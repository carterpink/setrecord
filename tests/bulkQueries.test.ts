import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  deleteTracks,
  bulkUpdateTrackMeta,
  bulkSetEnergy,
  bulkSetUserTags,
  bulkSetLifecycle
} from '../electron/db/queries'

/**
 * better-sqlite3 is a native module built against Electron's Node ABI, so it
 * can't load under plain `vitest`. Skip when the binary can't load (run
 * `npm rebuild better-sqlite3` to exercise locally) rather than failing.
 */
const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

/** Minimal schema covering just what the bulk track ops touch. */
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      bpm REAL, key TEXT, genre TEXT, rating INTEGER, color TEXT, comment TEXT,
      energy INTEGER, energy_raw REAL, energy_source TEXT,
      lifecycle_state TEXT, lifecycle_source TEXT
    );
    CREATE TABLE set_tracks (id TEXT PRIMARY KEY, set_id TEXT, track_id TEXT);
    CREATE TABLE session_tracks (id TEXT PRIMARY KEY, session_id TEXT, track_id TEXT, play_order INTEGER);
    CREATE TABLE set_reactions (id TEXT PRIMARY KEY, session_id TEXT, track_id TEXT);
    CREATE TABLE track_tags (
      track_id TEXT, category TEXT, value TEXT, source TEXT, updated_at TEXT,
      PRIMARY KEY (track_id, category, value)
    );
  `)
  return db
}

function seedTrack(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO tracks (id, bpm, key, genre, rating, energy, energy_source)
     VALUES (?, 120, '8A', 'House', 0, 5, 'computed')`
  ).run(id)
}

describe.skipIf(!dbAvailable)('bulk track queries', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })

  it('deleteTracks removes the tracks and cleans set/session/reaction/tag memberships', () => {
    seedTrack(db, 't1')
    seedTrack(db, 't2')
    seedTrack(db, 't3')
    db.prepare('INSERT INTO set_tracks VALUES (?,?,?)').run('st1', 's1', 't1')
    db.prepare('INSERT INTO session_tracks VALUES (?,?,?,?)').run('se1', 'sess1', 't1', 0)
    db.prepare('INSERT INTO set_reactions VALUES (?,?,?)').run('r1', 'sess1', 't1')
    db.prepare('INSERT INTO track_tags VALUES (?,?,?,?,?)').run('t1', 'vibe', 'dark', 'auto', 'now')

    const removed = deleteTracks(db, ['t1', 't2'])
    expect(removed).toBe(2)
    expect(db.prepare('SELECT COUNT(*) n FROM tracks').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT COUNT(*) n FROM set_tracks WHERE track_id = ?').get('t1')).toEqual({
      n: 0
    })
    expect(
      db.prepare('SELECT COUNT(*) n FROM session_tracks WHERE track_id = ?').get('t1')
    ).toEqual({ n: 0 })
    expect(db.prepare('SELECT COUNT(*) n FROM set_reactions WHERE track_id = ?').get('t1')).toEqual({
      n: 0
    })
    expect(db.prepare('SELECT COUNT(*) n FROM track_tags WHERE track_id = ?').get('t1')).toEqual({
      n: 0
    })
  })

  it('bulkUpdateTrackMeta changes only the provided fields', () => {
    seedTrack(db, 't1')
    seedTrack(db, 't2')
    bulkUpdateTrackMeta(db, ['t1', 't2'], { bpm: 128, genre: 'Techno' })
    const rows = db.prepare('SELECT id, bpm, genre, key FROM tracks ORDER BY id').all()
    expect(rows).toEqual([
      { id: 't1', bpm: 128, genre: 'Techno', key: '8A' },
      { id: 't2', bpm: 128, genre: 'Techno', key: '8A' }
    ])
  })

  it('bulkUpdateTrackMeta with an empty patch is a no-op', () => {
    seedTrack(db, 't1')
    bulkUpdateTrackMeta(db, ['t1'], {})
    expect(db.prepare('SELECT bpm FROM tracks WHERE id = ?').get('t1')).toEqual({ bpm: 120 })
  })

  it('bulkSetEnergy clamps and marks the source as user', () => {
    seedTrack(db, 't1')
    bulkSetEnergy(db, ['t1'], 42)
    expect(db.prepare('SELECT energy, energy_source FROM tracks WHERE id = ?').get('t1')).toEqual({
      energy: 10,
      energy_source: 'user'
    })
  })

  it('bulkSetUserTags supports replace / add / remove', () => {
    seedTrack(db, 't1')
    const values = (): string[] =>
      (
        db
          .prepare("SELECT value FROM track_tags WHERE track_id='t1' AND category='vibe' AND value!=''")
          .all() as Array<{ value: string }>
      )
        .map((r) => r.value)
        .sort()

    bulkSetUserTags(db, ['t1'], 'vibe', ['dark', 'driving'], 'replace')
    expect(values()).toEqual(['dark', 'driving'])

    bulkSetUserTags(db, ['t1'], 'vibe', ['warm'], 'add')
    expect(values()).toEqual(['dark', 'driving', 'warm'])

    bulkSetUserTags(db, ['t1'], 'vibe', ['dark'], 'remove')
    expect(values()).toEqual(['driving', 'warm'])
  })

  it('bulkSetLifecycle sets state with a user source', () => {
    seedTrack(db, 't1')
    bulkSetLifecycle(db, ['t1'], 'archive')
    expect(
      db.prepare('SELECT lifecycle_state, lifecycle_source FROM tracks WHERE id = ?').get('t1')
    ).toEqual({ lifecycle_state: 'archive', lifecycle_source: 'user' })
  })
})
