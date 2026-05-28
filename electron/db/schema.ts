import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, renameSync, unlinkSync } from 'fs'
import { join } from 'path'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

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
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  createSchema(_db)
  runMigrations(_db)
}

/**
 * Quarantine the existing library so a fresh DB can be created. We rename
 * rather than delete so the user can email us their broken DB if they want a
 * diagnosis — and so accidental clicks don't nuke a still-recoverable file.
 * WAL companion files have to go too or the new DB will pick them up.
 */
export function resetDb(): void {
  if (_db) {
    try { _db.close() } catch { /* already broken — nothing to close */ }
    _db = null
  }
  const dbPath = getDbPath()
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const quarantine = `${dbPath}.corrupt-${ts}`
  if (existsSync(dbPath)) {
    try { renameSync(dbPath, quarantine) } catch (err) {
      console.error('[resetDb] rename failed', err)
      // Best-effort: if rename fails, fall back to delete so init can proceed
      try { unlinkSync(dbPath) } catch { /* nothing more we can do */ }
    }
  }
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = dbPath + suffix
    if (existsSync(sidecar)) {
      try { unlinkSync(sidecar) } catch { /* best effort */ }
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
      beatgrid_offset REAL DEFAULT 0,
      art_gradient TEXT,
      missing_file INTEGER NOT NULL DEFAULT 0,
      phantom INTEGER NOT NULL DEFAULT 0,
      discover_meta TEXT,
      lifecycle_state TEXT,
      lifecycle_source TEXT DEFAULT 'computed',
      flagged_for_gig_at TEXT
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
      target_hardware TEXT DEFAULT 'CDJ-2000NXS2'
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

    CREATE TABLE IF NOT EXISTS smart_crates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'all',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO schema_version VALUES (1);
  `)
}

export function trackCount(): number {
  if (!_db) return 0
  const row = _db.prepare('SELECT COUNT(*) as n FROM tracks').get() as { n: number }
  return row.n
}
