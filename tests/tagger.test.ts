import { describe, it, expect } from 'vitest'
import {
  inferTags,
  energyTag,
  vocalsTag,
  timeTag,
  bestForTags,
  vibeTags,
  genreBlendTags,
  isMajorKey,
  type TagInput
} from '../electron/services/tagging/tagRules'
import { vocalPresence } from '../electron/services/energy/vocalFeature'
import { formatTagsComment } from '../electron/services/exportService'
import { isValidTag } from '../src/utils/tagging/taxonomy'

const base: TagInput = {
  energy: 5,
  rms: 0.5,
  brightness: 0.5,
  loudness: 0.5,
  vocalness: 0,
  bpm: 124,
  key: '8A',
  genre: undefined,
  durationSec: 360
}

describe('tagRules — single-value categories', () => {
  it('maps energy bands off the 1–10 score', () => {
    expect(energyTag(2)).toBe('cooldown')
    expect(energyTag(4)).toBe('warm-up')
    expect(energyTag(6)).toBe('builder')
    expect(energyTag(9)).toBe('peak-time')
  })

  it('buckets vocals into three levels', () => {
    expect(vocalsTag(0.1)).toBe('instrumental')
    expect(vocalsTag(0.4)).toBe('vocal-touches')
    expect(vocalsTag(0.8)).toBe('vocal-led')
  })

  it('reads major vs minor from the Camelot suffix', () => {
    expect(isMajorKey('9B')).toBe(true)
    expect(isMajorKey('11b')).toBe(true)
    expect(isMajorKey('9A')).toBe(false)
    expect(isMajorKey('')).toBe(false)
  })

  it('places time-of-night from energy + brightness', () => {
    expect(timeTag({ ...base, energy: 2, brightness: 0.7 })).toBe('sunset')
    expect(timeTag({ ...base, energy: 2, brightness: 0.2 })).toBe('after-hours')
    expect(timeTag({ ...base, energy: 9, brightness: 0.3 })).toBe('late-night')
    expect(timeTag({ ...base, energy: 6, brightness: 0.5 })).toBe('prime')
  })
})

describe('tagRules — multi-value categories', () => {
  it('best-for: high energy → peak, low energy → opener, capped at 2', () => {
    expect(bestForTags({ ...base, energy: 9 })).toContain('peak')
    expect(bestForTags({ ...base, energy: 3 })).toContain('opener')
    const instrumentalTool = bestForTags({ ...base, energy: 5, vocalness: 0.1 })
    expect(instrumentalTool).toContain('tool')
    expect(bestForTags({ ...base, energy: 9 }).length).toBeLessThanOrEqual(2)
  })

  it('vibe: returns 1–2 valid slugs', () => {
    const v = vibeTags({ ...base, brightness: 0.85, loudness: 0.6, key: '8B', energy: 8 })
    expect(v.length).toBeGreaterThanOrEqual(1)
    expect(v.length).toBeLessThanOrEqual(2)
    for (const slug of v) expect(isValidTag('vibe', slug)).toBe(true)
  })

  it('genre-blend maps free text to lexicon slugs, most-specific first', () => {
    expect(genreBlendTags('Tech House')).toEqual(['tech-house'])
    expect(genreBlendTags('Melodic Techno')).toEqual(['melodic-techno'])
    expect(genreBlendTags('Deep House')).toEqual(['deep-house'])
    expect(genreBlendTags(undefined)).toEqual([])
    expect(genreBlendTags('Unknowncore')).toEqual([])
  })
})

describe('inferTags — invariant: only ever emits valid taxonomy slugs', () => {
  const cases: TagInput[] = [
    base,
    { ...base, energy: 1, vocalness: 0.9, brightness: 0.1, key: '5A', genre: 'Deep House' },
    { ...base, energy: 10, vocalness: 0, brightness: 0.95, key: '7B', genre: 'Melodic Techno' },
    { ...base, energy: 7, rms: 0.9, loudness: 0.9, brightness: 0.2, genre: 'Afro House' }
  ]
  it('every tag is valid for its category, with the single-value categories present', () => {
    for (const input of cases) {
      const tags = inferTags(input)
      for (const t of tags) expect(isValidTag(t.category, t.value)).toBe(true)
      const cats = new Set(tags.map((t) => t.category))
      expect(cats.has('energy')).toBe(true)
      expect(cats.has('vocals')).toBe(true)
      expect(cats.has('time')).toBe(true)
    }
  })
})

describe('vocalFeature — vocal-presence proxy', () => {
  const SR = 22_050
  function tone(freqHz: number, seconds: number, modHz = 0): Float32Array {
    const n = Math.floor(SR * seconds)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const mod = modHz > 0 ? 0.5 + 0.5 * Math.sin(2 * Math.PI * modHz * t) : 1
      out[i] = mod * Math.sin(2 * Math.PI * freqHz * t)
    }
    return out
  }

  it('reads modulated mid-band energy as more vocal than a steady sub-bass tone', () => {
    const instrumental = vocalPresence(tone(60, 2), SR) // deep sub, no mid, no modulation
    const vocalish = vocalPresence(tone(1200, 2, 6), SR) // mid band + amplitude modulation
    expect(vocalish).toBeGreaterThan(instrumental)
    expect(instrumental).toBeGreaterThanOrEqual(0)
    expect(vocalish).toBeLessThanOrEqual(1)
  })

  it('returns 0 for empty input', () => {
    expect(vocalPresence(new Float32Array(0), SR)).toBe(0)
  })
})

describe('formatTagsComment — Rekordbox MyTag-in-comments syntax', () => {
  it('wraps labels and preserves an existing comment', () => {
    const out = formatTagsComment(
      [
        { category: 'energy', value: 'peak-time', source: 'auto' },
        { category: 'vibe', value: 'dark', source: 'auto' }
      ],
      'banger'
    )
    expect(out).toMatch(/^banger \/\* /)
    expect(out).toContain('Peak-time')
    expect(out).toContain('Dark')
  })

  it('replaces a previously-written tag block rather than stacking it', () => {
    const first = formatTagsComment([{ category: 'vibe', value: 'warm', source: 'auto' }], 'note')
    const second = formatTagsComment([{ category: 'vibe', value: 'dark', source: 'auto' }], first)
    expect(second).toBe('note /* Dark */')
  })

  it('returns the existing comment untouched when there are no tags', () => {
    expect(formatTagsComment([], 'keep me')).toBe('keep me')
    expect(formatTagsComment(undefined, undefined)).toBe('')
  })
})
