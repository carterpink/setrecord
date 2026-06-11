/**
 * Parse Serato's History database into the app's gig-session payload.
 *
 * Serato keeps per-session play history under `_Serato_/History/`:
 *
 *   History/history.database     index of sessions (one `oses` chunk each)
 *   History/Sessions/<id>.session  per-session track log (one `oent` per play)
 *
 * Both files use the same outer container as `database V2` (see chunks.ts),
 * but the `adat` payload inside each `oses`/`oent` chunk uses a different
 * inner encoding: a flat sequence of
 *
 *   [4-byte big-endian uint32 field id][4-byte big-endian uint32 length][payload]
 *
 * Known `oent` (track row) field ids — reverse-engineered by the Mixxx /
 * serato-tags community:
 *
 *   2  → file path (UTF-16BE, drive-relative like `pfil`)
 *   6  → title, 7 → artist (UTF-16BE)
 *   28 → start time (uint32, unix seconds)
 *   29 → end time   (uint32, unix seconds)
 *   50 → "played" flag (1 byte; Serato logs loaded-but-not-played rows too)
 *
 * Known `oses` (session index row) field ids:
 *
 *   1  → session id (uint32, matches `Sessions/<id>.session` filename)
 *   29 → session date (uint32, unix seconds)
 *
 * Everything is parsed defensively: unknown fields are skipped, a corrupt
 * session file is dropped with a console.error rather than sinking the import,
 * and a missing history.database just means dates fall back to each session's
 * earliest track start time.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { parseChunks, decodeUtf16BE, type SeratoChunk } from './chunks'
import { resolveSeratoPath } from './databaseReader'
import type { ImportPayload } from '../libraryImport'

// ───────── inner `adat` field stream ─────────

export interface AdatField {
  id: number
  payload: Buffer
}

/** Parse the `[u32 id][u32 len][payload]` field stream inside an `adat` chunk. */
export function parseAdatFields(buf: Buffer): AdatField[] {
  const out: AdatField[] = []
  let offset = 0
  while (offset + 8 <= buf.length) {
    const id = buf.readUInt32BE(offset)
    const length = buf.readUInt32BE(offset + 4)
    const start = offset + 8
    const end = start + length
    // Truncated/garbage length — stop rather than read past the buffer.
    if (end > buf.length) break
    out.push({ id, payload: Buffer.from(buf.subarray(start, end)) })
    offset = end
  }
  return out
}

/** Encode adat fields back to bytes (fixture-building inverse, like chunks.ts). */
export function encodeAdatFields(fields: AdatField[]): Buffer {
  return Buffer.concat(
    fields.map((f) => {
      const header = Buffer.alloc(8)
      header.writeUInt32BE(f.id, 0)
      header.writeUInt32BE(f.payload.length, 4)
      return Buffer.concat([header, f.payload])
    })
  )
}

const fieldText = (f: AdatField): string => decodeUtf16BE(f.payload).replace(/\0+$/, '')
const fieldU32 = (f: AdatField): number | undefined =>
  f.payload.length >= 4 ? f.payload.readUInt32BE(0) : undefined

/** Pull the raw `adat` payload out of a parsed `oses`/`oent` chunk. */
function adatOf(chunk: SeratoChunk): Buffer | undefined {
  return chunk.children?.find((c) => c.tag === 'adat')?.raw
}

const unixToIso = (secs: number | undefined): string | null => {
  // Reject 0 / absurd values rather than producing 1970 gigs.
  if (!secs || secs < 631152000 /* 1990-01-01 */ || secs > 4102444800 /* 2100 */) return null
  return new Date(secs * 1000).toISOString()
}

// ───────── session file (Sessions/<id>.session) ─────────

export interface SeratoSessionEntry {
  /** Drive-relative path, same convention as `pfil`/`ptrk`. */
  filePath: string
  /** ISO start time, if the row carried a sane timestamp. */
  startedAt: string | null
  /** Field 50 when present; undefined when the row doesn't carry the flag. */
  played?: boolean
}

/** Decode all `oent` track rows from a `.session` buffer, in file order. */
export function parseSessionFile(buf: Buffer): SeratoSessionEntry[] {
  const entries: SeratoSessionEntry[] = []
  for (const chunk of parseChunks(buf)) {
    if (chunk.tag !== 'oent') continue
    const adat = adatOf(chunk)
    if (!adat) continue
    const entry: SeratoSessionEntry = { filePath: '', startedAt: null }
    for (const f of parseAdatFields(adat)) {
      switch (f.id) {
        case 2:
          entry.filePath = fieldText(f)
          break
        case 28:
          entry.startedAt = unixToIso(fieldU32(f))
          break
        case 50:
          entry.played = f.payload.length >= 1 ? f.payload.readUInt8(0) !== 0 : false
          break
      }
    }
    if (entry.filePath) entries.push(entry)
  }
  return entries
}

// ───────── session index (history.database) ─────────

/** Map of session id → ISO date, from `history.database`. Defensive: partial on garbage. */
export function parseHistoryDatabase(buf: Buffer): Map<number, string> {
  const dates = new Map<number, string>()
  for (const chunk of parseChunks(buf)) {
    if (chunk.tag !== 'oses') continue
    const adat = adatOf(chunk)
    if (!adat) continue
    let id: number | undefined
    let date: string | null = null
    for (const f of parseAdatFields(adat)) {
      if (f.id === 1) id = fieldU32(f)
      else if (f.id === 29) date = unixToIso(fieldU32(f))
    }
    if (id !== undefined && date) dates.set(id, date)
  }
  return dates
}

// ───────── high-level reader ─────────

/** `_Serato_/History` dir for a library folder. */
export function historyDir(seratoDir: string): string {
  return join(seratoDir, 'History')
}

/**
 * Read every Serato history session and resolve its plays to internal track
 * ids. Mirrors the Rekordbox HISTORY parse: unresolvable refs are dropped,
 * empty sessions are filtered by the caller.
 *
 * @param byAbsPath  absolute file path → internal track id (from the import).
 * @param resolvePath drive-relative → absolute resolver (injectable for tests).
 */
export function readSeratoHistory(
  seratoDir: string,
  byAbsPath: Map<string, string>,
  resolvePath: (p: string) => string = resolveSeratoPath
): ImportPayload['sessions'] {
  const dir = historyDir(seratoDir)
  const sessionsDir = join(dir, 'Sessions')
  if (!existsSync(sessionsDir)) return []

  // Session dates from the index, when readable.
  let dates = new Map<number, string>()
  try {
    const indexPath = join(dir, 'history.database')
    if (existsSync(indexPath)) dates = parseHistoryDatabase(readFileSync(indexPath))
  } catch (err) {
    console.error('[serato] history.database parse failed', err)
  }

  const sessions: ImportPayload['sessions'] = []
  for (const file of readdirSync(sessionsDir)) {
    if (!file.toLowerCase().endsWith('.session')) continue
    const filePath = join(sessionsDir, file)
    try {
      const entries = parseSessionFile(readFileSync(filePath))

      // Serato also logs loaded-but-never-played decks; keep only confirmed
      // plays when the flag exists, all rows when this Serato version omits it.
      const hasFlag = entries.some((e) => e.played !== undefined)
      const played = hasFlag ? entries.filter((e) => e.played === true) : entries

      const sessionId = Number.parseInt(basename(file, '.session'), 10)
      const starts = played.map((e) => e.startedAt).filter((s): s is string => s !== null)
      const performedAt =
        (Number.isFinite(sessionId) ? dates.get(sessionId) : undefined) ??
        (starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null) ??
        statSync(filePath).mtime.toISOString()

      const trackIds: string[] = []
      for (const e of played) {
        const id = byAbsPath.get(resolvePath(e.filePath))
        if (id) trackIds.push(id)
      }

      sessions.push({
        name: `Serato ${performedAt.slice(0, 10)}`,
        performedAt,
        venue: null,
        trackIds
      })
    } catch (err) {
      console.error('[serato] failed to parse session file', file, err)
    }
  }

  // Oldest first, matching Rekordbox history ordering.
  sessions.sort((a, b) => (a.performedAt ?? '').localeCompare(b.performedAt ?? ''))
  return sessions
}
