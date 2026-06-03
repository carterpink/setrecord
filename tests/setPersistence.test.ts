import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { saveSet, getSetById } from '../electron/db/queries'
import { ARCHITECT_ALGORITHM_VERSION, type Set as DJSet } from '../src/types'

/**
 * better-sqlite3 is a native module built against Electron's Node ABI, so it
 * can't load under plain vitest. Skip these real-DB tests when the binary can't
 * load (run `npm run rebuild` to exercise them locally) rather than failing.
 */
const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

/**
 * Minimal in-memory schema covering what saveSet/getSetById touch: the `sets`
 * table (with the v20 seed columns) plus `set_tracks` + a `tracks` table so the
 * SET_TRACKS_JOIN resolves. Tests use seed-only, empty-tracklist sets so the
 * join returns no rows — we're proving the seed columns round-trip.
 */
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE sets (
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
      safety_score INTEGER,
      architect_seed INTEGER,
      algorithm_version INTEGER
    );

    CREATE TABLE set_tracks (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      energy_override INTEGER,
      notes TEXT,
      transition_score TEXT DEFAULT '{}',
      locked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      rekordbox_id TEXT,
      source TEXT,
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
  `)
  return db
}

function baseSet(overrides: Partial<DJSet> = {}): DJSet {
  return {
    id: 's-1',
    name: 'Test set',
    createdAt: '2026-06-03T00:00:00Z',
    updatedAt: '2026-06-03T00:00:00Z',
    tracks: [],
    vibe: 'peak',
    ...overrides
  }
}

describe.skipIf(!dbAvailable)('set persistence — architect seed (FR-305)', () => {
  it('round-trips architectSeed + algorithmVersion through save/load', () => {
    const db = makeDb()
    saveSet(db, baseSet({ architectSeed: 123456, algorithmVersion: ARCHITECT_ALGORITHM_VERSION }))
    const loaded = getSetById(db, 's-1')
    expect(loaded?.architectSeed).toBe(123456)
    expect(loaded?.algorithmVersion).toBe(ARCHITECT_ALGORITHM_VERSION)
  })

  it('persists seed 0 (falsy but valid) rather than dropping it', () => {
    const db = makeDb()
    saveSet(db, baseSet({ id: 's-zero', architectSeed: 0, algorithmVersion: 1 }))
    const loaded = getSetById(db, 's-zero')
    expect(loaded?.architectSeed).toBe(0)
  })

  it('leaves seed undefined for hand-built sets', () => {
    const db = makeDb()
    saveSet(db, baseSet({ id: 's-manual' }))
    const loaded = getSetById(db, 's-manual')
    expect(loaded?.architectSeed).toBeUndefined()
    expect(loaded?.algorithmVersion).toBeUndefined()
  })

  it('updates the seed on re-save (upsert path)', () => {
    const db = makeDb()
    saveSet(db, baseSet({ architectSeed: 111, algorithmVersion: 1 }))
    saveSet(db, baseSet({ architectSeed: 222, algorithmVersion: 1 }))
    expect(getSetById(db, 's-1')?.architectSeed).toBe(222)
  })
})
