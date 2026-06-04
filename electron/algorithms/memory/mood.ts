/**
 * mood.ts — pure vibe/energy → track-selection heuristics.
 *
 * Maps a MoodKey to BPM / energy / key / duration filters. The fixture library
 * has no mood tags, so these are honest heuristic proxies (and say so where the
 * matrix expects transparency).
 */

import type { Track } from '../../../src/types'
import type { MoodKey } from '../../../src/utils/moodIntent'

export interface MoodAnswer {
  kind: 'tracks' | 'empty'
  tracks?: Track[]
  narration: string
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
const isMinor = (t: Track): boolean => /A$/.test(t.key)
const isMajor = (t: Track): boolean => /B$/.test(t.key)

export function computeMood(mood: MoodKey, tracksIn: Track[]): MoodAnswer {
  const tracks = real(tracksIn)
  const wrap = (out: Track[], narration: string): MoodAnswer => ({
    kind: out.length ? 'tracks' : 'empty',
    tracks: out,
    narration: out.length ? narration : `Nothing in your library fits that vibe yet.`
  })

  switch (mood) {
    case 'euphoric':
      return wrap(
        tracks.filter((t) => t.energy >= 8 && t.bpm >= 128).sort((a, b) => b.energy - a.energy),
        'High-energy, peak-time tracks — euphoric picks (energy + tempo).'
      )
    case 'uplifting':
      return wrap(
        tracks
          .filter((t) => t.bpm >= 120 && t.bpm <= 128 && t.energy >= 5)
          .sort((a, b) => Number(isMajor(b)) - Number(isMajor(a))),
        'Uplifting daytime tracks — 120–128 BPM, medium-high energy, major-leaning.'
      )
    case 'aggressive':
      return wrap(
        tracks.filter((t) => t.energy >= 8 && t.bpm >= 133).sort((a, b) => b.bpm - a.bpm),
        'Aggressive, high-BPM (133+) main-stage material.'
      )
    case 'melancholic':
      return wrap(
        tracks.filter((t) => t.bpm >= 95 && t.bpm <= 118 && isMinor(t)),
        'Slow (≈100–118 BPM), minor-key, melancholic tracks.'
      )
    case 'emotional':
      return wrap(
        tracks.filter((t) => isMinor(t) && t.energy <= 6).sort((a, b) => a.energy - b.energy),
        'Approximating "emotional" via minor keys and lower energy (no emotion tag in your library).'
      )
    case 'hypnotic':
      return wrap(
        tracks
          .filter((t) => t.duration >= 480)
          .sort((a, b) => b.duration - a.duration),
        'Your longest tracks (8min+) — a proxy for hypnotic, repetitive structure; tag tracks "hypnotic" for an exact list.'
      )
    case 'late_night':
      return wrap(
        tracks.filter((t) => t.energy <= 6 && t.bpm > 0 && t.bpm <= 126),
        'Melodic, atmospheric tracks for a 6am crowd — not aggressive peak-time.'
      )
    case 'ambient_intro':
      return wrap(
        tracks
          .filter((t) => (t.bpm === 0 || t.bpm <= 100) && t.energy <= 3)
          .sort((a, b) => b.duration - a.duration),
        'Very-low / no-BPM, low-energy, long tracks for an ambient intro.'
      )
    case 'underwater':
      return wrap(
        tracks
          .filter((t) => t.energy <= 4 && t.bpm > 0 && t.bpm <= 122)
          .sort((a, b) => a.energy - b.energy),
        'A creative read of "underwater": slow, low-energy, atmospheric tracks.'
      )
    case 'club_ready': {
      const ranked = tracks
        .filter((t) => t.bpm >= 128 && t.bpm <= 133 && t.energy >= 8)
        .sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
      return wrap(
        ranked.slice(0, 1),
        ranked.length
          ? `${ranked[0].title} looks most club-ready — 128–133 BPM, high energy, recently added.`
          : 'No obvious club-ready peak track right now.'
      )
    }
    case 'reading_crowd':
      return wrap(
        tracks.filter((t) => t.energy >= 4 && t.energy <= 7),
        'Versatile, mid-energy tracks that work across crowds — good for reading the room.'
      )
    case 'cinematic':
      return wrap(
        tracks.filter((t) => t.energy <= 5).sort((a, b) => b.duration - a.duration),
        'Interpreting "cinematic" as dramatic, lower-energy, longer tracks (no cinematic tag to filter on).'
      )
    case 'chill':
      return wrap(
        tracks.filter((t) => t.bpm >= 100 && t.bpm <= 120 && t.energy <= 5),
        'Chilled, warmer tracks (≈100–120 BPM) for a beach/relaxed vibe.'
      )
    case 'tension':
      // Structural "build/tension" isn't reliably detectable — be transparent.
      return wrap(
        tracks
          .filter((t) => t.energy >= 7)
          .sort((a, b) => b.energy - a.energy)
          .slice(0, 12),
        'Tracks that tend to build tension (by energy) — note: bar-level build detection is approximate, not exact.'
      )
    default:
      return { kind: 'empty', narration: 'No mood mapping for that.' }
  }
}
