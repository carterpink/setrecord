/**
 * courage.ts — pure compute for the "Courage Engine" (Frontier 2B).
 *
 * Every recommender pushes a DJ toward safe/similar. Nothing pushes them to
 * grow. The Courage Engine does the opposite on purpose: out of the track
 * currently playing, it surfaces a pick that is genuinely MIXABLE (harmonically
 * compatible + within a BPM window) but from a genre OUTSIDE the DJ's comfort
 * zone — the cure for the rut the Sound Mirror detects.
 *
 * Comfort is derived from what the DJ actually plays (sessions) or, failing
 * that, play-count-weighted library genres. Pure: no DB/electron deps.
 */

import type { Track, CourageCandidate, CourageResult } from '../../../src/types'
import {
  camelotCompatible,
  camelotRelationship,
  type CamelotRelationship
} from '../../../src/utils/camelot'

// Re-export so existing importers (tests, main) can keep importing from here.
export type { CourageCandidate, CourageResult }

export interface CourageOptions {
  /** BPM window around the reference. Default max(6, 6% of reference BPM). */
  bpmTolerance?: number
  limit?: number
  /** Override the derived comfort zone. */
  comfortGenres?: string[]
  /** Sessions to derive comfort from (preferred over library play counts). */
  sessions?: { trackIds: string[] }[]
}

const REL_WEIGHT: Record<CamelotRelationship, number> = {
  perfect: 1,
  'energy-shift': 0.85,
  'mood-shift': 0.85,
  compatible: 0.75,
  neutral: 0.55,
  clash: 0,
  unknown: 0.5
}
const REL_LABEL: Record<CamelotRelationship, string> = {
  perfect: 'Perfect',
  'energy-shift': 'Energy-shift',
  'mood-shift': 'Mood-shift',
  compatible: 'Compatible',
  neutral: 'Workable',
  clash: 'Clashing',
  unknown: 'Untested'
}

/** Genres covering the bulk (~60%) of what the DJ reaches for. */
export function deriveComfort(tracks: Track[], sessions?: { trackIds: string[] }[]): string[] {
  const freq = new Map<string, number>()
  if (sessions?.length) {
    const byId = new Map(tracks.map((t) => [t.id, t]))
    for (const s of sessions)
      for (const id of s.trackIds) {
        const g = byId.get(id)?.genre
        if (g) freq.set(g, (freq.get(g) ?? 0) + 1)
      }
  }
  if (freq.size === 0) {
    // Fallback: weight library genres by play count (+1 so unplayed still count a little).
    for (const t of tracks) {
      if (!t.genre) continue
      freq.set(t.genre, (freq.get(t.genre) ?? 0) + 1 + (t.playCount ?? 0))
    }
  }
  const total = Array.from(freq.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return []
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])
  const comfort: string[] = []
  let cum = 0
  for (const [g, c] of sorted) {
    comfort.push(g)
    cum += c
    if (cum / total >= 0.6) break
  }
  return comfort
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

export function computeCourage(
  reference: Track,
  library: Track[],
  opts: CourageOptions = {}
): CourageResult {
  const comfort = opts.comfortGenres ?? deriveComfort(library, opts.sessions)
  const comfortSet = new Set(comfort.map((g) => g.toLowerCase()))
  const tol = opts.bpmTolerance ?? Math.max(6, Math.round(reference.bpm * 0.06))
  const limit = opts.limit ?? 5

  // Mixability is meaningless without a BPM and key to mix against.
  if (reference.bpm <= 0 || !reference.key) {
    return {
      kind: 'empty',
      comfortGenres: comfort,
      candidates: [],
      narration: `Need a BPM and key on ${reference.title} before I can find a daring-but-mixable pick.`
    }
  }

  const candidates: CourageCandidate[] = []
  for (const t of library) {
    if (t.id === reference.id || t.phantom === true) continue
    if (
      `${t.title}|${t.artist}`.toLowerCase() ===
      `${reference.title}|${reference.artist}`.toLowerCase()
    )
      continue
    // The courage: must be OUTSIDE the comfort zone.
    if (!t.genre || comfortSet.has(t.genre.toLowerCase())) continue
    // The safety: a real, known, mixable key + BPM (no zero-BPM / keyless tracks).
    if (t.bpm <= 0 || !t.key) continue
    if (!camelotCompatible(reference.key, t.key)) continue
    const bpmDelta = Math.round(t.bpm - reference.bpm)
    if (Math.abs(bpmDelta) > tol) continue

    const rel = camelotRelationship(reference.key, t.key)
    const bpmFactor = 1 - Math.min(1, Math.abs(bpmDelta) / tol)
    const mixScore = REL_WEIGHT[rel] * (0.6 + 0.4 * bpmFactor)
    const noveltyScore = 1 + (t.playCount === 0 ? 0.25 : 0)
    const score = mixScore * noveltyScore
    candidates.push({
      track: t,
      mixScore: Math.round(mixScore * 100) / 100,
      noveltyScore: Math.round(noveltyScore * 100) / 100,
      score: Math.round(score * 100) / 100,
      reason: `${REL_LABEL[rel]} key match at ${signed(bpmDelta)} BPM — ${t.genre}, which you rarely play.`
    })
  }
  candidates.sort((a, b) => b.score - a.score)
  const top = candidates.slice(0, limit)

  const comfortLabel = comfort.slice(0, 3).join(' / ') || 'your usual lane'
  const narration = top.length
    ? `You lean ${comfortLabel}. Dare one of these — all mixable out of ${reference.title}, none from your usual lane.`
    : `Nothing outside ${comfortLabel} mixes cleanly out of ${reference.title} right now.`

  return {
    kind: top.length ? 'tracks' : 'empty',
    comfortGenres: comfort,
    candidates: top,
    narration
  }
}
