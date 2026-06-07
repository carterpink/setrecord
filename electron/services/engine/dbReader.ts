/**
 * Engine DJ (Denon) library reader — produces a normalised {@link ImportPayload}
 * from an Engine `m.db`, converging on the shared `applyImport()` writer like the
 * Rekordbox and Serato readers.
 *
 * This is the INVERSE of the export side ({@link populateEngineDatabase} in
 * engineExport.ts), which is our only verified reference for the modern Engine
 * schema. Everything the export writes, we can read back with confidence:
 *
 *   • Track columns: length, bpm, bpmAnalyzed, year, path, filename, bitrate
 *   • MetaData (EAV text):     Title / Artist / Album / Genre / Comment / FileExtension
 *   • MetaDataInteger (EAV):   Rating (0–120 → 0–5 stars)
 *   • Playlist + PlaylistTrackList: title + ordered membership
 *
 * ⚠️ Deliberately NOT read (no verified reference — see capabilities.stability='beta'):
 *   • Musical key — stored as an opaque integer with no confirmed enum/encoding.
 *     Left blank ('') so the energy/key analyser fills it rather than risk a wrong
 *     Camelot value silently corrupting harmonic suggestions.
 *   • Cues / hot cues / loops / beatgrid — packed performance blobs the export
 *     skips entirely. Formally Planned for a future postImport() pass.
 *   • Playlist folder nesting — flattened to a single level for v1.
 */

import { existsSync } from 'fs'
import { basename, dirname, extname, isAbsolute, join } from 'path'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import type { AudioFormat, ImportProgress, Playlist, Track } from '../../../src/types'
import type { ImportPayload } from '../libraryImport'
import { MetaDataType, MetaDataIntegerType } from './engineSchema'

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

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

/**
 * Resolve an Engine `Track.path` to an absolute filesystem path. Engine stores
 * paths relative to the "Engine Library" directory (the parent of Database2);
 * exported drives keep m.db directly under "Engine Library". Best-effort — this
 * is one of the parts that needs validation against a real library.
 */
export function resolveEnginePath(rawPath: string, mDbPath: string): string {
  if (!rawPath) return ''
  if (isAbsolute(rawPath)) return rawPath
  const dbDir = dirname(mDbPath)
  // Desktop layout: <root>/Engine Library/Database2/m.db → base is <root>/Engine Library.
  // Exported layout: <root>/Engine Library/m.db          → base is that same dir.
  const root = basename(dbDir).toLowerCase() === 'database2' ? dirname(dbDir) : dbDir
  return join(root, rawPath)
}

interface EngineTrackRow {
  id: number
  length: number | null
  bpm: number | null
  bpmAnalyzed: number | null
  year: number | null
  path: string | null
  filename: string | null
  bitrate: number | null
}

/**
 * Read + normalise an Engine `m.db` into an ImportPayload.
 *
 * `existingIdsByPath` reuses our internal track ids by file_path so set_tracks
 * FKs survive a re-import — same contract as the Rekordbox/Serato readers.
 */
export async function readEngineLibrary(
  mDbPath: string,
  onProgress: (p: ImportProgress) => void,
  existingIdsByPath: Map<string, string>
): Promise<ImportPayload> {
  onProgress({ processed: 0, total: 0, phase: 'parsing' })
  await yieldToEventLoop()

  const db = new Database(mDbPath, { readonly: true, fileMustExist: true })
  try {
    // 1. EAV metadata, pre-loaded into per-track maps (one query each).
    const textByTrack = new Map<number, Map<number, string>>()
    for (const row of db.prepare('SELECT id, type, text FROM MetaData').all() as Array<{
      id: number
      type: number
      text: string | null
    }>) {
      if (row.text == null) continue
      let m = textByTrack.get(row.id)
      if (!m) {
        m = new Map()
        textByTrack.set(row.id, m)
      }
      m.set(row.type, row.text)
    }

    const intByTrack = new Map<number, Map<number, number>>()
    for (const row of db.prepare('SELECT id, type, value FROM MetaDataInteger').all() as Array<{
      id: number
      type: number
      value: number | null
    }>) {
      if (row.value == null) continue
      let m = intByTrack.get(row.id)
      if (!m) {
        m = new Map()
        intByTrack.set(row.id, m)
      }
      m.set(row.type, row.value)
    }

    // 2. Tracks.
    const trackRows = db
      .prepare(
        'SELECT id, length, bpm, bpmAnalyzed, year, path, filename, bitrate FROM Track ORDER BY id'
      )
      .all() as EngineTrackRow[]
    const total = trackRows.length
    onProgress({ processed: 0, total, phase: 'parsing' })

    const tracks: Track[] = []
    /** Engine Track.id → our internal UUID, for playlist membership. */
    const engineIdToTrackId = new Map<number, string>()
    const nowIso = new Date().toISOString()

    for (let i = 0; i < trackRows.length; i++) {
      const row = trackRows[i]
      const rawPath = row.path ?? ''
      if (!rawPath) continue // a track with no path is unusable
      const filePath = resolveEnginePath(rawPath, mDbPath)

      const text = textByTrack.get(row.id)
      const ints = intByTrack.get(row.id)
      const rating = ints?.get(MetaDataIntegerType.Rating)

      const id = existingIdsByPath.get(filePath) ?? randomUUID()
      engineIdToTrackId.set(row.id, id)

      tracks.push({
        id,
        source: 'engine',
        title: text?.get(MetaDataType.Title) ?? 'Unknown title',
        artist: text?.get(MetaDataType.Artist) ?? 'Unknown artist',
        album: text?.get(MetaDataType.Album),
        genre: text?.get(MetaDataType.Genre),
        bpm: row.bpm || row.bpmAnalyzed || 0,
        // Key intentionally left blank — see file header. Analyser fills it in.
        key: '',
        // No energy field in Engine — queue the background analyser.
        energy: 5,
        energySource: 'pending',
        duration: row.length ?? 0,
        filePath,
        bitrate: row.bitrate ?? undefined,
        format: parseFormat(filePath),
        // Cues/beatgrids are packed blobs — Planned, not decoded yet.
        cuePoints: [],
        hotCues: [],
        loops: [],
        playCount: 0,
        // Engine rating is 0–120 in steps of 20; back to 0–5 stars.
        rating: rating != null ? Math.round(rating / 20) : 0,
        dateAdded: nowIso,
        comment: text?.get(MetaDataType.Comment),
        missingFile: !existsSync(filePath)
      })

      if (i > 0 && i % 500 === 0) {
        onProgress({ processed: i, total, phase: 'parsing' })
        await yieldToEventLoop()
      }
    }

    // 3. Playlists (flat for v1) with ordered membership.
    const playlists = readEnginePlaylists(db, engineIdToTrackId)

    // 4. Engine has no gig-session concept we read in v1.
    return { tracks, playlists, sessions: [] }
  } finally {
    db.close()
  }
}

function readEnginePlaylists(
  db: Database.Database,
  engineIdToTrackId: Map<number, string>
): Playlist[] {
  const playlistRows = db.prepare('SELECT id, title FROM Playlist ORDER BY id').all() as Array<{
    id: number
    title: string | null
  }>

  const entryStmt = db.prepare(
    'SELECT trackId FROM PlaylistTrackList WHERE playlistId = ? ORDER BY trackNumber'
  )

  const playlists: Playlist[] = []
  for (const pl of playlistRows) {
    const entries = entryStmt.all(pl.id) as Array<{ trackId: number }>
    const trackIds: string[] = []
    for (const e of entries) {
      const internalId = engineIdToTrackId.get(e.trackId)
      if (internalId) trackIds.push(internalId) // entries to missing tracks are dropped
    }
    playlists.push({
      id: randomUUID(),
      name: pl.title ?? 'Untitled',
      parentId: null, // folder nesting flattened for v1
      trackIds,
      isFolder: false
    })
  }
  return playlists
}
