import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  querySessions,
  getTrackIdsPlayedWhere,
  updateSession,
  bulkAssignSessions
} from '../electron/db/queries'

/**
 * better-sqlite3 is a native module built against Electron's Node ABI, so it
 * can't load under plain `vitest` (different NODE_MODULE_VERSION) — the rest of
 * the suite mocks it for the same reason. These are real-DB integration tests;
 * we skip them when the binary can't load (run `npm rebuild better-sqlite3`
 * first to exercise them locally) rather than failing the suite.
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
 * Minimal in-memory schema covering just what the gig queries touch:
 * play_sessions (with the v19 metadata columns) + session_tracks.
 */
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
      venue_source TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE session_tracks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      play_order INTEGER NOT NULL,
      played_at TEXT
    );
  `)
  return db
}

function addSession(
  db: Database.Database,
  s: {
    id: string
    name: string
    performedAt: string | null
    venue?: string | null
    eventType?: string | null
    city?: string | null
    setSlot?: string | null
    venueSource?: string
    trackIds: string[]
  }
): void {
  db.prepare(
    `INSERT INTO play_sessions
       (id, name, source, performed_at, venue, duration, set_id, created_at,
        event_type, city, country, set_slot, venue_source)
     VALUES (@id, @name, 'rekordbox', @performedAt, @venue, NULL, NULL, '2025-01-01',
        @eventType, @city, NULL, @setSlot, @venueSource)`
  ).run({
    id: s.id,
    name: s.name,
    performedAt: s.performedAt,
    venue: s.venue ?? null,
    eventType: s.eventType ?? null,
    city: s.city ?? null,
    setSlot: s.setSlot ?? null,
    venueSource: s.venueSource ?? 'auto'
  })
  s.trackIds.forEach((tid, i) =>
    db
      .prepare('INSERT INTO session_tracks (id, session_id, track_id, play_order) VALUES (?,?,?,?)')
      .run(`${s.id}-${i}`, s.id, tid, i)
  )
}

let db: Database.Database

beforeEach(() => {
  db = makeDb()
  addSession(db, {
    id: 'hi-jul',
    name: 'Hi Ibiza',
    performedAt: '2025-07-12',
    venue: 'Hi Ibiza',
    eventType: 'club',
    city: 'Ibiza',
    trackIds: ['t1', 't2', 't3']
  })
  addSession(db, {
    id: 'hi-aug',
    name: 'Hi Ibiza closing',
    performedAt: '2025-08-02',
    venue: 'Hï Ibiza',
    eventType: 'club',
    city: 'Ibiza',
    setSlot: 'closer',
    trackIds: ['t2', 't4']
  })
  addSession(db, {
    id: 'fest-jul',
    name: 'Tomorrowland',
    performedAt: '2025-07-20',
    venue: 'Tomorrowland',
    eventType: 'festival',
    city: 'Boom',
    trackIds: ['t1', 't5']
  })
  addSession(db, {
    id: 'undated',
    name: 'Mystery gig',
    performedAt: null,
    venue: 'Some Bar',
    eventType: 'bar',
    trackIds: ['t6']
  })
})

describe.skipIf(!dbAvailable)('querySessions', () => {
  it('returns all sessions newest-first with no filter', () => {
    const all = querySessions(db, {})
    expect(all.map((s) => s.id)).toEqual(['hi-aug', 'fest-jul', 'hi-jul', 'undated'])
    expect(all[0].trackCount).toBe(2)
  })

  it('filters by venue (case-insensitive substring)', () => {
    const r = querySessions(db, { venue: 'hi ibiza' })
    expect(r.map((s) => s.id).sort()).toEqual(['hi-jul'])
  })

  it('filters by a month range (July 2025)', () => {
    const r = querySessions(db, { after: '2025-07-01', before: '2025-07-31' })
    expect(r.map((s) => s.id).sort()).toEqual(['fest-jul', 'hi-jul'])
  })

  it('filters by event type', () => {
    const r = querySessions(db, { eventType: 'festival' })
    expect(r.map((s) => s.id)).toEqual(['fest-jul'])
  })

  it('excludes undated sessions from date-bounded queries', () => {
    const r = querySessions(db, { after: '2025-01-01' })
    expect(r.map((s) => s.id)).not.toContain('undated')
  })
})

describe.skipIf(!dbAvailable)('getTrackIdsPlayedWhere', () => {
  it('returns null when no filter is given', () => {
    expect(getTrackIdsPlayedWhere(db, {})).toBeNull()
  })

  it('returns the union of track ids played at a venue', () => {
    const ids = getTrackIdsPlayedWhere(db, { venue: 'tomorrowland' })
    expect([...(ids ?? [])].sort()).toEqual(['t1', 't5'])
  })

  it('returns track ids across a date range', () => {
    const ids = getTrackIdsPlayedWhere(db, { after: '2025-07-01', before: '2025-07-31' })
    // hi-jul {t1,t2,t3} ∪ fest-jul {t1,t5}
    expect([...(ids ?? [])].sort()).toEqual(['t1', 't2', 't3', 't5'])
  })

  it('returns an empty set (not null) when a filter matches nothing', () => {
    const ids = getTrackIdsPlayedWhere(db, { venue: 'nonexistent club' })
    expect(ids).not.toBeNull()
    expect(ids!.size).toBe(0)
  })
})

describe.skipIf(!dbAvailable)('updateSession', () => {
  it('patches venue and promotes venue_source to user', () => {
    updateSession(db, 'hi-jul', { venue: 'Hï Ibiza (main room)', city: 'Ibiza' })
    const row = db
      .prepare('SELECT venue, venue_source, city FROM play_sessions WHERE id = ?')
      .get('hi-jul') as { venue: string; venue_source: string; city: string }
    expect(row.venue).toBe('Hï Ibiza (main room)')
    expect(row.venue_source).toBe('user')
    expect(row.city).toBe('Ibiza')
  })

  it('clears a field when passed null', () => {
    updateSession(db, 'hi-jul', { eventType: null })
    const row = db.prepare('SELECT event_type FROM play_sessions WHERE id = ?').get('hi-jul') as {
      event_type: string | null
    }
    expect(row.event_type).toBeNull()
  })
})

describe.skipIf(!dbAvailable)('bulkAssignSessions', () => {
  it('assigns a venue across a date range and reports the count', () => {
    const n = bulkAssignSessions(
      db,
      { after: '2025-07-01', before: '2025-07-31' },
      { venue: 'Ibiza Residency' }
    )
    expect(n).toBe(2)
    const r = querySessions(db, { venue: 'Ibiza Residency' })
    expect(r.map((s) => s.id).sort()).toEqual(['fest-jul', 'hi-jul'])
  })
})
