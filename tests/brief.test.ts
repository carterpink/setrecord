import { describe, it, expect } from 'vitest'
import { detectBrief } from '../src/utils/briefIntent'
import { computeBrief, type BriefReactionRow } from '../electron/algorithms/memory/brief'
import { buildWorld } from './eval/fixtures'
import type { Track } from '../src/types'

// Fixed "now" so every 2025 fixture session is in the past and recent1 stays fresh.
const NOW = new Date('2025-08-01T00:00:00.000Z')
const ids = (ts: Track[]): string[] => ts.map((t) => t.id)

describe('detectBrief — forward-looking pre-gig requests', () => {
  it('detects "what should I play at <venue>"', () => {
    expect(detectBrief('what should I play at Fabric')).toEqual({ venue: 'fabric' })
  })
  it('detects a named brief and strips the article', () => {
    expect(detectBrief('give me a brief for The Cause')).toEqual({ venue: 'cause' })
  })
  it('detects "I\'m playing <venue> on <day>" and strips the day', () => {
    expect(detectBrief("I'm playing Hi Ibiza on Saturday")).toEqual({ venue: 'hi ibiza' })
  })
  it('captures the slot alongside the venue', () => {
    expect(detectBrief('pre-gig brief for Fabric, peak slot')).toEqual({
      venue: 'fabric',
      setSlot: 'peak'
    })
  })
  it('falls back to event type when no venue is named', () => {
    expect(detectBrief('what should I pack for my festival set')).toEqual({ eventType: 'festival' })
  })
  it('detects a multi-word venue', () => {
    expect(detectBrief('game plan for Warehouse Project')).toEqual({ venue: 'warehouse project' })
  })

  it('ignores backward-looking recall and unrelated intents', () => {
    expect(detectBrief('what did I play at Fabric')).toBeNull()
    expect(detectBrief('last time I was at a warehouse')).toBeNull()
    expect(detectBrief('build me a warmup set')).toBeNull()
    expect(detectBrief('what should I play to warm up')).toBeNull()
    expect(detectBrief("what's my most played track")).toBeNull()
  })
})

describe('computeBrief — game plan from history', () => {
  it('profiles a venue and surfaces tracks that landed there twice', () => {
    const w = buildWorld(NOW)
    const a = computeBrief({ venue: 'fabric' }, w.tracks, w.sessions, w.now)
    expect(a.timesPlayed).toBe(2)
    expect(a.venueLabel).toBe('Fabric')
    expect(ids(a.proven)).toContain('orbital1') // played in both Fabric sets
    expect(a.profile?.topGenres.length).toBeGreaterThan(0)
    expect(a.hasReactionData).toBe(false)
    expect(a.notes.join(' ')).toMatch(/Black Box/) // honest "no reaction data" caveat
  })

  it('matches a venue by case-insensitive substring (The Cause)', () => {
    const w = buildWorld(NOW)
    const a = computeBrief({ venue: 'cause' }, w.tracks, w.sessions, w.now)
    expect(a.timesPlayed).toBe(2)
    expect(ids(a.proven)).toContain('fisher1')
  })

  it('briefs by event type when no venue is given', () => {
    const w = buildWorld(NOW)
    const a = computeBrief({ eventType: 'festival' }, w.tracks, w.sessions, w.now)
    expect(a.timesPlayed).toBe(1)
    expect(a.venueLabel).toMatch(/festival/i)
  })

  it('gives an honest cold brief for a venue never played', () => {
    const w = buildWorld(NOW)
    const a = computeBrief({ venue: 'berghain' }, w.tracks, w.sessions, w.now)
    expect(a.timesPlayed).toBe(0)
    expect(a.proven).toEqual([])
    expect(a.narration).toMatch(/haven't played/i)
  })

  it('uses crowd-reaction data when present: promotes high-reaction tracks and warns on dips', () => {
    const w = buildWorld(NOW)
    const reactions: BriefReactionRow[] = [
      { sessionId: 's-fabric2', trackId: 'caribou1', reactionScore: 0.9, confidence: 0.8 },
      { sessionId: 's-fabric1', trackId: 'orbital1', reactionScore: 0.7, confidence: 0.6 },
      { sessionId: 's-fabric1', trackId: 'surgeon1', reactionScore: 0.1, confidence: 0.7 }
    ]
    const a = computeBrief({ venue: 'fabric' }, w.tracks, w.sessions, w.now, reactions)
    expect(a.hasReactionData).toBe(true)
    expect(ids(a.proven)).toContain('caribou1') // single play, but it killed → proven
    expect(ids(a.proven)).toContain('orbital1')
    expect(a.notes.join(' ')).toMatch(/Magneze/) // surgeon1 underperformed here
  })

  it('puts flagged-for-gig tracks on the bring list, excluding ones already played here', () => {
    const w = buildWorld(NOW)
    // Flag a track that has NOT been played at Fabric.
    const tracks = w.tracks.map((t) =>
      t.id === 'body3' ? { ...t, flaggedForGigAt: NOW.toISOString() } : t
    )
    const a = computeBrief({ venue: 'fabric' }, tracks, w.sessions, w.now)
    expect(ids(a.bring)).toContain('body3')
    // orbital1 was played at Fabric, so it must not appear as something to "bring"
    expect(ids(a.bring)).not.toContain('orbital1')
  })
})
