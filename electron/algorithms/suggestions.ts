import type {
  Track,
  Set as DJSet,
  Suggestion,
  MatchReason,
  MatchReasonQuality,
} from '../../src/types'
import { scoreTransition } from './transitionScore'
import { getKeyCompatibility } from '../utils/camelot'
import { getTargetAt } from './energyCurve'

// ───────── Match reason generation ─────────

function buildMatchReasons(currentTrack: Track, candidate: Track): MatchReason[] {
  const score = scoreTransition(currentTrack, candidate)
  const camelot = getKeyCompatibility(currentTrack.key, candidate.key)
  const reasons: MatchReason[] = []

  // Key reason
  const keyQuality: MatchReasonQuality =
    camelot.relationship === 'clash'
      ? 'warning'
      : camelot.relationship === 'neutral'
        ? 'neutral'
        : 'positive'
  reasons.push({ label: camelot.reason, type: 'key', quality: keyQuality })

  // BPM reason
  const bpmQuality: MatchReasonQuality =
    score.bpmDelta <= 2 ? 'positive' : score.bpmDelta <= 8 ? 'neutral' : 'warning'
  const bpmLabel =
    score.bpmDelta === 0 ? 'Identical BPM' : `±${Math.round(score.bpmDelta)} BPM`
  reasons.push({ label: bpmLabel, type: 'bpm', quality: bpmQuality })

  // Energy reason — only if non-zero
  const eDelta = candidate.energy - currentTrack.energy
  if (eDelta !== 0) {
    const energyQuality: MatchReasonQuality =
      eDelta === 1 ? 'positive' : Math.abs(eDelta) <= 2 ? 'neutral' : 'warning'
    const energyLabel = eDelta > 0 ? `+${eDelta} energy` : `${eDelta} energy`
    reasons.push({ label: energyLabel, type: 'energy', quality: energyQuality })
  }

  return reasons
}

// ───────── Main export ─────────

export function getSuggestions(
  currentTrack: Track,
  library: Track[],
  set: DJSet,
  count: number,
  extraExcludeIds: string[] = [],
): Suggestion[] {
  // Merge DB-persisted set IDs with any IDs the renderer passes directly.
  // This handles the race where a newly added track hasn't been saved to DB yet
  // but must still be excluded from suggestions.
  const inSetIds = new Set([...set.tracks.map((st) => st.trackId), ...extraExcludeIds])
  const artistsInSet = new Set(set.tracks.map((st) => st.track.artist.toLowerCase()))
  const nextPosition = set.tracks.length  // 0-indexed position of the next slot

  const candidates = library.filter(
    (t) =>
      !inSetIds.has(t.id) &&
      !t.missingFile &&
      Math.abs(t.bpm - currentTrack.bpm) <= 16,
  )

  interface Scored {
    track: Track
    rawScore: number
    adjustedScore: number
  }

  const scored: Scored[] = candidates.map((candidate) => {
    const ts = scoreTransition(currentTrack, candidate)
    let adjusted = ts.score

    // Diversity penalty: same artist as any track already in the set
    if (artistsInSet.has(candidate.artist.toLowerCase())) {
      adjusted -= 15
    }

    // Energy curve bonus: if the curve target calls for higher energy, reward matching tracks
    if (set.energyCurveType && set.energyCurveType !== 'custom') {
      const count = Math.max(nextPosition + 1, 2)
      const t = nextPosition / (count - 1)
      const target = getTargetAt(set.energyCurveType, t)
      if (Math.abs(candidate.energy - target) <= 1) adjusted += 8
    }

    return { track: candidate, rawScore: ts.score, adjustedScore: adjusted }
  })

  scored.sort((a, b) => b.adjustedScore - a.adjustedScore)

  return scored.slice(0, count).map((s, i) => {
    const ts = scoreTransition(currentTrack, s.track)
    return {
      track: s.track,
      transitionScore: ts,
      rank: i,
      matchReasons: buildMatchReasons(currentTrack, s.track),
      best: i === 0,
    }
  })
}
