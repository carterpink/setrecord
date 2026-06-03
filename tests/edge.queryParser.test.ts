/**
 * EDGE CASES — Recall "ask your library" query parser.
 * Covers EC-MEM-141..200. Pure: parseQuery.
 */
import { describe, it, expect } from 'vitest'
import { parseQuery } from '../electron/algorithms/memory/queryParser'

describe('edge: parseQuery — null / no-signal inputs', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['hello world', 'unrelated chatter'],
    ['warehouse', '"house" must not match inside "warehouse"'],
    ['the quick brown fox', 'no recognised tokens']
  ])('returns null for %j (%s)', (q) => {
    expect(parseQuery(q)).toBeNull()
  })
})

describe('edge: parseQuery — direct intents', () => {
  it.each([
    ['forgotten gems', 'forgotten_gems'],
    ['tracks I used to play', 'forgotten_gems'],
    ['best closers', 'best_closers'],
    ['my openers', 'best_openers'],
    ['my go-to transitions', 'top_sequences'],
    ['library health', 'health'],
    ['missing keys', 'health'],
    ['my taste profile', 'identity'],
    ['lifecycle breakdown', 'lifecycle']
  ])('%j → intent %s', (q, intent) => {
    expect(parseQuery(q)?.intent).toBe(intent)
  })
})

describe('edge: parseQuery — "after <track>"', () => {
  it('extracts and lowercases the track query', () => {
    expect(parseQuery('after Strobe')).toEqual({ intent: 'tracks_after', trackQuery: 'strobe' })
  })
  it('strips trailing punctuation', () => {
    expect(parseQuery('what do I play after Strobe?')?.trackQuery).toBe('strobe')
  })
  it('ignores a one-character track query', () => {
    // "after a" → trackQuery "a" (len 1) → falls through to smart_filter/null
    expect(parseQuery('after a')).toBeNull()
  })
})

describe('edge: parseQuery — BPM slots', () => {
  it.each([
    ['120-128 bpm', 120, 128],
    ['between 120 and 128 bpm', 120, 128],
    ['128 to 120 bpm', 120, 128], // min/max normalised regardless of order
    ['128 bpm', 126, 130] // single tempo gets ±2 tolerance
  ])('%j → bpm [%d,%d]', (q, min, max) => {
    const r = parseQuery(q)!
    expect(r.bpmMin).toBe(min)
    expect(r.bpmMax).toBe(max)
  })
})

describe('edge: parseQuery — genre (longest-first)', () => {
  it.each([
    ['tech house bangers', 'tech house'],
    ['deep house', 'deep house'],
    ['some drum and bass', 'drum and bass'],
    ['melodic techno set', 'melodic techno']
  ])('%j → genre %s', (q, genre) => {
    expect(parseQuery(q)?.genre).toBe(genre)
  })
})

describe('edge: parseQuery — energy / rating / dormancy / never-played', () => {
  it('peak keywords set energyMin 8', () => {
    expect(parseQuery('peak time bangers')?.energyMin).toBe(8)
  })
  it('chill keywords set energyMax 4', () => {
    expect(parseQuery('chill warmup tracks')?.energyMax).toBe(4)
  })
  it('rating "4 star" sets minRating', () => {
    expect(parseQuery('4 star tracks')?.minRating).toBe(4)
  })
  it('favourites map to minRating 4', () => {
    expect(parseQuery('my favourites')?.minRating).toBe(4)
  })
  it('never-played sets the flag', () => {
    expect(parseQuery('tracks I never played')?.neverPlayed).toBe(true)
  })
  it('dormancy in months', () => {
    expect(parseQuery('not played in 12 months')?.dormantMonths).toBe(12)
  })
  it('dormancy in years is converted to months', () => {
    expect(parseQuery('not played in 2 years')?.dormantMonths).toBe(24)
  })
})
