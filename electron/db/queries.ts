import type Database from 'better-sqlite3'
import type { LibraryFilters, LibraryStats, Track, SetTrack, Set as DJSet, CuePoint, HotCue, EnergySource } from '../../src/types'

// ───────── Row → Track ─────────

function rowToTrack(row: Record<string, unknown>): Track {
  return {
    id: row.id as string,
    rekordboxId: (row.rekordbox_id as string) || undefined,
    title: row.title as string,
    artist: row.artist as string,
    album: (row.album as string) || undefined,
    genre: (row.genre as string) || undefined,
    bpm: row.bpm as number,
    key: (row.key as string) ?? '',
    keyOpenNotation: (row.key_open as string) || undefined,
    energy: (row.energy as number | null) ?? 5,
    energyRaw: (row.energy_raw as number | null) ?? undefined,
    energySource: ((row.energy_source as EnergySource | null) ?? 'pending') as EnergySource,
    duration: row.duration as number,
    filePath: row.file_path as string,
    fileSize: (row.file_size as number) || undefined,
    bitrate: (row.bitrate as number) || undefined,
    format: (row.format as Track['format']) ?? 'unknown',
    albumArtPath: (row.album_art_path as string) || undefined,
    albumArtUrl: (row.album_art_url as string) || undefined,
    cuePoints: JSON.parse((row.cue_points as string) || '[]'),
    hotCues: JSON.parse((row.hot_cues as string) || '[]'),
    beatgridOffset: (row.beatgrid_offset as number) || undefined,
    playCount: (row.play_count as number) ?? 0,
    rating: (row.rating as number) ?? 0,
    dateAdded: (row.date_added as string) ?? new Date().toISOString(),
    lastPlayed: (row.last_played as string) || undefined,
    comment: (row.comment as string) || undefined,
    label: (row.label as string) || undefined,
    color: (row.color as string) || undefined,
    artGradient: row.art_gradient as string | undefined,
    missingFile: Boolean(row.missing_file),
    phantom: Boolean(row.phantom),
    discoverMeta: row.discover_meta
      ? (JSON.parse(row.discover_meta as string) as Track['discoverMeta'])
      : undefined,
  }
}

// ───────── Track → row ─────────

function trackToRow(track: Track): Record<string, unknown> {
  return {
    id: track.id,
    rekordbox_id: track.rekordboxId ?? null,
    title: track.title,
    artist: track.artist,
    album: track.album ?? null,
    genre: track.genre ?? null,
    bpm: track.bpm,
    key: track.key,
    key_open: track.keyOpenNotation ?? null,
    energy: track.energy ?? null,
    energy_raw: track.energyRaw ?? null,
    energy_source: track.energySource ?? 'pending',
    duration: track.duration,
    file_path: track.filePath,
    file_size: track.fileSize ?? null,
    bitrate: track.bitrate ?? null,
    format: track.format,
    album_art_path: track.albumArtPath ?? null,
    album_art_url: track.albumArtUrl ?? null,
    play_count: track.playCount,
    rating: track.rating,
    date_added: track.dateAdded,
    last_played: track.lastPlayed ?? null,
    comment: track.comment ?? null,
    label: track.label ?? null,
    color: track.color ?? null,
    cue_points: JSON.stringify(track.cuePoints),
    hot_cues: JSON.stringify(track.hotCues),
    beatgrid_offset: track.beatgridOffset ?? 0,
    art_gradient: track.artGradient ?? null,
    missing_file: track.missingFile ? 1 : 0,
    phantom: track.phantom ? 1 : 0,
    discover_meta: track.discoverMeta ? JSON.stringify(track.discoverMeta) : null,
  }
}

// ───────── Queries ─────────

const INSERT_TRACK = `
  INSERT OR REPLACE INTO tracks (
    id, rekordbox_id, title, artist, album, genre, bpm, key, key_open,
    energy, energy_raw, energy_source, duration, file_path, file_size, bitrate, format,
    album_art_path, album_art_url, play_count, rating, date_added,
    last_played, comment, label, color, cue_points, hot_cues, beatgrid_offset,
    missing_file, phantom, discover_meta
  ) VALUES (
    @id, @rekordbox_id, @title, @artist, @album, @genre, @bpm, @key, @key_open,
    @energy, @energy_raw, @energy_source, @duration, @file_path, @file_size, @bitrate, @format,
    @album_art_path, @album_art_url, @play_count, @rating, @date_added,
    @last_played, @comment, @label, @color, @cue_points, @hot_cues, @beatgrid_offset,
    @missing_file, @phantom, @discover_meta
  )
`

export function insertTrack(db: Database.Database, track: Track): void {
  db.prepare(INSERT_TRACK).run(trackToRow(track))
}

export function batchInsertTracks(db: Database.Database, tracks: Track[]): void {
  const insert = db.prepare(INSERT_TRACK)
  const insertMany = db.transaction((batch: Track[]) => {
    for (const t of batch) insert.run(trackToRow(t))
  })

  for (let i = 0; i < tracks.length; i += 100) {
    insertMany(tracks.slice(i, i + 100))
  }
}

export function getAllTracks(db: Database.Database, filters?: LibraryFilters): Track[] {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters?.bpmMin != null) {
    conditions.push('bpm >= @bpmMin')
    params.bpmMin = filters.bpmMin
  }
  if (filters?.bpmMax != null) {
    conditions.push('bpm <= @bpmMax')
    params.bpmMax = filters.bpmMax
  }
  if (filters?.key) {
    conditions.push('key = @key')
    params.key = filters.key
  }
  if (filters?.genre) {
    conditions.push('genre = @genre')
    params.genre = filters.genre
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT * FROM tracks ${where} ORDER BY artist ASC, title ASC`)
    .all(params) as Record<string, unknown>[]

  return rows.map(rowToTrack)
}

export function getTrackById(db: Database.Database, id: string): Track | undefined {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToTrack(row) : undefined
}

export function getLibraryStats(db: Database.Database): LibraryStats {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total_tracks,
        COALESCE(SUM(duration), 0) as total_duration,
        COUNT(*) FILTER (WHERE file_size IS NULL) as missing_files,
        COUNT(*) FILTER (WHERE format = 'unknown') as unsupported_formats,
        COUNT(*) FILTER (WHERE key IS NULL OR key = '') as no_key,
        COUNT(*) FILTER (WHERE bpm = 0) as no_bpm
      FROM tracks`
    )
    .get() as Record<string, number>

  return {
    totalTracks: row.total_tracks,
    totalDuration: row.total_duration,
    missingFiles: row.missing_files,
    unsupportedFormats: row.unsupported_formats,
    tracksWithoutKey: row.no_key,
    tracksWithoutBpm: row.no_bpm,
  }
}

export function countTracks(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as n FROM tracks').get() as { n: number }
  return row.n
}

// ───────── Set queries ─────────

const SET_TRACKS_JOIN = `
  SELECT
    st.id as st_id, st.set_id, st.track_id, st.position,
    st.energy_override, st.notes, st.transition_score,
    t.id as t_id, t.title, t.artist, t.album, t.genre,
    t.bpm, t.key, t.key_open, t.energy, t.energy_raw, t.energy_source, t.duration, t.file_path,
    t.file_size, t.bitrate, t.format, t.album_art_path, t.album_art_url,
    t.play_count, t.rating, t.date_added, t.last_played, t.comment,
    t.label, t.color, t.cue_points, t.hot_cues, t.beatgrid_offset, t.art_gradient,
    t.missing_file, t.phantom, t.discover_meta
  FROM set_tracks st
  JOIN tracks t ON t.id = st.track_id
  WHERE st.set_id = @setId
  ORDER BY st.position ASC
`

function rowToSetTrack(row: Record<string, unknown>): SetTrack {
  const track: Track = {
    id: row.t_id as string,
    rekordboxId: (row.rekordbox_id as string) || undefined,
    title: row.title as string,
    artist: row.artist as string,
    album: (row.album as string) || undefined,
    genre: (row.genre as string) || undefined,
    bpm: row.bpm as number,
    key: (row.key as string) ?? '',
    keyOpenNotation: (row.key_open as string) || undefined,
    energy: (row.energy as number | null) ?? 5,
    energyRaw: (row.energy_raw as number | null) ?? undefined,
    energySource: ((row.energy_source as EnergySource | null) ?? 'pending') as EnergySource,
    duration: row.duration as number,
    filePath: row.file_path as string,
    fileSize: (row.file_size as number) || undefined,
    bitrate: (row.bitrate as number) || undefined,
    format: (row.format as Track['format']) ?? 'unknown',
    albumArtPath: (row.album_art_path as string) || undefined,
    albumArtUrl: (row.album_art_url as string) || undefined,
    cuePoints: JSON.parse((row.cue_points as string) || '[]'),
    hotCues: JSON.parse((row.hot_cues as string) || '[]'),
    beatgridOffset: (row.beatgrid_offset as number) || undefined,
    playCount: (row.play_count as number) ?? 0,
    rating: (row.rating as number) ?? 0,
    dateAdded: (row.date_added as string) ?? new Date().toISOString(),
    lastPlayed: (row.last_played as string) || undefined,
    comment: (row.comment as string) || undefined,
    label: (row.label as string) || undefined,
    color: (row.color as string) || undefined,
    artGradient: row.art_gradient as string | undefined,
    missingFile: Boolean(row.missing_file),
    phantom: Boolean(row.phantom),
    discoverMeta: row.discover_meta
      ? (JSON.parse(row.discover_meta as string) as Track['discoverMeta'])
      : undefined,
  }
  return {
    id: row.st_id as string,
    trackId: row.track_id as string,
    track,
    position: row.position as number,
    transitionScore: row.transition_score
      ? JSON.parse(row.transition_score as string)
      : undefined,
    energyOverride: (row.energy_override as number) ?? undefined,
    notes: (row.notes as string) || undefined,
  }
}

function rowToSet(row: Record<string, unknown>, tracks: SetTrack[]): DJSet {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    tracks,
    targetDuration: (row.target_duration as number) || undefined,
    targetBpmMin: (row.target_bpm_min as number) || undefined,
    targetBpmMax: (row.target_bpm_max as number) || undefined,
    vibe: (row.vibe as DJSet['vibe']) || undefined,
    venue: (row.venue as DJSet['venue']) || undefined,
    slotTime: (row.slot_time as string) || undefined,
    energyCurveType: (row.energy_curve_type as DJSet['energyCurveType']) || undefined,
    targetHardware: (row.target_hardware as DJSet['targetHardware']) || 'CDJ-2000NXS2',
    safetyScore: row.safety_score != null ? (row.safety_score as number) : undefined,
  }
}

function getTracksForSet(db: Database.Database, setId: string): SetTrack[] {
  const rows = db.prepare(SET_TRACKS_JOIN).all({ setId }) as Record<string, unknown>[]
  return rows.map(rowToSetTrack)
}

export function getAllSets(db: Database.Database): DJSet[] {
  const setRows = db
    .prepare('SELECT * FROM sets ORDER BY updated_at DESC')
    .all() as Record<string, unknown>[]
  return setRows.map((row) => rowToSet(row, getTracksForSet(db, row.id as string)))
}

export function getSetById(db: Database.Database, id: string): DJSet | undefined {
  const row = db.prepare('SELECT * FROM sets WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return undefined
  return rowToSet(row, getTracksForSet(db, id))
}

export function saveSet(db: Database.Database, set: DJSet): void {
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO sets (id, name, created_at, updated_at, target_duration,
        target_bpm_min, target_bpm_max, vibe, venue, slot_time,
        energy_curve_type, target_hardware, safety_score)
      VALUES (@id, @name, @created_at, @updated_at, @target_duration,
        @target_bpm_min, @target_bpm_max, @vibe, @venue, @slot_time,
        @energy_curve_type, @target_hardware, @safety_score)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at,
        target_duration = excluded.target_duration,
        target_bpm_min = excluded.target_bpm_min,
        target_bpm_max = excluded.target_bpm_max,
        vibe = excluded.vibe,
        venue = excluded.venue,
        slot_time = excluded.slot_time,
        energy_curve_type = excluded.energy_curve_type,
        target_hardware = excluded.target_hardware,
        safety_score = excluded.safety_score
    `).run({
      id: set.id,
      name: set.name,
      created_at: set.createdAt,
      updated_at: set.updatedAt,
      target_duration: set.targetDuration ?? null,
      target_bpm_min: set.targetBpmMin ?? null,
      target_bpm_max: set.targetBpmMax ?? null,
      vibe: set.vibe ?? null,
      venue: set.venue ?? null,
      slot_time: set.slotTime ?? null,
      energy_curve_type: set.energyCurveType ?? null,
      target_hardware: set.targetHardware ?? 'CDJ-2000NXS2',
      safety_score: set.safetyScore ?? null,
    })

    db.prepare('DELETE FROM set_tracks WHERE set_id = ?').run(set.id)

    // Upsert phantom tracks so the set_tracks FK can resolve. Phantom tracks
    // originate in the renderer (Discover feature) and may not yet exist in the
    // tracks table on first save.
    const upsertPhantom = db.prepare(INSERT_TRACK)
    for (const st of set.tracks) {
      if (st.track.phantom) {
        upsertPhantom.run(trackToRow(st.track))
      }
    }

    const insertTrack = db.prepare(`
      INSERT INTO set_tracks (id, set_id, track_id, position, energy_override, notes, transition_score)
      VALUES (@id, @setId, @trackId, @position, @energyOverride, @notes, @transitionScore)
    `)
    for (const st of set.tracks) {
      insertTrack.run({
        id: st.id,
        setId: set.id,
        trackId: st.trackId,
        position: st.position,
        energyOverride: st.energyOverride ?? null,
        notes: st.notes ?? null,
        transitionScore: st.transitionScore ? JSON.stringify(st.transitionScore) : '{}',
      })
    }
  })
  tx()
}

export function deleteSet(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM sets WHERE id = ?').run(id)
}

// ───────── File health ─────────

/** Update the missing_file flag for a single track. */
export function setTrackMissingFile(
  db: Database.Database,
  trackId: string,
  missing: boolean
): void {
  db.prepare('UPDATE tracks SET missing_file = ? WHERE id = ?').run(missing ? 1 : 0, trackId)
}

/**
 * Walk every track in the DB, check existsSync, update missing_file where the
 * status has changed. Returns an array of { id, missing } for every track whose
 * status changed so the caller can push events to the renderer.
 */
export function runFileHealthCheck(
  db: Database.Database
): Array<{ id: string; missing: boolean }> {
  const { existsSync } = require('fs') as typeof import('fs')
  // Skip phantom tracks (file_path is a `discover://...` sentinel, not a real file)
  const rows = db
    .prepare('SELECT id, file_path, missing_file FROM tracks WHERE phantom = 0')
    .all() as Array<{ id: string; file_path: string; missing_file: number }>

  const changed: Array<{ id: string; missing: boolean }> = []
  const update = db.prepare('UPDATE tracks SET missing_file = ? WHERE id = ?')

  const tx = db.transaction(() => {
    for (const row of rows) {
      const nowMissing = !existsSync(row.file_path)
      const wasMissing = row.missing_file === 1
      if (nowMissing !== wasMissing) {
        update.run(nowMissing ? 1 : 0, row.id)
        changed.push({ id: row.id, missing: nowMissing })
      }
    }
  })
  tx()

  return changed
}

// ───────── Cue point updates ─────────

export function updateTrackCues(
  db: Database.Database,
  trackId: string,
  cuePoints: CuePoint[],
  hotCues: HotCue[]
): void {
  db.prepare('UPDATE tracks SET cue_points = ?, hot_cues = ? WHERE id = ?')
    .run(JSON.stringify(cuePoints), JSON.stringify(hotCues), trackId)
}

// ───────── Energy analysis ─────────

export function updateTrackEnergy(
  db: Database.Database,
  trackId: string,
  energy: number,
  energyRaw: number | null,
  source: EnergySource
): void {
  db.prepare(
    'UPDATE tracks SET energy = ?, energy_raw = ?, energy_source = ? WHERE id = ?'
  ).run(energy, energyRaw, source, trackId)
}

export interface PendingEnergyRow {
  id: string
  filePath: string
  bpm: number
  missingFile: number
}

export function getPendingEnergyTracks(db: Database.Database): PendingEnergyRow[] {
  const rows = db
    .prepare(
      `SELECT id, file_path, bpm, missing_file
       FROM tracks
       WHERE (energy_source = 'pending' OR energy_source IS NULL) AND phantom = 0
       ORDER BY date_added DESC`
    )
    .all() as Array<{ id: string; file_path: string; bpm: number; missing_file: number }>
  return rows.map((r) => ({
    id: r.id,
    filePath: r.file_path,
    bpm: r.bpm,
    missingFile: r.missing_file,
  }))
}

export function countPendingEnergyTracks(db: Database.Database): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) as n FROM tracks WHERE (energy_source = 'pending' OR energy_source IS NULL) AND phantom = 0"
    )
    .get() as { n: number }
  return row.n
}

// ───────── USB devices ─────────

export interface USBDeviceRow {
  id: string
  label: string
  customName?: string
  isFavorite: boolean
  isExportTarget: boolean
  lastSeen: string
  exportCount: number
  lastExport?: string
  readSpeedMBps?: number
  writeSpeedMBps?: number
  speedTestedAt?: string
}

function rowToUSBDevice(row: Record<string, unknown>): USBDeviceRow {
  return {
    id: row.id as string,
    label: row.label as string,
    customName: (row.custom_name as string) || undefined,
    isFavorite: Boolean(row.is_favorite),
    isExportTarget: Boolean(row.is_export_target),
    lastSeen: row.last_seen as string,
    exportCount: (row.export_count as number) ?? 0,
    lastExport: (row.last_export as string) || undefined,
    readSpeedMBps: (row.read_speed_mbps as number) || undefined,
    writeSpeedMBps: (row.write_speed_mbps as number) || undefined,
    speedTestedAt: (row.speed_tested_at as string) || undefined,
  }
}

export function getUSBDevice(db: Database.Database, id: string): USBDeviceRow | undefined {
  const row = db.prepare('SELECT * FROM usb_devices WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToUSBDevice(row) : undefined
}

export function getAllRememberedUSBDevices(db: Database.Database): USBDeviceRow[] {
  const rows = db
    .prepare('SELECT * FROM usb_devices ORDER BY last_seen DESC')
    .all() as Record<string, unknown>[]
  return rows.map(rowToUSBDevice)
}

export function upsertUSBDevice(db: Database.Database, device: Partial<USBDeviceRow> & { id: string; label: string }): void {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO usb_devices
      (id, label, custom_name, is_favorite, is_export_target, last_seen,
       export_count, last_export, read_speed_mbps, write_speed_mbps, speed_tested_at)
    VALUES
      (@id, @label, @customName, @isFavorite, @isExportTarget, @lastSeen,
       @exportCount, @lastExport, @readSpeedMBps, @writeSpeedMBps, @speedTestedAt)
    ON CONFLICT(id) DO UPDATE SET
      label            = excluded.label,
      custom_name      = COALESCE(excluded.custom_name, custom_name),
      is_favorite      = excluded.is_favorite,
      is_export_target = excluded.is_export_target,
      last_seen        = excluded.last_seen,
      export_count     = excluded.export_count,
      last_export      = COALESCE(excluded.last_export, last_export),
      read_speed_mbps  = COALESCE(excluded.read_speed_mbps, read_speed_mbps),
      write_speed_mbps = COALESCE(excluded.write_speed_mbps, write_speed_mbps),
      speed_tested_at  = COALESCE(excluded.speed_tested_at, speed_tested_at)
  `).run({
    id: device.id,
    label: device.label,
    customName: device.customName ?? null,
    isFavorite: device.isFavorite ? 1 : 0,
    isExportTarget: device.isExportTarget ? 1 : 0,
    lastSeen: device.lastSeen ?? now,
    exportCount: device.exportCount ?? 0,
    lastExport: device.lastExport ?? null,
    readSpeedMBps: device.readSpeedMBps ?? null,
    writeSpeedMBps: device.writeSpeedMBps ?? null,
    speedTestedAt: device.speedTestedAt ?? null,
  })
}

export function updateUSBPrefs(
  db: Database.Database,
  id: string,
  prefs: { customName?: string | null; isFavorite?: boolean; isExportTarget?: boolean }
): void {
  const parts: string[] = []
  const params: Record<string, unknown> = { id }

  if ('customName' in prefs) {
    parts.push('custom_name = @customName')
    params.customName = prefs.customName ?? null
  }
  if (prefs.isFavorite !== undefined) {
    parts.push('is_favorite = @isFavorite')
    params.isFavorite = prefs.isFavorite ? 1 : 0
  }
  if (prefs.isExportTarget !== undefined) {
    parts.push('is_export_target = @isExportTarget')
    params.isExportTarget = prefs.isExportTarget ? 1 : 0
  }

  if (parts.length === 0) return
  db.prepare(`UPDATE usb_devices SET ${parts.join(', ')} WHERE id = @id`).run(params)
}

export function updateUSBSpeedResult(
  db: Database.Database,
  id: string,
  readMBps: number,
  writeMBps: number
): void {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE usb_devices SET read_speed_mbps = ?, write_speed_mbps = ?, speed_tested_at = ? WHERE id = ?'
  ).run(readMBps, writeMBps, now, id)
}

export function recordUSBExport(db: Database.Database, id: string): void {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE usb_devices SET export_count = export_count + 1, last_export = ? WHERE id = ?'
  ).run(now, id)
}

export function forgetUSBDevice(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM usb_devices WHERE id = ?').run(id)
}
