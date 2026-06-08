import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

/**
 * Highest schema version produced by runMigrations(). BUMP THIS whenever you add
 * a migration step in migrations.ts. It exists so initDb() can tell, before
 * touching anything, whether this launch will actually migrate — and therefore
 * whether it needs to take a pre-migration safety backup. A test pins this to
 * the real max version so the two can't drift.
 */
export const LATEST_SCHEMA_VERSION = 22

export function getDb(): Database.Database {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}

export function getDbPath(): string {
  return join(app.getPath('userData'), 'library.db')
}

/**
 * Open the SQLite library DB and run schema + migrations. Throws if the DB file
 * is locked, corrupted, or in a schema state we can't migrate from. Callers
 * (main.ts) catch this and offer the user a recovery path — see resetDb().
 */
export function initDb(): void {
  const dbPath = getDbPath()
  // Did a real library already exist on disk before we opened it? Only then is
  // there irreplaceable user data to protect with a pre-migration backup.
  const isExistingDb = existsSync(dbPath)
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  // createSchema is all CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE — a no-op
  // on an existing DB, so it never mutates data before we take the backup below.
  createSchema(_db)

  // Take a safety snapshot *before* any schema-mutating migration runs, but only
  // when this launch will actually migrate (current on-disk version is behind).
  // A failed/half-finished migration on a DJ's library is unrecoverable; the
  // backup + the transaction wrapper below are the two nets that prevent that.
  if (isExistingDb && getSchemaVersion(_db) < LATEST_SCHEMA_VERSION) {
    backupBeforeMigration(dbPath, getSchemaVersion(_db))
  }

  // Wrap the whole migration run in ONE transaction. SQLite makes ALTER TABLE
  // transactional, so if anything throws partway the DB rolls back to its exact
  // pre-migration state — no half-applied schema. (runMigrations contains only
  // PRAGMA table_info reads + ALTER/UPDATE/CREATE, all transaction-safe.)
  _db.transaction(() => runMigrations(_db!))()
}

/** Current schema version on disk (migrations record the max value reached). */
function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as {
      v: number | null
    }
    return row?.v ?? 0
  } catch {
    // schema_version table not present yet (brand-new DB) — treat as version 0.
    return 0
  }
}

/**
 * Copy the live DB to `library.db.bak-v{N}` before a migration. We checkpoint
 * the WAL into the main file first so the plain copy is a complete, self-
 * contained snapshot. If the snapshot can't be written (e.g. disk full) we
 * THROW rather than migrate blind — main.ts catches initDb() failures and shows
 * the recovery UI, which is far safer than risking the user's library.
 */
function backupBeforeMigration(dbPath: string, fromVersion: number): void {
  try {
    _db!.pragma('wal_checkpoint(TRUNCATE)')
    const backupPath = `${dbPath}.bak-v${fromVersion}`
    copyFileSync(dbPath, backupPath) // overwriting a stale same-version backup is fine
  } catch (err) {
    throw new Error(
      `Pre-migration backup failed (refusing to migrate to protect your library): ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

/**
 * Quarantine (or delete) the existing library so a fresh DB can be created.
 *
 * On crash-recovery we *rename* rather than delete (`quarantine: true`, the
 * default) so the user can email us their broken DB for a diagnosis, and so an
 * accidental click doesn't nuke a still-recoverable file. On an intentional
 * Fresh Start (`quarantine: false`) we hard-delete — the user asked to wipe it.
 * WAL companion files have to go too either way, or the new DB picks them up.
 */
export function resetDb({ quarantine = true }: { quarantine?: boolean } = {}): void {
  if (_db) {
    try {
      _db.close()
    } catch {
      /* already broken — nothing to close */
    }
    _db = null
  }
  const dbPath = getDbPath()
  if (existsSync(dbPath)) {
    if (quarantine) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const quarantinePath = `${dbPath}.corrupt-${ts}`
      try {
        renameSync(dbPath, quarantinePath)
      } catch (err) {
        console.error('[resetDb] rename failed', err)
        // Best-effort: if rename fails, fall back to delete so init can proceed
        try {
          unlinkSync(dbPath)
        } catch {
          /* nothing more we can do */
        }
      }
    } else {
      try {
        unlinkSync(dbPath)
      } catch (err) {
        console.error('[resetDb] delete failed', err)
      }
    }
  }
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = dbPath + suffix
    if (existsSync(sidecar)) {
      try {
        unlinkSync(sidecar)
      } catch {
        /* best effort */
      }
    }
  }
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      rekordbox_id TEXT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      genre TEXT,
      bpm REAL NOT NULL DEFAULT 0,
      key TEXT,
      key_open TEXT,
      energy INTEGER,
      energy_raw REAL,
      energy_source TEXT DEFAULT 'pending',
      duration REAL NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL UNIQUE,
      file_size INTEGER,
      bitrate INTEGER,
      format TEXT DEFAULT 'unknown',
      album_art_path TEXT,
      album_art_url TEXT,
      album_art_source TEXT DEFAULT 'pending',
      play_count INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      date_added TEXT,
      last_played TEXT,
      comment TEXT,
      label TEXT,
      color TEXT,
      cue_points TEXT DEFAULT '[]',
      hot_cues TEXT DEFAULT '[]',
      loops TEXT DEFAULT '[]',
      beatgrid_offset REAL DEFAULT 0,
      art_gradient TEXT,
      missing_file INTEGER NOT NULL DEFAULT 0,
      phantom INTEGER NOT NULL DEFAULT 0,
      discover_meta TEXT,
      lifecycle_state TEXT,
      lifecycle_source TEXT DEFAULT 'computed',
      flagged_for_gig_at TEXT,
      analysis_features TEXT
    );

    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      target_duration INTEGER,
      target_bpm_min REAL,
      target_bpm_max REAL,
      vibe TEXT,
      venue TEXT,
      slot_time TEXT,
      energy_curve_type TEXT,
      target_hardware TEXT DEFAULT 'CDJ-2000NXS2',
      architect_seed INTEGER,
      algorithm_version INTEGER
    );

    CREATE TABLE IF NOT EXISTS set_tracks (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      position INTEGER NOT NULL,
      energy_override INTEGER,
      notes TEXT,
      transition_score TEXT DEFAULT '{}',
      UNIQUE(set_id, position)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      rekordbox_id TEXT,
      name TEXT NOT NULL,
      parent_id TEXT,
      track_ids TEXT DEFAULT '[]',
      is_folder INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);
    CREATE INDEX IF NOT EXISTS idx_tracks_key ON tracks(key);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_energy ON tracks(energy);
    CREATE INDEX IF NOT EXISTS idx_set_tracks_set_id ON set_tracks(set_id);

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

    CREATE TABLE IF NOT EXISTS play_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      performed_at TEXT,
      venue TEXT,
      duration REAL,
      set_id TEXT,
      created_at TEXT NOT NULL,
      event_type TEXT,
      city TEXT,
      country TEXT,
      set_slot TEXT,
      venue_source TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS session_tracks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      play_order INTEGER NOT NULL,
      played_at TEXT,
      start_ms INTEGER,
      end_ms INTEGER,
      match_offset_sec REAL,
      UNIQUE(session_id, play_order)
    );

    CREATE INDEX IF NOT EXISTS idx_session_tracks_session ON session_tracks(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_tracks_track ON session_tracks(track_id);
    CREATE INDEX IF NOT EXISTS idx_play_sessions_performed ON play_sessions(performed_at);
    CREATE INDEX IF NOT EXISTS idx_play_sessions_venue ON play_sessions(venue);

    CREATE TABLE IF NOT EXISTS smart_crates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'all',
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO schema_version VALUES (1);
  `)
}

export function trackCount(): number {
  if (!_db) return 0
  const row = _db.prepare('SELECT COUNT(*) as n FROM tracks').get() as { n: number }
  return row.n
}
