/**
 * EDGE CASES — export + Set Architect seed utilities.
 * Covers EC-LIC-001..060. Pure: ratingToEngine, safeMusicFilename,
 * extractIsrc, parseMixName, encodeSeed/decodeSeed/freshSeed.
 */
import { describe, it, expect } from 'vitest'
import { ratingToEngine, safeMusicFilename } from '../electron/services/engine/engineSchema'
import { extractIsrc, parseMixName } from '../src/utils/beatportMatch'
import { encodeSeed, decodeSeed, freshSeed } from '../src/utils/seed'

describe('edge: ratingToEngine (0-5 stars → 0-100)', () => {
  it.each([
    [0, 0],
    [1, 20],
    [2, 40],
    [3, 60],
    [4, 80],
    [5, 100],
    [-1, 0], // clamp below
    [6, 100], // clamp above
    [3.4, 60], // round down
    [3.6, 80] // round up
  ])('ratingToEngine(%j) === %d', (stars, expected) => {
    expect(ratingToEngine(stars)).toBe(expected)
  })
})

describe('edge: safeMusicFilename (FAT-safe, collision-free)', () => {
  it('passes a clean name through', () => {
    expect(safeMusicFilename('/x/Song.mp3', new Set())).toBe('Song.mp3')
  })
  it('replaces characters illegal on FAT/exFAT', () => {
    expect(safeMusicFilename('/x/a:b?<>|.mp3', new Set())).toBe('a_b____.mp3')
  })
  it('suffixes duplicate names within one export', () => {
    const taken = new Set<string>()
    expect(safeMusicFilename('/x/Song.mp3', taken)).toBe('Song.mp3')
    expect(safeMusicFilename('/y/Song.mp3', taken)).toBe('Song-1.mp3')
    expect(safeMusicFilename('/z/Song.mp3', taken)).toBe('Song-2.mp3')
  })
  it('handles a name with no extension', () => {
    expect(safeMusicFilename('track', new Set())).toBe('track')
  })
  it('replaces every illegal char with an underscore (stem stays non-empty)', () => {
    expect(safeMusicFilename('/x/:?.mp3', new Set())).toBe('__.mp3')
  })
  it('falls back to "track" when the stem is whitespace-only', () => {
    expect(safeMusicFilename('/x/   .mp3', new Set())).toBe('track.mp3')
  })
})

describe('edge: extractIsrc', () => {
  it('pulls a valid ISRC out of a label and upper-cases it', () => {
    expect(extractIsrc({ label: 'usrc17607839', comment: undefined })).toBe('USRC17607839')
  })
  it('finds an ISRC embedded in a comment', () => {
    expect(extractIsrc({ label: undefined, comment: 'ISRC: GBAYE0601498' })).toBe('GBAYE0601498')
  })
  it.each([
    [{ label: undefined, comment: undefined }],
    [{ label: 'Anjunadeep', comment: '' }],
    [{ label: 'TOOL12345', comment: undefined }] // too short to be an ISRC
  ])('returns undefined when there is no ISRC (%j)', (track) => {
    expect(extractIsrc(track)).toBeUndefined()
  })
})

describe('edge: parseMixName', () => {
  it('returns the title unchanged when there is no mix suffix', () => {
    expect(parseMixName('Strobe')).toEqual({ title: 'Strobe' })
  })
  it('handles an empty/blank title', () => {
    expect(parseMixName('')).toEqual({ title: '' })
    expect(parseMixName('   ')).toEqual({ title: '' })
  })
})

describe('edge: seed encode/decode round-trip', () => {
  it.each([0, 1, 255, 123456, 0xffffffff])('round-trips %d', (n) => {
    expect(decodeSeed(encodeSeed(n))).toBe(n)
  })

  it('encodes to lowercase base36', () => {
    expect(encodeSeed(0)).toBe('0')
    expect(encodeSeed(123456)).toBe((123456).toString(36))
  })

  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['!!', 'illegal chars'],
    ['-5', 'minus sign'],
    ['zzzzzzzz', 'out of uint32 range']
  ])('decodeSeed rejects %j (%s) → null', (input) => {
    expect(decodeSeed(input)).toBeNull()
  })

  it('tolerates surrounding whitespace and case', () => {
    // base36: 'ff' = 15*36 + 15 = 555
    expect(decodeSeed('  FF  ')).toBe(555)
  })

  it('freshSeed produces an in-range uint32', () => {
    for (let i = 0; i < 100; i++) {
      const s = freshSeed()
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
    }
  })
})
