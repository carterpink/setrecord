import { describe, it, expect } from 'vitest'
import { computeTrackResume, type ResumeReaction } from '../electron/algorithms/memory/trackResume'
import { buildWorld } from './eval/fixtures'

const NOW = new Date('2025-08-01T00:00:00.000Z')

describe('computeTrackResume — a track’s lived reputation', () => {
  it('summarises live play history across venues', () => {
    const w = buildWorld(NOW)
    const fisher1 = w.byId.get('fisher1')!
    const r = computeTrackResume(fisher1, w.sessions)
    // fisher1 appears in s-lastsat, s-hi, s-festival, s-marathon
    expect(r.timesPlayedLive).toBe(4)
    expect(r.totalPlayCount).toBe(fisher1.playCount)
    const cause = r.venues.find((v) => v.label === 'The Cause')
    expect(cause?.count).toBe(2) // s-lastsat + s-marathon
    expect(r.hasReactionData).toBe(false)
    expect(r.narration).toMatch(/Played live 4×/)
  })

  it('reports an honest empty résumé for a never-played track', () => {
    const w = buildWorld(NOW)
    const fresh = w.byId.get('body8')! // playCount 0, in no sessions
    const r = computeTrackResume(fresh, w.sessions)
    expect(r.timesPlayedLive).toBe(0)
    expect(r.venues).toEqual([])
    expect(r.narration).toMatch(/never played/i)
  })

  it('surfaces a CDJ play-count even with no logged gigs', () => {
    const w = buildWorld(NOW)
    const cdjOnly = { ...w.byId.get('body8')!, playCount: 9 }
    const r = computeTrackResume(cdjOnly, w.sessions)
    expect(r.timesPlayedLive).toBe(0)
    expect(r.narration).toMatch(/play-count of 9/)
  })

  it('ranks where a track lands vs dies when reaction data exists', () => {
    const w = buildWorld(NOW)
    const fisher1 = w.byId.get('fisher1')!
    const reactions: ResumeReaction[] = [
      { sessionId: 's-hi', trackId: 'fisher1', reactionScore: 0.9, confidence: 0.8 }, // Hi Ibiza
      { sessionId: 's-lastsat', trackId: 'fisher1', reactionScore: 0.2, confidence: 0.7 }, // The Cause
      { sessionId: 's-festival', trackId: 'fisher1', reactionScore: 0.6, confidence: 0.6 } // Lost Village
    ]
    const r = computeTrackResume(fisher1, w.sessions, reactions)
    expect(r.hasReactionData).toBe(true)
    expect(r.bestContext?.label).toBe('Hi Ibiza')
    expect(r.worstContext?.label).toBe('The Cause')
    expect(r.narration).toMatch(/Lands hardest at Hi Ibiza/)
    expect(r.narration).toMatch(/Cools at The Cause/)
  })
})
