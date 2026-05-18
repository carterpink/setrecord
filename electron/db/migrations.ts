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
  const cols = (
    db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!cols.includes('art_gradient')) {
    db.exec('ALTER TABLE tracks ADD COLUMN art_gradient TEXT')
  }

  // v3: per-track missing_file flag (checked on import and background health scan)
  if (!cols.includes('missing_file')) {
    db.exec('ALTER TABLE tracks ADD COLUMN missing_file INTEGER NOT NULL DEFAULT 0')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (3)').run()

  // v4: safety_score column on sets for persisting validation results
  const setCols = (
    db.prepare('PRAGMA table_info(sets)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!setCols.includes('safety_score')) {
    db.exec('ALTER TABLE sets ADD COLUMN safety_score INTEGER')
  }

  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (4)').run()

  // v5: auto energy analysis — energy_raw (float) + energy_source provenance.
  // Existing rows are flagged 'pending' so the background analyser backfills them on next launch.
  const colsV5 = (
    db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

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
  const colsV6 = (
    db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

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
}
