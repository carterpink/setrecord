import { describe, it, expect } from 'vitest'
import { scoreTransition } from '../electron/algorithms/transitionScore'
import { GENERIC_PROFILE, getProfile } from '../electron/algorithms/genreProfiles'
import { makeTrack } from './fixtures'

describe('scoreTransition', () => {
  it('classifies a same-key + same-BPM transition as clean with a high score', () => {
    const from = makeTrack({ bpm: 124, key: '8A', energy: 5 })
    const to = makeTrack({ bpm: 124, key: '8A', energy: 5 })
    const result = scoreTransition(from, to)

    expect(result.overall).toBe('clean')
    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.keyCompatibility).toBe('perfect')
    expect(result.bpmDelta).toBe(0)
    expect(result.energyDelta).toBe(0)
    expect(result.reasons).toContain('Perfect harmony')
  })

  it('classifies a clashing-key + big-BPM-jump transition as a trainwreck', () => {
    const from = makeTrack({ bpm: 120, key: '8A', energy: 5 })
    const to = makeTrack({ bpm: 140, key: '2B', energy: 8 }) // far apart on the wheel + 20 BPM gap
    const result = scoreTransition(from, to)

    expect(result.overall).toBe('trainwreck')
    expect(result.score).toBeLessThan(45)
    expect(result.keyCompatibility).toBe('clash')
    expect(result.bpmDelta).toBe(20)
  })

  it('is unchanged by the generic profile (backward-compat guarantee)', () => {
    const pairs = [
      [
        makeTrack({ bpm: 124, key: '8A', energy: 5 }),
        makeTrack({ bpm: 126, key: '9A', energy: 6 })
      ],
      [
        makeTrack({ bpm: 120, key: '8A', energy: 7 }),
        makeTrack({ bpm: 132, key: '2B', energy: 4 })
      ],
      [makeTrack({ bpm: 128, key: '5A', energy: 3 }), makeTrack({ bpm: 128, key: '5A', energy: 3 })]
    ] as const
    for (const [from, to] of pairs) {
      const def = scoreTransition(from, to)
      const generic = scoreTransition(from, to, GENERIC_PROFILE)
      expect(generic.score).toBe(def.score)
      expect(generic.overall).toBe(def.overall)
    }
  })

  it('scores the same pair differently across genre profiles', () => {
    // An energy drop into a clashing-ish key: techno tolerates the drop and
    // discounts harmony, trance punishes the drop and leans on harmony — so the
    // two profiles should disagree on this transition.
    const from = makeTrack({ bpm: 130, key: '8A', energy: 8 })
    const to = makeTrack({ bpm: 130, key: '3A', energy: 5 }) // -3 energy, non-adjacent key

    const techno = scoreTransition(from, to, getProfile('techno')).score
    const trance = scoreTransition(from, to, getProfile('trance')).score

    expect(techno).not.toBe(trance)
    expect(techno).toBeGreaterThan(trance) // techno is the more forgiving profile here
  })
})
