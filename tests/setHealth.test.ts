/**
 * Set Health formula — verifies each sub-score moves in the right direction and
 * the composite stays well-defined (0–100). Targets/weights are asserted by
 * behaviour, not magic numbers, so they stay tunable.
 */
import { describe, it, expect } from 'vitest'
import { computeSetHealth, type SetHealthInput } from '../electron/algorithms/setHealth'
import { makeTrack } from './fixtures'
import type { Track } from '../src/types'

/** Build N candidates around a base, varying key/bpm/energy via the callback. */
function candidates(n: number, fn: (i: number) => Partial<Parameters<typeof makeTrack>[0]>): Track[] {
  return Array.from({ length: n }, (_, i) => makeTrack({ id: `c${i}`, ...fn(i) }))
}

const current = makeTrack({ id: 'cur', bpm: 124, key: '8A', energy: 6 })

describe('computeSetHealth', () => {
  it('a healthy moment scores high (on-arc, lots of safe, varied, plentiful)', () => {
    const input: SetHealthInput = {
      current,
      recent: [makeTrack({ energy: 5 }), makeTrack({ energy: 6 })],
      targetEnergy: 6, // exactly on arc
      candidates: candidates(12, (i) => ({
        key: '8A', // all perfectly harmonic
        bpm: 120 + i, // wide spread
        energy: 6
      }))
    }
    const h = computeSetHealth(input)
    expect(h.energyFit).toBe(100)
    expect(h.harmonicRunway).toBe(100)
    expect(h.bpmTrap).toBe(100)
    expect(h.ammunition).toBe(100)
    expect(h.score).toBe(100)
  })

  it('running dry (no candidates) tanks runway, trap, and ammunition', () => {
    const h = computeSetHealth({ current, recent: [], candidates: [], targetEnergy: 6 })
    expect(h.harmonicRunway).toBe(0)
    expect(h.bpmTrap).toBe(0)
    expect(h.ammunition).toBe(0)
    expect(h.energyFit).toBe(100) // on target — that part's fine
    expect(h.score).toBeLessThan(50)
  })

  it('harmonic runway rises with the count of key-safe candidates', () => {
    const safe = (n: number): number =>
      computeSetHealth({
        current,
        recent: [],
        candidates: candidates(n, () => ({ key: '8A', bpm: 124, energy: 6 })),
        targetEnergy: 6
      }).harmonicRunway
    expect(safe(1)).toBeLessThan(safe(3))
    expect(safe(3)).toBeLessThan(safe(5))
    expect(safe(8)).toBe(100) // saturates at the target
  })

  it('key clashes do not count toward runway', () => {
    const clashes = candidates(6, () => ({ key: '3B', bpm: 124, energy: 6 })) // far from 8A
    const h = computeSetHealth({ current, recent: [], candidates: clashes, targetEnergy: 6 })
    expect(h.harmonicRunway).toBe(0)
  })

  it('energy off the arc lowers energyFit', () => {
    const onArc = computeSetHealth({ current, recent: [], candidates: [], targetEnergy: 6 }).energyFit
    const offArc = computeSetHealth({ current, recent: [], candidates: [], targetEnergy: 9 }).energyFit
    expect(offArc).toBeLessThan(onArc)
  })

  it('a narrow BPM pool reads as more trapped than a wide one', () => {
    const narrow = computeSetHealth({
      current,
      recent: [],
      candidates: candidates(6, () => ({ key: '8A', bpm: 124, energy: 6 })),
      targetEnergy: 6
    }).bpmTrap
    const wide = computeSetHealth({
      current,
      recent: [],
      candidates: candidates(6, (i) => ({ key: '8A', bpm: 119 + i * 2, energy: 6 })),
      targetEnergy: 6
    }).bpmTrap
    expect(narrow).toBeLessThan(wide)
  })

  it('always returns a composite within 0–100', () => {
    for (const t of [3, 6, 10]) {
      const h = computeSetHealth({
        current: makeTrack({ energy: t }),
        recent: [],
        candidates: candidates(t, (i) => ({ key: i % 2 ? '8A' : '3B', bpm: 120 + i, energy: i })),
        targetEnergy: 5
      })
      expect(h.score).toBeGreaterThanOrEqual(0)
      expect(h.score).toBeLessThanOrEqual(100)
    }
  })
})
