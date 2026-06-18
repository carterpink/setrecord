import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../electron/db/schema'
import { runMigrations } from '../electron/db/migrations'

/**
 * v23 provenance backfill — classifies pre-existing sessions by evidence,
 * collapses same-day duplicate asserted sessions, and strips asserted
 * inflation back out of tracks.play_count / last_played while preserving
 * counts seeded from the Rekordbox XML PlayCount attribute.
 *
 * Skipped (like the other real-DB suites) when better-sqlite3 can't load
 * under the test runner's Node ABI.
 */
const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

/** A current-schema DB rewound to pre-v23 (no play_sessions.method). */
function makePreV23Db(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  db.exec('DROP INDEX IF EXISTS idx_play_sessions_method')
  db.exec('ALTER TABLE play_sessions DROP COLUMN method')
  return db
}

let trackSeq = 0
function addTrack(db: Database.Database, id: string, playCount: number, lastPlayed?: string): void {
  db.prepare(
    `INSERT INTO tracks (id, title, artist, bpm, play_count, last_played, date_added, file_path)
     VALUES (?, ?, 'Artist', 120, ?, ?, '2025-01-01', ?)`
  ).run(id, `Track ${id}`, playCount, lastPlayed ?? null, `/music/${++trackSeq}.mp3`)
}

function addSession(
  db: Database.Database,
  opts: {
    id: string
    source: 'rekordbox' | 'setrecord' | 'manual'
    performedAt: string | null
    setId?: string
    createdAt?: string
    trackIds?: string[]
    startMs?: number | null
  }
): void {
  db.prepare(
    `INSERT INTO play_sessions (id, name, source, performed_at, set_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    opts.id,
    `Gig ${opts.id}`,
    opts.source,
    opts.performedAt,
    opts.setId ?? null,
    opts.createdAt ?? '2025-01-01T00:00:00.000Z'
  )
  const ids = opts.trackIds ?? []
  for (let i = 0; i < ids.length; i++) {
    db.prepare(
      `INSERT INTO session_tracks (id, session_id, track_id, play_order, played_at, start_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(`${opts.id}-st${i}`, opts.id, ids[i], i, opts.performedAt, opts.startMs ?? null)
  }
}

function methodOf(db: Database.Database, sessionId: string): string | undefined {
  const row = db.prepare('SELECT method FROM play_sessions WHERE id = ?').get(sessionId) as
    | { method: string }
    | undefined
  return row?.method
}

function trackStats(
  db: Database.Database,
  id: string
): { play_count: number; last_played: string | null } {
  return db.prepare('SELECT play_count, last_played FROM tracks WHERE id = ?').get(id) as {
    play_count: number
    last_played: string | null
  }
}

describe.skipIf(!dbAvailable)('v23 provenance backfill', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makePreV23Db()
  })

  it('classifies sessions: rekordbox → imported, audio evidence → live, rest → asserted', () => {
    addTrack(db, 't1', 0)
    addSession(db, {
      id: 'rb',
      source: 'rekordbox',
      performedAt: '2025-02-01T22:00:00.000Z',
      trackIds: ['t1']
    })
    addSession(db, {
      id: 'live',
      source: 'setrecord',
      performedAt: '2025-03-01T22:00:00.000Z',
      trackIds: ['t1'],
      startMs: 0
    })
    addSession(db, {
      id: 'rec',
      source: 'setrecord',
      performedAt: '2025-03-02T22:00:00.000Z',
      trackIds: ['t1']
    })
    db.prepare(
      `INSERT INTO set_recordings (id, session_id, audio_file_path, created_at)
       VALUES ('r1', 'rec', '/tmp/a.webm', '2025-03-02T23:00:00.000Z')`
    ).run()
    addSession(db, {
      id: 'claim',
      source: 'setrecord',
      performedAt: '2025-03-03T22:00:00.000Z',
      trackIds: ['t1']
    })

    runMigrations(db)

    expect(methodOf(db, 'rb')).toBe('imported-history')
    expect(methodOf(db, 'live')).toBe('live-recorded')
    expect(methodOf(db, 'rec')).toBe('live-recorded')
    expect(methodOf(db, 'claim')).toBe('user-asserted')
  })

  it('collapses same-day duplicate asserted sessions but keeps different days', () => {
    db.prepare(
      "INSERT INTO sets (id, name, created_at, updated_at) VALUES ('s1', 'Set', '', '')"
    ).run()
    addTrack(db, 't1', 3)
    addSession(db, {
      id: 'a1',
      source: 'setrecord',
      setId: 's1',
      performedAt: '2025-03-01T10:00:00.000Z',
      createdAt: '2025-03-01T10:00:00.000Z',
      trackIds: ['t1']
    })
    addSession(db, {
      id: 'a2',
      source: 'setrecord',
      setId: 's1',
      performedAt: '2025-03-01T11:30:00.000Z',
      createdAt: '2025-03-01T11:30:00.000Z',
      trackIds: ['t1']
    })
    addSession(db, {
      id: 'a3',
      source: 'setrecord',
      setId: 's1',
      performedAt: '2025-04-01T22:00:00.000Z',
      createdAt: '2025-04-01T22:00:00.000Z',
      trackIds: ['t1']
    })

    runMigrations(db)

    const ids = (
      db.prepare('SELECT id FROM play_sessions ORDER BY id').all() as Array<{ id: string }>
    ).map((r) => r.id)
    expect(ids).toEqual(['a1', 'a3'])
  })

  it('strips asserted inflation from play_count but keeps the XML-seeded floor', () => {
    // t1: XML seeded play_count=5 at library import, then 3 asserted sessions inflated it to 8.
    addTrack(db, 't1', 8)
    for (let i = 1; i <= 3; i++) {
      addSession(db, {
        id: `a${i}`,
        source: 'setrecord',
        performedAt: `2025-0${i}-01T22:00:00.000Z`,
        trackIds: ['t1']
      })
    }
    // t2: one verified live session + one asserted; count was 0 + 1 (live) + 1 (asserted) = 2.
    addTrack(db, 't2', 2)
    addSession(db, {
      id: 'live',
      source: 'setrecord',
      performedAt: '2025-05-01T22:00:00.000Z',
      trackIds: ['t2'],
      startMs: 0
    })
    addSession(db, {
      id: 'a4',
      source: 'setrecord',
      performedAt: '2025-05-02T22:00:00.000Z',
      trackIds: ['t2']
    })

    runMigrations(db)

    expect(trackStats(db, 't1').play_count).toBe(5) // 8 − 3 asserted = XML floor
    expect(trackStats(db, 't2').play_count).toBe(1) // only the live play survives
  })

  it('rolls last_played back to verified evidence when it came from an asserted click', () => {
    const assertedAt = '2025-06-01T22:00:00.000Z'
    const liveAt = '2025-04-01T22:00:00.000Z'
    addTrack(db, 't1', 2, assertedAt)
    addSession(db, {
      id: 'live',
      source: 'setrecord',
      performedAt: liveAt,
      trackIds: ['t1'],
      startMs: 0
    })
    addSession(db, { id: 'a1', source: 'setrecord', performedAt: assertedAt, trackIds: ['t1'] })

    // t2's last_played was seeded from the Rekordbox XML (matches no session) — untouched.
    const xmlDate = '2025-01-15T00:00:00.000Z'
    addTrack(db, 't2', 1, xmlDate)
    addSession(db, {
      id: 'a2',
      source: 'setrecord',
      performedAt: '2025-02-01T22:00:00.000Z',
      trackIds: ['t2']
    })

    runMigrations(db)

    expect(trackStats(db, 't1').last_played).toBe(liveAt)
    expect(trackStats(db, 't2').last_played).toBe(xmlDate)
  })

  it('is one-shot: re-running migrations never re-applies the backfill', () => {
    addTrack(db, 't1', 1)
    addSession(db, {
      id: 'a1',
      source: 'setrecord',
      performedAt: '2025-03-01T22:00:00.000Z',
      trackIds: ['t1']
    })
    runMigrations(db)
    expect(trackStats(db, 't1').play_count).toBe(0)

    // Simulate a verified play after the migration, then relaunch.
    db.prepare('UPDATE tracks SET play_count = 1 WHERE id = ?').run('t1')
    runMigrations(db)
    expect(trackStats(db, 't1').play_count).toBe(1)
  })
})
