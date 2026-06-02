import type {
  Track,
  Set as DJSet,
  Suggestion,
  MatchReason,
  MatchReasonQuality
} from '../../src/types'
import { scoreTransition } from './transitionScore'
import { getKeyCompatibility } from '../utils/camelot'
import { getTargetAt } from './energyCurve'

// ───────── Combo scoring constants ─────────

/** Boost added to a candidate's raw score when the user has played it after the
 *  current track ≥ 3 times — significant enough to promote even a slightly
 *  weaker transition to the top of the list ("muscle memory wins"). */
const COMBO_STRONG_BOOST = 25
/** Smaller boost for 1–2 prior plays — nudge without dominating. */
const COMBO_LIGHT_BOOST = 10
/** Below this count the combo chip isn't shown (one-offs aren't a pattern). */
const COMBO_CHIP_THRESHOLD = 3

// ───────── Match reason generation ─────────

function buildMatchReasons(
  currentTrack: Track,
  candidate: Track,
  comboCount: number
): MatchReason[] {
  const score = scoreTransition(currentTrack, candidate)
  const camelot = getKeyCompatibility(currentTrack.key, candidate.key)
  const reasons: MatchReason[] = []

  // Combo reason takes pole position when present — it's the DJ's own data,
  // outranking algorithmic key/BPM compatibility.
  if (comboCount >= COMBO_CHIP_THRESHOLD) {
    reasons.push({
      label: `You've played this ${comboCount} times`,
      type: 'combo',
      quality: 'positive'
    })
  }

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
  const bpmLabel = score.bpmDelta === 0 ? 'Identical BPM' : `±${Math.round(score.bpmDelta)} BPM`
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
  /**
   * Map of candidate trackId → number of times the DJ has played that track
   * after `currentTrack` in their performed sessions or saved sets. Tracks NOT
   * in the map are assumed to have 0 (no prior pairing recorded).
   */
  comboLookup?: Map<string, number>
): Suggestion[] {
  // Merge DB-persisted set IDs with any IDs the renderer passes directly.
  // This handles the race where a newly added track hasn't been saved to DB yet
  // but must still be excluded from suggestions.
  const inSetIds = new Set([...set.tracks.map((st) => st.trackId), ...extraExcludeIds])
  const artistsInSet = new Set(set.tracks.map((st) => st.track.artist.toLowerCase()))
  const nextPosition = set.tracks.length // 0-indexed position of the next slot

  const candidates = library.filter(
    (t) => !inSetIds.has(t.id) && !t.missingFile && Math.abs(t.bpm - currentTrack.bpm) <= 16
  )

  interface Scored {
    track: Track
    rawScore: number
    adjustedScore: number
    comboCount: number
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

    // Combo boost: the DJ has played this transition before. Strong boost
    // beyond threshold (clearly a pattern), light boost for occasional pairs.
    const comboCount = comboLookup?.get(candidate.id) ?? 0
    if (comboCount >= COMBO_CHIP_THRESHOLD) adjusted += COMBO_STRONG_BOOST
    else if (comboCount >= 1) adjusted += COMBO_LIGHT_BOOST

    return { track: candidate, rawScore: ts.score, adjustedScore: adjusted, comboCount }
  })

  scored.sort((a, b) => b.adjustedScore - a.adjustedScore)

  return scored.slice(0, count).map((s, i) => {
    const ts = scoreTransition(currentTrack, s.track)
    return {
      track: s.track,
      transitionScore: ts,
      rank: i,
      matchReasons: buildMatchReasons(currentTrack, s.track, s.comboCount),
      best: i === 0,
      comboCount: s.comboCount > 0 ? s.comboCount : undefined
    }
  })
}
