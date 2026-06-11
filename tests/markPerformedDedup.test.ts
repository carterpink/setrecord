import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../electron/db/schema'
import { markSetAsPerformed } from '../electron/db/queries'

/**
 * markSetAsPerformed — a user-asserted diary entry, NOT evidence:
 *   • never touches tracks.play_count / last_played
 *   • one session per set per local calendar day (force overrides after confirm)
 *   • stamped method='user-asserted'
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

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  db.prepare(
    "INSERT INTO sets (id, name, created_at, updated_at) VALUES ('s1', 'Set', '', '')"
  ).run()
  for (const id of ['t1', 't2']) {
    db.prepare(
      `INSERT INTO tracks (id, title, artist, bpm, play_count, date_added, file_path)
       VALUES (?, ?, 'Artist', 120, 0, '2025-01-01', ?)`
    ).run(id, `Track ${id}`, `/music/${id}.mp3`)
  }
  db.prepare(
    "INSERT INTO set_tracks (id, set_id, track_id, position) VALUES ('st1', 's1', 't1', 0)"
  ).run()
  db.prepare(
    "INSERT INTO set_tracks (id, set_id, track_id, position) VALUES ('st2', 's1', 't2', 1)"
  ).run()
  return db
}

describe.skipIf(!dbAvailable)('markSetAsPerformed', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('creates a user-asserted session and never bumps play stats', () => {
    const res = markSetAsPerformed(db, 's1', { performedAt: '2025-03-01T10:00:00.000Z' })
    expect(res).not.toBeNull()
    expect(res!.alreadyPerformedToday).toBe(false)

    const session = db
      .prepare('SELECT method, source FROM play_sessions WHERE id = ?')
      .get(res!.sessionId) as { method: string; source: string }
    expect(session.method).toBe('user-asserted')
    expect(session.source).toBe('setrecord')

    const t1 = db.prepare("SELECT play_count, last_played FROM tracks WHERE id = 't1'").get() as {
      play_count: number
      last_played: string | null
    }
    expect(t1.play_count).toBe(0)
    expect(t1.last_played).toBeNull()
  })

  it('blocks a second mark on the same local day and returns the existing session', () => {
    const first = markSetAsPerformed(db, 's1', { performedAt: '2025-03-01T10:00:00.000Z' })
    const dup = markSetAsPerformed(db, 's1', { performedAt: '2025-03-01T11:30:00.000Z' })
    expect(dup!.alreadyPerformedToday).toBe(true)
    expect(dup!.sessionId).toBe(first!.sessionId)
    expect(db.prepare('SELECT COUNT(*) AS n FROM play_sessions').get()).toEqual({ n: 1 })
  })

  it('force creates a second same-day session after the user confirms', () => {
    const first = markSetAsPerformed(db, 's1', { performedAt: '2025-03-01T10:00:00.000Z' })
    const forced = markSetAsPerformed(db, 's1', {
      performedAt: '2025-03-01T11:30:00.000Z',
      force: true
    })
    expect(forced!.alreadyPerformedToday).toBe(false)
    expect(forced!.sessionId).not.toBe(first!.sessionId)
    expect(db.prepare('SELECT COUNT(*) AS n FROM play_sessions').get()).toEqual({ n: 2 })
  })

  it('allows marking the same set on a different day', () => {
    markSetAsPerformed(db, 's1', { performedAt: '2025-03-01T10:00:00.000Z' })
    const next = markSetAsPerformed(db, 's1', { performedAt: '2025-03-02T10:00:00.000Z' })
    expect(next!.alreadyPerformedToday).toBe(false)
    expect(db.prepare('SELECT COUNT(*) AS n FROM play_sessions').get()).toEqual({ n: 2 })
  })
})
