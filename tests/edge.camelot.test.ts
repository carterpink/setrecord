/**
 * EDGE CASES — Camelot wheel (harmonic mixing core).
 * Covers EC-MEM-001..050 in EDGE_CASES.md.
 * Pure functions: openNotationToCamelot, getKeyCompatibility, CAMELOT_KEYS.
 */
import { describe, it, expect } from 'vitest'
import {
  openNotationToCamelot,
  getKeyCompatibility,
  CAMELOT_KEYS
} from '../electron/utils/camelot'

describe('edge: openNotationToCamelot', () => {
  it.each([
    ['Am', '8A'],
    ['C', '8B'],
    ['A#m', '9A'],
    ['Bbm', '9A'], // enharmonic equivalent of A#m → same Camelot
    ['Db', '9B'],
    ['C#', '9B'], // enharmonic equivalent of Db
    [' Am ', '8A'], // surrounding whitespace trimmed
    ['B', '7B']
  ])('maps %j → %j', (input, expected) => {
    expect(openNotationToCamelot(input)).toBe(expected)
  })

  it.each([
    ['', 'empty string'],
    ['am', 'lowercase is not in the map (case-sensitive)'],
    ['H', 'non-existent note letter'],
    ['Xyz', 'garbage'],
    ['8A', 'already-Camelot is NOT open notation'],
    ['Cmaj', 'chord-style suffix'],
    ['  ', 'whitespace only']
  ])('returns undefined for %j (%s)', (input) => {
    expect(openNotationToCamelot(input)).toBeUndefined()
  })
})

describe('edge: getKeyCompatibility', () => {
  it.each([
    ['8A', '8A', 'perfect', 30],
    ['8A', '9A', 'compatible', 25], // +1 same letter (energy shift)
    ['8A', '7A', 'compatible', 25],
    ['8A', '8B', 'compatible', 20], // relative major/minor (mood shift)
    ['8A', '10A', 'compatible', 10], // +2 same letter
    ['1A', '12A', 'compatible', 25], // wheel wraparound: distance 1, not 11
    ['12A', '1A', 'compatible', 25], // wraparound symmetric
    ['1A', '11A', 'compatible', 10], // wraparound distance 2
    ['8A', '2A', 'clash', -20], // distance 6 same letter → clash
    ['8A', '2B', 'clash', -20], // distance 6 + letter flip
    ['8A', '11B', 'clash', -20], // numDist 3 + letter flip = 4 > 3
    ['8A', '11A', 'neutral', 0], // numDist 3 same letter = 3, not > 3
    ['1B', '12A', 'neutral', 0] // numDist 1 + letter flip = 2
  ])('%s × %s → %s (%d)', (a, b, rel, mod) => {
    const r = getKeyCompatibility(a, b)
    expect(r.relationship).toBe(rel)
    expect(r.scoreModifier).toBe(mod)
  })

  it.each([
    ['', '8A'],
    ['8A', ''],
    ['', ''],
    ['Am', '8A'], // open notation is NOT valid Camelot input here
    ['8a', '8A'], // lowercase letter fails the /[AB]/ matcher
    ['XYZ', 'ABC'],
    ['8', '8A'], // missing letter
    ['A', 'A'] // missing number
  ])('unparseable pair (%j, %j) → neutral / Unknown key', (a, b) => {
    const r = getKeyCompatibility(a, b)
    expect(r.relationship).toBe('neutral')
    expect(r.scoreModifier).toBe(0)
    expect(r.reason).toBe('Unknown key')
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(getKeyCompatibility(' 8A ', ' 8A ').relationship).toBe('perfect')
  })

  it('is symmetric for every pair of valid Camelot keys', () => {
    for (const a of CAMELOT_KEYS) {
      for (const b of CAMELOT_KEYS) {
        expect(getKeyCompatibility(a, b).scoreModifier).toBe(
          getKeyCompatibility(b, a).scoreModifier
        )
      }
    }
  })

  it('every key is perfectly compatible with itself', () => {
    for (const k of CAMELOT_KEYS) {
      expect(getKeyCompatibility(k, k).relationship).toBe('perfect')
    }
  })

  it('exposes exactly 24 unique Camelot keys', () => {
    expect(CAMELOT_KEYS).toHaveLength(24)
    expect(new Set(CAMELOT_KEYS).size).toBe(24)
  })
})
