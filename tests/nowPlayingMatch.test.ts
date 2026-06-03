/**
 * matchNowPlaying — turns on-screen / metadata text into a confident library
 * match. Covers OCR-style noisy lines, "artist — title" metadata, suffix junk,
 * artist tie-breaks, and confident rejection of non-matches.
 */
import { describe, it, expect } from 'vitest'
import { matchNowPlaying } from '../electron/algorithms/nowPlayingMatch'

const lib = [
  { id: 'a', title: 'Nocturne Drive', artist: 'Lunar Bloc' },
  { id: 'b', title: 'Escape Velocity', artist: 'Vela' },
  { id: 'c', title: 'Oxygen', artist: 'Halcyon' },
  { id: 'd', title: 'Go', artist: 'Common Artist' } // one-word title (risky)
]

describe('matchNowPlaying', () => {
  it('matches a clean title line', () => {
    const m = matchNowPlaying(['Nocturne Drive'], lib)
    expect(m?.trackId).toBe('a')
  })

  it('matches a "artist — title" metadata string', () => {
    const m = matchNowPlaying(['Vela — Escape Velocity'], lib)
    expect(m?.trackId).toBe('b')
    expect(m!.score).toBeGreaterThan(0.6)
  })

  it('survives OCR chrome and "(Extended Mix)" suffixes', () => {
    const ocr = ['DECK A', 'Escape Velocity (Extended Mix)', 'Vela', '124.0 BPM   8A', '03:12']
    expect(matchNowPlaying(ocr, lib)?.trackId).toBe('b')
  })

  it('uses the artist to break a tie between two on-screen titles', () => {
    // Both titles present; only Halcyon's artist appears → Oxygen wins.
    const ocr = ['Nocturne Drive', 'Oxygen', 'Halcyon']
    expect(matchNowPlaying(ocr, lib)?.trackId).toBe('c')
  })

  it('rejects unrelated text (no false lock)', () => {
    expect(matchNowPlaying(['System Preferences', 'Wi-Fi', 'Bluetooth'], lib)).toBeNull()
  })

  it('does not match a one-word title without artist corroboration', () => {
    expect(matchNowPlaying(['Go', 'to', 'settings'], lib)).toBeNull()
    // …but does when the artist is also present.
    expect(matchNowPlaying(['Go', 'Common Artist'], lib)?.trackId).toBe('d')
  })

  it('returns null for empty / blank text', () => {
    expect(matchNowPlaying([], lib)).toBeNull()
    expect(matchNowPlaying(['', '   '], lib)).toBeNull()
  })
})
