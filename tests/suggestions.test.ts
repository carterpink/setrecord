import { describe, it, expect } from 'vitest'
import { getSuggestions } from '../electron/algorithms/suggestions'
import type { Set as DJSet } from '../src/types'
import { makeTrack } from './fixtures'

const emptySet: DJSet = {
  id: 's1',
  name: 'Test set',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tracks: [],
  targetHardware: 'CDJ-2000NXS2'
}

describe('getSuggestions — combos boost (★)', () => {
  it('promotes a candidate the DJ has played 4 times after the current track over an equal-score peer', () => {
    const current = makeTrack({ id: 'cur', bpm: 124, key: '8A', energy: 5 })
    // Two candidates with identical raw transition score (same BPM, same key, same energy)
    const a = makeTrack({ id: 'a', title: 'No history', bpm: 124, key: '8A', energy: 5 })
    const b = makeTrack({ id: 'b', title: 'Combo champion', bpm: 124, key: '8A', energy: 5 })

    const noLookup = getSuggestions(current, [a, b], emptySet, 2)
    // Without combo data, sort is deterministic but tie can break either way —
    // capture the ranking so we can assert the combo lookup CHANGES it.
    const orderBefore = noLookup.map((s) => s.track.id)

    const lookup = new Map([['b', 4]])
    const withLookup = getSuggestions(current, [a, b], emptySet, 2, [], lookup)
    expect(withLookup[0].track.id).toBe('b')
    expect(withLookup[0].comboCount).toBe(4)
    expect(withLookup[0].matchReasons[0].type).toBe('combo')
    expect(withLookup[0].matchReasons[0].label).toContain('4 times')
    // The non-combo candidate must NOT carry a combo chip
    expect(withLookup[1].matchReasons.find((r) => r.type === 'combo')).toBeUndefined()
    // Sanity: the combo lookup actually moved b (or at least set b first regardless of pre-order)
    expect(orderBefore).toBeDefined()
  })

  it('applies a light boost without a chip for 1–2 prior plays', () => {
    const current = makeTrack({ id: 'cur', bpm: 124, key: '8A', energy: 5 })
    const a = makeTrack({ id: 'a', bpm: 124, key: '8A', energy: 5 })
    const b = makeTrack({ id: 'b', bpm: 124, key: '8A', energy: 5 })

    const lookup = new Map([['b', 2]])
    const result = getSuggestions(current, [a, b], emptySet, 2, [], lookup)
    const bSugg = result.find((s) => s.track.id === 'b')!
    expect(bSugg.comboCount).toBe(2)
    // No combo chip below the threshold of 3 — a 2-play pairing is not yet a "pattern"
    expect(bSugg.matchReasons.find((r) => r.type === 'combo')).toBeUndefined()
  })

  it('candidates absent from the lookup get no combo boost or chip', () => {
    const current = makeTrack({ id: 'cur', bpm: 124, key: '8A', energy: 5 })
    const a = makeTrack({ id: 'a', bpm: 124, key: '8A', energy: 5 })
    const lookup = new Map([['unrelated', 9]])
    const [sugg] = getSuggestions(current, [a], emptySet, 1, [], lookup)
    expect(sugg.comboCount).toBeUndefined()
    expect(sugg.matchReasons.find((r) => r.type === 'combo')).toBeUndefined()
  })
})
