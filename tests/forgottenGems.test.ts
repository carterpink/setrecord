import { describe, it, expect } from 'vitest'
import { findForgottenGems } from '../electron/algorithms/memory/forgottenGems'
import { makeTrack } from './fixtures'

const NOW = new Date('2026-01-01T00:00:00Z')

// Helpers to create dates relative to NOW
function monthsBack(n: number): string {
  const d = new Date(NOW)
  d.setMonth(d.getMonth() - n)
  return d.toISOString()
}

describe('findForgottenGems', () => {
  it('returns empty array for empty library', () => {
    expect(findForgottenGems([])).toEqual([])
  })

  it('excludes never-played tracks (playCount 0 / no lastPlayed)', () => {
    const tracks = [makeTrack({ id: 't1', playCount: 0, rating: 5, dateAdded: monthsBack(24) })]
    expect(findForgottenGems(tracks, { now: NOW })).toHaveLength(0)
  })

  it('excludes recently-played tracks even if high playCount', () => {
    const tracks = [
      makeTrack({ id: 't1', playCount: 20, lastPlayed: monthsBack(2), dateAdded: monthsBack(36) })
    ]
    expect(findForgottenGems(tracks, { now: NOW })).toHaveLength(0)
  })

  it('excludes tracks with below-average playCount and no rating', () => {
    // Inject a high-play track to push avg up so the low-count track is below avg
    const tracks2 = [
      makeTrack({
        id: 'popular',
        playCount: 100,
        lastPlayed: monthsBack(1),
        dateAdded: monthsBack(24)
      }),
      makeTrack({
        id: 'low',
        playCount: 1,
        lastPlayed: monthsBack(12),
        dateAdded: monthsBack(24),
        rating: 0
      })
    ]
    const gems = findForgottenGems(tracks2, { now: NOW })
    // popular is recent, low has below-avg count + no rating
    expect(gems.map((g) => g.track.id)).not.toContain('low')
  })

  it('surfaces a highly-played dormant track', () => {
    const tracks = [
      makeTrack({
        id: 'gem',
        playCount: 20,
        lastPlayed: monthsBack(10),
        dateAdded: monthsBack(36),
        rating: 0
      })
    ]
    const gems = findForgottenGems(tracks, { now: NOW })
    expect(gems).toHaveLength(1)
    expect(gems[0].track.id).toBe('gem')
    expect(gems[0].monthsDormant).toBeGreaterThan(9)
    expect(gems[0].reason).toContain('dormant')
  })

  it('surfaces a high-rated dormant track even with below-avg play count', () => {
    const tracks = [
      // high avg from other tracks
      makeTrack({
        id: 'banger',
        playCount: 50,
        lastPlayed: monthsBack(1),
        dateAdded: monthsBack(24)
      }),
      makeTrack({
        id: 'rated',
        playCount: 2,
        lastPlayed: monthsBack(9),
        dateAdded: monthsBack(24),
        rating: 5
      })
    ]
    const gems = findForgottenGems(tracks, { now: NOW })
    expect(gems.map((g) => g.track.id)).toContain('rated')
  })

  it('respects minMonthsDormant option', () => {
    const tracks = [
      makeTrack({ id: 'a', playCount: 10, lastPlayed: monthsBack(3), dateAdded: monthsBack(24) }),
      makeTrack({ id: 'b', playCount: 10, lastPlayed: monthsBack(8), dateAdded: monthsBack(24) })
    ]
    const gems3 = findForgottenGems(tracks, { now: NOW, minMonthsDormant: 2 })
    const gems6 = findForgottenGems(tracks, { now: NOW, minMonthsDormant: 6 })

    expect(gems3.map((g) => g.track.id)).toContain('a')
    expect(gems3.map((g) => g.track.id)).toContain('b')
    expect(gems6.map((g) => g.track.id)).not.toContain('a')
    expect(gems6.map((g) => g.track.id)).toContain('b')
  })

  it('respects limit option', () => {
    const tracks = Array.from({ length: 10 }, (_, i) =>
      makeTrack({
        id: `t${i}`,
        playCount: 10 + i,
        lastPlayed: monthsBack(8 + i),
        dateAdded: monthsBack(36)
      })
    )
    const gems = findForgottenGems(tracks, { now: NOW, limit: 3 })
    expect(gems).toHaveLength(3)
  })

  it('returns results ranked descending by score', () => {
    const tracks = [
      // More dormant + higher count should score higher
      makeTrack({ id: 'low', playCount: 5, lastPlayed: monthsBack(7), dateAdded: monthsBack(36) }),
      makeTrack({
        id: 'high',
        playCount: 50,
        lastPlayed: monthsBack(24),
        dateAdded: monthsBack(36)
      })
    ]
    const gems = findForgottenGems(tracks, { now: NOW })
    expect(gems[0].track.id).toBe('high')
  })

  it('includes rating info in reason when track is high-rated', () => {
    const tracks = [
      makeTrack({
        id: 'r',
        playCount: 3,
        lastPlayed: monthsBack(8),
        dateAdded: monthsBack(24),
        rating: 4
      })
    ]
    const gems = findForgottenGems(tracks, { now: NOW })
    expect(gems[0].reason).toContain('4★')
  })

  it('handles single track library', () => {
    const tracks = [
      makeTrack({ id: 'only', playCount: 1, lastPlayed: monthsBack(8), dateAdded: monthsBack(24) })
    ]
    const gems = findForgottenGems(tracks, { now: NOW })
    expect(gems).toHaveLength(1)
    expect(gems[0].track.id).toBe('only')
  })
})
