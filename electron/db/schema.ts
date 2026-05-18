import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'library.db')
  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  createSchema(_db)
  runMigrations(_db)
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
      discover_meta TEXT
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
      track_ids TEXT DEFAULT '[]'
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

    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
    INSERT OR IGNORE INTO schema_version VALUES (1);
  `)
}

export function trackCount(): number {
  if (!_db) return 0
  const row = _db.prepare('SELECT COUNT(*) as n FROM tracks').get() as { n: number }
  return row.n
}
