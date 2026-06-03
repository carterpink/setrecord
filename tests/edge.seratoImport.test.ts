/**
 * EDGE CASES — Serato import parsing.
 * Covers EC-IMP-001..080. Pure: parseSeratoLength, seratoKeyToCamelot,
 * resolveSeratoPath, parseDatabaseV2, seratoRecordToTrack.
 */
import { describe, it, expect } from 'vitest'
import {
  parseSeratoLength,
  seratoKeyToCamelot,
  resolveSeratoPath,
  parseDatabaseV2,
  seratoRecordToTrack
} from '../electron/services/serato/databaseReader'

describe('edge: parseSeratoLength', () => {
  it.each([
    ['3:45', 225],
    ['1:02:33', 3753],
    ['0:00', 0],
    ['90', 90],
    ['  120  ', 120],
    ['-5', -5] // negative passes through (documented)
  ])('parseSeratoLength(%j) === %d', (input, expected) => {
    expect(parseSeratoLength(input)).toBe(expected)
  })

  it.each([[undefined], [''], ['abc'], ['3:ab'], ['::'], ['not:a:time']])(
    'returns undefined for unparseable %j',
    (input) => {
      expect(parseSeratoLength(input as string | undefined)).toBeUndefined()
    }
  )
})

describe('edge: seratoKeyToCamelot', () => {
  it.each([
    ['8A', '8A'],
    ['8a', '8A'], // case-insensitive Camelot passthrough → upper
    ['12B', '12B'],
    ['Am', '8A'], // open notation conversion
    ['C', '8B']
  ])('seratoKeyToCamelot(%j) === %j', (input, expected) => {
    expect(seratoKeyToCamelot(input)).toBe(expected)
  })

  it.each([[undefined], [''], ['am'], ['Xyz'], ['  ']])(
    'returns empty string for unmappable %j',
    (input) => {
      expect(seratoKeyToCamelot(input as string | undefined)).toBe('')
    }
  )
})

describe('edge: resolveSeratoPath', () => {
  it.each([
    ['Users/x/a.mp3', '/Users/x/a.mp3'],
    ['/Users/x', '/Users/x'],
    ['///a', '/a'],
    ['', '/']
  ])('resolveSeratoPath(%j) === %j', (input, expected) => {
    expect(resolveSeratoPath(input)).toBe(expected)
  })
})

describe('edge: parseDatabaseV2 — corrupt / empty buffers', () => {
  it('returns [] for an empty buffer', () => {
    expect(parseDatabaseV2(Buffer.alloc(0))).toEqual([])
  })
  it('returns [] for random garbage', () => {
    expect(parseDatabaseV2(Buffer.from('not a serato db at all'))).toEqual([])
  })
  it('does not throw on a truncated chunk header', () => {
    expect(() => parseDatabaseV2(Buffer.from([0x6f, 0x74, 0x72, 0x6b, 0x00]))).not.toThrow()
  })
})

describe('edge: seratoRecordToTrack — missing fields default safely', () => {
  it('fills sensible defaults for a near-empty record', () => {
    const t = seratoRecordToTrack({ filePath: 'Music/x.mp3' }, new Map())
    expect(t.title).toBe('Unknown title')
    expect(t.artist).toBe('Unknown artist')
    expect(t.bpm).toBe(0)
    expect(t.key).toBe('')
    expect(t.energy).toBe(5)
    expect(t.energySource).toBe('pending')
    expect(t.duration).toBe(0)
    expect(t.filePath).toBe('/Music/x.mp3')
    expect(t.source).toBe('serato')
    expect(t.format).toBe('mp3')
  })

  it('reuses an existing id for a known path (re-import FK stability)', () => {
    const existing = new Map([['/Music/x.mp3', 'stable-id']])
    const t = seratoRecordToTrack({ filePath: 'Music/x.mp3' }, existing)
    expect(t.id).toBe('stable-id')
  })

  it('mints a fresh id for an unknown path', () => {
    const t = seratoRecordToTrack({ filePath: 'Music/new.mp3' }, new Map())
    expect(t.id).toBeTruthy()
    expect(t.id).not.toBe('stable-id')
  })

  it('classifies unknown extensions as format "unknown"', () => {
    expect(seratoRecordToTrack({ filePath: 'Music/x.ogg' }, new Map()).format).toBe('unknown')
  })
})
