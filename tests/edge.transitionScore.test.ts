/**
 * EDGE CASES — transition scoring resilience.
 * Covers EC-MEM-051..090. Asserts invariants that must hold for ANY input
 * (bounded score, finite output) plus a handful of exact anchors.
 */
import { describe, it, expect } from 'vitest'
import { scoreTransition } from '../electron/algorithms/transitionScore'
import { makeTrack } from './fixtures'

describe('edge: scoreTransition invariants', () => {
  const bpms = [0, 1, 124, 200, -10, NaN, Infinity]
  const energies = [-5, 0, 1, 5, 10, 20]
  const keys = ['8A', '9A', '2B', 'BAD', '', '8a']

  const pairs: Array<[number, number, number, number, string, string]> = []
  for (const fb of bpms)
    for (const tb of [0, 124, 130])
      for (const fe of energies)
        for (const te of [0, 5, 10])
          for (const fk of keys) pairs.push([fb, tb, fe, te, fk, '8A'])

  it(`keeps score within [0,100] and finite across ${pairs.length} hostile pairs`, () => {
    for (const [fb, tb, fe, te, fk, tk] of pairs) {
      const r = scoreTransition(
        makeTrack({ bpm: fb, energy: fe, key: fk }),
        makeTrack({ bpm: tb, energy: te, key: tk })
      )
      expect(Number.isFinite(r.score)).toBe(true)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
      expect(['clean', 'messy', 'trainwreck']).toContain(r.overall)
      expect(r.reasons.length).toBeLessThanOrEqual(3)
    }
  })

  it('identical tracks score a perfect 100 / clean', () => {
    const t = makeTrack({ bpm: 124, key: '8A', energy: 5, format: 'mp3' })
    const r = scoreTransition(t, { ...t })
    expect(r.score).toBe(100)
    expect(r.overall).toBe('clean')
    expect(r.bpmDelta).toBe(0)
    expect(r.energyDelta).toBe(0)
  })

  it('bpmDelta is the absolute tempo difference', () => {
    expect(scoreTransition(makeTrack({ bpm: 120 }), makeTrack({ bpm: 140 })).bpmDelta).toBe(20)
    expect(scoreTransition(makeTrack({ bpm: 140 }), makeTrack({ bpm: 120 })).bpmDelta).toBe(20)
  })

  it('energyDelta is signed (to − from)', () => {
    expect(scoreTransition(makeTrack({ energy: 3 }), makeTrack({ energy: 8 })).energyDelta).toBe(5)
    expect(scoreTransition(makeTrack({ energy: 8 }), makeTrack({ energy: 3 })).energyDelta).toBe(-5)
  })

  it('a clashing key + 20 BPM jump is a trainwreck', () => {
    const r = scoreTransition(
      makeTrack({ bpm: 120, key: '8A', energy: 5 }),
      makeTrack({ bpm: 140, key: '2B', energy: 8 })
    )
    expect(r.overall).toBe('trainwreck')
    expect(r.score).toBeLessThan(45)
  })

  it('does not crash on NaN/Infinity tempo (BPM term degrades to 0)', () => {
    const r = scoreTransition(makeTrack({ bpm: NaN }), makeTrack({ bpm: Infinity }))
    expect(Number.isFinite(r.score)).toBe(true)
  })
})
