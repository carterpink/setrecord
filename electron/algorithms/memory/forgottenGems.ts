/**
 * forgottenGems.ts — Pure engine: surface tracks that were once popular
 * in the DJ's library but have gone dormant.
 *
 * A "forgotten gem" requires BOTH signals:
 *   1. Historical significance: either playCount is above-average for the
 *      library OR the track has a rating of 4+.
 *   2. Recency dormancy: lastPlayed is older than `minMonthsDormant` months
 *      (default 6). Tracks with no lastPlayed (never played) are explicitly
 *      excluded — they are "untested", not "forgotten".
 *
 * Score = significance × gap_factor, where gap_factor grows with dormancy.
 */

import type { Track } from '../../../src/types'
import type { GemResult } from '../../../src/types'

export type { GemResult }

export interface ForgottenGemsOpts {
  now?: Date
  /** Minimum months since lastPlayed to qualify. Default: 6 */
  minMonthsDormant?: number
  /** Maximum results to return. Default: 20 */
  limit?: number
}

function monthsAgo(date: Date, now: Date): number {
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  return (now.getTime() - date.getTime()) / msPerMonth
}

export function findForgottenGems(tracks: Track[], opts: ForgottenGemsOpts = {}): GemResult[] {
  const now = opts.now ?? new Date()
  const minMonths = opts.minMonthsDormant ?? 6
  const limit = opts.limit ?? 20

  if (tracks.length === 0) return []

  // Compute library-wide average playCount (only played tracks)
  const playedTracks = tracks.filter((t) => t.playCount > 0)
  const avgPlayCount =
    playedTracks.length > 0
      ? playedTracks.reduce((s, t) => s + t.playCount, 0) / playedTracks.length
      : 1

  const results: GemResult[] = []

  for (const track of tracks) {
    // Must have been played at some point
    if (!track.lastPlayed || track.playCount === 0) continue

    const lastPlayedDate = new Date(track.lastPlayed)
    const gap = monthsAgo(lastPlayedDate, now)
    if (gap < minMonths) continue

    // Significance signal: above-average play count or strong rating
    const isHighPlayCount = track.playCount >= avgPlayCount
    const isHighRating = track.rating >= 4

    if (!isHighPlayCount && !isHighRating) continue

    // Score: combination of relative popularity and dormancy gap.
    // cap gap_factor at 5 years to avoid infinity dominating everything.
    const normalizedCount = track.playCount / Math.max(avgPlayCount, 1)
    const ratingBonus = track.rating >= 4 ? 1 + (track.rating - 3) * 0.5 : 1
    const gapFactor = Math.min(gap / minMonths, (5 * 12) / minMonths)
    const score = normalizedCount * ratingBonus * gapFactor

    const reasonParts: string[] = []
    if (isHighPlayCount) {
      reasonParts.push(`played ${track.playCount}× (library avg ${Math.round(avgPlayCount)})`)
    }
    if (isHighRating) {
      reasonParts.push(`rated ${track.rating}★`)
    }
    reasonParts.push(`dormant ${Math.round(gap)} months`)

    results.push({
      track,
      score,
      reason: reasonParts.join(' · '),
      monthsDormant: gap
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}
