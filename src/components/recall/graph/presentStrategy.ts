/**
 * presentStrategy.ts — PRESENT-lens edge generator. Runs in the RENDERER (its
 * data is live Zustand state in setStore/liveStore), so it never round-trips to
 * the main process — it must feel instant on every keystroke.
 *
 * Present = your live working context drawn as a glowing path: the set you're
 * building in Build mode (or a Set Recording in progress), node N → node N+1 in
 * play order. The track playing right now (when live) is flagged `current`.
 */

import type { GraphData, GraphEdge, GraphNode, GraphTrackNode, Track } from '@/types'

export interface PresentInput {
  /** The working set's tracks, already in play order. */
  tracks: Track[]
  /** Id of the track playing right now, when a live session is running. */
  liveCurrentId?: string | null
}

export function buildPresentGraph({ tracks, liveCurrentId }: PresentInput): GraphData {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  tracks.forEach((t, i) => {
    if (!t || seen.has(t.id)) return
    seen.add(t.id)
    const node: GraphTrackNode = {
      kind: 'track',
      id: t.id,
      trackId: t.id,
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
      // Degree along the path: 1 for the ends, 2 for the middle.
      degree: i === 0 || i === tracks.length - 1 ? 1 : 2
    }
    nodes.push(node)
  })

  for (let i = 0; i < tracks.length - 1; i++) {
    const a = tracks[i]
    const b = tracks[i + 1]
    if (!a || !b || a.id === b.id) continue
    edges.push({
      id: `present:${a.id}->${b.id}:${i}`,
      source: a.id,
      target: b.id,
      mode: 'present',
      weight: 2,
      directed: true,
      reason: { kind: 'live-path', label: `#${i + 1} → #${i + 2}` }
    })
  }

  return {
    nodes,
    edges,
    meta: {
      mode: 'present',
      scope: 'context',
      truncated: false,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      seedId: liveCurrentId ?? tracks[0]?.id
    }
  }
}
