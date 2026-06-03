/**
 * NFR-107 — fixture helpers for the suggestion benchmark.
 *
 * Builds a realistic mid-set state: a Set with N tracks already placed, a
 * "current" track drawn from the densest BPM cluster (worst case for the
 * candidate filter), and a comboLookup over plausible next-track ids.
 */

import type { Track, Set as DJSet, SetTrack } from '../../src/types'

export interface SuggestionScenario {
  current: Track
  set: DJSet
  comboLookup: Map<string, number>
  /** Suggestions to request per call (matches the live HUD's request size). */
  count: number
}

/** Pick the track whose BPM is closest to `target` — the dense-cluster centre. */
function pickNearBpm(library: Track[], target: number, skip: Set<string>): Track {
  let best = library[0]
  let bestDelta = Infinity
  for (const t of library) {
    if (skip.has(t.id)) continue
    const d = Math.abs(t.bpm - target)
    if (d < bestDelta) {
      bestDelta = d
      best = t
    }
  }
  return best
}

function makeSetTrack(track: Track, position: number): SetTrack {
  return { id: `set-slot-${position}`, trackId: track.id, track, position }
}

/**
 * Construct a mid-set scenario over `library`. The current track and the placed
 * tracks all sit in the 126 BPM cluster so the ±maxStep candidate window
 * captures the largest possible pool — the case the <100ms budget must hold.
 */
export function buildSuggestionScenario(
  library: Track[],
  placed = 8,
  count = 10
): SuggestionScenario {
  const skip = new Set<string>()
  const setTracks: SetTrack[] = []
  for (let i = 0; i < placed; i++) {
    // Spread the placed tracks across the dense band so several artists land in
    // the set (exercising getSuggestions' artist-exclusion path).
    const target = 124 + (i % 5)
    const t = pickNearBpm(library, target, skip)
    skip.add(t.id)
    setTracks.push(makeSetTrack(t, i))
  }

  const current = pickNearBpm(library, 126, skip)
  skip.add(current.id)

  const set: DJSet = {
    id: 'bench-set',
    name: 'Bench Set',
    createdAt: new Date('2025-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2025-01-01T00:00:00Z').toISOString(),
    tracks: setTracks
  }

  // Seed a combo lookup over ~200 candidates near the current BPM so the
  // combo-boost branch in getSuggestions is exercised, not dead.
  const comboLookup = new Map<string, number>()
  let seeded = 0
  for (const t of library) {
    if (skip.has(t.id)) continue
    if (Math.abs(t.bpm - current.bpm) <= 6) {
      comboLookup.set(t.id, 1 + ((seeded * 7) % 5)) // counts 1–5, deterministic
      if (++seeded >= 200) break
    }
  }

  return { current, set, comboLookup, count }
}
