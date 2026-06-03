import { describe, it, expect } from 'vitest'
import {
  buildBeatportRow,
  extractIsrc,
  parseMixName,
  scoreConfidence
} from '../src/utils/beatportMatch'
import { buildCsv } from '../electron/services/beatport/csvExport'
import type { BeatportRow, SetTrack } from '../src/types'
import { makeTrack } from './fixtures'

function makeSetTrack(overrides: Partial<SetTrack['track']> = {}, position = 0): SetTrack {
  const track = makeTrack(overrides)
  return { id: `slot-${position}`, trackId: track.id, track, position }
}

describe('extractIsrc', () => {
  it('pulls a valid ISRC out of a polluted label field', () => {
    expect(extractIsrc({ label: 'GBCPZ2321644', comment: undefined })).toBe('GBCPZ2321644')
  })

  it('finds an ISRC embedded among other text and upper-cases it', () => {
    expect(extractIsrc({ label: undefined, comment: 'isrc: usrc12345678 buy on bandcamp' })).toBe(
      'USRC12345678'
    )
  })

  it('ignores catalogue-only noise that is not an ISRC', () => {
    expect(extractIsrc({ label: 'TOOL12345', comment: undefined })).toBeUndefined()
    expect(extractIsrc({ label: 'Anjunadeep', comment: undefined })).toBeUndefined()
  })
})

describe('parseMixName', () => {
  it('splits a trailing parenthetical mix off the title', () => {
    expect(parseMixName('Strobe (Extended Mix)')).toEqual({ title: 'Strobe', mix: 'Extended Mix' })
  })

  it('handles square brackets and remix wording', () => {
    expect(parseMixName('Opus [Four Tet Remix]')).toEqual({ title: 'Opus', mix: 'Four Tet Remix' })
  })

  it('leaves a plain title (or non-mix parenthetical) intact', () => {
    expect(parseMixName('Midnight City')).toEqual({ title: 'Midnight City' })
    expect(parseMixName('Song (feat. Someone)')).toEqual({ title: 'Song (feat. Someone)' })
  })
})

describe('scoreConfidence', () => {
  it('rates a row with an ISRC as high', () => {
    const { confidence } = scoreConfidence({ isrc: 'GBCPZ2321644', title: 'X', artist: 'Y' })
    expect(confidence).toBe('high')
  })

  it('rates a clean title + artist (no ISRC) as medium', () => {
    const { confidence } = scoreConfidence({ isrc: undefined, title: 'Strobe', artist: 'Deadmau5' })
    expect(confidence).toBe('medium')
  })

  it('rates a row missing the artist as low', () => {
    const { confidence } = scoreConfidence({ isrc: undefined, title: 'Strobe', artist: '' })
    expect(confidence).toBe('low')
  })
})

describe('buildBeatportRow', () => {
  it('derives artist from an "Artist - Title" title when artist is blank', () => {
    const row = buildBeatportRow(
      makeSetTrack({ title: 'Bicep - Glue', artist: '', label: 'GBCPZ2321644' }),
      0
    )
    expect(row.artist).toBe('Bicep')
    expect(row.title).toBe('Glue')
    expect(row.isrc).toBe('GBCPZ2321644')
    expect(row.confidence).toBe('high')
    expect(row.position).toBe(1)
  })
})

describe('buildCsv escaping', () => {
  it('round-trips a title containing a comma, a quote and a newline', () => {
    const row: BeatportRow = {
      trackId: 't1',
      position: 1,
      title: 'Hello, "World"\nLine2',
      artist: 'A',
      bpm: 128,
      key: '8A',
      duration: 200,
      searchUrl: 'https://beatport.com/search?q=x',
      confidence: 'medium',
      reasons: []
    }
    const csv = buildCsv([row])
    const lines = csv.split('\r\n')
    expect(lines[0]).toMatch(/^Track Title,Mix,Artist/)
    // The escaped title field keeps its comma/quote/newline inside one quoted cell.
    expect(csv).toContain('"Hello, ""World""\nLine2"')
    // Length formats as m:ss.
    expect(lines[1]).toContain('3:20')
  })
})
