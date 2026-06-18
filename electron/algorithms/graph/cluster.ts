/**
 * cluster.ts — LIBRARY-scope overview. Collapses the whole library into genre
 * super-nodes (the "galaxy" view) so 10k tracks stay legible, with inter-genre
 * threads computed per lens:
 *   past     → how often you've actually mixed from one genre into another
 *   future   → which genres are harmonically/rhythmically compatible (centroids)
 *   diff     → compatible genre pairs you've never bridged
 *
 * Clicking a super-node drills back into a neighborhood seeded on that genre's
 * representative track (handled in the renderer via memberIds[0]).
 *
 * Pure engine — graphService loads the data and calls this.
 */

import { getKeyCompatibility } from '../../utils/camelot'
import type {
  Track,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphClusterNode,
  GraphMode,
  CamelotRelationship
} from '../../../src/types'

export interface ClusterInput {
  tracks: Track[]
  mode: Extract<GraphMode, 'past' | 'future' | 'diff'>
  /** Track-level transition counts (from the full play history). */
  adjacency: Map<string, Map<string, number>>
  /** Keep at most this many genres (largest by track count). */
  maxClusters?: number
}

const DEFAULT_MAX_CLUSTERS = 40
const BPM_BAND = 8

const genreOf = (t: Track): string => (t.genre && t.genre.trim() ? t.genre.trim() : 'Unknown')

interface Centroid {
  genre: string
  count: number
  bpm: number
  key: string
  memberIds: string[]
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function dominant(values: string[]): string {
  const tally = new Map<string, number>()
  let best = ''
  let bestN = 0
  for (const v of values) {
    const n = (tally.get(v) ?? 0) + 1
    tally.set(v, n)
    if (n > bestN) {
      bestN = n
      best = v
    }
  }
  return best
}

/** Compatibility of two genre centroids (same kernel as futureStrategy, scaled). */
function centroidScore(a: Centroid, b: Centroid): { score: number; rel: CamelotRelationship } {
  const rel = getKeyCompatibility(a.key, b.key).relationship as CamelotRelationship
  let score = 0
  if (rel === 'perfect') score += 3
  else if (rel === 'compatible') score += 2
  const bpmDelta = Math.abs(a.bpm - b.bpm)
  if (bpmDelta <= BPM_BAND) score += 3 - (bpmDelta / BPM_BAND) * 1.5
  return { score, rel }
}

export function buildClusterGraph(input: ClusterInput): GraphData {
  const { tracks, mode, adjacency, maxClusters = DEFAULT_MAX_CLUSTERS } = input
  const playable = tracks.filter((t) => t.phantom !== true)

  // ── Group into genre centroids ────────────────────────────────────────────
  const byGenre = new Map<string, Track[]>()
  for (const t of playable) {
    const g = genreOf(t)
    const arr = byGenre.get(g)
    if (arr) arr.push(t)
    else byGenre.set(g, [t])
  }

  const centroids: Centroid[] = [...byGenre.entries()]
    .map(([genre, ts]) => ({
      genre,
      count: ts.length,
      bpm: median(ts.map((t) => t.bpm ?? 0)),
      key: dominant(ts.map((t) => t.key).filter(Boolean)) || '1A',
      // Representative-first: members sorted by play count so memberIds[0] anchors a drill-in.
      memberIds: [...ts].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0)).map((t) => t.id)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxClusters)

  const genreOfTrack = new Map<string, string>()
  const kept = new Set(centroids.map((c) => c.genre))
  for (const t of playable) {
    const g = genreOf(t)
    if (kept.has(g)) genreOfTrack.set(t.id, g)
  }

  // ── Inter-genre transition counts from real history (for past + novelty) ──
  const pastPair = new Map<string, number>() // `gA|gB` (sorted) → count
  const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (const [from, nexts] of adjacency) {
    const gA = genreOfTrack.get(from)
    if (!gA) continue
    for (const [to, count] of nexts) {
      const gB = genreOfTrack.get(to)
      if (!gB || gA === gB) continue
      const k = pairKey(gA, gB)
      pastPair.set(k, (pastPair.get(k) ?? 0) + count)
    }
  }

  const edges: GraphEdge[] = []
  const degree = new Map<string, number>()
  const bump = (g: string): void => {
    degree.set(g, (degree.get(g) ?? 0) + 1)
  }
  const nodeId = (g: string): string => `cluster:${g}`

  if (mode === 'past') {
    for (const [k, count] of pastPair) {
      const [gA, gB] = k.split('|')
      edges.push({
        id: `past:${nodeId(gA)}~${nodeId(gB)}`,
        source: nodeId(gA),
        target: nodeId(gB),
        mode: 'past',
        weight: count,
        directed: false,
        reason: { kind: 'mixed', label: count > 1 ? `mixed ${count}×` : 'mixed once', count }
      })
      bump(gA)
      bump(gB)
    }
  } else {
    // future / diff: compatible genre centroids, flagged novel when never bridged.
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        const a = centroids[i]
        const b = centroids[j]
        const { score, rel } = centroidScore(a, b)
        if (score < 4) continue
        const novel = !pastPair.has(pairKey(a.genre, b.genre))
        if (mode === 'diff' && !novel) continue
        edges.push({
          id: `${mode}:${nodeId(a.genre)}~${nodeId(b.genre)}`,
          source: nodeId(a.genre),
          target: nodeId(b.genre),
          mode,
          weight: score,
          directed: false,
          reason: {
            kind: 'compatible',
            label: rel === 'perfect' ? 'perfect harmony' : 'compatible',
            camelot: rel,
            novel
          }
        })
        bump(a.genre)
        bump(b.genre)
      }
    }
  }

  // Keep clusters that participate in an edge (plus always the biggest few).
  const connected = new Set<string>()
  for (const e of edges) {
    connected.add(e.source)
    connected.add(e.target)
  }

  const nodes: GraphNode[] = []
  for (const c of centroids) {
    const id = nodeId(c.genre)
    if (!connected.has(id) && degree.size > 0) continue
    const node: GraphClusterNode = {
      kind: 'cluster',
      id,
      label: c.genre,
      memberIds: c.memberIds,
      size: c.count,
      degree: degree.get(c.genre) ?? 0
    }
    nodes.push(node)
  }

  return {
    nodes,
    edges,
    meta: {
      mode,
      scope: 'library',
      truncated: byGenre.size > centroids.length,
      nodeCount: nodes.length,
      edgeCount: edges.length
    }
  }
}
