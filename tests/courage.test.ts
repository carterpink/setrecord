import { describe, it, expect } from 'vitest'
import { computeCourage, deriveComfort } from '../electron/algorithms/memory/courage'
import { camelotCompatible } from '../src/utils/camelot'
import { buildWorld } from './eval/fixtures'

const NOW = new Date('2025-08-01T00:00:00.000Z')

describe('computeCourage — mixable but out of the comfort zone', () => {
  it('only suggests tracks that are mixable AND outside the comfort genres', () => {
    const w = buildWorld(NOW)
    const ref = w.byId.get('fisher1')! // Tech House, 7A, 125 BPM
    const comfortGenres = ['Tech House', 'Techno']
    const r = computeCourage(ref, w.tracks, { comfortGenres })
    expect(r.candidates.length).toBeGreaterThan(0)
    for (const c of r.candidates) {
      expect(['tech house', 'techno']).not.toContain((c.track.genre ?? '').toLowerCase())
      expect(camelotCompatible(ref.key, c.track.key)).toBe(true)
      expect(Math.abs(c.track.bpm - ref.bpm)).toBeLessThanOrEqual(8)
    }
    expect(r.candidates[0].reason).toMatch(/rarely play/)
  })

  it('never suggests the reference track itself', () => {
    const w = buildWorld(NOW)
    const ref = w.byId.get('fisher1')!
    const r = computeCourage(ref, w.tracks, { comfortGenres: ['Tech House'] })
    expect(r.candidates.map((c) => c.track.id)).not.toContain('fisher1')
  })

  it('returns an honest empty when everything mixable is in the comfort zone', () => {
    const w = buildWorld(NOW)
    const ref = w.byId.get('fisher1')!
    // Mark every genre present as comfort → nothing is "daring" left.
    const allGenres = Array.from(
      new Set(w.tracks.map((t) => t.genre).filter((g): g is string => !!g))
    )
    const r = computeCourage(ref, w.tracks, { comfortGenres: allGenres })
    expect(r.kind).toBe('empty')
    expect(r.candidates).toEqual([])
    expect(r.narration).toMatch(/mixes cleanly/)
  })

  it('derives a comfort zone from played sessions', () => {
    const w = buildWorld(NOW)
    const comfort = deriveComfort(w.tracks, w.sessions)
    expect(comfort.length).toBeGreaterThan(0)
    // The fixture sessions are dominated by Tech House / Techno; one should lead.
    expect(comfort.some((g) => /tech house|techno/i.test(g))).toBe(true)
  })
})
