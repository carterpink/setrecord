import type { Track, Set as DJSet, SetTrack, ArchitectParams } from '../../src/types'
import { getSuggestions } from './suggestions'
import { scoreTransition } from './transitionScore'
import { getTargetCurve } from './energyCurve'

// ───────── Helpers ─────────

function makeSetTrack(track: Track, position: number): SetTrack {
  return {
    id: crypto.randomUUID(),
    trackId: track.id,
    track,
    position,
  }
}

function selectOpener(
  pool: Track[],
  targetEnergy: number,
  excluded: string[],
): Track | null {
  const candidates = pool.filter((t) => !excluded.includes(t.id))
  if (candidates.length === 0) return null

  const scored = candidates.map((t) => {
    let score = -Math.abs(t.energy - targetEnergy) * 10
    if (t.duration > 300) score += 5  // prefer long intros
    const keyNum = parseInt(t.key, 10)
    if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 12) score += 3
    return { track: t, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0].track
}

function pickCandidate(
  suggestions: ReturnType<typeof getSuggestions>,
  targetEnergy: number,
  tolerance: number,
  harmonicMixing: boolean,
): Track | null {
  for (const s of suggestions) {
    if (Math.abs(s.track.energy - targetEnergy) > tolerance) continue
    if (harmonicMixing && s.transitionScore.keyCompatibility === 'clash') continue
    return s.track
  }
  return null
}

function findBetterTrack(
  from: Track,
  current: Track,
  pool: Track[],
  harmonicMixing: boolean,
): Track | null {
  const currentScore = scoreTransition(from, current).score
  let best: Track | null = null
  let bestScore = currentScore

  for (const candidate of pool) {
    if (Math.abs(candidate.bpm - from.bpm) > 16) continue
    const ts = scoreTransition(from, candidate)
    if (harmonicMixing && ts.keyCompatibility === 'clash') continue
    if (ts.score > bestScore) {
      bestScore = ts.score
      best = candidate
    }
  }
  return best
}

// ───────── Main export ─────────

export function buildSet(params: ArchitectParams, library: Track[]): SetTrack[] {
  // Step 1: Filter library to BPM window (±5 tolerance around the requested range)
  const filtered = library.filter(
    (t) => t.bpm >= params.bpmMin - 5 && t.bpm <= params.bpmMax + 5,
  )
  if (filtered.length === 0) return []

  // Step 2: Compute target track count (avg 6 min/track, clamped sensibly)
  const rawCount = Math.round(params.targetDuration / 6)
  const minCount = Math.ceil(params.targetDuration / 10)
  const maxCount = Math.floor(params.targetDuration / 4)
  const targetCount = Math.max(minCount, Math.min(maxCount, Math.max(rawCount, 1)))

  // Step 3: Generate target energy curve
  const curve = getTargetCurve(params.energyCurveType, targetCount)

  // Step 4: Select opener
  const opener = selectOpener(filtered, curve[0], params.excludedTracks ?? [])
  if (!opener) return []

  const usedIds = new Set<string>([opener.id])
  const remaining = filtered.filter((t) => !usedIds.has(t.id))

  // Partial DJSet object so getSuggestions() can apply curve bonuses
  const partialSet: DJSet = {
    id: crypto.randomUUID(),
    name: `${params.vibe} — ${params.slotTime}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tracks: [],
    energyCurveType: params.energyCurveType,
    vibe: params.vibe,
    venue: params.venueType,
    slotTime: params.slotTime,
    targetBpmMin: params.bpmMin,
    targetBpmMax: params.bpmMax,
  }

  const setTracks: SetTrack[] = [makeSetTrack(opener, 0)]
  partialSet.tracks = [...setTracks]

  // Step 5: Greedy build loop
  for (let i = 1; i < targetCount; i++) {
    const lastTrack = setTracks[setTracks.length - 1].track
    const targetEnergy = curve[i]

    // getSuggestions uses partialSet for diversity + curve bonuses
    const suggestions = getSuggestions(lastTrack, remaining, partialSet, 30)

    let candidate =
      pickCandidate(suggestions, targetEnergy, 1.5, params.harmonicMixing) ??
      pickCandidate(suggestions, targetEnergy, 3, params.harmonicMixing) ??
      suggestions[0]?.track ??
      null

    if (!candidate) break

    const st = makeSetTrack(candidate, i)
    setTracks.push(st)
    partialSet.tracks = [...setTracks]
    usedIds.add(candidate.id)
    const idx = remaining.findIndex((t) => t.id === candidate!.id)
    if (idx !== -1) remaining.splice(idx, 1)
  }

  // Step 6: Repair pass — swap trainwreck slots (max 3 passes)
  const repairPool = filtered.filter((t) => !usedIds.has(t.id))
  for (let pass = 0; pass < 3; pass++) {
    let repaired = false
    for (let i = 1; i < setTracks.length; i++) {
      const ts = scoreTransition(setTracks[i - 1].track, setTracks[i].track)
      if (ts.score < 45) {
        const better = findBetterTrack(
          setTracks[i - 1].track,
          setTracks[i].track,
          repairPool,
          params.harmonicMixing,
        )
        if (better) {
          const oldTrack = setTracks[i].track
          setTracks[i] = makeSetTrack(better, i)
          usedIds.add(better.id)
          repairPool.splice(repairPool.findIndex((t) => t.id === better.id), 1)
          repairPool.push(oldTrack)
          usedIds.delete(oldTrack.id)
          repaired = true
        }
      }
    }
    if (!repaired) break
  }

  // Step 7: Score all transitions and return
  return setTracks.map((st, i) => ({
    ...st,
    transitionScore: i > 0 ? scoreTransition(setTracks[i - 1].track, st.track) : undefined,
  }))
}
