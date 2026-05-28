import { describe, it, expect } from 'vitest'
import { scoreTransition } from '../electron/algorithms/transitionScore'
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
    const to = makeTrack({ bpm: 140, key: '2B', energy: 8 })  // far apart on the wheel + 20 BPM gap
    const result = scoreTransition(from, to)

    expect(result.overall).toBe('trainwreck')
    expect(result.score).toBeLessThan(45)
    expect(result.keyCompatibility).toBe('clash')
    expect(result.bpmDelta).toBe(20)
  })
})
