import { describe, it, expect } from 'vitest'
import { parseQuery } from '../electron/algorithms/memory/queryParser'

describe('parseQuery', () => {
  it('parses "give me 10 128bpm tech house tracks" into a bpm+genre filter', () => {
    const r = parseQuery('give me 10 128bpm tech house tracks')
    expect(r?.intent).toBe('smart_filter')
    expect(r?.genre).toBe('tech house')
    // single tempo gets a ±2 tolerance
    expect(r?.bpmMin).toBe(126)
    expect(r?.bpmMax).toBe(130)
  })

  it('parses a bpm range', () => {
    const r = parseQuery('melodic techno 124-128 bpm')
    expect(r?.intent).toBe('smart_filter')
    expect(r?.genre).toBe('melodic techno')
    expect(r?.bpmMin).toBe(124)
    expect(r?.bpmMax).toBe(128)
  })

  it('routes forgotten-gem phrasings', () => {
    expect(parseQuery('show me forgotten gems')?.intent).toBe('forgotten_gems')
    expect(parseQuery("tracks I used to play but haven't lately")?.intent).toBe('forgotten_gems')
  })

  it('routes closers and openers', () => {
    expect(parseQuery('what are my best closers')?.intent).toBe('best_closers')
    expect(parseQuery('my go-to openers')?.intent).toBe('best_openers')
  })

  it('routes never-played and ratings into smart_filter', () => {
    expect(parseQuery('tracks never tested live')?.neverPlayed).toBe(true)
    expect(parseQuery('5 star tracks')?.minRating).toBe(5)
    expect(parseQuery('my favourites')?.minRating).toBe(4)
  })

  it('captures the track for "after X"', () => {
    const r = parseQuery('what do I play after Strobe')
    expect(r?.intent).toBe('tracks_after')
    expect(r?.trackQuery).toBe('strobe')
  })

  it('maps energy words', () => {
    expect(parseQuery('peak hour bangers')?.energyMin).toBe(8)
    expect(parseQuery('chill warmup house')?.energyMax).toBe(4)
  })

  it('routes health, lifecycle, identity, transitions', () => {
    expect(parseQuery('library health')?.intent).toBe('health')
    expect(parseQuery('lifecycle breakdown')?.intent).toBe('lifecycle')
    expect(parseQuery('my taste profile')?.intent).toBe('identity')
    expect(parseQuery('my most common transitions')?.intent).toBe('top_sequences')
  })

  it('does not match "house" inside "warehouse"', () => {
    // no genre/bpm/etc → unrecognised
    expect(parseQuery('a warehouse rave')).toBeNull()
  })

  it('returns null for unrecognised free-form', () => {
    expect(parseQuery('what should I have for dinner')).toBeNull()
    expect(parseQuery('')).toBeNull()
  })
})
