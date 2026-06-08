/**
 * graph.ts — "Constellation" graph-view domain types.
 *
 * A single node set (Tracks + Gigs) viewed through a Past / Present / Future
 * temporal lens. Only the *edge-generation function* swaps between modes; the
 * nodes — and, in the renderer, their force-layout positions — stay stable so
 * toggling a mode animates the threads morphing rather than reshuffling.
 *
 * Past / Future / Diff edges are generated in the MAIN process (DB + algorithms
 * live there) and shipped over IPC as a GraphData. Present edges are generated
 * in the renderer from live Zustand state (setStore / liveStore).
 */

export type GraphMode = 'past' | 'present' | 'future' | 'diff'
export type GraphScope = 'neighborhood' | 'library' | 'context'

/** A library track rendered as a node. */
export interface GraphTrackNode {
  kind: 'track'
  /** Node id === trackId (ids are unique across kinds: tracks are UUIDs, gigs are `gig:<id>`). */
  id: string
  trackId: string
  title: string
  artist: string
  bpm: number
  key: string
  genre?: string
  energy: number
  rating: number
  color?: string
  playCount: number
  lastPlayed?: string
  /** Edge count touching this node in the current GraphData (filled by the strategy). */
  degree: number
}

/** A performed gig (play_session) rendered as a hub node. */
export interface GraphGigNode {
  kind: 'gig'
  /** `gig:<sessionId>` so it never collides with a track UUID. */
  id: string
  sessionId: string
  name: string
  venue?: string
  performedAt?: string
  eventType?: string
  trackCount: number
  degree: number
}

/** A collapsed super-node (genre × key family / community) — Phase 5. */
export interface GraphClusterNode {
  kind: 'cluster'
  id: string
  label: string
  memberIds: string[]
  size: number
  degree: number
}

export type GraphNode = GraphTrackNode | GraphGigNode | GraphClusterNode

export type EdgeReasonKind = 'mixed' | 'compatible' | 'live-path' | 'gig-membership'
export type CamelotRelationship = 'perfect' | 'compatible' | 'neutral' | 'clash'

/** Provenance for an edge — drives its label, colour and the diff view. */
export interface EdgeReason {
  kind: EdgeReasonKind
  /** Human one-liner: "mixed 4×" · "perfect harmony · +0 BPM" · "in this set". */
  label: string
  camelot?: CamelotRelationship
  bpmDelta?: number
  count?: number
  /** Future-without-Past: compatible but you've never actually mixed it (the discovery flag). */
  novel?: boolean
}

export interface GraphEdge {
  /** Stable across rebuilds: `${mode}:${source}->${target}`. */
  id: string
  source: string
  target: string
  mode: GraphMode
  /** past = play count · future = compat score · present = path order · gig-membership = 1. */
  weight: number
  /** past/present edges carry direction; future edges are symmetric. */
  directed: boolean
  reason: EdgeReason
}

export interface GraphMeta {
  mode: GraphMode
  scope: GraphScope
  /** True when the result was capped (node/gig limits hit). */
  truncated: boolean
  nodeCount: number
  edgeCount: number
  /** The track the neighborhood was grown from (may be auto-picked when none supplied). */
  seedId?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: GraphMeta
}

/** Reference to an open working context for scope='context'. */
export interface GraphContextRef {
  kind: 'set' | 'gig' | 'playlist' | 'crate'
  id: string
}

/**
 * Request shape for the `graph:build` IPC method. 'present' is never sent over
 * IPC — it's computed in the renderer from live store state.
 */
export interface GraphRequest {
  mode: 'past' | 'future' | 'diff'
  scope: GraphScope
  seedTrackId?: string
  contextRef?: GraphContextRef
  /** scope='context': restrict the graph to exactly these tracks (e.g. the open set). */
  contextTrackIds?: string[]
  timeWindow?: { after?: string; before?: string }
  /** Future: keep top-K compatible edges per node (default 6). */
  topK?: number
  /** Neighborhood BFS depth from the seed (default 2). */
  bfsDepth?: number
  thresholds?: { minPastCount?: number; minFutureScore?: number }
}
