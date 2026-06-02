import { describe, it, expect } from 'vitest'
import { interpretTurn } from '../src/utils/recallQuery'

describe('interpretTurn — count / limit', () => {
  it('reads a count when the number precedes a genre ("15 UK garage tracks")', () => {
    const t = interpretTurn('15 UK garage tracks I play the most', {})
    expect(t.kind).toBe('search')
    if (t.kind !== 'search') return
    expect(t.params.limit).toBe(15)
    expect(t.params.genre).toBe('uk garage')
    expect(t.params.sort).toBe('mostPlayed')
  })

  it('reads "10 banger tech house tracks"', () => {
    const t = interpretTurn('10 banger tech house tracks', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.limit).toBe(10)
    expect(t.params.genre).toBe('tech house')
    expect(t.params.energyMin).toBe(8)
  })

  it('refines just the count, keeping prior filters ("actually i want 10")', () => {
    const t = interpretTurn('actually i want 10', {
      genre: 'uk garage',
      sort: 'mostPlayed',
      limit: 15
    })
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.limit).toBe(10)
    expect(t.params.genre).toBe('uk garage')
    expect(t.params.sort).toBe('mostPlayed')
  })

  it('handles a bare number refinement ("8")', () => {
    const t = interpretTurn('8', { genre: 'tech house', limit: 25 })
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.limit).toBe(8)
  })

  it('does NOT treat a rating ("5 star") as a count', () => {
    const t = interpretTurn('tracks rated 5 star', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.minRating).toBe(5)
    expect(t.params.limit).toBe(25) // default, not 5
  })

  it('does NOT treat a BPM as a count, and defaults to 25', () => {
    const t = interpretTurn('deep house around 122 bpm', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.genre).toBe('deep house')
    expect(t.params.bpmMin).toBe(119)
    expect(t.params.bpmMax).toBe(125)
    expect(t.params.limit).toBe(25)
  })

  it('routes special intents to ask (forgotten gems)', () => {
    expect(interpretTurn('my forgotten gems', {}).kind).toBe('ask')
  })
})

describe('interpretTurn — key (Camelot + open notation)', () => {
  it('parses a Camelot key ("in 8A")', () => {
    const t = interpretTurn('deep house in 8A', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.keyExact).toBe('8A')
    expect(t.params.genre).toBe('deep house')
  })

  it('parses open notation ("in Am")', () => {
    const t = interpretTurn('tracks in Am', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.keyExact).toBe('8A')
  })

  it('parses open notation ("in C# major")', () => {
    const t = interpretTurn('tracks in C# major', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.keyExact).toBe('3B')
  })

  it('does not parse invalid Camelot numbers (e.g. 13A)', () => {
    const t = interpretTurn('tracks in 13A', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.keyExact).toBeUndefined()
  })
})

describe('interpretTurn — duration', () => {
  it('parses "under 5 minutes"', () => {
    const t = interpretTurn('tracks under 5 minutes', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.durationMaxSec).toBe(300)
    expect(t.params.durationMinSec).toBeUndefined()
  })

  it('parses "over 7 min"', () => {
    const t = interpretTurn('tracks over 7 min', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.durationMinSec).toBe(420)
  })

  it('parses a range "3 to 6 minute tracks"', () => {
    const t = interpretTurn('3 to 6 minute tracks', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.durationMinSec).toBe(180)
    expect(t.params.durationMaxSec).toBe(360)
  })
})

describe('interpretTurn — date-added ranges', () => {
  it('parses "added in last 30 days"', () => {
    const t = interpretTurn('tracks added in last 30 days', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.addedAfter).toBeDefined()
    const ageDays = (Date.now() - new Date(t.params.addedAfter!).getTime()) / (24 * 3600 * 1000)
    expect(ageDays).toBeGreaterThan(29.9)
    expect(ageDays).toBeLessThan(30.1)
  })

  it('parses "added in 2024"', () => {
    const t = interpretTurn('tracks added in 2024', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.addedAfter).toBe('2024-01-01T00:00:00.000Z')
    expect(t.params.addedBefore).toBe('2024-12-31T23:59:59.999Z')
  })

  it('parses "added in last 2 years"', () => {
    const t = interpretTurn('tracks added in last 2 years', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.addedAfter).toBeDefined()
  })
})

describe('interpretTurn — cue label search', () => {
  it('parses "cue labelled drop"', () => {
    const t = interpretTurn("tracks with cue labelled 'drop'", {})
    if (t.kind !== 'search') throw new Error('expected search — cue queries must search, not ask')
    expect(t.params.cueLabel).toBe('drop')
  })

  it('parses "cue point named breakdown"', () => {
    const t = interpretTurn('tracks with cue point named breakdown', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.cueLabel).toBe('breakdown')
  })
})

describe('interpretTurn — mixed multi-dimensional query', () => {
  it('parses "5 deep house tracks in 8A under 6 minutes never played live"', () => {
    const t = interpretTurn('5 deep house tracks in 8A under 6 minutes never played live', {})
    if (t.kind !== 'search') throw new Error('expected search')
    expect(t.params.limit).toBe(5)
    expect(t.params.genre).toBe('deep house')
    expect(t.params.keyExact).toBe('8A')
    expect(t.params.durationMaxSec).toBe(360)
    expect(t.params.neverPlayed).toBe(true)
  })
})
