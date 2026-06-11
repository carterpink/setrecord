import { extname } from 'path'
import { readFileSync } from 'fs'
import { parseStringPromise } from 'xml2js'
import type { AudioFormat, ImportProgress, ImportResult, Playlist, Track } from '../../src/types'
import { openNotationToCamelot } from '../utils/camelot'
import { getDb } from '../db/schema'
import {
  batchInsertTracks,
  getExistingTrackIdsByPath,
  getLibraryStats,
  replaceAllPlaylists,
  replaceImportedSessions
} from '../db/queries'
import { parseSessionMeta } from './rekordbox/sessionMeta'

/**
 * Normalised payload produced by any library source (XML, master.db, future
 * sources). `applyImport()` consumes it and writes to our SQLite — both the
 * XML parser and the Rekordbox DB reader converge here.
 *
 * Tracks must already have their final ids — callers reuse existing ids by
 * file_path (via `getExistingTrackIdsByPath`) so `set_tracks` FKs stay valid
 * across re-imports. Playlist/session trackIds must reference those same ids.
 */
export interface ImportPayload {
  tracks: Track[]
  playlists: Playlist[]
  /** Which importer owns `sessions` (defaults to 'rekordbox'). */
  sessionSource?: 'rekordbox' | 'serato'
  sessions: Array<{
    name: string
    performedAt: string | null
    venue: string | null
    venueSource?: 'auto' | 'user'
    trackIds: string[]
  }>
}

// Yield back to the Node.js event loop so Chromium can flush queued IPC messages.
// Without this, webContents.send() calls accumulate but are never delivered to the
// renderer until the entire handler returns — making the progress bar stay at 0%.
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

// ───────── Field mapping helpers ─────────

function parseLocation(raw: string): string {
  // Rekordbox encodes paths as file://localhost/… or file:///…
  return decodeURIComponent(raw.replace(/^file:\/\/localhost/, '').replace(/^file:\/\/\//, '/'))
}

function parseFormat(filePath: string): AudioFormat {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, AudioFormat> = {
    '.mp3': 'mp3',
    '.aiff': 'aiff',
    '.aif': 'aiff',
    '.wav': 'wav',
    '.flac': 'flac',
    '.m4a': 'm4a'
  }
  return map[ext] ?? 'unknown'
}

function parseRating(raw: string | undefined): number {
  if (!raw) return 0
  // Rekordbox uses 0-255; normalise to 0-5
  return Math.round(parseInt(raw, 10) / 51)
}

// ───────── Playlist tree parsing ─────────

interface XmlNode {
  $?: Record<string, string>
  NODE?: XmlNode[]
  TRACK?: Array<{ $?: Record<string, string> }>
}

/**
 * Walk the Rekordbox PLAYLISTS NODE tree.
 *
 * Rekordbox encodes the tree as:
 *   <PLAYLISTS><NODE Type="0" Name="ROOT" Count="N">  ← always one root folder
 *     <NODE Type="0" Name="Folder">                   ← nested folder
 *       <NODE Type="1" Name="My Playlist">            ← leaf playlist
 *         <TRACK Key="123"/>
 *       </NODE>
 *     </NODE>
 *   </NODE></PLAYLISTS>
 *
 * We skip the synthetic ROOT and emit every node beneath it. `Key` on TRACK
 * entries references TrackID from COLLECTION, which we mapped to internal
 * UUIDs during track insert.
 */
function parsePlaylistTree(
  root: XmlNode | undefined,
  rekordboxIdToTrackId: Map<string, string>
): Playlist[] {
  if (!root) return []
  const out: Playlist[] = []

  function visit(node: XmlNode, parentId: string | null): void {
    const attrs = node.$ ?? {}
    const type = attrs.Type ?? '0'
    const name = attrs.Name ?? 'Untitled'
    const rekordboxId = attrs.KeyType ?? attrs.Entries // not a stable id, but a hint
    const isFolder = type === '0'

    const id = crypto.randomUUID()
    const trackIds: string[] = []

    if (!isFolder && node.TRACK) {
      for (const entry of node.TRACK) {
        const key = entry.$?.Key
        if (!key) continue
        const internalId = rekordboxIdToTrackId.get(key)
        if (internalId) trackIds.push(internalId)
        // Entries that don't map (track missing from COLLECTION) are silently dropped.
      }
    }

    out.push({
      id,
      rekordboxId: rekordboxId || undefined,
      name,
      parentId,
      trackIds,
      isFolder
    })

    for (const child of node.NODE ?? []) {
      visit(child, id)
    }
  }

  // Skip the synthetic ROOT — its children are the real top-level entries.
  for (const child of root.NODE ?? []) {
    visit(child, null)
  }

  return out
}

function parseCuePoints(marks: unknown[]): {
  cuePoints: Track['cuePoints']
  hotCues: Track['hotCues']
  loops: NonNullable<Track['loops']>
} {
  const cuePoints: Track['cuePoints'] = []
  const hotCues: Track['hotCues'] = []
  const loops: NonNullable<Track['loops']> = []

  for (const mark of marks ?? []) {
    const m = (mark as { $: Record<string, string> }).$
    if (!m) continue
    const position = parseFloat(m.Start ?? '0') * 1000 // seconds → ms
    const type = m.Type ?? '0'
    // Rekordbox encodes a saved loop as a mark with an End attribute (Type "4").
    const hasEnd = m.End !== undefined && m.End !== ''

    if (hasEnd || type === '4') {
      loops.push({ startMs: position, endMs: parseFloat(m.End ?? '0') * 1000 })
    } else if (type === '0') {
      cuePoints.push({ position, type: 'memory' })
    } else if (type === '1') {
      cuePoints.push({ position, type: 'cue' })
    } else {
      // Hot cue (type "3" in Rekordbox XML)
      const index = parseInt(m.Num ?? '0', 10)
      hotCues.push({
        index,
        position,
        color: m.Red && m.Green && m.Blue ? `rgb(${m.Red},${m.Green},${m.Blue})` : undefined
      })
    }
  }

  return { cuePoints, hotCues, loops }
}

/**
 * First-downbeat anchor (ms) from the Rekordbox `<TEMPO>` grid. Inizio is the
 * time of the first beat in seconds; we take the earliest TEMPO marker so the
 * constant-tempo grid lines up with Rekordbox.
 */
function parseBeatgridOffset(tempos: unknown[] | undefined): number | undefined {
  if (!tempos || tempos.length === 0) return undefined
  const first = (tempos[0] as { $?: Record<string, string> })?.$
  if (!first?.Inizio) return undefined
  const inizio = parseFloat(first.Inizio)
  return Number.isFinite(inizio) ? inizio * 1000 : undefined
}

// ───────── Rekordbox history parsing ─────────

/**
 * Result returned by history-parsing routines so callers can report progress.
 */
export interface HistoryImportResult {
  sessions: number
  tracks: number
}

const MONTH_NAMES: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12'
}

/**
 * Attempt to parse a date from a Rekordbox history playlist name.
 *
 * Rekordbox names history session playlists with dates, but the exact format
 * varies by version and locale. Formats this handles (verified by unit test):
 *   "2024-05-18" / "2024/05/18"      → ISO, the Rekordbox default
 *   "2024-05-18 Club Night"          → ISO with trailing text
 *   "18.05.2024"                     → European dot-separated (D.M.Y)
 *   "May 18, 2024" / "18 May 2024"   → English month name
 *
 * Deliberately NOT handled (ambiguous or unobserved): purely numeric US
 * "5/18/24" — D/M vs M/D cannot be told apart from European D/M, so guessing
 * risks silently storing the wrong gig date.
 *
 * Returns an ISO date string (YYYY-MM-DD) or null when no date is found.
 */
function parseDateFromPlaylistName(name: string): string | null {
  // ISO / dash- or slash-separated: 2024-05-18 (optionally followed by extra text)
  const isoMatch = name.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  // European dot-separated: 18.05.2024
  const euroMatch = name.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (euroMatch) return `${euroMatch[3]}-${euroMatch[2]}-${euroMatch[1]}`

  // English month name: "May 18, 2024" or "18 May 2024".
  const monthName = name.match(
    /(?:([A-Za-z]{3,9})\.?\s+(\d{1,2})|(\d{1,2})\s+([A-Za-z]{3,9}))[,.]?\s+(\d{4})/
  )
  if (monthName) {
    const monthWord = (monthName[1] ?? monthName[4] ?? '').slice(0, 3).toLowerCase()
    const day = monthName[2] ?? monthName[3]
    const month = MONTH_NAMES[monthWord]
    if (month && day) {
      return `${monthName[5]}-${month}-${day.padStart(2, '0')}`
    }
  }

  return null
}

/**
 * Detect whether a NODE is the HISTORY folder.
 *
 * Rekordbox typically places all gig history under a root-level folder named
 * "HISTORY" (Type="0"). Some versions may use different capitalisation or
 * localised names — we check for "history" case-insensitively as a fallback.
 *
 * ASSUMPTION: We assume the HISTORY folder is a direct child of the root NODE
 * (one level below the synthetic ROOT). Nested history folders are not handled.
 * Verify against a real Rekordbox XML export.
 */
function isHistoryNode(node: XmlNode): boolean {
  const name = (node.$ ?? {}).Name ?? ''
  return name.toLowerCase() === 'history' && (node.$ ?? {}).Type === '0'
}

/**
 * Walk a history folder NODE and emit session descriptors.
 *
 * Each direct child of the HISTORY folder is assumed to be a leaf playlist
 * (Type="1") representing one gig session. Its TRACK entries reference
 * Rekordbox TrackIDs which are resolved to internal UUIDs via rekordboxIdToTrackId.
 *
 * ASSUMPTION: History child nodes are always leaf playlists (not sub-folders).
 * If a user has sub-folders inside HISTORY (e.g. by year), they will be skipped.
 * Verify this against a real export.
 *
 * @param historyNode  The HISTORY folder XmlNode
 * @param rekordboxIdToTrackId  Map built during track import — Rekordbox TrackID → internal UUID
 */
function parseHistoryNode(
  historyNode: XmlNode,
  rekordboxIdToTrackId: Map<string, string>
): Array<{
  name: string
  performedAt: string | null
  venue: string | null
  venueSource?: 'auto' | 'user'
  trackIds: string[]
}> {
  const sessions: Array<{
    name: string
    performedAt: string | null
    venue: string | null
    venueSource?: 'auto' | 'user'
    trackIds: string[]
  }> = []

  // Guard: historyNode.NODE may be absent if HISTORY folder is empty
  const children = historyNode.NODE ?? []
  for (const child of children) {
    const attrs = child.$ ?? {}
    // Only process leaf playlists (Type="1"); skip any unexpected sub-folders
    if (attrs.Type !== '1') {
      console.log('[history] skipping non-leaf node inside HISTORY:', attrs.Name)
      continue
    }

    const name = attrs.Name ?? 'Unknown Session'
    const performedAt = parseDateFromPlaylistName(name)

    const trackIds: string[] = []
    // Guard: TRACK array may be absent on empty playlists
    for (const entry of child.TRACK ?? []) {
      const key = entry.$?.Key
      if (!key) continue
      const internalId = rekordboxIdToTrackId.get(key)
      if (internalId) {
        trackIds.push(internalId)
      }
      // Tracks not in the collection map are silently dropped (track removed from library)
    }

    const meta = parseSessionMeta(name)
    sessions.push({ name, performedAt, venue: meta.venue, venueSource: meta.source, trackIds })
  }

  return sessions
}

/**
 * Parse an entire Rekordbox XML document for HISTORY sessions.
 * Handles both "main collection XML that contains a HISTORY node" and
 * "dedicated history export" — the XML shape is the same in both cases.
 *
 * Returns { sessions, tracks } counts for the caller to report.
 * Never throws — all errors are caught and logged; returns zeros on failure.
 */
async function parseHistoryXml(
  xmlPath: string,
  rekordboxIdToTrackId: Map<string, string>
): Promise<HistoryImportResult> {
  const db = getDb()
  try {
    const xml = readFileSync(xmlPath, 'utf-8')
    const parsed = await parseStringPromise(xml, { explicitArray: true })

    // Navigate to the PLAYLISTS root node (same structure as collection XML)
    const playlistRoot = parsed?.DJ_PLAYLISTS?.PLAYLISTS?.[0] as XmlNode | undefined
    if (!playlistRoot) {
      console.log('[history] no PLAYLISTS node found in', xmlPath)
      return { sessions: 0, tracks: 0 }
    }

    // Find the HISTORY folder among the root's direct children
    const rootChildren: XmlNode[] = playlistRoot.NODE ?? []
    const historyNode = rootChildren.find(isHistoryNode)

    if (!historyNode) {
      console.log('[history] no HISTORY folder found in', xmlPath, '— skipping history import')
      return { sessions: 0, tracks: 0 }
    }

    const sessions = parseHistoryNode(historyNode, rekordboxIdToTrackId)

    // Filter out sessions with no resolvable tracks (entirely unknown collection)
    const nonEmpty = sessions.filter((s) => s.trackIds.length > 0)

    console.log(
      `[history] parsed ${sessions.length} session(s) from HISTORY (${nonEmpty.length} non-empty, ` +
        `${nonEmpty.reduce((n, s) => n + s.trackIds.length, 0)} total track refs)`
    )

    if (nonEmpty.length > 0) {
      replaceImportedSessions(db, 'rekordbox', nonEmpty)
    }

    return {
      sessions: nonEmpty.length,
      tracks: nonEmpty.reduce((n, s) => n + s.trackIds.length, 0)
    }
  } catch (err) {
    console.error('[history] parseHistoryXml failed', err)
    return { sessions: 0, tracks: 0 }
  }
}

/**
 * Standalone "import a history file" path — for Rekordbox history XML exports
 * that were saved separately from the main collection XML.
 *
 * Because this file may reference tracks not yet in the DB, we build
 * rekordboxIdToTrackId from the existing tracks table (keyed on rekordbox_id).
 */
export async function importHistoryFile(xmlPath: string): Promise<HistoryImportResult> {
  const db = getDb()

  // Build the rekordboxId → internalId map from the existing tracks table
  const rows = db
    .prepare('SELECT id, rekordbox_id FROM tracks WHERE rekordbox_id IS NOT NULL')
    .all() as Array<{ id: string; rekordbox_id: string }>
  const rekordboxIdToTrackId = new Map<string, string>()
  for (const row of rows) {
    rekordboxIdToTrackId.set(row.rekordbox_id, row.id)
  }

  return parseHistoryXml(xmlPath, rekordboxIdToTrackId)
}

// ───────── Shared writer (both XML and master.db paths feed this) ─────────

/**
 * Write a fully-built `ImportPayload` into the SetRecord library DB.
 *
 * Steps:
 *  1. Batch insert/upsert tracks (preserves `set_tracks` FKs via ON CONFLICT).
 *  2. Replace playlist tree wholesale (source is authoritative).
 *  3. Replace Rekordbox sessions wholesale (source is authoritative).
 *  4. Return ImportResult including final LibraryStats.
 *
 * Progress events are emitted on the 'writing' phase. Callers should already
 * have emitted 'parsing' events upstream.
 */
export async function applyImport(
  payload: ImportPayload,
  onProgress: (p: ImportProgress) => void
): Promise<ImportResult> {
  const db = getDb()
  const total = payload.tracks.length

  // 1. Batch write tracks.
  const BATCH = 100
  for (let i = 0; i < payload.tracks.length; i += BATCH) {
    batchInsertTracks(db, payload.tracks.slice(i, i + BATCH))
    onProgress({
      processed: Math.min(i + BATCH, payload.tracks.length),
      total,
      phase: 'writing'
    })
    await yieldToEventLoop()
  }

  // 2. Replace playlist tree. Non-fatal: tracks are already imported.
  try {
    if (payload.playlists.length > 0) {
      replaceAllPlaylists(db, payload.playlists)
    } else {
      // Empty playlists array is a deliberate "no playlists in source" signal;
      // wipe any stale tree from a prior import.
      replaceAllPlaylists(db, [])
    }
  } catch (err) {
    console.error('[import] playlist write failed', err)
  }

  // 3. Replace history sessions. Non-fatal.
  try {
    const nonEmpty = payload.sessions.filter((s) => s.trackIds.length > 0)
    if (nonEmpty.length > 0) {
      replaceImportedSessions(db, payload.sessionSource ?? 'rekordbox', nonEmpty)
    }
  } catch (err) {
    console.error('[import] session write failed', err)
  }

  onProgress({ processed: total, total, phase: 'done' })
  await yieldToEventLoop()

  const stats = getLibraryStats(db)
  return { total, inserted: payload.tracks.length, errors: 0, missingFiles: 0, stats }
}

// ───────── Main export ─────────

export async function importFromXml(
  xmlPath: string,
  onProgress: (p: ImportProgress) => void
): Promise<ImportResult> {
  const db = getDb()
  let errors = 0

  // Signal immediately that we've started so the modal transitions from idle.
  // The yield lets Chromium flush this IPC message before we block on disk I/O.
  onProgress({ processed: 0, total: 0, phase: 'parsing' })
  await yieldToEventLoop()

  // 1. Read + parse XML
  const xml = readFileSync(xmlPath, 'utf-8')
  const parsed = await parseStringPromise(xml, { explicitArray: true })

  const collection: unknown[] = parsed?.DJ_PLAYLISTS?.COLLECTION?.[0]?.TRACK ?? []

  const total: number = collection.length
  onProgress({ processed: 0, total, phase: 'parsing' })
  await yieldToEventLoop()

  if (total === 0) {
    onProgress({ processed: 0, total: 0, phase: 'done' })
    const stats = getLibraryStats(db)
    return { total: 0, inserted: 0, errors: 0, missingFiles: 0, stats }
  }

  // 2. Map Rekordbox fields → Track objects.
  // We intentionally skip existsSync here — checking 10k files synchronously on
  // an external drive blocks the event loop for seconds. The background health
  // check (scheduleHealthCheck in main.ts) runs immediately after import and
  // flags any missing files without blocking the UI.
  const tracks: Track[] = []
  // Rekordbox TrackID → internal UUID. Used after track insert to resolve playlist entries.
  const rekordboxIdToTrackId = new Map<string, string>()
  // Existing tracks by file_path — reuse their ids on re-import so set_tracks FKs stay valid.
  const existingIdsByPath = getExistingTrackIdsByPath(db)
  const PARSE_YIELD_EVERY = 500

  for (let i = 0; i < total; i++) {
    try {
      const item = collection[i] as {
        $?: Record<string, string>
        POSITION_MARK?: unknown[]
        TEMPO?: unknown[]
      }
      const t = item.$
      if (!t?.Location) continue

      const filePath = parseLocation(t.Location)
      const { cuePoints, hotCues, loops } = parseCuePoints(item.POSITION_MARK ?? [])
      const beatgridOffset = parseBeatgridOffset(item.TEMPO)

      // Reuse the existing id when this file_path is already in the DB; otherwise mint a fresh one.
      // Paired with INSERT ... ON CONFLICT(file_path) DO UPDATE in queries.ts, this preserves
      // saved-set references across re-imports and resolves playlist track entries correctly.
      const trackId = existingIdsByPath.get(filePath) ?? crypto.randomUUID()
      if (t.TrackID) rekordboxIdToTrackId.set(t.TrackID, trackId)
      tracks.push({
        id: trackId,
        rekordboxId: t.TrackID,
        title: t.Name ?? 'Unknown title',
        artist: t.Artist ?? 'Unknown artist',
        album: t.Album || undefined,
        genre: t.Genre || undefined,
        bpm: parseFloat(t.AverageBpm ?? '0'),
        key: openNotationToCamelot(t.Tonality ?? '') ?? '',
        keyOpenNotation: t.Tonality || undefined,
        // Prefer Rekordbox's own Energy tag (1-10); if absent/invalid, queue the
        // background ffmpeg analyser to compute it from loudness + BPM instead.
        energy: (() => {
          const v = parseInt(t.Energy ?? '', 10)
          return v >= 1 && v <= 10 ? v : 5
        })(),
        energySource: (() => {
          const v = parseInt(t.Energy ?? '', 10)
          return v >= 1 && v <= 10 ? 'rekordbox' : 'pending'
        })() as import('../../src/types').EnergySource,
        duration: parseFloat(t.TotalTime ?? '0'),
        filePath,
        fileSize: t.Size ? parseInt(t.Size, 10) : undefined,
        bitrate: t.BitRate ? parseInt(t.BitRate, 10) : undefined,
        format: parseFormat(filePath),
        cuePoints,
        hotCues,
        loops,
        beatgridOffset,
        playCount: parseInt(t.PlayCount ?? '0', 10),
        rating: parseRating(t.Rating),
        dateAdded: t.DateAdded ? new Date(t.DateAdded).toISOString() : new Date().toISOString(),
        comment: t.Comments || undefined,
        label: t.Label || undefined,
        color: t.Colour || undefined,
        missingFile: false // health check will update this right after import
      })
    } catch {
      errors++
    }

    // Yield periodically during the parse loop so the event loop stays responsive
    if (i > 0 && i % PARSE_YIELD_EVERY === 0) {
      onProgress({ processed: i, total, phase: 'parsing' })
      await yieldToEventLoop()
    }
  }

  // 3. Build playlist + history payloads now that we have the rekordbox-id map.
  const playlistRoot = parsed?.DJ_PLAYLISTS?.PLAYLISTS?.[0] as XmlNode | undefined
  let playlists: Playlist[] = []
  try {
    playlists = parsePlaylistTree(playlistRoot, rekordboxIdToTrackId)
  } catch (err) {
    console.error('[import] playlist parsing failed', err)
  }

  let sessions: ImportPayload['sessions'] = []
  try {
    if (playlistRoot) {
      const rootChildren: XmlNode[] = playlistRoot.NODE ?? []
      const historyNode = rootChildren.find(isHistoryNode)
      if (historyNode) {
        const parsedSessions = parseHistoryNode(historyNode, rekordboxIdToTrackId)
        sessions = parsedSessions.filter((s) => s.trackIds.length > 0)
        console.log(
          `[import] HISTORY: ${parsedSessions.length} session(s), ${sessions.length} non-empty, ` +
            `${sessions.reduce((n, s) => n + s.trackIds.length, 0)} track refs`
        )
      } else {
        console.log('[import] no HISTORY folder in XML — skipping history import')
      }
    }
  } catch (err) {
    console.error('[import] history parsing failed', err)
  }

  // 4. Hand off to the shared writer.
  const result = await applyImport({ tracks, playlists, sessions }, onProgress)
  return { ...result, errors }
}
