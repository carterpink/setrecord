/**
 * closers.ts — Pure engine: identify a DJ's habitual set openers and closers
 * by aggregating first/last track positions across all session sequences.
 */

import type { RankedTrack } from '../../../src/types'

export type { RankedTrack }

export interface OpenerCloserResult {
  closers: RankedTrack[]
  openers: RankedTrack[]
}

/**
 * Analyse sequences of ordered track ids to find which tracks are most often
 * placed first (openers) and last (closers).
 *
 * Sequences of length < 2 are skipped (a single-track sequence has no opener
 * distinct from closer — it's excluded from both lists to avoid noise).
 * Sequences of length 1 are skipped entirely (opener === closer ambiguous).
 */
export function analyzeEnds(sequences: string[][]): OpenerCloserResult {
  const openerCounts = new Map<string, number>()
  const closerCounts = new Map<string, number>()

  for (const seq of sequences) {
    if (seq.length < 2) continue
    const first = seq[0]
    const last = seq[seq.length - 1]

    openerCounts.set(first, (openerCounts.get(first) ?? 0) + 1)
    closerCounts.set(last, (closerCounts.get(last) ?? 0) + 1)
  }

  const toRanked = (map: Map<string, number>): RankedTrack[] =>
    Array.from(map.entries())
      .map(([trackId, count]) => ({ trackId, count }))
      .sort((a, b) => b.count - a.count)

  return {
    openers: toRanked(openerCounts),
    closers: toRanked(closerCounts)
  }
}
