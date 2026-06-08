/**
 * futureStrategy.ts — FUTURE / DIFF edge generator for the Constellation graph.
 *
 * Pure engine: grow a neighborhood of *feasible* transitions around a seed track
 * from compatibility alone (harmonic key + BPM proximity + genre/energy
 * adjacency) — "what you could mix". Each edge is flagged `novel` when the pair
 * has never actually been mixed (no Past co-occurrence); the DIFF lens keeps only
 * those — "compatible, but you've never tried it" = the discovery engine.
 *
 * Works from day one with zero play history (the cold-start answer Past can't
 * give). No DB or electron imports — graphService loads the data and calls this.
 */

import { getKeyCompatibility } from '../../utils/camelot'
import type {
  Track,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphTrackNode,
  CamelotRelationship,
  GraphMode
} from '../../../src/types'

export interface FutureGraphInput {
  /** Whole library (phantom/missing-file tracks are filtered out here). */
  tracks: Track[]
  /** Undirected pair keys (`a|b`, sorted) the DJ has actually mixed — for the novel flag. */
  mixedPairs: Set<string>
  /** 'future' = all compatible edges · 'diff' = only never-mixed (novel) edges. */
  mode: Extract<GraphMode, 'future' | 'diff'>
  seedTrackId?: string
  /** Keep the top-K compatible candidates per node (default 6) — kills the hairball. */
  topK?: number
  /** Hops out from the seed (default 2). */
  bfsDepth?: number
  /** Hard cap on track nodes (default 150). */
  maxNodes?: number
  /** Drop edges below this compatibility score — require ≥2 signals to agree (default 4). */
  minScore?: number
}

const DEFAULT_TOPK = 6
const DEFAULT_DEPTH = 2
const DEFAULT_MAX_NODES = 150
const DEFAULT_MIN_SCORE = 4
const BPM_BAND = 8

/** Sorted, order-independent key for an unordered track pair. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

interface Scored {
  relationship: CamelotRelationship
  bpmDelta: number
  score: number
}

/**
 * Compatibility score for mixing `b` after `a`. Blends the same signals the
 * suggestion/discovery engines use so the graph agrees with the rest of the app:
 *   harmonic (Camelot)  +3 perfect / +2 compatible
 *   BPM within ±8       up to +3 (closer = higher)
 *   same genre          +2
 *   energy within ±1    +1
 */
function compatibility(a: Track, b: Track): Scored {
  const rel = getKeyCompatibility(a.key, b.key).relationship as CamelotRelationship
  let score = 0
  if (rel === 'perfect') score += 3
  else if (rel === 'compatible') score += 2

  const bpmDelta = Math.abs((a.bpm ?? 0) - (b.bpm ?? 0))
  if (bpmDelta <= BPM_BAND) score += 3 - (bpmDelta / BPM_BAND) * 1.5 // +3 at 0 BPM → +1.5 at ±8

  if (a.genre && b.genre && a.genre.toLowerCase() === b.genre.toLowerCase()) score += 2
  if (Math.abs((a.energy ?? 0) - (b.energy ?? 0)) <= 1) score += 1

  return { relationship: rel, bpmDelta: Math.round((b.bpm ?? 0) - (a.bpm ?? 0)), score }
}

function compatLabel(s: Scored): string {
  const harmonic =
    s.relationship === 'perfect'
      ? 'perfect harmony'
      : s.relationship === 'compatible'
        ? 'compatible key'
        : 'workable'
  const bpm = s.bpmDelta === 0 ? 'same BPM' : `${s.bpmDelta > 0 ? '+' : ''}${s.bpmDelta} BPM`
  return `${harmonic} · ${bpm}`
}

/** A sensible anchor when the user hasn't picked one — the track they lean on most. */
function pickSeed(tracks: Track[]): string | undefined {
  let best: Track | undefined
  for (const t of tracks) {
    if (!best) {
      best = t
      continue
    }
    const score = (t.playCount ?? 0) * 2 + (t.rating ?? 0)
    const bestScore = (best.playCount ?? 0) * 2 + (best.rating ?? 0)
    if (score > bestScore) best = t
  }
  return best?.id
}

export function buildFutureGraph(input: FutureGraphInput): GraphData {
  const {
    mixedPairs,
    mode,
    topK = DEFAULT_TOPK,
    bfsDepth = DEFAULT_DEPTH,
    maxNodes = DEFAULT_MAX_NODES,
    minScore = DEFAULT_MIN_SCORE
  } = input

  const onlyNovel = mode === 'diff'
  const tracks = input.tracks.filter((t) => t.phantom !== true && t.missingFile !== true)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))

  const seedId =
    input.seedTrackId && trackMap.has(input.seedTrackId) ? input.seedTrackId : pickSeed(tracks)

  const empty = (): GraphData => ({
    nodes: [],
    edges: [],
    meta: { mode, scope: 'neighborhood', truncated: false, nodeCount: 0, edgeCount: 0, seedId }
  })

  if (!seedId) return empty()

  /** Top-K compatible candidates for one track, scored against the whole library. */
  const candidatesFor = (id: string): { other: string; scored: Scored }[] => {
    const a = trackMap.get(id)!
    const out: { other: string; scored: Scored }[] = []
    for (const b of tracks) {
      if (b.id === id) continue
      const scored = compatibility(a, b)
      if (scored.score < minScore) continue
      if (onlyNovel && mixedPairs.has(pairKey(id, b.id))) continue
      out.push({ other: b.id, scored })
    }
    out.sort((x, y) => y.scored.score - x.scored.score)
    return out.slice(0, topK)
  }

  // ── BFS over the top-K compatibility graph from the seed ──────────────────
  const visited = new Set<string>([seedId])
  const edges: GraphEdge[] = []
  const seenEdge = new Set<string>()
  const degree = new Map<string, number>()
  let truncated = false
  let frontier = [seedId]

  for (let depth = 0; depth < bfsDepth && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const { other, scored } of candidatesFor(id)) {
        const key = pairKey(id, other)
        if (!seenEdge.has(key)) {
          seenEdge.add(key)
          const novel = !mixedPairs.has(key)
          edges.push({
            id: `${mode}:${key}`,
            source: id,
            target: other,
            mode,
            weight: scored.score,
            directed: false,
            reason: {
              kind: 'compatible',
              label: compatLabel(scored),
              camelot: scored.relationship,
              bpmDelta: scored.bpmDelta,
              novel
            }
          })
          degree.set(id, (degree.get(id) ?? 0) + 1)
          degree.set(other, (degree.get(other) ?? 0) + 1)
        }
        if (!visited.has(other)) {
          if (visited.size >= maxNodes) {
            truncated = true
            continue
          }
          visited.add(other)
          next.push(other)
        }
      }
    }
    frontier = next
  }

  // Drop the seed if it ended up isolated (e.g. diff with everything already mixed).
  const connected = new Set<string>()
  for (const e of edges) {
    connected.add(e.source)
    connected.add(e.target)
  }
  if (connected.size === 0) return empty()

  const nodes: GraphNode[] = []
  for (const id of visited) {
    if (!connected.has(id)) continue
    const t = trackMap.get(id)!
    const node: GraphTrackNode = {
      kind: 'track',
      id,
      trackId: id,
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      key: t.key,
      genre: t.genre,
      energy: t.energy,
      rating: t.rating,
      color: t.color,
      playCount: t.playCount,
      lastPlayed: t.lastPlayed,
      degree: degree.get(id) ?? 0
    }
    nodes.push(node)
  }

  return {
    nodes,
    edges,
    meta: {
      mode,
      scope: 'neighborhood',
      truncated,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      seedId
    }
  }
}
