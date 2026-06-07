import { existsSync } from 'fs'
import type Database from 'better-sqlite3'
import type {
  LibraryFilters,
  LibraryStats,
  Track,
  SetTrack,
  Set as DJSet,
  CuePoint,
  HotCue,
  Loop,
  EnergySource,
  ArtworkSource,
  Playlist,
  PlaySession,
  SessionTrack,
  SessionFilter,
  SessionMetadataPatch,
  SetReaction,
  LifecycleState,
  TrackTag,
  TagCategory,
  TagSource,
  TrackAnalysisFeatures,
  TagCoverage
} from '../../src/types'

// ───────── Row → Track ─────────

function rowToTrack(row: Record<string, unknown>): Track {
  return {
    id: row.id as string,
    rekordboxId: (row.rekordbox_id as string) || undefined,
    source: (row.source as 'rekordbox' | 'serato' | null) ?? undefined,
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
    albumArtSource: ((row.album_art_source as ArtworkSource | null) ?? 'pending') as ArtworkSource,
    cuePoints: JSON.parse((row.cue_points as string) || '[]'),
    hotCues: JSON.parse((row.hot_cues as string) || '[]'),
    loops: JSON.parse((row.loops as string) || '[]'),
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
    lifecycleState: (row.lifecycle_state as LifecycleState | null) ?? undefined,
    lifecycleSource: (row.lifecycle_source as 'computed' | 'user' | null) ?? undefined,
    flaggedForGigAt: (row.flagged_for_gig_at as string) || undefined,
    analysisFeatures: row.analysis_features
      ? (JSON.parse(row.analysis_features as string) as TrackAnalysisFeatures)
      : undefined,
    discoverMeta: row.discover_meta
      ? (JSON.parse(row.discover_meta as string) as Track['discoverMeta'])
      : undefined
  }
}

// ───────── Track → row ─────────

function trackToRow(track: Track): Record<string, unknown> {
  return {
    id: track.id,
    rekordbox_id: track.rekordboxId ?? null,
    source: track.source ?? null,
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
    album_art_source: track.albumArtSource ?? 'pending',
    play_count: track.playCount,
    rating: track.rating,
    date_added: track.dateAdded,
    last_played: track.lastPlayed ?? null,
    comment: track.comment ?? null,
    label: track.label ?? null,
    color: track.color ?? null,
    cue_points: JSON.stringify(track.cuePoints),
    hot_cues: JSON.stringify(track.hotCues),
    loops: JSON.stringify(track.loops ?? []),
    beatgrid_offset: track.beatgridOffset ?? 0,
    art_gradient: track.artGradient ?? null,
    missing_file: track.missingFile ? 1 : 0,
    phantom: track.phantom ? 1 : 0,
    discover_meta: track.discoverMeta ? JSON.stringify(track.discoverMeta) : null,
    lifecycle_state: track.lifecycleState ?? null,
    lifecycle_source: track.lifecycleSource ?? 'computed',
    analysis_features: track.analysisFeatures ? JSON.stringify(track.analysisFeatures) : null
  }
}

// ───────── Queries ─────────

/**
 * INSERT OR REPLACE doesn't work here: the file_path UNIQUE constraint would
 * trigger a DELETE on re-import, which violates the set_tracks FK to tracks(id).
 * Instead, ON CONFLICT(file_path) DO UPDATE preserves the row (and its id) so
 * any sets referencing this track keep working. Callers must reuse the existing
 * id (look up by file_path) — otherwise the row's id stays stale and any
 * downstream references built off the inserted id will dangle.
 *
 * Energy fields are preserved when the row was already analysed ('computed') so
 * re-import doesn't reset progress to 'pending' and force a full re-analysis.
 */
const INSERT_TRACK = `
  INSERT INTO tracks (
    id, rekordbox_id, source, title, artist, album, genre, bpm, key, key_open,
    energy, energy_raw, energy_source, duration, file_path, file_size, bitrate, format,
    album_art_path, album_art_url, album_art_source, play_count, rating, date_added,
    last_played, comment, label, color, cue_points, hot_cues, loops, beatgrid_offset,
    missing_file, phantom, discover_meta, lifecycle_state, lifecycle_source, analysis_features
  ) VALUES (
    @id, @rekordbox_id, @source, @title, @artist, @album, @genre, @bpm, @key, @key_open,
    @energy, @energy_raw, @energy_source, @duration, @file_path, @file_size, @bitrate, @format,
    @album_art_path, @album_art_url, @album_art_source, @play_count, @rating, @date_added,
    @last_played, @comment, @label, @color, @cue_points, @hot_cues, @loops, @beatgrid_offset,
    @missing_file, @phantom, @discover_meta, @lifecycle_state, @lifecycle_source, @analysis_features
  )
  ON CONFLICT(file_path) DO UPDATE SET
    rekordbox_id = excluded.rekordbox_id,
    source = excluded.source,
    title = excluded.title,
    artist = excluded.artist,
    album = excluded.album,
    genre = excluded.genre,
    bpm = excluded.bpm,
    key = excluded.key,
    key_open = excluded.key_open,
    duration = excluded.duration,
    file_size = excluded.file_size,
    bitrate = excluded.bitrate,
    format = excluded.format,
    album_art_url = excluded.album_art_url,
    play_count = excluded.play_count,
    rating = excluded.rating,
    date_added = excluded.date_added,
    last_played = excluded.last_played,
    comment = excluded.comment,
    label = excluded.label,
    color = excluded.color,
    cue_points = excluded.cue_points,
    hot_cues = excluded.hot_cues,
    loops = excluded.loops,
    beatgrid_offset = excluded.beatgrid_offset,
    missing_file = excluded.missing_file,
    phantom = excluded.phantom,
    discover_meta = excluded.discover_meta,
    lifecycle_state = CASE WHEN tracks.lifecycle_source = 'user' THEN tracks.lifecycle_state ELSE excluded.lifecycle_state END,
    lifecycle_source = CASE WHEN tracks.lifecycle_source = 'user' THEN tracks.lifecycle_source ELSE excluded.lifecycle_source END,
    energy = CASE WHEN tracks.energy_source = 'computed' THEN tracks.energy ELSE excluded.energy END,
    energy_raw = CASE WHEN tracks.energy_source = 'computed' THEN tracks.energy_raw ELSE excluded.energy_raw END,
    energy_source = CASE WHEN tracks.energy_source = 'computed' THEN tracks.energy_source ELSE excluded.energy_source END,
    analysis_features = CASE WHEN tracks.energy_source = 'computed' THEN tracks.analysis_features ELSE excluded.analysis_features END,
    album_art_path = CASE WHEN tracks.album_art_source = 'embedded' THEN tracks.album_art_path ELSE excluded.album_art_path END,
    album_art_source = CASE WHEN tracks.album_art_source = 'embedded' THEN tracks.album_art_source ELSE excluded.album_art_source END
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

  const tracks = rows.map(rowToTrack)
  attachTags(db, tracks)
  return tracks
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
        COUNT(*) FILTER (WHERE missing_file = 1) as missing_files,
        COUNT(*) FILTER (WHERE file_size IS NULL) as unknown_size,
        COUNT(*) FILTER (WHERE format = 'unknown') as unsupported_formats,
        COUNT(*) FILTER (WHERE key IS NULL OR key = '') as no_key,
        COUNT(*) FILTER (WHERE bpm = 0) as no_bpm,
        COUNT(*) FILTER (WHERE energy_source = 'pending') as pending_energy
      FROM tracks`
    )
    .get() as Record<string, number>

  return {
    totalTracks: row.total_tracks,
    totalDuration: row.total_duration,
    missingFiles: row.missing_files,
    unknownSize: row.unknown_size,
    unsupportedFormats: row.unsupported_formats,
    tracksWithoutKey: row.no_key,
    tracksWithoutBpm: row.no_bpm,
    tracksWithPendingEnergy: row.pending_energy
  }
}

export function countTracks(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as n FROM tracks').get() as { n: number }
  return row.n
}

/**
 * Highest applied schema version. Used by the backup importer to refuse a bundle
 * produced by a newer build whose extra columns this DB can't represent.
 */
export function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as {
    v: number | null
  }
  return row.v ?? 0
}

/**
 * Lookup existing track ids by absolute file_path. Used by the importer to
 * reuse ids across re-imports — paired with the ON CONFLICT(file_path) clause
 * in INSERT_TRACK, this keeps set_tracks FKs valid and avoids the
 * DELETE-then-INSERT path that would violate them.
 */
export function getExistingTrackIdsByPath(db: Database.Database): Map<string, string> {
  const rows = db.prepare('SELECT id, file_path FROM tracks').all() as Array<{
    id: string
    file_path: string
  }>
  const map = new Map<string, string>()
  for (const row of rows) map.set(row.file_path, row.id)
  return map
}

// ───────── Set queries ─────────

const SET_TRACKS_JOIN = `
  SELECT
    st.id as st_id, st.set_id, st.track_id, st.position,
    st.energy_override, st.notes, st.transition_score, st.locked,
    t.id as t_id, t.title, t.artist, t.album, t.genre,
    t.bpm, t.key, t.key_open, t.energy, t.energy_raw, t.energy_source, t.duration, t.file_path,
    t.file_size, t.bitrate, t.format, t.album_art_path, t.album_art_url, t.album_art_source,
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
    albumArtSource: ((row.album_art_source as ArtworkSource | null) ?? 'pending') as ArtworkSource,
    cuePoints: JSON.parse((row.cue_points as string) || '[]'),
    hotCues: JSON.parse((row.hot_cues as string) || '[]'),
    loops: JSON.parse((row.loops as string) || '[]'),
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
    lifecycleState: (row.lifecycle_state as LifecycleState | null) ?? undefined,
    lifecycleSource: (row.lifecycle_source as 'computed' | 'user' | null) ?? undefined,
    flaggedForGigAt: (row.flagged_for_gig_at as string) || undefined,
    discoverMeta: row.discover_meta
      ? (JSON.parse(row.discover_meta as string) as Track['discoverMeta'])
      : undefined
  }
  return {
    id: row.st_id as string,
    trackId: row.track_id as string,
    track,
    position: row.position as number,
    transitionScore: row.transition_score ? JSON.parse(row.transition_score as string) : undefined,
    energyOverride: (row.energy_override as number) ?? undefined,
    notes: (row.notes as string) || undefined,
    locked: row.locked === 1 || row.locked === true
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
    architectSeed: row.architect_seed != null ? (row.architect_seed as number) : undefined,
    algorithmVersion: row.algorithm_version != null ? (row.algorithm_version as number) : undefined
  }
}

function getTracksForSet(db: Database.Database, setId: string): SetTrack[] {
  const rows = db.prepare(SET_TRACKS_JOIN).all({ setId }) as Record<string, unknown>[]
  return rows.map(rowToSetTrack)
}

export function getAllSets(db: Database.Database): DJSet[] {
  const setRows = db.prepare('SELECT * FROM sets ORDER BY updated_at DESC').all() as Record<
    string,
    unknown
  >[]
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
    db.prepare(
      `
      INSERT INTO sets (id, name, created_at, updated_at, target_duration,
        target_bpm_min, target_bpm_max, vibe, venue, slot_time,
        energy_curve_type, target_hardware, safety_score,
        architect_seed, algorithm_version)
      VALUES (@id, @name, @created_at, @updated_at, @target_duration,
        @target_bpm_min, @target_bpm_max, @vibe, @venue, @slot_time,
        @energy_curve_type, @target_hardware, @safety_score,
        @architect_seed, @algorithm_version)
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
        safety_score = excluded.safety_score,
        architect_seed = excluded.architect_seed,
        algorithm_version = excluded.algorithm_version
    `
    ).run({
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
      architect_seed: set.architectSeed ?? null,
      algorithm_version: set.algorithmVersion ?? null
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
      INSERT INTO set_tracks (id, set_id, track_id, position, energy_override, notes, transition_score, locked)
      VALUES (@id, @setId, @trackId, @position, @energyOverride, @notes, @transitionScore, @locked)
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
        locked: st.locked ? 1 : 0
      })
    }
  })
  tx()
}

export function deleteSet(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM sets WHERE id = ?').run(id)
}

// ───────── Playlists (Rekordbox import) ─────────

function rowToPlaylist(row: Record<string, unknown>): Playlist {
  const trackIdsRaw = (row.track_ids as string) || '[]'
  let trackIds: string[]
  try {
    trackIds = JSON.parse(trackIdsRaw)
  } catch {
    trackIds = []
  }
  return {
    id: row.id as string,
    rekordboxId: (row.rekordbox_id as string) || undefined,
    name: row.name as string,
    parentId: (row.parent_id as string | null) ?? null,
    trackIds,
    isFolder: Boolean(row.is_folder)
  }
}

/**
 * Wipe the playlists table and insert the new set. Wrapped in a transaction so
 * a partial failure leaves the previous tree intact. Called after every XML
 * import — Rekordbox is the source of truth, SetSense is a mirror.
 */
export function replaceAllPlaylists(db: Database.Database, playlists: Playlist[]): void {
  const insert = db.prepare(`
    INSERT INTO playlists (id, rekordbox_id, name, parent_id, track_ids, is_folder)
    VALUES (@id, @rekordbox_id, @name, @parent_id, @track_ids, @is_folder)
  `)
  const tx = db.transaction((items: Playlist[]) => {
    db.exec('DELETE FROM playlists')
    for (const p of items) {
      insert.run({
        id: p.id,
        rekordbox_id: p.rekordboxId ?? null,
        name: p.name,
        parent_id: p.parentId,
        track_ids: JSON.stringify(p.trackIds),
        is_folder: p.isFolder ? 1 : 0
      })
    }
  })
  tx(playlists)
}

export function getAllPlaylists(db: Database.Database): Playlist[] {
  const rows = db.prepare('SELECT * FROM playlists ORDER BY name ASC').all() as Record<
    string,
    unknown
  >[]
  return rows.map(rowToPlaylist)
}

/**
 * Union of track ids across the given playlists. Used by the Set Architect IPC
 * handler to pre-filter the library before the algorithm runs.
 */
export function getTrackIdsForPlaylists(db: Database.Database, playlistIds: string[]): Set<string> {
  const out = new Set<string>()
  if (playlistIds.length === 0) return out
  const placeholders = playlistIds.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT track_ids FROM playlists WHERE id IN (${placeholders})`)
    .all(...playlistIds) as Array<{ track_ids: string }>
  for (const row of rows) {
    try {
      const ids = JSON.parse(row.track_ids || '[]') as string[]
      for (const id of ids) out.add(id)
    } catch {
      // ignore malformed JSON
    }
  }
  return out
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
export function runFileHealthCheck(db: Database.Database): Array<{ id: string; missing: boolean }> {
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
  db.prepare('UPDATE tracks SET cue_points = ?, hot_cues = ? WHERE id = ?').run(
    JSON.stringify(cuePoints),
    JSON.stringify(hotCues),
    trackId
  )
}

/** Persist beatgrid: BPM + first-downbeat anchor (ms). */
export function updateTrackBeatgrid(
  db: Database.Database,
  trackId: string,
  bpm: number,
  beatgridOffset: number
): void {
  db.prepare('UPDATE tracks SET bpm = ?, beatgrid_offset = ? WHERE id = ?').run(
    bpm,
    beatgridOffset,
    trackId
  )
}

/** Persist saved loops for a track. */
export function updateTrackLoops(db: Database.Database, trackId: string, loops: Loop[]): void {
  db.prepare('UPDATE tracks SET loops = ? WHERE id = ?').run(JSON.stringify(loops), trackId)
}

/** Persist a track's colour tag (e.g. from the Serato Markers2 COLOR entry). */
export function updateTrackColor(db: Database.Database, trackId: string, color: string): void {
  db.prepare('UPDATE tracks SET color = ? WHERE id = ?').run(color, trackId)
}

/** Update editable metadata fields (used by the Recall Health "resolve" workflow). */
export function updateTrackMeta(
  db: Database.Database,
  trackId: string,
  fields: { bpm?: number; key?: string }
): void {
  const cols: string[] = []
  const vals: (string | number)[] = []
  if (fields.bpm != null) {
    cols.push('bpm = ?')
    vals.push(fields.bpm)
  }
  if (fields.key != null) {
    cols.push('key = ?')
    vals.push(fields.key)
  }
  if (cols.length === 0) return
  vals.push(trackId)
  db.prepare(`UPDATE tracks SET ${cols.join(', ')} WHERE id = ?`).run(...vals)
}

/** Point a track at a relocated file and clear its missing-file flag. */
export function updateTrackFilePath(
  db: Database.Database,
  trackId: string,
  filePath: string
): void {
  db.prepare('UPDATE tracks SET file_path = ?, missing_file = 0 WHERE id = ?').run(
    filePath,
    trackId
  )
}

// ───────── Energy analysis ─────────

export function updateTrackEnergy(
  db: Database.Database,
  trackId: string,
  energy: number,
  energyRaw: number | null,
  source: EnergySource
): void {
  db.prepare('UPDATE tracks SET energy = ?, energy_raw = ?, energy_source = ? WHERE id = ?').run(
    energy,
    energyRaw,
    source,
    trackId
  )
}

export interface PendingEnergyRow {
  id: string
  filePath: string
  bpm: number
  missingFile: number
  /** Metadata the tag rules read once energy is computed. */
  key: string
  genre: string | null
  duration: number
}

export function getPendingEnergyTracks(db: Database.Database): PendingEnergyRow[] {
  const rows = db
    .prepare(
      `SELECT id, file_path, bpm, missing_file, key, genre, duration
       FROM tracks
       WHERE (energy_source = 'pending' OR energy_source IS NULL) AND phantom = 0
       ORDER BY date_added DESC`
    )
    .all() as Array<{
    id: string
    file_path: string
    bpm: number
    missing_file: number
    key: string | null
    genre: string | null
    duration: number | null
  }>
  return rows.map((r) => ({
    id: r.id,
    filePath: r.file_path,
    bpm: r.bpm,
    missingFile: r.missing_file,
    key: r.key ?? '',
    genre: r.genre ?? null,
    duration: r.duration ?? 0
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

/** Persist the normalised audio features used for tag inference. */
export function updateTrackAnalysisFeatures(
  db: Database.Database,
  trackId: string,
  features: TrackAnalysisFeatures
): void {
  db.prepare('UPDATE tracks SET analysis_features = ? WHERE id = ?').run(
    JSON.stringify(features),
    trackId
  )
}

// ───────── Auto-tagging ─────────

/** A track + the metadata the tag rules read, for the (re)tagging passes. */
export interface TagInputRow {
  id: string
  energy: number
  bpm: number
  key: string
  genre: string | null
  duration: number
  analysisFeatures: TrackAnalysisFeatures | null
}

/**
 * Every analysable track with its stored features. The retag pass runs the rules
 * over these without re-decoding audio. Tracks without features yet are skipped
 * by the caller.
 */
export function getTagInputRows(db: Database.Database): TagInputRow[] {
  const rows = db
    .prepare(
      `SELECT id, energy, bpm, key, genre, duration, analysis_features
       FROM tracks
       WHERE phantom = 0`
    )
    .all() as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: r.id as string,
    energy: (r.energy as number | null) ?? 5,
    bpm: (r.bpm as number) ?? 0,
    key: (r.key as string) ?? '',
    genre: (r.genre as string | null) ?? null,
    duration: (r.duration as number) ?? 0,
    analysisFeatures: r.analysis_features
      ? (JSON.parse(r.analysis_features as string) as TrackAnalysisFeatures)
      : null
  }))
}

interface TagRowRaw {
  track_id: string
  category: string
  value: string
  source: string
}

function rawToTag(r: TagRowRaw): TrackTag {
  return { category: r.category as TagCategory, value: r.value, source: r.source as TagSource }
}

/**
 * Attach tags to a set of already-loaded tracks in one query. Empty-string lock
 * markers (a user clearing a category) are filtered out of the visible list.
 */
export function attachTags(db: Database.Database, tracks: Track[]): void {
  if (tracks.length === 0) return
  const rows = db
    .prepare("SELECT track_id, category, value, source FROM track_tags WHERE value != ''")
    .all() as TagRowRaw[]
  const byTrack = new Map<string, TrackTag[]>()
  for (const r of rows) {
    const list = byTrack.get(r.track_id) ?? []
    list.push(rawToTag(r))
    byTrack.set(r.track_id, list)
  }
  for (const t of tracks) t.tags = byTrack.get(t.id) ?? []
}

/** Tags for a single track (visible tags only — lock markers excluded). */
export function getTagsForTrack(db: Database.Database, trackId: string): TrackTag[] {
  const rows = db
    .prepare(
      "SELECT track_id, category, value, source FROM track_tags WHERE track_id = ? AND value != ''"
    )
    .all(trackId) as TagRowRaw[]
  return rows.map(rawToTag)
}

/** Categories a user has manually set for a track — never overwritten by auto-tagging. */
function lockedCategories(db: Database.Database, trackId: string): Set<string> {
  const rows = db
    .prepare("SELECT DISTINCT category FROM track_tags WHERE track_id = ? AND source = 'user'")
    .all(trackId) as Array<{ category: string }>
  return new Set(rows.map((r) => r.category))
}

/**
 * Replace the auto tags for a track, leaving any user-locked categories intact.
 * `autoTags` is the full freshly-inferred set; we only write categories the user
 * hasn't taken over.
 */
export function upsertAutoTags(
  db: Database.Database,
  trackId: string,
  autoTags: Array<{ category: TagCategory; value: string }>
): void {
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    const locked = lockedCategories(db, trackId)
    db.prepare("DELETE FROM track_tags WHERE track_id = ? AND source = 'auto'").run(trackId)
    const insert = db.prepare(
      "INSERT OR REPLACE INTO track_tags (track_id, category, value, source, updated_at) VALUES (?, ?, ?, 'auto', ?)"
    )
    for (const t of autoTags) {
      if (locked.has(t.category)) continue
      insert.run(trackId, t.category, t.value, now)
    }
  })
  tx()
}

/**
 * Set a category's tags from a user override. Clears every existing row in that
 * category and writes user rows. An empty `values` writes a single lock marker
 * (value '') so the category stays user-owned but shows no tags.
 */
export function setUserTags(
  db: Database.Database,
  trackId: string,
  category: TagCategory,
  values: string[]
): void {
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM track_tags WHERE track_id = ? AND category = ?').run(trackId, category)
    const insert = db.prepare(
      "INSERT OR REPLACE INTO track_tags (track_id, category, value, source, updated_at) VALUES (?, ?, ?, 'user', ?)"
    )
    if (values.length === 0) {
      insert.run(trackId, category, '', now)
    } else {
      for (const v of values) insert.run(trackId, category, v, now)
    }
  })
  tx()
}

/**
 * Clear user ownership of a track's tags so the next retag pass re-infers them.
 * With `category` omitted, resets every category.
 */
export function resetTagsToAuto(
  db: Database.Database,
  trackId: string,
  category?: TagCategory
): void {
  if (category) {
    db.prepare(
      "DELETE FROM track_tags WHERE track_id = ? AND category = ? AND source = 'user'"
    ).run(trackId, category)
  } else {
    db.prepare("DELETE FROM track_tags WHERE track_id = ? AND source = 'user'").run(trackId)
  }
}

/** Aggregate counts for the Tags view. */
export function getTagCoverage(db: Database.Database): TagCoverage {
  const total = (
    db.prepare('SELECT COUNT(*) as n FROM tracks WHERE phantom = 0').get() as { n: number }
  ).n
  const tagged = (
    db.prepare("SELECT COUNT(DISTINCT track_id) as n FROM track_tags WHERE value != ''").get() as {
      n: number
    }
  ).n
  const counts = (
    db
      .prepare(
        "SELECT category, value, COUNT(*) as count FROM track_tags WHERE value != '' GROUP BY category, value ORDER BY count DESC"
      )
      .all() as Array<{ category: string; value: string; count: number }>
  ).map((r) => ({ category: r.category as TagCategory, value: r.value, count: r.count }))
  return { totalTracks: total, taggedTracks: tagged, counts }
}

// ───────── Album artwork extraction ─────────

export function updateTrackArtwork(
  db: Database.Database,
  trackId: string,
  albumArtPath: string | null,
  source: ArtworkSource
): void {
  db.prepare('UPDATE tracks SET album_art_path = ?, album_art_source = ? WHERE id = ?').run(
    albumArtPath,
    source,
    trackId
  )
}

export interface PendingArtworkRow {
  id: string
  filePath: string
  missingFile: number
}

export function getPendingArtworkTracks(db: Database.Database): PendingArtworkRow[] {
  const rows = db
    .prepare(
      `SELECT id, file_path, missing_file
       FROM tracks
       WHERE (album_art_source = 'pending' OR album_art_source IS NULL) AND phantom = 0
       ORDER BY date_added DESC`
    )
    .all() as Array<{ id: string; file_path: string; missing_file: number }>
  return rows.map((r) => ({
    id: r.id,
    filePath: r.file_path,
    missingFile: r.missing_file
  }))
}

export function countPendingArtworkTracks(db: Database.Database): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) as n FROM tracks WHERE (album_art_source = 'pending' OR album_art_source IS NULL) AND phantom = 0"
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
    speedTestedAt: (row.speed_tested_at as string) || undefined
  }
}

export function getUSBDevice(db: Database.Database, id: string): USBDeviceRow | undefined {
  const row = db.prepare('SELECT * FROM usb_devices WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  return row ? rowToUSBDevice(row) : undefined
}

export function getAllRememberedUSBDevices(db: Database.Database): USBDeviceRow[] {
  const rows = db.prepare('SELECT * FROM usb_devices ORDER BY last_seen DESC').all() as Record<
    string,
    unknown
  >[]
  return rows.map(rowToUSBDevice)
}

export function upsertUSBDevice(
  db: Database.Database,
  device: Partial<USBDeviceRow> & { id: string; label: string }
): void {
  const now = new Date().toISOString()
  db.prepare(
    `
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
  `
  ).run({
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
    speedTestedAt: device.speedTestedAt ?? null
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

// ───────── Play history (Phase 11) ─────────

function rowToPlaySession(row: Record<string, unknown>): PlaySession {
  return {
    id: row.id as string,
    name: row.name as string,
    source: row.source as PlaySession['source'],
    performedAt: (row.performed_at as string) || undefined,
    venue: (row.venue as string) || undefined,
    venueSource: ((row.venue_source as string) || 'user') as PlaySession['venueSource'],
    eventType: (row.event_type as PlaySession['eventType']) || undefined,
    city: (row.city as string) || undefined,
    country: (row.country as string) || undefined,
    setSlot: (row.set_slot as PlaySession['setSlot']) || undefined,
    duration: (row.duration as number) || undefined,
    setId: (row.set_id as string) || undefined,
    createdAt: row.created_at as string,
    trackCount: (row.track_count as number) ?? 0
  }
}

/**
 * Create a play session with its ordered tracks in a single transaction.
 * Returns the persisted session id.
 */
export function createSession(
  db: Database.Database,
  session: Omit<PlaySession, 'id' | 'createdAt' | 'trackCount'>,
  trackIds: string[]
): string {
  const sessionId = crypto.randomUUID()
  const now = new Date().toISOString()

  const insertSession = db.prepare(`
    INSERT INTO play_sessions (id, name, source, performed_at, venue, duration, set_id, created_at)
    VALUES (@id, @name, @source, @performedAt, @venue, @duration, @setId, @createdAt)
  `)
  const insertTrack = db.prepare(`
    INSERT INTO session_tracks (id, session_id, track_id, play_order, played_at)
    VALUES (@id, @sessionId, @trackId, @playOrder, @playedAt)
  `)

  const tx = db.transaction(() => {
    insertSession.run({
      id: sessionId,
      name: session.name,
      source: session.source,
      performedAt: session.performedAt ?? null,
      venue: session.venue ?? null,
      duration: session.duration ?? null,
      setId: session.setId ?? null,
      createdAt: now
    })
    for (let i = 0; i < trackIds.length; i++) {
      insertTrack.run({
        id: crypto.randomUUID(),
        sessionId,
        trackId: trackIds[i],
        playOrder: i,
        playedAt: session.performedAt ?? null
      })
    }
  })
  tx()
  return sessionId
}

/**
 * All sessions, newest performed_at first, with a track count per session.
 */
export function getSessions(db: Database.Database): PlaySession[] {
  const rows = db
    .prepare(
      `
      SELECT ps.*,
        (SELECT COUNT(*) FROM session_tracks st WHERE st.session_id = ps.id) AS track_count
      FROM play_sessions ps
      ORDER BY ps.performed_at DESC, ps.created_at DESC
    `
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToPlaySession)
}

/**
 * Ordered tracks for a session, joined with full track data.
 */
export function getSessionTracks(db: Database.Database, sessionId: string): SessionTrack[] {
  const rows = db
    .prepare(
      `
      SELECT
        st.id, st.session_id, st.track_id, st.play_order, st.played_at,
        t.id as t_id, t.rekordbox_id, t.title, t.artist, t.album, t.genre,
        t.bpm, t.key, t.key_open, t.energy, t.energy_raw, t.energy_source,
        t.duration, t.file_path, t.file_size, t.bitrate, t.format,
        t.album_art_path, t.album_art_url, t.album_art_source,
        t.play_count, t.rating, t.date_added, t.last_played, t.comment,
        t.label, t.color, t.cue_points, t.hot_cues, t.beatgrid_offset,
        t.art_gradient, t.missing_file, t.phantom, t.discover_meta
      FROM session_tracks st
      JOIN tracks t ON t.id = st.track_id
      WHERE st.session_id = ?
      ORDER BY st.play_order ASC
    `
    )
    .all(sessionId) as Record<string, unknown>[]

  return rows.map((row) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    trackId: row.track_id as string,
    playOrder: row.play_order as number,
    playedAt: (row.played_at as string) || undefined,
    track: rowToTrack({ ...row, id: row.t_id })
  }))
}

/**
 * All sessions containing a given track (for "what did I play after X" queries).
 */
export function getSessionsForTrack(db: Database.Database, trackId: string): PlaySession[] {
  const rows = db
    .prepare(
      `
      SELECT ps.*,
        (SELECT COUNT(*) FROM session_tracks st2 WHERE st2.session_id = ps.id) AS track_count
      FROM play_sessions ps
      JOIN session_tracks st ON st.session_id = ps.id
      WHERE st.track_id = ?
      ORDER BY ps.performed_at DESC, ps.created_at DESC
    `
    )
    .all(trackId) as Record<string, unknown>[]
  return rows.map(rowToPlaySession)
}

export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare('DELETE FROM play_sessions WHERE id = ?').run(sessionId)
}

// ───────── Crowd reactions (Black Box "set flight recorder") ─────────

/** Tolerant JSON-array parse for the peak_ts / dip_ts columns — never throws. */
function reactionTimestamps(v: unknown): number[] {
  if (typeof v !== 'string' || !v) return []
  try {
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) ? (parsed.filter((n) => typeof n === 'number') as number[]) : []
  } catch {
    return []
  }
}

function rowToReaction(row: Record<string, unknown>): SetReaction {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    trackId: row.track_id as string,
    reactionScore: row.reaction_score == null ? undefined : (row.reaction_score as number),
    confidence: row.confidence == null ? undefined : (row.confidence as number),
    peakMs: reactionTimestamps(row.peak_ts),
    dipMs: reactionTimestamps(row.dip_ts),
    source: (row.source as SetReaction['source']) ?? 'blackbox',
    createdAt: row.created_at as string
  }
}

/**
 * Insert or update the measured crowd reaction for one track in one gig. Keyed on
 * (session_id, track_id) so re-analysing a recording overwrites the prior score
 * rather than duplicating it. created_at is preserved on update.
 */
export function upsertReaction(
  db: Database.Database,
  reaction: Omit<SetReaction, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): void {
  db.prepare(
    `
    INSERT INTO set_reactions
      (id, session_id, track_id, reaction_score, confidence, peak_ts, dip_ts, source, created_at)
    VALUES
      (@id, @sessionId, @trackId, @reactionScore, @confidence, @peakTs, @dipTs, @source, @createdAt)
    ON CONFLICT(session_id, track_id) DO UPDATE SET
      reaction_score = excluded.reaction_score,
      confidence     = excluded.confidence,
      peak_ts        = excluded.peak_ts,
      dip_ts         = excluded.dip_ts,
      source         = excluded.source
  `
  ).run({
    id: reaction.id ?? crypto.randomUUID(),
    sessionId: reaction.sessionId,
    trackId: reaction.trackId,
    reactionScore: reaction.reactionScore ?? null,
    confidence: reaction.confidence ?? null,
    peakTs: JSON.stringify(reaction.peakMs ?? []),
    dipTs: JSON.stringify(reaction.dipMs ?? []),
    source: reaction.source ?? 'blackbox',
    createdAt: reaction.createdAt ?? new Date().toISOString()
  })
}

/** Every measured reaction for one gig (unordered; caller joins to play order). */
export function getReactionsForSession(db: Database.Database, sessionId: string): SetReaction[] {
  const rows = db
    .prepare('SELECT * FROM set_reactions WHERE session_id = ?')
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(rowToReaction)
}

/**
 * Every reaction a track has ever drawn, newest gig first — the raw material for
 * the Track Résumé ("kills at 1am warehouse, died at weddings").
 */
export function getReactionsForTrack(db: Database.Database, trackId: string): SetReaction[] {
  const rows = db
    .prepare(
      `
      SELECT sr.* FROM set_reactions sr
      JOIN play_sessions ps ON ps.id = sr.session_id
      WHERE sr.track_id = ?
      ORDER BY ps.performed_at DESC, ps.created_at DESC
    `
    )
    .all(trackId) as Record<string, unknown>[]
  return rows.map(rowToReaction)
}

/**
 * Builds the WHERE fragment + bound params shared by querySessions and
 * getTrackIdsPlayedWhere. Venue/city match case-insensitively (substring);
 * date bounds compare on the YYYY-MM-DD prefix of performed_at. Returns a
 * clause that always starts with " AND " (or '' when no filter is given).
 */
function sessionFilterClause(f: SessionFilter): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  if (f.venue) {
    clauses.push('LOWER(ps.venue) LIKE ?')
    params.push(`%${f.venue.toLowerCase().trim()}%`)
  }
  if (f.city) {
    clauses.push('LOWER(ps.city) LIKE ?')
    params.push(`%${f.city.toLowerCase().trim()}%`)
  }
  if (f.after) {
    clauses.push('ps.performed_at IS NOT NULL AND SUBSTR(ps.performed_at, 1, 10) >= ?')
    params.push(f.after.slice(0, 10))
  }
  if (f.before) {
    clauses.push('ps.performed_at IS NOT NULL AND SUBSTR(ps.performed_at, 1, 10) <= ?')
    params.push(f.before.slice(0, 10))
  }
  if (f.eventType) {
    clauses.push('ps.event_type = ?')
    params.push(f.eventType)
  }
  if (f.setSlot) {
    clauses.push('ps.set_slot = ?')
    params.push(f.setSlot)
  }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params }
}

/**
 * Session-oriented query: returns sessions matching venue/city/date-range/
 * event-type/slot, newest first. Powers "all sets I played in July 2025" and
 * "my festival sets" — the result is a list of gigs, not tracks.
 */
export function querySessions(db: Database.Database, filter: SessionFilter = {}): PlaySession[] {
  const { sql, params } = sessionFilterClause(filter)
  const rows = db
    .prepare(
      `
      SELECT ps.*,
        (SELECT COUNT(*) FROM session_tracks st WHERE st.session_id = ps.id) AS track_count
      FROM play_sessions ps
      WHERE 1=1${sql}
      ORDER BY ps.performed_at DESC, ps.created_at DESC
    `
    )
    .all(...params) as Record<string, unknown>[]
  return rows.map(rowToPlaySession)
}

/**
 * Track-oriented query: the set of track ids that were PLAYED in any session
 * matching the filter. Used to intersect into searchLibrary so questions like
 * "tech house I played at Hi Ibiza in July" combine track filters with gig
 * filters. Returns null when the filter is empty (no constraint to apply).
 */
export function getTrackIdsPlayedWhere(
  db: Database.Database,
  filter: SessionFilter
): Set<string> | null {
  const { sql, params } = sessionFilterClause(filter)
  if (sql === '') return null
  const rows = db
    .prepare(
      `
      SELECT DISTINCT st.track_id AS track_id
      FROM session_tracks st
      JOIN play_sessions ps ON ps.id = st.session_id
      WHERE 1=1${sql}
    `
    )
    .all(...params) as Array<{ track_id: string }>
  return new Set(rows.map((r) => r.track_id))
}

/**
 * Patch a single session's gig metadata. Any field set to a value overwrites;
 * a field set to null clears it; an omitted field is left untouched. Editing
 * the venue promotes venue_source to 'user' so a later Rekordbox re-import
 * won't clobber the manual value.
 */
export function updateSession(
  db: Database.Database,
  sessionId: string,
  patch: SessionMetadataPatch
): void {
  const sets: string[] = []
  const params: Record<string, unknown> = { id: sessionId }
  if ('venue' in patch) {
    sets.push('venue = @venue', "venue_source = 'user'")
    params.venue = patch.venue ?? null
  }
  if ('eventType' in patch) {
    sets.push('event_type = @eventType')
    params.eventType = patch.eventType ?? null
  }
  if ('city' in patch) {
    sets.push('city = @city')
    params.city = patch.city ?? null
  }
  if ('country' in patch) {
    sets.push('country = @country')
    params.country = patch.country ?? null
  }
  if ('setSlot' in patch) {
    sets.push('set_slot = @setSlot')
    params.setSlot = patch.setSlot ?? null
  }
  if (sets.length === 0) return
  db.prepare(`UPDATE play_sessions SET ${sets.join(', ')} WHERE id = @id`).run(params)
}

/**
 * Apply a metadata patch to every session matching a filter (the date-range
 * back-fill workflow, e.g. "everything I played 10–14 July → Hi Ibiza").
 * Returns the number of sessions updated.
 */
export function bulkAssignSessions(
  db: Database.Database,
  filter: SessionFilter,
  patch: SessionMetadataPatch
): number {
  const matches = querySessions(db, filter)
  const tx = db.transaction(() => {
    for (const s of matches) updateSession(db, s.id, patch)
  })
  tx()
  return matches.length
}

/**
 * Reads the ordered set_tracks for a SetSense set, creates a play_sessions row
 * (source='setsense', set_id linked), and increments play_count / updates
 * last_played on each track if the performed date is newer. All in one transaction.
 */
export function markSetAsPerformed(
  db: Database.Database,
  setId: string,
  opts: {
    performedAt?: string
    venue?: string
    eventType?: PlaySession['eventType']
    city?: string
    country?: string
    setSlot?: PlaySession['setSlot']
  } = {}
): string | null {
  const setRow = db.prepare('SELECT * FROM sets WHERE id = ?').get(setId) as
    | Record<string, unknown>
    | undefined
  if (!setRow) return null

  const stRows = db
    .prepare('SELECT track_id FROM set_tracks WHERE set_id = ? ORDER BY position ASC')
    .all(setId) as Array<{ track_id: string }>

  if (stRows.length === 0) return null

  const trackIds = stRows.map((r) => r.track_id)
  const performedAt = opts.performedAt ?? new Date().toISOString()

  // Dedup guard: if a session for this set already exists within the last 60 seconds
  // (same set_id + performed_at within a 1-minute window), return the existing id
  // rather than creating a duplicate. This prevents smoke-test or rapid UI re-clicks
  // from flooding the transition graph with phantom sessions.
  const existing = db
    .prepare(
      `SELECT id FROM play_sessions
       WHERE source = 'setsense' AND set_id = ?
         AND ABS(CAST((julianday(performed_at) - julianday(?)) * 86400 AS INTEGER)) < 60
       LIMIT 1`
    )
    .get(setId, performedAt) as { id: string } | undefined
  if (existing) return existing.id

  const sessionId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Inherit gig metadata from the planned set where the caller didn't override.
  // A set's `venue` column actually stores a VenueType (Set Architect's venueType),
  // so it maps to the session's event_type, not the named-place venue. The set's
  // `vibe` hints at the slot (warmup→opener, closing→closer, peak→peak).
  const VIBE_TO_SLOT: Record<string, PlaySession['setSlot']> = {
    warmup: 'opener',
    closing: 'closer',
    peak: 'peak'
  }
  const eventType = opts.eventType ?? ((setRow.venue as PlaySession['eventType']) || null)
  const setSlot = opts.setSlot ?? (VIBE_TO_SLOT[(setRow.vibe as string) ?? ''] || null)

  const insertSession = db.prepare(`
    INSERT INTO play_sessions
      (id, name, source, performed_at, venue, duration, set_id, created_at,
       event_type, city, country, set_slot, venue_source)
    VALUES
      (@id, @name, @source, @performedAt, @venue, @duration, @setId, @createdAt,
       @eventType, @city, @country, @setSlot, 'user')
  `)
  const insertTrack = db.prepare(`
    INSERT INTO session_tracks (id, session_id, track_id, play_order, played_at)
    VALUES (@id, @sessionId, @trackId, @playOrder, @playedAt)
  `)
  const updatePlayCount = db.prepare(`
    UPDATE tracks
    SET
      play_count = play_count + 1,
      last_played = CASE
        WHEN last_played IS NULL OR last_played < @performedAt THEN @performedAt
        ELSE last_played
      END
    WHERE id = @trackId
  `)

  const tx = db.transaction(() => {
    insertSession.run({
      id: sessionId,
      name: setRow.name as string,
      source: 'setsense',
      performedAt,
      venue: opts.venue ?? null,
      duration: null,
      setId,
      createdAt: now,
      eventType,
      city: opts.city ?? null,
      country: opts.country ?? null,
      setSlot
    })
    for (let i = 0; i < trackIds.length; i++) {
      insertTrack.run({
        id: crypto.randomUUID(),
        sessionId,
        trackId: trackIds[i],
        playOrder: i,
        playedAt: performedAt
      })
      updatePlayCount.run({ trackId: trackIds[i], performedAt })
    }
  })
  tx()
  return sessionId
}

/**
 * Wipe all source='rekordbox' sessions and bulk-insert a fresh batch.
 * Never touches source='setsense' or source='manual' sessions.
 * Idempotent — safe to call on every XML re-import.
 *
 * User-edited gig metadata is preserved across the wipe: before deleting we
 * snapshot every rekordbox session whose venue_source='user', keyed by
 * (name|performed_at), then re-apply it onto the freshly inserted row with the
 * same key. Auto-parsed venues (venue_source='auto') are recomputed each import.
 */
export function replaceRekordboxSessions(
  db: Database.Database,
  sessions: Array<{
    name: string
    performedAt: string | null
    venue: string | null
    venueSource?: 'auto' | 'user'
    trackIds: string[]
  }>
): void {
  const insertSession = db.prepare(`
    INSERT INTO play_sessions
      (id, name, source, performed_at, venue, duration, set_id, created_at, venue_source)
    VALUES (@id, @name, 'rekordbox', @performedAt, @venue, NULL, NULL, @createdAt, @venueSource)
  `)
  const insertTrack = db.prepare(`
    INSERT INTO session_tracks (id, session_id, track_id, play_order, played_at)
    VALUES (@id, @sessionId, @trackId, @playOrder, @playedAt)
  `)
  const updatePlayCount = db.prepare(`
    UPDATE tracks
    SET
      play_count = CASE
        WHEN @playCount > play_count THEN @playCount
        ELSE play_count
      END,
      last_played = CASE
        WHEN @lastPlayed IS NOT NULL AND (last_played IS NULL OR last_played < @lastPlayed) THEN @lastPlayed
        ELSE last_played
      END
    WHERE id = @trackId
  `)
  const restoreUserMeta = db.prepare(`
    UPDATE play_sessions
    SET venue = @venue, event_type = @eventType, city = @city,
        country = @country, set_slot = @setSlot, venue_source = 'user'
    WHERE id = @id
  `)

  const sessionKey = (name: string, performedAt: string | null): string =>
    `${name} ${performedAt ?? ''}`

  const tx = db.transaction(() => {
    // Snapshot user-edited metadata before the wipe so manual venue/city/etc. survive.
    const preservedRows = db
      .prepare(
        `SELECT name, performed_at, venue, event_type, city, country, set_slot
         FROM play_sessions
         WHERE source = 'rekordbox' AND venue_source = 'user'`
      )
      .all() as Array<Record<string, unknown>>
    const preserved = new Map<string, Record<string, unknown>>()
    for (const r of preservedRows) {
      preserved.set(sessionKey(r.name as string, (r.performed_at as string) ?? null), r)
    }

    // Delete only rekordbox-sourced sessions (cascade clears session_tracks).
    db.exec("DELETE FROM play_sessions WHERE source = 'rekordbox'")

    const now = new Date().toISOString()
    for (const s of sessions) {
      const sessionId = crypto.randomUUID()
      insertSession.run({
        id: sessionId,
        name: s.name,
        performedAt: s.performedAt,
        venue: s.venue,
        venueSource: s.venueSource ?? 'auto',
        createdAt: now
      })
      // Re-apply a user's earlier edits for the same gig, if any.
      const prev = preserved.get(sessionKey(s.name, s.performedAt))
      if (prev) {
        restoreUserMeta.run({
          id: sessionId,
          venue: (prev.venue as string) ?? null,
          eventType: (prev.event_type as string) ?? null,
          city: (prev.city as string) ?? null,
          country: (prev.country as string) ?? null,
          setSlot: (prev.set_slot as string) ?? null
        })
      }
      for (let i = 0; i < s.trackIds.length; i++) {
        insertTrack.run({
          id: crypto.randomUUID(),
          sessionId,
          trackId: s.trackIds[i],
          playOrder: i,
          playedAt: s.performedAt
        })
      }
      // Back-fill play stats: if the session has a date, use it as last_played
      // and award at least 1 play per session per track.
      for (const trackId of s.trackIds) {
        updatePlayCount.run({
          trackId,
          playCount: 1,
          lastPlayed: s.performedAt
        })
      }
    }
  })
  tx()
}

export function setTrackLifecycle(
  db: Database.Database,
  trackId: string,
  state: string | null,
  source: 'computed' | 'user'
): void {
  db.prepare('UPDATE tracks SET lifecycle_state = ?, lifecycle_source = ? WHERE id = ?').run(
    state,
    source,
    trackId
  )
}

// ───────── Flag for next gig (Phase 14 — test-at-gig loop) ─────────

/**
 * Flag a batch of tracks for testing at the next gig. Sets `flagged_for_gig_at`
 * to the current ISO timestamp and updates lifecycle_state to 'testing' with
 * source 'user' (so the computed classifier doesn't override the choice).
 */
export function flagTracksForGig(db: Database.Database, trackIds: string[]): void {
  if (trackIds.length === 0) return
  const now = new Date().toISOString()
  const stmt = db.prepare(
    `UPDATE tracks
     SET flagged_for_gig_at = ?, lifecycle_state = 'testing', lifecycle_source = 'user'
     WHERE id = ?`
  )
  const tx = db.transaction(() => {
    for (const id of trackIds) stmt.run(now, id)
  })
  tx()
}

/**
 * Resolve a flag — typically after the user reviews how a tested track went.
 * `outcome` drives the resulting lifecycle_state:
 *  - 'tested' → 'testing' (still testing, but unflagged); fresh user override.
 *    Actually, this should advance to 'active' to indicate the track was successfully
 *    tried at a gig — that's what the change matrix asks for.
 *  - 'archive' → 'archive'
 *  - 'keep'   → leaves lifecycle alone but clears the flag
 */
export function resolveGigFlag(
  db: Database.Database,
  trackId: string,
  outcome: 'tested' | 'archive' | 'keep'
): void {
  if (outcome === 'tested') {
    db.prepare(
      `UPDATE tracks
       SET flagged_for_gig_at = NULL, lifecycle_state = 'active', lifecycle_source = 'user'
       WHERE id = ?`
    ).run(trackId)
  } else if (outcome === 'archive') {
    db.prepare(
      `UPDATE tracks
       SET flagged_for_gig_at = NULL, lifecycle_state = 'archive', lifecycle_source = 'user'
       WHERE id = ?`
    ).run(trackId)
  } else {
    db.prepare(`UPDATE tracks SET flagged_for_gig_at = NULL WHERE id = ?`).run(trackId)
  }
}

/** All tracks currently flagged for the next gig. */
export function getTracksFlaggedForGig(db: Database.Database): Track[] {
  const rows = db
    .prepare(
      `SELECT * FROM tracks
       WHERE flagged_for_gig_at IS NOT NULL
       ORDER BY flagged_for_gig_at DESC, artist ASC, title ASC`
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToTrack)
}

/**
 * Flagged tracks that appeared in a specific session (used post-gig to prompt
 * the user: "you played these flagged tracks — how did they go?").
 */
export function getFlaggedTracksInSession(db: Database.Database, sessionId: string): Track[] {
  const rows = db
    .prepare(
      `SELECT t.* FROM tracks t
       INNER JOIN session_tracks st ON st.track_id = t.id
       WHERE st.session_id = ? AND t.flagged_for_gig_at IS NOT NULL
       ORDER BY st.play_order ASC`
    )
    .all(sessionId) as Record<string, unknown>[]
  return rows.map(rowToTrack)
}

// ───────── Smart crates (Phase 12a) ─────────

export interface SmartCrateRow {
  id: string
  name: string
  rulesJson: string
  matchMode: 'all' | 'any'
  createdAt: string
}

function rowToSmartCrate(row: Record<string, unknown>): SmartCrateRow {
  return {
    id: row.id as string,
    name: row.name as string,
    rulesJson: row.rules_json as string,
    matchMode: (row.match_mode as 'all' | 'any') ?? 'all',
    createdAt: row.created_at as string
  }
}

export function createCrate(db: Database.Database, crate: SmartCrateRow): void {
  db.prepare(
    `
    INSERT INTO smart_crates (id, name, rules_json, match_mode, created_at)
    VALUES (@id, @name, @rulesJson, @matchMode, @createdAt)
  `
  ).run({
    id: crate.id,
    name: crate.name,
    rulesJson: crate.rulesJson,
    matchMode: crate.matchMode,
    createdAt: crate.createdAt
  })
}

export function getCrates(db: Database.Database): SmartCrateRow[] {
  const rows = db.prepare('SELECT * FROM smart_crates ORDER BY created_at ASC').all() as Record<
    string,
    unknown
  >[]
  return rows.map(rowToSmartCrate)
}

export function updateCrate(
  db: Database.Database,
  id: string,
  updates: { name?: string; rulesJson?: string; matchMode?: 'all' | 'any' }
): void {
  const parts: string[] = []
  const params: Record<string, unknown> = { id }

  if (updates.name !== undefined) {
    parts.push('name = @name')
    params.name = updates.name
  }
  if (updates.rulesJson !== undefined) {
    parts.push('rules_json = @rulesJson')
    params.rulesJson = updates.rulesJson
  }
  if (updates.matchMode !== undefined) {
    parts.push('match_mode = @matchMode')
    params.matchMode = updates.matchMode
  }

  if (parts.length === 0) return
  db.prepare(`UPDATE smart_crates SET ${parts.join(', ')} WHERE id = @id`).run(params)
}

export function deleteCrate(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM smart_crates WHERE id = ?').run(id)
}

// ───────── Dismissed duplicate groups (S12 P1) ─────────

/** Normalised keys the user has marked "not actually duplicates" — hidden from Health. */
export function getDismissedDuplicateGroupKeys(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT normalised_key FROM dismissed_duplicate_groups').all() as Array<{
    normalised_key: string
  }>
  return new Set(rows.map((r) => r.normalised_key))
}

export function dismissDuplicateGroup(db: Database.Database, normalisedKey: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO dismissed_duplicate_groups (normalised_key, dismissed_at)
     VALUES (?, ?)`
  ).run(normalisedKey, new Date().toISOString())
}

export function undismissDuplicateGroup(db: Database.Database, normalisedKey: string): void {
  db.prepare('DELETE FROM dismissed_duplicate_groups WHERE normalised_key = ?').run(normalisedKey)
}

/**
 * Remove duplicate setsense sessions: when the same set was marked as performed
 * multiple times in a short burst (e.g. from automated tests or a rapid UI re-click),
 * keep only the earliest session per set_id and delete the rest.
 *
 * Safe to run on every launch — idempotent, never touches rekordbox sessions.
 * Returns the number of duplicate sessions removed.
 */
export function pruneDuplicateSetsenseSessions(db: Database.Database): number {
  // Find set_ids that have more than one setsense session
  const duplicates = db
    .prepare(
      `
      SELECT set_id, COUNT(*) AS cnt, MIN(created_at) AS keep_created_at
      FROM play_sessions
      WHERE source = 'setsense' AND set_id IS NOT NULL
      GROUP BY set_id
      HAVING cnt > 1
    `
    )
    .all() as Array<{ set_id: string; cnt: number; keep_created_at: string }>

  if (duplicates.length === 0) return 0

  let removed = 0
  const tx = db.transaction(() => {
    for (const { set_id, keep_created_at } of duplicates) {
      // Keep the one session with the earliest created_at; delete all others.
      // If two have the same created_at (e.g. tests with identical timestamps),
      // SQLite's rowid ordering picks a deterministic winner.
      const result = db
        .prepare(
          `
          DELETE FROM play_sessions
          WHERE source = 'setsense'
            AND set_id = ?
            AND id NOT IN (
              SELECT id FROM play_sessions
              WHERE source = 'setsense' AND set_id = ?
              ORDER BY created_at ASC, rowid ASC
              LIMIT 1
            )
        `
        )
        .run(set_id, set_id)
      removed += result.changes
      void keep_created_at // used only in query above via MIN()
    }
  })
  tx()
  return removed
}
