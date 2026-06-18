/**
 * EDGE CASES — library health + normalisation.
 * Covers EC-MEM-091..140. Pure: normalise, analyzeHealth, HEALTH_WEIGHTS.
 */
import { describe, it, expect } from 'vitest'
import { normalise, analyzeHealth } from '../electron/algorithms/memory/libraryHealth'
import { makeTrack } from './fixtures'

describe('edge: normalise', () => {
  it.each([
    ['Hello, World!', 'hello world'],
    ['  Multiple   Spaces  ', 'multiple spaces'],
    ['', ''],
    ['A.B.C', 'abc'],
    ['a_b', 'a_b'], // underscore is a word char, preserved
    ['123', '123'],
    ['🔥 Fire', 'fire'], // emoji stripped as non-word, leftover space trimmed
    ['Émigré', 'migr'], // accented chars are NOT \w → stripped (documented quirk)
    ['Tiësto', 'tisto'],
    ['UPPER', 'upper'],
    ['  ', ''],
    ['!!!', '']
  ])('normalise(%j) === %j', (input, expected) => {
    expect(normalise(input)).toBe(expected)
  })

  it('is idempotent', () => {
    for (const s of ['Hello, World!', 'Émigré', '🔥 Fire', 'a__b  c']) {
      expect(normalise(normalise(s))).toBe(normalise(s))
    }
  })
})

describe('edge: analyzeHealth', () => {
  it('an empty library scores a perfect 100', () => {
    const r = analyzeHealth([])
    expect(r.healthScore).toBe(100)
    expect(r.totalTracks).toBe(0)
    expect(r.missingFiles).toBe(0)
    expect(r.duplicateGroups).toHaveLength(0)
  })

  it('penalises a single missing file by 2 points', () => {
    expect(analyzeHealth([makeTrack({ missingFile: true })]).healthScore).toBe(98)
  })

  it('caps the missing-file penalty at 40 (50 missing files)', () => {
    // Unique titles so the missing-file cap is isolated from duplicate penalty.
    const tracks = Array.from({ length: 50 }, (_, i) =>
      makeTrack({ id: `m${i}`, title: `Track ${i}`, missingFile: true })
    )
    expect(analyzeHealth(tracks).healthScore).toBe(60)
  })

  it('detects a duplicate pair via normalised artist+title', () => {
    const a = makeTrack({ id: 'a', artist: 'Bicep', title: 'Glue' })
    const b = makeTrack({ id: 'b', artist: 'bicep', title: 'glue!' }) // same after normalise
    const r = analyzeHealth([a, b])
    expect(r.duplicateGroups).toHaveLength(1)
    expect(r.duplicateGroups[0].ids.sort()).toEqual(['a', 'b'])
    expect(r.healthScore).toBe(99)
  })

  it('does not flag distinct tracks as duplicates', () => {
    const r = analyzeHealth([
      makeTrack({ id: 'a', artist: 'A', title: 'One' }),
      makeTrack({ id: 'b', artist: 'B', title: 'Two' })
    ])
    expect(r.duplicateGroups).toHaveLength(0)
    expect(r.healthScore).toBe(100)
  })

  it('flags empty/whitespace keys and zero BPM as missing', () => {
    const r = analyzeHealth([
      makeTrack({ id: 'k', key: '   ', bpm: 124 }),
      makeTrack({ id: 'b', key: '8A', bpm: 0 })
    ])
    expect(r.missingKeyIds).toContain('k')
    expect(r.missingBpmIds).toContain('b')
  })

  it('flags unsupported formats', () => {
    const r = analyzeHealth([makeTrack({ id: 'x', format: 'unknown' })])
    expect(r.unsupportedFormatIds).toContain('x')
  })

  it('respects dismissed duplicate groups', () => {
    const a = makeTrack({ id: 'a', artist: 'Dup', title: 'Track' })
    const b = makeTrack({ id: 'b', artist: 'Dup', title: 'Track' })
    const key = 'dup|track'
    const r = analyzeHealth([a, b], { dismissedGroupKeys: new Set([key]) })
    expect(r.duplicateGroups).toHaveLength(0)
  })

  it('never returns a negative score even with everything broken', () => {
    const tracks = Array.from({ length: 200 }, (_, i) =>
      makeTrack({ id: `t${i}`, missingFile: true, key: '', bpm: 0, format: 'unknown' })
    )
    const r = analyzeHealth(tracks)
    expect(r.healthScore).toBeGreaterThanOrEqual(0)
  })
})
