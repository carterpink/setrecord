import { extname } from 'path'
import { readFileSync } from 'fs'
import { parseStringPromise } from 'xml2js'
import type { AudioFormat, ImportProgress, ImportResult, Track } from '../../src/types'
import { openNotationToCamelot } from '../utils/camelot'
import { getDb } from '../db/schema'
import { batchInsertTracks, getLibraryStats } from '../db/queries'

// Yield back to the Node.js event loop so Chromium can flush queued IPC messages.
// Without this, webContents.send() calls accumulate but are never delivered to the
// renderer until the entire handler returns — making the progress bar stay at 0%.
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

// ───────── Field mapping helpers ─────────

function parseLocation(raw: string): string {
  // Rekordbox encodes paths as file://localhost/… or file:///…
  return decodeURIComponent(
    raw
      .replace(/^file:\/\/localhost/, '')
      .replace(/^file:\/\/\//, '/')
  )
}

function parseFormat(filePath: string): AudioFormat {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, AudioFormat> = {
    '.mp3': 'mp3',
    '.aiff': 'aiff',
    '.aif': 'aiff',
    '.wav': 'wav',
    '.flac': 'flac',
    '.m4a': 'm4a',
  }
  return map[ext] ?? 'unknown'
}

function parseRating(raw: string | undefined): number {
  if (!raw) return 0
  // Rekordbox uses 0-255; normalise to 0-5
  return Math.round(parseInt(raw, 10) / 51)
}

function parseCuePoints(marks: unknown[]): { cuePoints: Track['cuePoints']; hotCues: Track['hotCues'] } {
  const cuePoints: Track['cuePoints'] = []
  const hotCues: Track['hotCues'] = []

  for (const mark of marks ?? []) {
    const m = (mark as { $: Record<string, string> }).$
    if (!m) continue
    const position = parseFloat(m.Start ?? '0') * 1000 // seconds → ms
    const type = m.Type ?? '0'

    if (type === '0') {
      cuePoints.push({ position, type: 'memory' })
    } else if (type === '1') {
      cuePoints.push({ position, type: 'cue' })
    } else {
      // Hot cue (type "3" in Rekordbox XML)
      const index = parseInt(m.Num ?? '0', 10)
      hotCues.push({
        index,
        position,
        color: m.Red && m.Green && m.Blue
          ? `rgb(${m.Red},${m.Green},${m.Blue})`
          : undefined,
      })
    }
  }

  return { cuePoints, hotCues }
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

  const collection: unknown[] =
    parsed?.DJ_PLAYLISTS?.COLLECTION?.[0]?.TRACK ?? []

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
  const PARSE_YIELD_EVERY = 500

  for (let i = 0; i < total; i++) {
    try {
      const item = collection[i] as { $?: Record<string, string>; POSITION_MARK?: unknown[] }
      const t = item.$
      if (!t?.Location) continue

      const filePath = parseLocation(t.Location)
      const { cuePoints, hotCues } = parseCuePoints(item.POSITION_MARK ?? [])

      tracks.push({
        id: crypto.randomUUID(),
        rekordboxId: t.TrackID,
        title: t.Name ?? 'Unknown title',
        artist: t.Artist ?? 'Unknown artist',
        album: t.Album || undefined,
        genre: t.Genre || undefined,
        bpm: parseFloat(t.AverageBpm ?? '0'),
        key: openNotationToCamelot(t.Tonality ?? '') ?? '',
        keyOpenNotation: t.Tonality || undefined,
        // Rekordbox's Energy tag is discarded — the background analyser computes
        // a real score from loudness + BPM. 5 is a neutral placeholder until then.
        energy: 5,
        energySource: 'pending',
        duration: parseFloat(t.TotalTime ?? '0'),
        filePath,
        fileSize: t.Size ? parseInt(t.Size, 10) : undefined,
        bitrate: t.BitRate ? parseInt(t.BitRate, 10) : undefined,
        format: parseFormat(filePath),
        cuePoints,
        hotCues,
        beatgridOffset: undefined,
        playCount: parseInt(t.PlayCount ?? '0', 10),
        rating: parseRating(t.Rating),
        dateAdded: t.DateAdded ? new Date(t.DateAdded).toISOString() : new Date().toISOString(),
        comment: t.Comments || undefined,
        label: t.Label || undefined,
        color: t.Colour || undefined,
        missingFile: false, // health check will update this right after import
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

  // 3. Batch write to SQLite with yield between batches.
  // batchInsertTracks (from queries.ts) handles all columns including missing_file.
  const BATCH = 100

  for (let i = 0; i < tracks.length; i += BATCH) {
    batchInsertTracks(db, tracks.slice(i, i + BATCH))
    onProgress({ processed: Math.min(i + BATCH, tracks.length), total, phase: 'writing' })
    await yieldToEventLoop()
  }

  onProgress({ processed: total, total, phase: 'done' })
  await yieldToEventLoop()

  const stats = getLibraryStats(db)
  return { total, inserted: tracks.length, errors, missingFiles: 0, stats }
}
