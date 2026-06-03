import { extname, normalize } from 'path'
import { openMasterDb } from './cipher'
import { parseSessionMeta } from './sessionMeta'
import { openNotationToCamelot } from '../../utils/camelot'
import type { AudioFormat, ImportProgress, Playlist, Track } from '../../../src/types'

export interface RekordboxImportPayload {
  tracks: Track[]
  playlists: Playlist[]
  sessions: Array<{
    name: string
    performedAt: string | null
    venue: string | null
    venueSource?: 'auto' | 'user'
    trackIds: string[]
  }>
}

/** Test seam — split out for unit tests that don't open a real cipher. */
export interface RawContentRow {
  ID: string
  Title: string | null
  ArtistName: string | null
  AlbumName: string | null
  GenreName: string | null
  KeyName: string | null
  LabelName: string | null
  /** Rekordbox 6: foreign key to djmdColor.Name. Rekordbox 7: foreign key resolved via colorMap. */
  ColorID: string | null
  BPM: number | null
  Length: number | null
  FolderPath: string | null
  FileNameL: string | null
  FileSize: number | null
  BitRate: number | null
  Rating: number | null
  DJPlayCount: number | null
  Commnt: string | null
  StockDate: string | null
  created_at: string | null
}

export interface RawCueRow {
  ContentID: string
  Kind: number
  InMsec: number | null
  /** Packed 0xRRGGBB int — Rekordbox stores hot-cue colour as 24-bit. */
  Color: number | null
  /** Hot-cue bank index (0-7). Null for memory cues. */
  ActiveLoop: number | null
}

export interface RawPlaylistRow {
  ID: string
  Name: string | null
  Attribute: number
  ParentID: string | null
}

export interface RawSongPlaylistRow {
  PlaylistID: string
  ContentID: string
  TrackNo: number | null
}

export interface RawHistoryRow {
  ID: string
  Name: string | null
  DateCreated: string | null
}

export interface RawSongHistoryRow {
  HistoryID: string
  ContentID: string
  TrackNo: number | null
}

/**
 * Read the entire Rekordbox library from a decrypted master.db, mapping
 * everything to the same shapes the XML import produces. The caller passes
 * the result through `applyImport()` in libraryImport.ts — both the XML and
 * DB paths converge on the same writer.
 *
 * Pass `existingIdsByPath` (from `getExistingTrackIdsByPath` in queries.ts) so
 * we reuse internal track UUIDs across re-syncs and keep `set_tracks` foreign
 * keys valid. Tests pass an empty Map and get fresh UUIDs.
 *
 * Progress events fire during the parse loop; the write loop is the caller's
 * responsibility.
 */
export async function readMasterDb(
  path: string,
  onProgress: (p: ImportProgress) => void,
  existingIdsByPath: Map<string, string> = new Map()
): Promise<RekordboxImportPayload> {
  onProgress({ processed: 0, total: 0, phase: 'parsing' })
  const db = await openMasterDb(path)

  try {
    // Pre-count for a useful progress total.
    const totalRow = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM djmdContent`)
    const total = totalRow?.n ?? 0
    onProgress({ processed: 0, total, phase: 'parsing' })

    if (total === 0) {
      return { tracks: [], playlists: [], sessions: [] }
    }

    // ── Colours ───────────────────────────────────────────────────────────
    // Rekordbox 6 stores colour names in djmdColor.Name; Rekordbox 7 renamed
    // the column to Commnt. Fetch them separately so the main query stays
    // schema-agnostic and never throws on a missing column.
    const colorMap = await fetchColorMap(db)

    // ── Tracks ────────────────────────────────────────────────────────────
    // One big LEFT JOIN — Rekordbox keeps track metadata normalised, but on a
    // 10k-track library this is still a single sub-second query.
    const contentRows = await db.all<RawContentRow>(`
      SELECT
        c.ID                  AS ID,
        c.Title               AS Title,
        a.Name                AS ArtistName,
        al.Name               AS AlbumName,
        g.Name                AS GenreName,
        k.ScaleName           AS KeyName,
        l.Name                AS LabelName,
        c.ColorID             AS ColorID,
        c.BPM                 AS BPM,
        c.Length              AS Length,
        c.FolderPath          AS FolderPath,
        c.FileNameL           AS FileNameL,
        c.FileSize            AS FileSize,
        c.BitRate             AS BitRate,
        c.Rating              AS Rating,
        c.DJPlayCount         AS DJPlayCount,
        c.Commnt              AS Commnt,
        c.StockDate           AS StockDate,
        c.created_at          AS created_at
      FROM djmdContent c
      LEFT JOIN djmdArtist a  ON a.ID  = c.ArtistID
      LEFT JOIN djmdAlbum  al ON al.ID = c.AlbumID
      LEFT JOIN djmdGenre  g  ON g.ID  = c.GenreID
      LEFT JOIN djmdKey    k  ON k.ID  = c.KeyID
      LEFT JOIN djmdLabel  l  ON l.ID  = c.LabelID
      WHERE c.rb_local_deleted IS NULL OR c.rb_local_deleted = 0
    `)

    // ── Cues ──────────────────────────────────────────────────────────────
    // Pull all cues in one shot then bucket per content ID. Avoids N+1.
    let cueRows: RawCueRow[] = []
    try {
      cueRows = await db.all<RawCueRow>(`
        SELECT ContentID, Kind, InMsec, Color, ActiveLoop
        FROM djmdCue
        WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0
      `)
    } catch (err) {
      // Some Rekordbox versions use slightly different cue table shapes —
      // keep going without cues rather than aborting the whole import.
      console.warn('[rekordbox] djmdCue read failed; importing without cues', err)
    }
    const cuesByContent = bucketCuesByContent(cueRows)

    // ── Map to Track[] ────────────────────────────────────────────────────
    // Track IDs reuse existing UUIDs when a matching file_path is already in
    // our DB (same trick as the XML path) — that's what keeps set_tracks FKs
    // valid across a re-sync.
    const tracks: Track[] = []
    // Rekordbox ID → internal UUID. Built as we go so playlists/history below resolve.
    const idMap = new Map<string, string>()
    let processed = 0
    for (const row of contentRows) {
      const mapped = mapContentRow(row, cuesByContent.get(row.ID) ?? [], existingIdsByPath, colorMap)
      if (mapped) {
        tracks.push(mapped)
        idMap.set(row.ID, mapped.id)
      }
      processed++
      if (processed % 500 === 0) {
        onProgress({ processed, total, phase: 'parsing' })
        // Yield so progress events flush to the renderer.
        await microYield()
      }
    }
    onProgress({ processed: total, total, phase: 'parsing' })

    // ── Playlists ─────────────────────────────────────────────────────────
    const playlistRows = await db
      .all<RawPlaylistRow>(
        `
      SELECT ID, Name, Attribute, ParentID
      FROM djmdPlaylist
      WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0
      ORDER BY Seq
    `
      )
      .catch((err) => {
        console.warn('[rekordbox] djmdPlaylist read failed', err)
        return [] as RawPlaylistRow[]
      })
    const songPlaylistRows = await db
      .all<RawSongPlaylistRow>(
        `
      SELECT PlaylistID, ContentID, TrackNo
      FROM djmdSongPlaylist
      WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0
      ORDER BY TrackNo
    `
      )
      .catch((err) => {
        console.warn('[rekordbox] djmdSongPlaylist read failed', err)
        return [] as RawSongPlaylistRow[]
      })
    const playlists = mapPlaylists(playlistRows, songPlaylistRows, idMap)

    // ── History sessions ──────────────────────────────────────────────────
    const historyRows = await db
      .all<RawHistoryRow>(
        `
      SELECT ID, Name, DateCreated
      FROM djmdHistory
      WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0
      ORDER BY DateCreated
    `
      )
      .catch(() => [] as RawHistoryRow[])
    const songHistoryRows = await db
      .all<RawSongHistoryRow>(
        `
      SELECT HistoryID, ContentID, TrackNo
      FROM djmdSongHistory
      WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0
      ORDER BY HistoryID, TrackNo
    `
      )
      .catch(() => [] as RawSongHistoryRow[])
    const sessions = mapSessions(historyRows, songHistoryRows, idMap)

    return { tracks, playlists, sessions }
  } finally {
    await db.close().catch(() => {})
  }
}

// ───────── Internal helpers ────────────────────────────────────────

/**
 * Build a Map<colorId, colorName> from djmdColor.
 *
 * Schema changed between Rekordbox 6 and 7:
 *  - RB6: colour label in the `Name` column
 *  - RB7: `Name` removed; label moved to `Commnt`
 *
 * We try `Name` first; if that column doesn't exist, fall back to `Commnt`.
 * Either failure leaves the map empty — callers treat missing colour as null.
 */
async function fetchColorMap(db: MasterDb): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  // RB6 form
  try {
    const rows = await db.all<{ ID: string; Name: string | null }>(
      `SELECT ID, Name FROM djmdColor`
    )
    for (const r of rows) if (r.ID && r.Name) map.set(r.ID, r.Name)
    if (map.size > 0) return map
  } catch {
    /* Name column absent (RB7) — try Commnt */
  }
  // RB7 form
  try {
    const rows = await db.all<{ ID: string; Commnt: string | null }>(
      `SELECT ID, Commnt FROM djmdColor`
    )
    for (const r of rows) if (r.ID && r.Commnt) map.set(r.ID, r.Commnt)
  } catch {
    /* djmdColor absent or unreadable — proceed without colour data */
  }
  return map
}

// ───────── Pure mapping functions (exported for testing) ─────────

/** Map a raw djmdContent row + its cues into our Track shape. */
export function mapContentRow(
  row: RawContentRow,
  cues: RawCueRow[],
  existingIdsByPath: Map<string, string> = new Map(),
  colorMap: Map<string, string> = new Map()
): Track | null {
  const filePath = combinePath(row.FolderPath, row.FileNameL)
  if (!filePath) return null // No path = unusable

  const { cuePoints, hotCues } = splitCues(cues)
  const bpm = row.BPM != null ? row.BPM / 100 : 0
  const duration = row.Length != null ? row.Length / 1000 : 0
  const keyOpen = row.KeyName ?? ''
  const camelot = keyOpen ? (openNotationToCamelot(keyOpen) ?? '') : ''

  return {
    id: existingIdsByPath.get(filePath) ?? crypto.randomUUID(),
    rekordboxId: row.ID,
    title: row.Title ?? 'Unknown title',
    artist: row.ArtistName ?? 'Unknown artist',
    album: row.AlbumName ?? undefined,
    genre: row.GenreName ?? undefined,
    bpm,
    key: camelot,
    keyOpenNotation: keyOpen || undefined,
    // Rekordbox 6 master.db has no Energy column — let the analyser compute it.
    energy: 5,
    energySource: 'pending',
    duration,
    filePath,
    fileSize: row.FileSize ?? undefined,
    bitrate: row.BitRate ?? undefined,
    format: parseFormat(filePath),
    cuePoints,
    hotCues,
    beatgridOffset: undefined,
    playCount: row.DJPlayCount ?? 0,
    // RB6 Rating is already 0-5 (no normalisation needed unlike XML's 0-255).
    rating: clampInt(row.Rating ?? 0, 0, 5),
    dateAdded: parseRbDate(row.StockDate ?? row.created_at),
    comment: row.Commnt ?? undefined,
    label: row.LabelName ?? undefined,
    color: (row.ColorID ? (colorMap.get(row.ColorID) ?? undefined) : undefined),
    missingFile: false
  }
}

export function bucketCuesByContent(rows: RawCueRow[]): Map<string, RawCueRow[]> {
  const out = new Map<string, RawCueRow[]>()
  for (const r of rows) {
    const list = out.get(r.ContentID)
    if (list) list.push(r)
    else out.set(r.ContentID, [r])
  }
  return out
}

function splitCues(cues: RawCueRow[]): {
  cuePoints: Track['cuePoints']
  hotCues: Track['hotCues']
} {
  const cuePoints: Track['cuePoints'] = []
  const hotCues: Track['hotCues'] = []
  for (const c of cues) {
    if (c.InMsec == null) continue
    // Kind: 0 = memory cue (any subsequent are hot cues in Rekordbox 6/7).
    if (c.Kind === 0) {
      cuePoints.push({ position: c.InMsec, type: c.ActiveLoop != null ? 'cue' : 'memory' })
    } else {
      // Hot cue. Bank index from ActiveLoop when present, otherwise sequence index.
      const index = c.ActiveLoop ?? hotCues.length
      hotCues.push({
        index,
        position: c.InMsec,
        color: c.Color != null ? packedRgbToCss(c.Color) : undefined
      })
    }
  }
  return { cuePoints, hotCues }
}

function packedRgbToCss(packed: number): string {
  const r = (packed >> 16) & 0xff
  const g = (packed >> 8) & 0xff
  const b = packed & 0xff
  return `rgb(${r},${g},${b})`
}

/**
 * Combine Rekordbox's FolderPath + FileNameL into an absolute path.
 * Rekordbox stores FolderPath with a trailing slash on macOS, sometimes
 * URL-encoded for non-ASCII characters.
 */
export function combinePath(folder: string | null, file: string | null): string | null {
  if (!folder || !file) return null
  let combined = folder.endsWith('/') ? folder + file : folder + '/' + file
  // Decode URL-encoded characters (Rekordbox encodes spaces and Unicode).
  try {
    combined = decodeURIComponent(combined)
  } catch {
    // Bad % sequences — leave as-is
  }
  return normalize(combined)
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

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function parseRbDate(raw: string | null | undefined): string {
  if (!raw) return new Date().toISOString()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function mapPlaylists(
  playlistRows: RawPlaylistRow[],
  songPlaylistRows: RawSongPlaylistRow[],
  rekordboxIdToTrackId: Map<string, string>
): Playlist[] {
  // Pre-build memberships by playlist ID.
  const byPlaylist = new Map<string, string[]>()
  for (const r of songPlaylistRows) {
    const internalId = rekordboxIdToTrackId.get(r.ContentID)
    if (!internalId) continue
    const list = byPlaylist.get(r.PlaylistID)
    if (list) list.push(internalId)
    else byPlaylist.set(r.PlaylistID, [internalId])
  }

  // Map Rekordbox playlist UUIDs to fresh internal UUIDs.
  const idMap = new Map<string, string>()
  for (const r of playlistRows) idMap.set(r.ID, crypto.randomUUID())

  return playlistRows.map((r) => ({
    id: idMap.get(r.ID)!,
    rekordboxId: r.ID,
    // Attribute: 0 = playlist, 1 = folder (Rekordbox 6 convention)
    isFolder: r.Attribute === 1,
    name: r.Name ?? 'Untitled',
    parentId: r.ParentID && r.ParentID !== 'root' ? (idMap.get(r.ParentID) ?? null) : null,
    trackIds: byPlaylist.get(r.ID) ?? []
  }))
}

export function mapSessions(
  historyRows: RawHistoryRow[],
  songHistoryRows: RawSongHistoryRow[],
  rekordboxIdToTrackId: Map<string, string>
): RekordboxImportPayload['sessions'] {
  const byHistory = new Map<string, string[]>()
  for (const r of songHistoryRows) {
    const internalId = rekordboxIdToTrackId.get(r.ContentID)
    if (!internalId) continue
    const list = byHistory.get(r.HistoryID)
    if (list) list.push(internalId)
    else byHistory.set(r.HistoryID, [internalId])
  }
  return historyRows
    .map((r) => {
      const name = r.Name ?? 'Untitled session'
      const meta = parseSessionMeta(name)
      return {
        name,
        performedAt: parseSessionDate(r.DateCreated),
        venue: meta.venue,
        venueSource: meta.source,
        trackIds: byHistory.get(r.ID) ?? []
      }
    })
    .filter((s) => s.trackIds.length > 0)
}

function parseSessionDate(raw: string | null): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  // Match the XML path: ISO date string YYYY-MM-DD.
  return d.toISOString().slice(0, 10)
}

function microYield(): Promise<void> {
  return new Promise((r) => setImmediate(r))
}
