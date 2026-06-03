import { describe, it, expect } from 'vitest'
import {
  normaliseGenre,
  detectDominantProfile,
  getProfile,
  bpmScale,
  GENERIC_PROFILE
} from '../electron/algorithms/genreProfiles'
import { makeTrack } from './fixtures'

describe('normaliseGenre', () => {
  it('maps multi-word styles before their substrings', () => {
    expect(normaliseGenre('Tech House')).toBe('tech-house')
    expect(normaliseGenre('tech-house')).toBe('tech-house')
    expect(normaliseGenre('Deep House')).toBe('deep-house')
    // "Techno" must NOT be swallowed by the "tech house" matcher
    expect(normaliseGenre('Techno')).toBe('techno')
    expect(normaliseGenre('House')).toBe('house')
  })

  it('recognises the drum & bass family', () => {
    expect(normaliseGenre('Drum & Bass')).toBe('dnb')
    expect(normaliseGenre('DnB')).toBe('dnb')
    expect(normaliseGenre('Liquid')).toBe('dnb')
    expect(normaliseGenre('Neurofunk')).toBe('dnb')
  })

  it('returns null for blank or unrecognised tags', () => {
    expect(normaliseGenre('')).toBeNull()
    expect(normaliseGenre('   ')).toBeNull()
    expect(normaliseGenre('Spoken Word')).toBeNull()
  })
})

describe('detectDominantProfile', () => {
  it('returns the mode of the normalised genre tags', () => {
    const tracks = [
      makeTrack({ genre: 'Tech House' }),
      makeTrack({ genre: 'Tech House' }),
      makeTrack({ genre: 'Techno' }),
      makeTrack({ genre: '' }),
      makeTrack({ genre: 'Unknownish' })
    ]
    expect(detectDominantProfile(tracks).id).toBe('tech-house')
  })

  it('falls back to the generic profile when nothing is recognisable', () => {
    const tracks = [makeTrack({ genre: '' }), makeTrack({ genre: 'Field Recording' })]
    expect(detectDominantProfile(tracks).id).toBe('generic')
  })
})

describe('getProfile', () => {
  it('resolves known ids and falls back to generic', () => {
    expect(getProfile('techno').id).toBe('techno')
    expect(getProfile(undefined).id).toBe('generic')
    expect(getProfile('not-a-genre').id).toBe('generic')
  })
})

describe('bpmScale', () => {
  it('is exactly 1 for the identity profile', () => {
    expect(bpmScale(GENERIC_PROFILE)).toBe(1)
  })

  it('scales below 1 for tighter styles and above 1 for looser ones', () => {
    expect(bpmScale(getProfile('tech-house'))).toBeLessThan(1) // maxStep 12 / 16
    expect(bpmScale(getProfile('bass'))).toBeGreaterThan(1) // maxStep 20 / 16
  })
})
