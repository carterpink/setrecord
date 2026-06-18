/**
 * graphService.ts — orchestration for the Constellation graph view.
 *
 * Loads play history + library from the DB once per call (no long-lived cache,
 * mirroring memoryService), then dispatches to the per-mode edge strategy and
 * returns a serialisable GraphData ready for IPC.
 *
 * Present mode is generated in the renderer (live store state) and never reaches
 * here. Future / Diff land in Phase 2.
 */

import { getDb } from '../db/schema'
import { getAllTracks, getAllSets, getSessions, getSessionTracks } from '../db/queries'
import { buildTransitionGraph } from '../algorithms/memory/transitionGraph'
import { buildPastGraph } from '../algorithms/graph/pastStrategy'
import { buildFutureGraph, pairKey } from '../algorithms/graph/futureStrategy'
import { buildClusterGraph } from '../algorithms/graph/cluster'
import type { GraphData, GraphRequest, PlaySession, Track } from '../../src/types'

interface LoadedHistory {
  trackMap: Map<string, Track>
  sessions: PlaySession[]
  /** sessionId → ordered track ids played in it (≥2 tracks). */
  sessionTrackIds: Map<string, string[]>
  /** Ordered id sequences from saved (planned) sets — undated, so window-exempt. */
  setSequences: string[][]
}

/** Load tracks + per-gig tracklists + saved-set sequences in a single pass. */
function loadHistory(): LoadedHistory {
  const db = getDb()
  const tracks = getAllTracks(db)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))
  const sessions = getSessions(db)
  const sessionTrackIds = new Map<string, string[]>()

  for (const session of sessions) {
    if (session.trackCount < 2) continue
    const ordered = getSessionTracks(db, session.id)
      .sort((a, b) => a.playOrder - b.playOrder)
      .map((st) => st.trackId)
    if (ordered.length >= 2) sessionTrackIds.set(session.id, ordered)
  }

  const setSequences: string[][] = []
  for (const set of getAllSets(db)) {
    if (set.tracks.length < 2) continue
    const ids = set.tracks
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((st) => st.trackId)
    if (ids.length >= 2) setSequences.push(ids)
  }

  return { trackMap, sessions, sessionTrackIds, setSequences }
}

type TimeWindow = GraphRequest['timeWindow']

/** Is a session's performed date inside the (optional) scrubber window? */
function withinWindow(performedAt: string | undefined, win: TimeWindow): boolean {
  if (!win) return true
  if (win.after && (!performedAt || performedAt < win.after)) return false
  if (win.before && (!performedAt || performedAt > win.before)) return false
  return true
}

/** Ordered sequences from the (optionally window-filtered) performed sessions. */
function sessionSequences(h: LoadedHistory, win?: TimeWindow): string[][] {
  const out: string[][] = []
  for (const session of h.sessions) {
    if (win && !withinWindow(session.performedAt, win)) continue
    const ids = h.sessionTrackIds.get(session.id)
    if (ids && ids.length >= 2) out.push(ids)
  }
  return out
}

function emptyGraph(req: GraphRequest): GraphData {
  return {
    nodes: [],
    edges: [],
    meta: { mode: req.mode, scope: req.scope, truncated: false, nodeCount: 0, edgeCount: 0 }
  }
}

/** Every track pair the DJ has actually mixed, as undirected `a|b` keys. */
function mixedPairsFrom(sequences: string[][]): Set<string> {
  const graph = buildTransitionGraph(sequences)
  const pairs = new Set<string>()
  for (const [from, nexts] of graph.adjacency) {
    for (const [to] of nexts) pairs.add(pairKey(from, to))
  }
  return pairs
}

export async function buildGraph(req: GraphRequest): Promise<GraphData> {
  if (req.mode !== 'past' && req.mode !== 'future' && req.mode !== 'diff') {
    return emptyGraph(req)
  }
  const h = loadHistory()
  const allSequences = [...sessionSequences(h), ...h.setSequences]

  // ── Library scope: collapse the whole library into a genre galaxy ─────────
  if (req.scope === 'library') {
    return buildClusterGraph({
      tracks: [...h.trackMap.values()],
      mode: req.mode,
      adjacency: buildTransitionGraph(allSequences).adjacency
    })
  }

  // ── Context scope: restrict the universe to a container's tracks ──────────
  // (e.g. the open Build set) so edges only appear among those tracks.
  const universe =
    req.scope === 'context' && req.contextTrackIds?.length
      ? new Map(
          req.contextTrackIds
            .map((id) => h.trackMap.get(id))
            .filter(Boolean)
            .map((t) => [t!.id, t!])
        )
      : h.trackMap
  const seedTrackId =
    req.scope === 'context' ? (req.seedTrackId ?? req.contextTrackIds?.[0]) : req.seedTrackId

  if (req.mode === 'past') {
    const win = req.timeWindow
    // Within a scrubber window, only dated performed sessions count — planned
    // sets (undated) are excluded so the window reflects real plays over time.
    const sequences = win ? sessionSequences(h, win) : allSequences
    const sessions = win ? h.sessions.filter((s) => withinWindow(s.performedAt, win)) : h.sessions
    return buildPastGraph({
      sequences,
      sessions,
      sessionTrackIds: h.sessionTrackIds,
      trackMap: universe,
      seedTrackId,
      bfsDepth: req.bfsDepth,
      minPastCount: req.thresholds?.minPastCount
    })
  }

  // future / diff. "Novel" is judged against EVERYTHING ever mixed.
  return buildFutureGraph({
    tracks: [...universe.values()],
    mixedPairs: mixedPairsFrom(allSequences),
    mode: req.mode,
    seedTrackId,
    topK: req.topK,
    bfsDepth: req.bfsDepth,
    minScore: req.thresholds?.minFutureScore
  })
}
