/**
 * Robustness suite — slang, dialect, txt-speak and misspellings.
 *
 * The 210-case matrix proves the engine understands clean phrasing; this suite
 * proves it survives how people actually type. Every case is a noisy variant of
 * a proven-clean prompt and must resolve to the same KIND of answer (and where
 * asserted, the same content) — model-off, fully deterministic, CI-stable.
 *
 * These run through the exact same `resolveQuery` the live app executes.
 */
import { describe, expect, it } from 'vitest'
import { buildWorld } from './fixtures'
import { resolveQuery } from './driver'
import type { EngineResult } from './types'

const ctx = buildWorld()

function resolve(prompt: string): EngineResult {
  return resolveQuery(prompt, ctx)
}

function expectArtistTracks(r: EngineResult, artist: string): void {
  expect(r.kind).toBe('tracks')
  expect(r.tracks ?? []).not.toHaveLength(0)
  for (const t of r.tracks ?? []) {
    expect(`${t.artist} ${t.title} ${t.album ?? ''}`.toLowerCase()).toContain(artist.toLowerCase())
  }
}

describe('slang & dialect — the "oi mate" class', () => {
  it('oi mate give us some fisher', () => {
    expectArtistTracks(resolve('oi mate give us some fisher'), 'fisher')
  })

  it('yo bruv chuck us some fisher tunes', () => {
    expectArtistTracks(resolve('yo bruv chuck us some fisher tunes'), 'fisher')
  })

  it('gimme 10 fisher songs pls', () => {
    const r = resolve('gimme 10 fisher songs pls')
    expectArtistTracks(r, 'fisher')
  })

  it('sort me out with some burial m8', () => {
    expectArtistTracks(resolve('sort me out with some burial m8'), 'burial')
  })

  it('alright legend, hook me up with some aphex twin', () => {
    expectArtistTracks(resolve('alright legend, hook me up with some aphex twin'), 'aphex')
  })

  it('go on then play us some techno bangers', () => {
    const r = resolve('go on then play us some techno bangers')
    expect(['tracks', 'set']).toContain(r.kind)
    expect((r.tracks ?? r.set ?? []).length).toBeGreaterThan(0)
  })
})

describe('misspellings — single-token typos repaired against library vocab', () => {
  it('give me 10 fihser songs (transposition in artist)', () => {
    expectArtistTracks(resolve('give me 10 fihser songs'), 'fisher')
  })

  it('find me some tecno trakcs (genre + object typos)', () => {
    const r = resolve('find me some tecno trakcs')
    expect(r.kind).toBe('tracks')
    expect((r.tracks ?? []).length).toBeGreaterThan(0)
  })

  it('wats my most playd genre (stats through txt-speak + typo)', () => {
    const r = resolve('wats my most playd genre')
    expect(r.kind).toBe('stats')
  })

  it('show me my forgoten gems', () => {
    const r = resolve('show me my forgoten gems')
    expect(['tracks', 'empty']).toContain(r.kind)
    expect(r.kind).toBe('tracks')
  })

  it('any duplicats in my library?', () => {
    const r = resolve('any duplicats in my library?')
    expect(['tracks', 'stats', 'count', 'empty']).toContain(r.kind)
    expect(r.kind).not.toBe('unknown')
  })

  it('what is harmnic mixing (knowledge through a typo)', () => {
    const r = resolve('what is harmnic mixing')
    expect(r.kind).toBe('knowledge')
  })
})

describe('txt-speak & compound noise', () => {
  it('wot did i play last saturday m8', () => {
    const r = resolve('wot did i play last saturday m8')
    expect(['gig', 'tracks']).toContain(r.kind)
  })

  it('how many trax hav i got', () => {
    const r = resolve('how many trax hav i got')
    expect(['stats', 'count']).toContain(r.kind)
  })

  it('oi oi giv us ur fastst tunes', () => {
    const r = resolve('oi oi giv us ur fastst tunes')
    expect(r.kind).toBe('tracks')
    expect((r.tracks ?? []).length).toBeGreaterThan(0)
  })

  it('build me a 2 hour tecno set plz', () => {
    const r = resolve('build me a 2 hour tecno set plz')
    expect(['set', 'tracks']).toContain(r.kind)
  })

  it('cheers mate wot r my best closers', () => {
    const r = resolve('cheers mate wot r my best closers')
    expect(['combos', 'tracks', 'sequences']).toContain(r.kind)
  })
})

describe('honesty rails survive normalization', () => {
  it('an artist genuinely absent from the library stays an honest miss', () => {
    const r = resolve('oi mate give us some skrillex')
    // No Skrillex in fixtures, and nothing within typo distance should
    // fabricate a result: empty or unknown, never invented tracks.
    expect(['empty', 'unknown']).toContain(r.kind)
  })

  it('clean queries never take the normalization path', () => {
    const r = resolve('give me 10 Fisher songs')
    expect(r.correctedQuery).toBeUndefined()
    expectArtistTracks(r, 'fisher')
  })
})
