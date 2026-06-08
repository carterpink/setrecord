import type Database from 'better-sqlite3'

/**
 * Run pending schema migrations in order.
 * Each migration is idempotent — safe to re-run on any startup.
 * NOTE: We check column existence directly rather than relying solely on the version
 * number because an earlier bad deploy briefly wrote schema_version = 2 to existing
 * databases before the ALTER TABLE ran, leaving the column missing at v2.
 */
export function runMigrations(db: Database.Database): void {
  // v2: art_gradient column — check existence unconditionally so corrupt version state can't skip it
  const cols = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!cols.includes('art_gradient')) {
    db.exec('ALTER TABLE tracks ADD COLUMN art_gradient TEXT')
  }

  // v3: per-track missing_file flag (checked on import and background health scan)
  if (!cols.includes('missing_file')) {
    db.exec('ALTER TABLE tracks ADD COLUMN missing_file INTEGER NOT NULL DEFAULT 0')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (3)').run()

  // v4: safety_score column on sets for persisting validation results
  const setCols = (db.prepare('PRAGMA table_info(sets)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!setCols.includes('safety_score')) {
    db.exec('ALTER TABLE sets ADD COLUMN safety_score INTEGER')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (4)').run()

  // v5: auto energy analysis — energy_raw (float) + energy_source provenance.
  // Existing rows are flagged 'pending' so the background analyser backfills them on next launch.
  const colsV5 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV5.includes('energy_raw')) {
    db.exec('ALTER TABLE tracks ADD COLUMN energy_raw REAL')
  }
  if (!colsV5.includes('energy_source')) {
    db.exec("ALTER TABLE tracks ADD COLUMN energy_source TEXT DEFAULT 'pending'")
    // Backfill existing rows: every previously-imported track gets re-analysed,
    // since user chose "always recompute" over preserving Rekordbox values.
    db.exec("UPDATE tracks SET energy_source = 'pending' WHERE energy_source IS NULL")
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (5)').run()

  // v6: phantom track support — tracks imported from Discover with no library match.
  // `phantom` = 1 means file_path is a sentinel `discover://...` URL, not a real file.
  // `discover_meta` is JSON: { discoverSetId, discoverSetTitle, beatportUrl, soundcloudUrl, youtubeUrl }.
  const colsV6 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV6.includes('phantom')) {
    db.exec('ALTER TABLE tracks ADD COLUMN phantom INTEGER NOT NULL DEFAULT 0')
  }
  if (!colsV6.includes('discover_meta')) {
    db.exec('ALTER TABLE tracks ADD COLUMN discover_meta TEXT')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (6)').run()

  // v7: YouTube discovery cache tables.
  // `discovery_sets` stores the full DiscoverSet JSON payload.
  // `discovery_queries` stores search result video-ID lists by query key.
  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_sets (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      tracklist_confidence REAL,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS discovery_queries (
      query_key TEXT PRIMARY KEY,
      video_ids TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_discovery_sets_fetched ON discovery_sets(fetched_at);
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (7)').run()

  // v8: USB device persistence — stores per-device prefs (custom name, favorite, export target,
  // speed test results) so they survive reconnects.
  db.exec(`
    CREATE TABLE IF NOT EXISTS usb_devices (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      custom_name TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_export_target INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL,
      export_count INTEGER NOT NULL DEFAULT 0,
      last_export TEXT,
      read_speed_mbps REAL,
      write_speed_mbps REAL,
      speed_tested_at TEXT
    );
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (8)').run()

  // v9: Rekordbox playlist import — playlists table existed since v1 but was orphaned.
  // Add the is_folder column so the renderer can distinguish folder nodes from leaf playlists.
  const playlistCols = (
    db.prepare('PRAGMA table_info(playlists)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!playlistCols.includes('is_folder')) {
    db.exec('ALTER TABLE playlists ADD COLUMN is_folder INTEGER NOT NULL DEFAULT 0')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (9)').run()

  // v10: per-set-track `locked` flag. When set, Set Architect treats the row as a
  // fixed anchor — preserved in place during rebuilds and skipped in the repair pass.
  const setTrackCols = (
    db.prepare('PRAGMA table_info(set_tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!setTrackCols.includes('locked')) {
    db.exec('ALTER TABLE set_tracks ADD COLUMN locked INTEGER NOT NULL DEFAULT 0')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (10)').run()

  // v11: embedded album-artwork extraction — `album_art_source` tracks the
  // extraction state ('pending' | 'embedded' | 'none' | 'failed') so the
  // background extractor doesn't re-scan files already found to have no art.
  // Existing rows default to 'pending' so they backfill on next launch.
  const colsV11 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV11.includes('album_art_source')) {
    db.exec("ALTER TABLE tracks ADD COLUMN album_art_source TEXT DEFAULT 'pending'")
    db.exec("UPDATE tracks SET album_art_source = 'pending' WHERE album_art_source IS NULL")
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (11)').run()

  // v12: play history sessions layer (DJ memory / Recall feature).
  // play_sessions records dated gig sessions (from Rekordbox, SetRecord, or manual entry).
  // session_tracks stores the ordered tracklist for each session.
  // Two new nullable columns on tracks: lifecycle_state + lifecycle_source.
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      performed_at TEXT,
      venue TEXT,
      duration REAL,
      set_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_tracks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      play_order INTEGER NOT NULL,
      played_at TEXT,
      UNIQUE(session_id, play_order)
    );

    CREATE INDEX IF NOT EXISTS idx_session_tracks_session ON session_tracks(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_tracks_track ON session_tracks(track_id);
    CREATE INDEX IF NOT EXISTS idx_play_sessions_performed ON play_sessions(performed_at);
  `)

  // Add lifecycle columns to tracks (column-existence checked, idempotent)
  const colsV12 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV12.includes('lifecycle_state')) {
    db.exec('ALTER TABLE tracks ADD COLUMN lifecycle_state TEXT')
  }
  if (!colsV12.includes('lifecycle_source')) {
    db.exec("ALTER TABLE tracks ADD COLUMN lifecycle_source TEXT DEFAULT 'computed'")
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (12)').run()

  // v13: smart crates persistence.
  // Stores user-defined and seed smart crate definitions (JSON rules) so they
  // survive app restarts. The engine (electron/algorithms/memory/smartCrates.ts)
  // evaluates them against the in-memory library — this table is purely storage.
  db.exec(`
    CREATE TABLE IF NOT EXISTS smart_crates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'all',
      created_at TEXT NOT NULL
    );
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (13)').run()

  // v14: flagged-for-next-gig column. Set when the user flags an "untested" track
  // for testing at their next gig; cleared after the post-gig prompt resolves it.
  // Lifecycle state ('testing' / 'active' / 'archive') already lives in v12 columns.
  const colsV14 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV14.includes('flagged_for_gig_at')) {
    db.exec('ALTER TABLE tracks ADD COLUMN flagged_for_gig_at TEXT')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (14)').run()

  // v15: dismissed duplicate groups.
  // When the user clicks "Keep all" on a duplicate group in the Health panel
  // we record its normalised key here so it disappears from future health
  // reports without touching the underlying tracks. Re-importing from Rekordbox
  // keeps these dismissals intact (the key is content-based, not id-based).
  db.exec(`
    CREATE TABLE IF NOT EXISTS dismissed_duplicate_groups (
      normalised_key TEXT PRIMARY KEY,
      dismissed_at TEXT NOT NULL
    );
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (15)').run()

  // v16: saved loops per track (Rekordbox-style). JSON array of { startMs, endMs, beats? }.
  // Beatgrid itself reuses existing columns: bpm + beatgrid_offset (first-downbeat anchor).
  const colsV16 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV16.includes('loops')) {
    db.exec("ALTER TABLE tracks ADD COLUMN loops TEXT DEFAULT '[]'")
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (16)').run()

  // v17: auto-tagger.
  // `analysis_features` (JSON: { rms, brightness, loudness, vocalness }, all 0..1)
  // persists the normalised audio features so tags can be re-inferred without
  // re-decoding. `track_tags` stores the plain-language tags (auto + user override).
  // Existing analysed rows are reset to 'pending' so the background analyser
  // backfills features + the new vocal proxy on next launch — the energy cache was
  // bumped to v2 in the same change, so cached scores recompute cleanly anyway.
  // Energy values are unchanged by the recompute (only the vocal feature is new).
  const colsV17 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV17.includes('analysis_features')) {
    db.exec('ALTER TABLE tracks ADD COLUMN analysis_features TEXT')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS track_tags (
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'auto',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (track_id, category, value)
    );

    CREATE INDEX IF NOT EXISTS idx_track_tags_value ON track_tags(value);
    CREATE INDEX IF NOT EXISTS idx_track_tags_track ON track_tags(track_id);
  `)

  // Backfill: re-analyse already-computed tracks so they gain analysis_features +
  // the vocal proxy. Preserve manual energy ('user') and never touch phantoms.
  db.exec(
    "UPDATE tracks SET energy_source = 'pending' WHERE energy_source = 'computed' AND phantom = 0"
  )

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (17)').run()

  // v18: cross-platform import provenance.
  // `source` records which DJ-software library a track was last imported from
  // ('rekordbox' | 'serato'). Nullable: existing rows predate multi-source
  // import and are treated as Rekordbox. Set on import; used for UI labelling
  // and to scope source-specific background passes (e.g. Serato cue extraction).
  const colsV18 = (db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV18.includes('source')) {
    db.exec('ALTER TABLE tracks ADD COLUMN source TEXT')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (18)').run()

  // v19: gig metadata on play_sessions — when/where a set was played, queryable.
  // `event_type` reuses the VenueType vocabulary (club | festival | bar | private |
  // outdoor). `city` / `country` locate the gig beyond the venue name. `set_slot`
  // records the role played (opener | peak | closer | b2b | other). `venue_source`
  // ('auto' | 'user') mirrors the energy_source/tag-source pattern: a venue derived
  // automatically from a Rekordbox history-session name never overwrites a user edit.
  const colsV19 = (
    db.prepare('PRAGMA table_info(play_sessions)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!colsV19.includes('event_type')) {
    db.exec('ALTER TABLE play_sessions ADD COLUMN event_type TEXT')
  }
  if (!colsV19.includes('city')) {
    db.exec('ALTER TABLE play_sessions ADD COLUMN city TEXT')
  }
  if (!colsV19.includes('country')) {
    db.exec('ALTER TABLE play_sessions ADD COLUMN country TEXT')
  }
  if (!colsV19.includes('set_slot')) {
    db.exec('ALTER TABLE play_sessions ADD COLUMN set_slot TEXT')
  }
  if (!colsV19.includes('venue_source')) {
    db.exec("ALTER TABLE play_sessions ADD COLUMN venue_source TEXT NOT NULL DEFAULT 'user'")
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_play_sessions_venue ON play_sessions(venue)')

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (19)').run()

  // v20: reproducible Set Architect generation (FR-305).
  // `architect_seed` persists the variation seed that produced a set so it can
  // be reproduced; `algorithm_version` records the engine version, since the
  // same seed only reproduces within the same version. Both nullable — existing
  // and hand-built sets simply have no seed.
  const colsV20 = (db.prepare('PRAGMA table_info(sets)').all() as Array<{ name: string }>).map(
    (c) => c.name
  )

  if (!colsV20.includes('architect_seed')) {
    db.exec('ALTER TABLE sets ADD COLUMN architect_seed INTEGER')
  }
  if (!colsV20.includes('algorithm_version')) {
    db.exec('ALTER TABLE sets ADD COLUMN algorithm_version INTEGER')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (20)').run()

  // v21: crowd-reaction layer — the Black Box "set flight recorder".
  // One row per (session, track): a normalised reaction_score, a confidence
  // (how trustworthy the crowd-from-mic isolation was), and JSON arrays of
  // cheer/dip timestamps. reaction_score + confidence are NULLABLE — features
  // that consume reactions (The Brief, Track Résumé) must degrade gracefully
  // when a gig has none, which is every gig until Black Box capture ships.
  // UNIQUE(session_id, track_id) lets a re-analysis overwrite cleanly (upsert).
  db.exec(`
    CREATE TABLE IF NOT EXISTS set_reactions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      reaction_score REAL,
      confidence REAL,
      peak_ts TEXT NOT NULL DEFAULT '[]',
      dip_ts TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'blackbox',
      created_at TEXT NOT NULL,
      UNIQUE(session_id, track_id)
    );

    CREATE INDEX IF NOT EXISTS idx_set_reactions_session ON set_reactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_set_reactions_track ON set_reactions(track_id);
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (21)').run()

  // v22: the Flight Recorder's lo-fi reference audio + the tracklist→audio→reaction
  // timeline bridge. `set_recordings` links ONE local audio file (room-mic webm/opus,
  // never uploaded) to a session. `session_tracks.start_ms`/`end_ms` map each track
  // onto that audio timeline (for playback seek), and `match_offset_sec` records how
  // far into the track it was first identified — the seed for reconstructing the clean
  // reference signal that Black Box reaction analysis needs (Phase 3).
  const colsV22 = (
    db.prepare('PRAGMA table_info(session_tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!colsV22.includes('start_ms')) {
    db.exec('ALTER TABLE session_tracks ADD COLUMN start_ms INTEGER')
  }
  if (!colsV22.includes('end_ms')) {
    db.exec('ALTER TABLE session_tracks ADD COLUMN end_ms INTEGER')
  }
  if (!colsV22.includes('match_offset_sec')) {
    db.exec('ALTER TABLE session_tracks ADD COLUMN match_offset_sec REAL')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS set_recordings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
      audio_file_path TEXT NOT NULL,
      audio_format TEXT NOT NULL DEFAULT 'webm-opus',
      audio_duration_sec REAL,
      audio_bytes INTEGER,
      source TEXT NOT NULL DEFAULT 'room-mic',
      created_at TEXT NOT NULL,
      UNIQUE(session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_set_recordings_session ON set_recordings(session_id);
  `)

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (22)').run()
}
