/**
 * Live "what happens if I play this" layer.
 *
 * SetSense Live's core insight: DJs care about CONSEQUENCES, not bare
 * recommendations. This wraps the existing {@link getSuggestions} brain — fed
 * the *detected* current track instead of a planned one — and reframes each
 * candidate as the consequence of playing it next: signed BPM move, energy
 * move, harmonic safety, and an overall match score. The same engine that
 * powers Studio drives Live; only the input (live vs planned) and the framing
 * (consequence vs suggestion) differ.
 */

import type { Track, Set as DJSet, KeyCompatibility } from '../../src/types'
import { getSuggestions } from './suggestions'
import { GENERIC_PROFILE, type MixingProfile } from './genreProfiles'

export interface LiveConsequence {
  track: Track
  /** Transition cleanliness, 0–100 (higher = cleaner). */
  matchScore: number
  /** Signed BPM change current → candidate (e.g. +2.0, -1.5). */
  bpmDelta: number
  /** Signed energy change current → candidate (−10..+10). */
  energyDelta: number
  keyCompatibility: KeyCompatibility
  /** Glanceable consequence line, e.g. "Perfect harmony · +1 energy · +2 BPM". */
  summary: string
  /** True for the single best option. */
  best: boolean
  /** How many times the DJ has historically played this after the current track. */
  comboCount?: number
}

function bpmPhrase(delta: number): string {
  if (delta === 0) return 'same BPM'
  const rounded = Math.round(delta * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded} BPM`
}

function energyPhrase(delta: number): string {
  if (delta === 0) return 'holds energy'
  return `${delta > 0 ? '+' : ''}${delta} energy`
}

function keyPhrase(k: KeyCompatibility): string {
  switch (k) {
    case 'perfect':
      return 'Perfect harmony'
    case 'compatible':
      return 'Harmonic'
    case 'neutral':
      return 'Key OK'
    case 'clash':
      return 'Key clash'
  }
}

/** Build the consequence one-liner, leading with the most decision-relevant
 *  fact (a key clash is a warning the DJ must see first). */
export function consequenceSummary(
  key: KeyCompatibility,
  bpmDelta: number,
  energyDelta: number
): string {
  return [keyPhrase(key), energyPhrase(energyDelta), bpmPhrase(bpmDelta)].join(' · ')
}

/**
 * Top `count` next-track consequences for the currently playing track.
 * `comboLookup` and `profile` pass straight through to {@link getSuggestions}.
 */
export function getLiveNextUp(
  currentTrack: Track,
  library: Track[],
  set: DJSet,
  count = 3,
  comboLookup?: Map<string, number>,
  profile: MixingProfile = GENERIC_PROFILE
): LiveConsequence[] {
  // Always exclude the playing track itself: in Live the current track is
  // detected from audio and may not be in any set, so getSuggestions' set-based
  // exclusion wouldn't catch it — without this it could "suggest" mixing into
  // the track already playing.
  const suggestions = getSuggestions(
    currentTrack,
    library,
    set,
    count,
    [currentTrack.id],
    comboLookup,
    profile
  )

  return suggestions.map((s) => {
    // Signed deltas (current → candidate); transitionScore.bpmDelta is absolute.
    const bpmDelta = Math.round((s.track.bpm - currentTrack.bpm) * 10) / 10
    const energyDelta = s.track.energy - currentTrack.energy
    const key = s.transitionScore.keyCompatibility
    return {
      track: s.track,
      matchScore: s.transitionScore.score,
      bpmDelta,
      energyDelta,
      keyCompatibility: key,
      summary: consequenceSummary(key, bpmDelta, energyDelta),
      best: s.best === true,
      comboCount: s.comboCount
    }
  })
}
