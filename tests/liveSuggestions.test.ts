/**
 * getLiveNextUp — consequence framing on top of the existing suggestions brain.
 */
import { describe, it, expect } from 'vitest'
import { getLiveNextUp, consequenceSummary } from '../electron/algorithms/liveSuggestions'
import { makeTrack } from './fixtures'
import type { Set as DJSet } from '../src/types'

const emptySet: DJSet = {
  id: 'set-1',
  name: 'Live',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  tracks: []
}

describe('consequenceSummary', () => {
  it('leads with harmony, then energy, then BPM, signed', () => {
    expect(consequenceSummary('perfect', 2, 1)).toBe('Perfect harmony · +1 energy · +2 BPM')
    expect(consequenceSummary('clash', 0, 0)).toBe('Key clash · holds energy · same BPM')
    expect(consequenceSummary('compatible', -1.5, -2)).toBe('Harmonic · -2 energy · -1.5 BPM')
    expect(consequenceSummary('neutral', 0.5, 3)).toBe('Key OK · +3 energy · +0.5 BPM')
  })
})

describe('getLiveNextUp', () => {
  const current = makeTrack({ id: 'cur', bpm: 124, key: '8A', energy: 5, artist: 'Now' })
  const library = [
    current,
    makeTrack({ id: 'a', title: 'Harmonic Up', bpm: 124, key: '8A', energy: 6, artist: 'A' }),
    makeTrack({ id: 'b', title: 'Faster', bpm: 126, key: '9A', energy: 7, artist: 'B' }),
    makeTrack({ id: 'c', title: 'Clasher', bpm: 125, key: '3A', energy: 5, artist: 'C' }),
    makeTrack({ id: 'd', title: 'Slower', bpm: 122, key: '7A', energy: 4, artist: 'D' })
  ]

  it('returns consequence-framed options with signed deltas', () => {
    const next = getLiveNextUp(current, library, emptySet, 3)
    expect(next.length).toBeGreaterThan(0)
    expect(next.length).toBeLessThanOrEqual(3)
    // Exactly one best, at the front.
    expect(next[0].best).toBe(true)
    expect(next.filter((n) => n.best)).toHaveLength(1)

    for (const n of next) {
      const expectedBpm = Math.round((n.track.bpm - 124) * 10) / 10
      expect(n.bpmDelta).toBe(expectedBpm)
      expect(n.energyDelta).toBe(n.track.energy - 5)
      expect(n.matchScore).toBeGreaterThanOrEqual(0)
      expect(n.matchScore).toBeLessThanOrEqual(100)
      expect(n.summary).toContain('energy')
      expect(n.track.id).not.toBe('cur') // never suggests the playing track
    }
  })

  it('reflects the true signed direction of an energy/BPM lift', () => {
    const next = getLiveNextUp(current, library, emptySet, 5)
    const b = next.find((n) => n.track.id === 'b')
    expect(b).toBeDefined()
    expect(b!.bpmDelta).toBe(2)
    expect(b!.energyDelta).toBe(2)
    expect(b!.summary).toContain('+2 BPM')
    expect(b!.summary).toContain('+2 energy')
  })

  it('flags a harmonic clash in the summary', () => {
    const next = getLiveNextUp(current, library, emptySet, 5)
    const c = next.find((n) => n.track.id === 'c')
    if (c) expect(c.summary).toContain('Key clash')
  })
})
