import type { Track, Set as DJSet, SetTrack, ArchitectParams } from '../../src/types'
import { getSuggestions } from './suggestions'
import { scoreTransition } from './transitionScore'
import { getTargetCurve } from './energyCurve'

// ───────── Helpers ─────────

function makeSetTrack(track: Track, position: number, locked = false): SetTrack {
  return {
    id: crypto.randomUUID(),
    trackId: track.id,
    track,
    position,
    locked: locked || undefined,
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
  // Resolve locked tracks first — they bypass BPM/source filtering and are never rejected.
  const lockSpec = params.lockedTracks ?? []
  const libraryById = new Map(library.map((t) => [t.id, t]))
  const resolvedLocks: Array<{ position: number; track: Track }> = []
  for (const { position, trackId } of lockSpec) {
    const t = libraryById.get(trackId)
    if (t) resolvedLocks.push({ position, track: t })
  }
  resolvedLocks.sort((a, b) => a.position - b.position)
  const lockByPos = new Map(resolvedLocks.map((l) => [l.position, l.track]))
  const lockedTrackIds = new Set(resolvedLocks.map((l) => l.track.id))

  // BPM-filter the candidate pool. Locked tracks bypass this and are never reused as filler.
  const filtered = library.filter(
    (t) =>
      !lockedTrackIds.has(t.id) &&
      !t.missingFile &&
      t.bpm >= params.bpmMin - 5 &&
      t.bpm <= params.bpmMax + 5,
  )

  // Target track count — extended if any lock sits past the duration-derived count.
  const rawCount = Math.round(params.targetDuration / 6)
  const minCount = Math.ceil(params.targetDuration / 10)
  const maxCount = Math.floor(params.targetDuration / 4)
  const durationCount = Math.max(minCount, Math.min(maxCount, Math.max(rawCount, 1)))
  const lockExtent = resolvedLocks.length > 0
    ? resolvedLocks[resolvedLocks.length - 1].position + 1
    : 0
  const targetCount = Math.max(durationCount, lockExtent, 1)

  if (filtered.length === 0 && targetCount > resolvedLocks.length) return []

  const curve = getTargetCurve(params.energyCurveType, targetCount)

  const usedIds = new Set<string>(lockedTrackIds)
  const remaining = filtered.filter((t) => !usedIds.has(t.id))

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

  const setTracks: SetTrack[] = []

  // Position 0 — locked or opener.
  if (lockByPos.has(0)) {
    setTracks.push(makeSetTrack(lockByPos.get(0)!, 0, true))
  } else {
    const opener = selectOpener(filtered, curve[0], params.excludedTracks ?? [])
    if (!opener) return []
    setTracks.push(makeSetTrack(opener, 0))
    usedIds.add(opener.id)
    const idx = remaining.findIndex((t) => t.id === opener.id)
    if (idx !== -1) remaining.splice(idx, 1)
  }
  partialSet.tracks = [...setTracks]

  // Index into resolvedLocks for fast "next lock after current position" lookups.
  function findNextLockAfter(pos: number): { position: number; track: Track } | null {
    for (const l of resolvedLocks) if (l.position > pos) return l
    return null
  }

  // Greedy fill
  for (let i = 1; i < targetCount; i++) {
    if (lockByPos.has(i)) {
      setTracks.push(makeSetTrack(lockByPos.get(i)!, i, true))
      partialSet.tracks = [...setTracks]
      continue
    }
    const lastTrack = setTracks[setTracks.length - 1].track
    const targetEnergy = curve[i]
    const nextLock = findNextLockAfter(i)
    const distToNextLock = nextLock ? nextLock.position - i : Infinity

    const suggestions = getSuggestions(lastTrack, remaining, partialSet, 30)

    let candidate: Track | null = null

    // Bridge mode: when a lock anchors within 4 slots, weight the candidate's
    // transition INTO the next lock alongside its transition FROM the previous track.
    if (nextLock && distToNextLock <= 4) {
      const W_BACK = 0.6
      const W_FORWARD = 0.4
      let best: Track | null = null
      let bestScore = -Infinity
      for (const s of suggestions) {
        if (params.harmonicMixing && s.transitionScore.keyCompatibility === 'clash') continue
        const back = s.transitionScore.score
        const forward = scoreTransition(s.track, nextLock.track).score
        const energyPenalty = Math.abs(s.track.energy - targetEnergy) * 4
        const combined = back * W_BACK + forward * W_FORWARD - energyPenalty
        if (combined > bestScore) {
          bestScore = combined
          best = s.track
        }
      }
      candidate = best
    }

    // Fallback (or default) selection — original tolerance ladder.
    if (!candidate) {
      candidate =
        pickCandidate(suggestions, targetEnergy, 1.5, params.harmonicMixing) ??
        pickCandidate(suggestions, targetEnergy, 3, params.harmonicMixing) ??
        suggestions[0]?.track ??
        null
    }

    if (!candidate) break

    setTracks.push(makeSetTrack(candidate, i))
    partialSet.tracks = [...setTracks]
    usedIds.add(candidate.id)
    const idx = remaining.findIndex((t) => t.id === candidate.id)
    if (idx !== -1) remaining.splice(idx, 1)
  }

  // Repair pass — never touch locked slots.
  const repairPool = filtered.filter((t) => !usedIds.has(t.id))
  for (let pass = 0; pass < 3; pass++) {
    let repaired = false
    for (let i = 1; i < setTracks.length; i++) {
      if (setTracks[i].locked) continue
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

  // Final scoring — preserve `locked` flag through the map.
  return setTracks.map((st, i) => ({
    ...st,
    transitionScore: i > 0 ? scoreTransition(setTracks[i - 1].track, st.track) : undefined,
  }))
}
