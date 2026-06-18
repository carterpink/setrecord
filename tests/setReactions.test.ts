import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  upsertReaction,
  getReactionsForSession,
  getReactionsForTrack
} from '../electron/db/queries'

/**
 * Real-DB integration tests for the Black Box reaction layer (set_reactions).
 * better-sqlite3 is built against Electron's Node ABI, so it can't load under
 * plain vitest — we skip when the binary is unavailable (run
 * `npm rebuild better-sqlite3` to exercise locally), matching gigQueries.test.ts.
 */
const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

/** Minimal schema: set_reactions + the play_sessions it joins to for track lookup. */
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE play_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      performed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE set_reactions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      reaction_score REAL,
      confidence REAL,
      peak_ts TEXT NOT NULL DEFAULT '[]',
      dip_ts TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'blackbox',
      created_at TEXT NOT NULL,
      UNIQUE(session_id, track_id)
    );
  `)
  db.prepare(
    "INSERT INTO play_sessions VALUES ('g-mar', 'March gig', '2025-03-01', '2025-03-01')"
  ).run()
  db.prepare(
    "INSERT INTO play_sessions VALUES ('g-jul', 'July gig', '2025-07-01', '2025-07-01')"
  ).run()
  return db
}

let db: Database.Database
beforeEach(() => {
  db = makeDb()
})

describe.skipIf(!dbAvailable)('upsertReaction + getReactionsForSession', () => {
  it('round-trips a measured reaction, parsing peak/dip arrays', () => {
    upsertReaction(db, {
      sessionId: 'g-jul',
      trackId: 't1',
      reactionScore: 0.82,
      confidence: 0.7,
      peakMs: [105000, 220000],
      dipMs: [310000],
      source: 'blackbox'
    })
    const [r] = getReactionsForSession(db, 'g-jul')
    expect(r.reactionScore).toBeCloseTo(0.82)
    expect(r.confidence).toBeCloseTo(0.7)
    expect(r.peakMs).toEqual([105000, 220000])
    expect(r.dipMs).toEqual([310000])
    expect(r.source).toBe('blackbox')
  })

  it('leaves an unmeasured reaction as undefined scores (graceful degradation)', () => {
    upsertReaction(db, {
      sessionId: 'g-jul',
      trackId: 't2',
      peakMs: [],
      dipMs: [],
      source: 'derived'
    })
    const r = getReactionsForSession(db, 'g-jul').find((x) => x.trackId === 't2')!
    expect(r.reactionScore).toBeUndefined()
    expect(r.confidence).toBeUndefined()
    expect(r.peakMs).toEqual([])
  })

  it('overwrites on (session, track) conflict instead of duplicating', () => {
    upsertReaction(db, {
      sessionId: 'g-jul',
      trackId: 't1',
      reactionScore: 0.3,
      peakMs: [],
      dipMs: [],
      source: 'blackbox'
    })
    upsertReaction(db, {
      sessionId: 'g-jul',
      trackId: 't1',
      reactionScore: 0.9,
      peakMs: [1000],
      dipMs: [],
      source: 'user'
    })
    const rows = getReactionsForSession(db, 'g-jul')
    expect(rows).toHaveLength(1)
    expect(rows[0].reactionScore).toBeCloseTo(0.9)
    expect(rows[0].source).toBe('user')
    expect(rows[0].peakMs).toEqual([1000])
  })

  it('tolerates corrupt JSON in the timestamp columns', () => {
    db.prepare(
      "INSERT INTO set_reactions (id, session_id, track_id, peak_ts, dip_ts, created_at) VALUES ('x','g-jul','t9','not json','{bad','2025-07-01')"
    ).run()
    const r = getReactionsForSession(db, 'g-jul').find((x) => x.trackId === 't9')!
    expect(r.peakMs).toEqual([])
    expect(r.dipMs).toEqual([])
  })
})

describe.skipIf(!dbAvailable)('getReactionsForTrack', () => {
  it('returns a track’s reactions across gigs, newest gig first', () => {
    upsertReaction(db, {
      sessionId: 'g-mar',
      trackId: 't1',
      reactionScore: 0.5,
      peakMs: [],
      dipMs: [],
      source: 'blackbox'
    })
    upsertReaction(db, {
      sessionId: 'g-jul',
      trackId: 't1',
      reactionScore: 0.8,
      peakMs: [],
      dipMs: [],
      source: 'blackbox'
    })
    const rows = getReactionsForTrack(db, 't1')
    expect(rows.map((r) => r.sessionId)).toEqual(['g-jul', 'g-mar'])
  })

  it('returns an empty array for a track with no reactions', () => {
    expect(getReactionsForTrack(db, 'never-played')).toEqual([])
  })
})
