/**
 * transitionGraph.ts — Pure engine: build and query a directed adjacency
 * graph of track→track transitions observed across performed sessions and
 * saved sets.
 *
 * TransitionGraph: adjacency map  trackId → { nextTrackId → count }
 *
 * Headline feature: "you've mixed X → Y 4 times" combo detection.
 */

import type { TransitionGraph, RankedTrack } from '../../../src/types'

export type { TransitionGraph, RankedTrack }

/**
 * Build a transition graph from an array of ordered track-id sequences.
 * Each sequence is the ordered track ids of one session or set.
 */
export function buildTransitionGraph(sequences: string[][]): TransitionGraph {
  const adj = new Map<string, Map<string, number>>()

  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 1; i++) {
      const from = seq[i]
      const to = seq[i + 1]
      if (!adj.has(from)) adj.set(from, new Map())
      const nexts = adj.get(from)!
      nexts.set(to, (nexts.get(to) ?? 0) + 1)
    }
  }

  return { adjacency: adj }
}

/**
 * Return all tracks that have been played after `trackId`, sorted by count
 * descending.
 */
export function tracksAfter(
  graph: TransitionGraph,
  trackId: string
): { trackId: string; count: number }[] {
  const nexts = graph.adjacency.get(trackId)
  if (!nexts) return []
  return Array.from(nexts.entries())
    .map(([id, count]) => ({ trackId: id, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Find recurring N-track chains where every consecutive pair has count ≥
 * `minCount`. Returns unique chains (deduped by stringified ids), sorted by
 * minimum edge weight descending.
 */
export function bestSequences(
  graph: TransitionGraph,
  minCount: number,
  length: number
): string[][] {
  if (length < 2) return []

  const results: string[][] = []
  const seen = new Set<string>()

  // DFS from every node
  function dfs(chain: string[]): void {
    if (chain.length === length) {
      const key = chain.join('→')
      if (!seen.has(key)) {
        seen.add(key)
        results.push([...chain])
      }
      return
    }
    const last = chain[chain.length - 1]
    const nexts = graph.adjacency.get(last)
    if (!nexts) return
    for (const [nextId, count] of nexts.entries()) {
      if (count >= minCount) dfs([...chain, nextId])
    }
  }

  for (const startId of graph.adjacency.keys()) {
    dfs([startId])
  }

  // Sort by minimum edge weight across the chain
  results.sort((a, b) => minEdge(graph, b) - minEdge(graph, a))
  return results
}

function minEdge(graph: TransitionGraph, chain: string[]): number {
  let min = Infinity
  for (let i = 0; i < chain.length - 1; i++) {
    const count = graph.adjacency.get(chain[i])?.get(chain[i + 1]) ?? 0
    if (count < min) min = count
  }
  return min === Infinity ? 0 : min
}

/**
 * Tracks the DJ frequently ends a set on — "dead-ends" in the transition
 * graph. A track is terminal if it appears as the final element of a sequence
 * and never (or rarely) leads anywhere else in any sequence.
 *
 * Counts how many sequences end on each track id. Returns ranked descending,
 * filtered to those with at least `minOccurrences` (default 2 — a one-off set
 * ending on a track isn't a pattern).
 */
export function terminalTracks(
  sequences: string[][],
  minOccurrences = 2
): RankedTrack[] {
  const counts = new Map<string, number>()
  for (const seq of sequences) {
    if (seq.length === 0) continue
    const last = seq[seq.length - 1]
    counts.set(last, (counts.get(last) ?? 0) + 1)
  }
  const result: RankedTrack[] = []
  for (const [trackId, count] of counts.entries()) {
    if (count >= minOccurrences) result.push({ trackId, count })
  }
  return result.sort((a, b) => b.count - a.count)
}

/**
 * Bridge tracks: nodes that appear as *both* a destination from one cluster
 * AND a source to another cluster.
 *
 * Heuristic: a "bridge" is a track that has in-degree ≥ 2 (reached from
 * multiple different predecessors) AND out-degree ≥ 2 (leads to multiple
 * different successors). We rank by in_degree × out_degree.
 */
export function bridges(graph: TransitionGraph): RankedTrack[] {
  // Compute in-degree
  const inDegree = new Map<string, number>()
  for (const nexts of graph.adjacency.values()) {
    for (const [toId] of nexts.entries()) {
      inDegree.set(toId, (inDegree.get(toId) ?? 0) + 1)
    }
  }

  const result: RankedTrack[] = []
  for (const [trackId, nexts] of graph.adjacency.entries()) {
    const outDeg = nexts.size
    const inDeg = inDegree.get(trackId) ?? 0
    if (inDeg >= 2 && outDeg >= 2) {
      result.push({ trackId, count: inDeg * outDeg })
    }
  }
  return result.sort((a, b) => b.count - a.count)
}
