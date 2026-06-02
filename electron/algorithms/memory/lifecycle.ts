/**
 * lifecycle.ts — Pure engine: classify every track in the library into a
 * LifecycleState based on play history, recency, and rating.
 *
 * State thresholds (all configurable via future opts if needed):
 *
 *   new         — added within 30 days AND playCount === 0
 *   untested    — playCount === 0 AND added > 30 days ago
 *   testing     — 1–3 plays, OR played recently (≤ 60 days) but < 5 plays
 *   active      — 4–9 plays OR consistently used in last year
 *   peak        — 10+ plays AND last played within 90 days
 *   occasional  — has plays, last played 90–365 days ago
 *   archive     — has plays, last played 1–3 years ago  OR  low rating + high age
 *   forgotten   — has plays, last played > 3 years ago  OR  played but rating=0 + >2yr dormant
 */

import type { Track } from '../../../src/types'
import type { LifecycleState } from '../../../src/types'

export type { LifecycleState }

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

export function classifyLifecycle(track: Track, ctx: { now?: Date } = {}): LifecycleState {
  const now = ctx.now ?? new Date()
  const daysAdded = daysSince(track.dateAdded, now)
  const daysLastPlayed = track.lastPlayed ? daysSince(track.lastPlayed, now) : null

  // No plays at all
  if (track.playCount === 0 || daysLastPlayed === null) {
    if (daysAdded <= 30) return 'new'
    return 'untested'
  }

  // Has plays — classify by frequency + recency
  if (track.playCount >= 10 && daysLastPlayed <= 90) return 'peak'
  if (daysLastPlayed > 3 * 365) return 'forgotten'
  if (daysLastPlayed > 365) return 'archive'
  if (daysLastPlayed > 90) return 'occasional'
  if (track.playCount >= 4) return 'active'
  return 'testing'
}

export function classifyAll(
  tracks: Track[],
  ctx: { now?: Date } = {}
): Map<string, LifecycleState> {
  const map = new Map<string, LifecycleState>()
  for (const track of tracks) {
    map.set(track.id, classifyLifecycle(track, ctx))
  }
  return map
}
