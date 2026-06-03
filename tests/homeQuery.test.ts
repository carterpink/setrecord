import { describe, it, expect } from 'vitest'
import { interpretHome, forgottenParams, readSummary } from '../src/utils/homeQuery'

describe('interpretHome — classification', () => {
  it('routes a timed warm-up build with a target BPM', () => {
    const { kind, filters } = interpretHome('build me a 90-minute warm-up around 122 bpm')
    expect(kind).toBe('warmup')
    if (filters.kind !== 'warmup') throw new Error('expected warmup filters')
    expect(filters.bpm).toBe(122)
    expect(filters.length).toBe(90)
  })

  it('parses hours into minutes for a set', () => {
    const { kind, filters } = interpretHome('make me a 2 hour set at 128 bpm')
    expect(kind).toBe('warmup')
    if (filters.kind !== 'warmup') throw new Error('expected warmup filters')
    expect(filters.length).toBe(120)
    expect(filters.bpm).toBe(128)
  })

  it('routes duplicate clean-up', () => {
    expect(interpretHome('clean up my duplicates').kind).toBe('duplicates')
    expect(interpretHome('dedupe my library').kind).toBe('duplicates')
  })

  it('routes "what do I play after X" and extracts the source', () => {
    const { kind, filters } = interpretHome('what do I play after Raw by MPH')
    expect(kind).toBe('after')
    if (filters.kind !== 'after') throw new Error('expected after filters')
    expect(filters.source.toLowerCase()).toContain('raw')
  })

  it('routes forgotten gems with dormancy + never-live + count', () => {
    const { kind, filters } = interpretHome(
      "find me 15 forgotten gems I haven't played in 12 months, never played live"
    )
    expect(kind).toBe('forgotten')
    if (filters.kind !== 'forgotten') throw new Error('expected forgotten filters')
    expect(filters.window).toBe('12 months')
    expect(filters.neverLive).toBe(true)
    expect(filters.count).toBe(15)
  })

  it('falls through to a deterministic generic search', () => {
    const { kind, filters } = interpretHome('melodic techno 124-128 bpm never played live')
    expect(kind).toBe('generic')
    if (filters.kind !== 'generic') throw new Error('expected generic filters')
    expect(filters.ask).toBe(false)
    expect(filters.params.bpmMin).toBe(124)
    expect(filters.params.bpmMax).toBe(128)
    expect(filters.params.neverPlayed).toBe(true)
  })

  it('delegates special intents the search params cannot express to the engine (ask path)', () => {
    const { kind, filters } = interpretHome('what are my best closers')
    expect(kind).toBe('generic')
    if (filters.kind !== 'generic') throw new Error('expected generic filters')
    expect(filters.ask).toBe(true)
  })
})

describe('forgottenParams', () => {
  it('maps the editable window + never-live + count to search params', () => {
    const params = forgottenParams({
      kind: 'forgotten',
      window: '6 months',
      neverLive: true,
      count: 10
    })
    expect(params.dormantMonths).toBe(6)
    expect(params.neverPlayed).toBe(true)
    expect(params.sort).toBe('oldest')
    expect(params.limit).toBe(10)
  })

  it('omits neverPlayed when off', () => {
    const params = forgottenParams({
      kind: 'forgotten',
      window: '3 months',
      neverLive: false,
      count: 5
    })
    expect(params.neverPlayed).toBeUndefined()
    expect(params.dormantMonths).toBe(3)
  })
})

describe('readSummary', () => {
  it('summarises each bespoke kind in plain language', () => {
    expect(readSummary({ kind: 'forgotten', window: '6 months', neverLive: true, count: 10 })).toBe(
      'not played in 6 months+, never played live, top 10'
    )
    expect(readSummary({ kind: 'warmup', bpm: 124, length: 90, shape: 'Slow burn' })).toBe(
      '124 bpm · 90 min · slow burn'
    )
    expect(readSummary({ kind: 'duplicates', match: 'Audio', keep: 'Highest quality' })).toBe(
      'matched on audio, keeping the highest quality'
    )
  })
})
