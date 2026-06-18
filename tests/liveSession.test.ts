import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { createLiveSession } from '../electron/db/queries'

/**
 * createLiveSession — the Flight Recorder's persistence: a setrecord play_session
 * plus its ordered, individually-timestamped tracklist, with play_count/last_played
 * bumps. better-sqlite3 is a native module built against Electron's ABI, so it may
 * not load under plain vitest; skip rather than fail when it can't (run
 * `npm rebuild better-sqlite3` to exercise locally).
 */
const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

/** Minimal schema covering just what createLiveSession touches. */
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE play_sessions (
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
      venue_source TEXT NOT NULL DEFAULT 'user',
      method TEXT NOT NULL DEFAULT 'user-asserted'
    );
    CREATE TABLE session_tracks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      play_order INTEGER NOT NULL,
      played_at TEXT,
      start_ms INTEGER,
      end_ms INTEGER,
      match_offset_sec REAL,
      UNIQUE(session_id, play_order)
    );
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      play_count INTEGER DEFAULT 0,
      last_played TEXT
    );
  `)
  const ins = db.prepare(
    'INSERT INTO tracks (id, title, artist, play_count, last_played) VALUES (?,?,?,?,?)'
  )
  ins.run('t1', 'One', 'A', 0, null)
  ins.run('t2', 'Two', 'B', 2, '2030-01-01T00:00:00.000Z') // already has a far-future last_played
  return db
}

describe.skipIf(!dbAvailable)('createLiveSession', () => {
  it('persists an ordered, individually-timestamped setrecord session', () => {
    const db = makeDb()
    const id = createLiveSession(db, {
      name: 'Hï Ibiza',
      venue: 'Hï Ibiza',
      performedAt: '2025-07-12T22:00:00.000Z',
      durationSec: 3600,
      tracks: [
        {
          trackId: 't1',
          playedAt: '2025-07-12T22:00:00.000Z',
          startMs: 0,
          endMs: 330000,
          matchOffsetSec: 12
        },
        {
          trackId: 't2',
          playedAt: '2025-07-12T22:05:30.000Z',
          startMs: 330000,
          endMs: 3600000,
          matchOffsetSec: 0
        }
      ]
    })
    expect(id).toBeTypeOf('string')

    const session = db.prepare('SELECT * FROM play_sessions WHERE id = ?').get(id) as Record<
      string,
      unknown
    >
    expect(session.source).toBe('setrecord')
    expect(session.venue).toBe('Hï Ibiza')
    expect(session.venue_source).toBe('user')
    expect(session.duration).toBe(3600)
    expect(session.performed_at).toBe('2025-07-12T22:00:00.000Z')

    const sts = db
      .prepare(
        'SELECT track_id, play_order, played_at, start_ms, end_ms, match_offset_sec FROM session_tracks WHERE session_id = ? ORDER BY play_order'
      )
      .all(id) as Array<Record<string, unknown>>
    expect(sts).toEqual([
      {
        track_id: 't1',
        play_order: 0,
        played_at: '2025-07-12T22:00:00.000Z',
        start_ms: 0,
        end_ms: 330000,
        match_offset_sec: 12
      },
      {
        track_id: 't2',
        play_order: 1,
        played_at: '2025-07-12T22:05:30.000Z',
        start_ms: 330000,
        end_ms: 3600000,
        match_offset_sec: 0
      }
    ])
  })

  it('bumps play_count, and last_played only when the played time is newer', () => {
    const db = makeDb()
    createLiveSession(db, {
      name: 'Set',
      performedAt: '2025-07-12T22:00:00.000Z',
      tracks: [
        { trackId: 't1', playedAt: '2025-07-12T22:00:00.000Z' },
        { trackId: 't2', playedAt: '2025-07-12T22:05:30.000Z' }
      ]
    })
    const rows = db
      .prepare('SELECT id, play_count, last_played FROM tracks ORDER BY id')
      .all() as Array<{
      id: string
      play_count: number
      last_played: string | null
    }>
    // t1: 0 → 1, last_played set from null.
    expect(rows[0]).toEqual({ id: 't1', play_count: 1, last_played: '2025-07-12T22:00:00.000Z' })
    // t2: 2 → 3, but last_played stays at its newer (2030) value.
    expect(rows[1]).toEqual({ id: 't2', play_count: 3, last_played: '2030-01-01T00:00:00.000Z' })
  })

  it('writes nothing and returns null when there are no tracks', () => {
    const db = makeDb()
    const id = createLiveSession(db, {
      name: 'Empty',
      performedAt: '2025-07-12T22:00:00.000Z',
      tracks: []
    })
    expect(id).toBeNull()
    expect((db.prepare('SELECT COUNT(*) AS n FROM play_sessions').get() as { n: number }).n).toBe(0)
  })
})
