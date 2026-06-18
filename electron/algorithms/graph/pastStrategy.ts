/**
 * pastStrategy.ts — PAST-mode edge generator for the Constellation graph.
 *
 * Pure engine: given ordered play sequences and gig metadata, grow a readable
 * neighborhood around a seed track and emit the transitions the DJ has actually
 * mixed (solid "mixed N×" edges), with the gigs those tracks were played at as
 * first-class hub nodes (gig↔track membership edges) so tracks naturally cluster
 * around the gigs they live in.
 *
 * No DB or electron imports — graphService loads the data and calls this.
 */

import { buildTransitionGraph } from '../memory/transitionGraph'
import { getKeyCompatibility } from '../../utils/camelot'
import type {
  Track,
  PlaySession,
  GraphData,
  GraphEdge,
  GraphNode,
  GraphTrackNode,
  GraphGigNode,
  CamelotRelationship
} from '../../../src/types'

export interface PastGraphInput {
  /** Ordered track-id sequences from performed sessions AND saved sets (transition edges). */
  sequences: string[][]
  /** Performed gigs (become hub nodes). */
  sessions: PlaySession[]
  /** sessionId → ordered track ids played in it. */
  sessionTrackIds: Map<string, string[]>
  /** Full track objects for node hydration. */
  trackMap: Map<string, Track>
  seedTrackId?: string
  /** Hops out from the seed (default 2). */
  bfsDepth?: number
  /** Hard cap on track nodes to keep the view legible (default 150). */
  maxNodes?: number
  /** Hard cap on gig hub nodes (default 30). */
  maxGigs?: number
  /** Minimum times a transition must have happened to draw it (default 1). */
  minPastCount?: number
}

const DEFAULT_DEPTH = 2
const DEFAULT_MAX_NODES = 150
const DEFAULT_MAX_GIGS = 30

/** Union the directed adjacency into an undirected neighbour map for BFS. */
function undirectedNeighbours(
  adjacency: Map<string, Map<string, number>>
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    let s = adj.get(a)
    if (!s) {
      s = new Set()
      adj.set(a, s)
    }
    s.add(b)
  }
  for (const [from, nexts] of adjacency) {
    for (const [to] of nexts) {
      link(from, to)
      link(to, from)
    }
  }
  return adj
}

/** Highest-degree node — the natural centre of the DJ's mixing universe when no seed is given. */
function pickSeed(
  neighbours: Map<string, Set<string>>,
  trackMap: Map<string, Track>
): string | undefined {
  let best: string | undefined
  let bestDeg = -1
  for (const [id, set] of neighbours) {
    if (!trackMap.has(id)) continue
    if (set.size > bestDeg) {
      bestDeg = set.size
      best = id
    }
  }
  return best
}

export function buildPastGraph(input: PastGraphInput): GraphData {
  const {
    sequences,
    sessions,
    sessionTrackIds,
    trackMap,
    bfsDepth = DEFAULT_DEPTH,
    maxNodes = DEFAULT_MAX_NODES,
    maxGigs = DEFAULT_MAX_GIGS,
    minPastCount = 1
  } = input

  const graph = buildTransitionGraph(sequences)
  const neighbours = undirectedNeighbours(graph.adjacency)

  const seed =
    input.seedTrackId && trackMap.has(input.seedTrackId)
      ? input.seedTrackId
      : pickSeed(neighbours, trackMap)

  // Empty / no-history library → nothing to draw.
  if (!seed) {
    return {
      nodes: [],
      edges: [],
      meta: { mode: 'past', scope: 'neighborhood', truncated: false, nodeCount: 0, edgeCount: 0 }
    }
  }

  // ── BFS out from the seed over the undirected co-occurrence graph ──────────
  const visited = new Set<string>([seed])
  let frontier = [seed]
  let truncated = false
  for (let depth = 0; depth < bfsDepth && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const nb of neighbours.get(id) ?? []) {
        if (visited.has(nb)) continue
        if (!trackMap.has(nb)) continue
        if (visited.size >= maxNodes) {
          truncated = true
          break
        }
        visited.add(nb)
        next.push(nb)
      }
      if (visited.size >= maxNodes) break
    }
    frontier = next
  }

  // ── Directed "mixed N×" edges between visited tracks ──────────────────────
  const edges: GraphEdge[] = []
  const degree = new Map<string, number>()
  const bump = (id: string): void => {
    degree.set(id, (degree.get(id) ?? 0) + 1)
  }

  for (const from of visited) {
    const nexts = graph.adjacency.get(from)
    if (!nexts) continue
    for (const [to, count] of nexts) {
      if (!visited.has(to) || count < minPastCount) continue
      const a = trackMap.get(from)!
      const b = trackMap.get(to)!
      const compat = getKeyCompatibility(a.key, b.key)
      edges.push({
        id: `past:${from}->${to}`,
        source: from,
        target: to,
        mode: 'past',
        weight: count,
        directed: true,
        reason: {
          kind: 'mixed',
          label: count > 1 ? `mixed ${count}×` : 'mixed once',
          camelot: compat.relationship as CamelotRelationship,
          bpmDelta: Math.round((b.bpm ?? 0) - (a.bpm ?? 0)),
          count
        }
      })
      bump(from)
      bump(to)
    }
  }

  // ── Gig hub nodes + membership edges (tracks cluster around their gigs) ────
  // Rank gigs by how many visited tracks they contain; keep the richest ones.
  const gigHits: { session: PlaySession; members: string[] }[] = []
  for (const session of sessions) {
    const ids = sessionTrackIds.get(session.id)
    if (!ids) continue
    const members = ids.filter((id) => visited.has(id))
    if (members.length >= 2) gigHits.push({ session, members })
  }
  gigHits.sort((a, b) => b.members.length - a.members.length)
  if (gigHits.length > maxGigs) truncated = true
  const gigNodes: GraphGigNode[] = []
  for (const { session, members } of gigHits.slice(0, maxGigs)) {
    const gigId = `gig:${session.id}`
    gigNodes.push({
      kind: 'gig',
      id: gigId,
      sessionId: session.id,
      name: session.name,
      venue: session.venue,
      performedAt: session.performedAt,
      eventType: session.eventType,
      trackCount: session.trackCount,
      degree: members.length
    })
    for (const trackId of members) {
      edges.push({
        id: `past:${gigId}~${trackId}`,
        source: gigId,
        target: trackId,
        mode: 'past',
        weight: 1,
        directed: false,
        reason: { kind: 'gig-membership', label: `played at ${session.venue ?? session.name}` }
      })
      bump(trackId)
    }
  }

  // ── Hydrate track nodes ───────────────────────────────────────────────────
  const trackNodes: GraphTrackNode[] = []
  for (const id of visited) {
    const t = trackMap.get(id)!
    trackNodes.push({
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
    })
  }

  const nodes: GraphNode[] = [...trackNodes, ...gigNodes]
  return {
    nodes,
    edges,
    meta: {
      mode: 'past',
      scope: 'neighborhood',
      truncated,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      seedId: seed
    }
  }
}
