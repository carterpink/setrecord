import { describe, it, expect } from 'vitest'
import { buildPastGraph } from '../electron/algorithms/graph/pastStrategy'
import type { PastGraphInput } from '../electron/algorithms/graph/pastStrategy'
import { makeTrack } from './fixtures'
import type { PlaySession, Track, GraphTrackNode, GraphGigNode } from '../src/types'

function session(id: string, overrides: Partial<PlaySession> = {}): PlaySession {
  return {
    id,
    name: `Gig ${id}`,
    source: 'setrecord',
    venue: `Venue ${id}`,
    createdAt: '2025-01-01T00:00:00Z',
    trackCount: 0,
    ...overrides
  }
}

/** A→B→C played twice, plus A→D once, across two gigs. */
function fixture(): PastGraphInput {
  const tracks: Track[] = ['A', 'B', 'C', 'D', 'Z'].map((id) =>
    makeTrack({ id, title: `Track ${id}`, key: '8A', bpm: 124 })
  )
  const trackMap = new Map(tracks.map((t) => [t.id, t]))

  const sessionTrackIds = new Map<string, string[]>([
    ['g1', ['A', 'B', 'C']],
    ['g2', ['A', 'B', 'C']],
    ['g3', ['A', 'D']]
  ])
  const sessions: PlaySession[] = [
    session('g1', { trackCount: 3 }),
    session('g2', { trackCount: 3 }),
    session('g3', { trackCount: 2 })
  ]
  const sequences = [...sessionTrackIds.values()]

  return { sequences, sessions, sessionTrackIds, trackMap, seedTrackId: 'A' }
}

const trackNodes = (g: ReturnType<typeof buildPastGraph>): GraphTrackNode[] =>
  g.nodes.filter((n): n is GraphTrackNode => n.kind === 'track')
const gigNodes = (g: ReturnType<typeof buildPastGraph>): GraphGigNode[] =>
  g.nodes.filter((n): n is GraphGigNode => n.kind === 'gig')

describe('buildPastGraph', () => {
  it('emits mixed edges with real play counts and skips the unconnected track', () => {
    const g = buildPastGraph(fixture())

    // Z was never mixed with anything reachable from A, so it must not appear.
    const ids = trackNodes(g).map((n) => n.trackId)
    expect(ids).toContain('A')
    expect(ids).toContain('B')
    expect(ids).not.toContain('Z')

    const ab = g.edges.find((e) => e.id === 'past:A->B')
    expect(ab?.reason.kind).toBe('mixed')
    expect(ab?.weight).toBe(2) // A→B happened in g1 and g2
    expect(ab?.directed).toBe(true)

    const ad = g.edges.find((e) => e.id === 'past:A->D')
    expect(ad?.weight).toBe(1)
    expect(ad?.reason.label).toBe('mixed once')
  })

  it('adds gig hub nodes with membership edges so tracks cluster around gigs', () => {
    const g = buildPastGraph(fixture())
    const gigs = gigNodes(g)
    // g1 and g2 each contain ≥2 visited tracks; g3 (A,D) qualifies too.
    expect(gigs.map((n) => n.sessionId).sort()).toEqual(['g1', 'g2', 'g3'])

    const membership = g.edges.filter((e) => e.reason.kind === 'gig-membership')
    expect(membership.length).toBeGreaterThan(0)
    expect(membership.every((e) => e.source.startsWith('gig:'))).toBe(true)
    expect(g.meta.mode).toBe('past')
  })

  it('auto-picks the highest-degree seed when none is supplied', () => {
    const input = fixture()
    delete input.seedTrackId
    const g = buildPastGraph(input)
    // A is the hub (connects to B and D), so it should be chosen + present.
    expect(g.meta.seedId).toBe('A')
    expect(trackNodes(g).some((n) => n.trackId === 'A')).toBe(true)
  })

  it('returns an empty graph for a library with no play history', () => {
    const g = buildPastGraph({
      sequences: [],
      sessions: [],
      sessionTrackIds: new Map(),
      trackMap: new Map()
    })
    expect(g.nodes).toHaveLength(0)
    expect(g.edges).toHaveLength(0)
    expect(g.meta.nodeCount).toBe(0)
  })

  it('respects the bfsDepth bound', () => {
    // Depth 1 from A reaches only its direct neighbours (B, D) — not C.
    const g = buildPastGraph({ ...fixture(), bfsDepth: 1 })
    const ids = trackNodes(g).map((n) => n.trackId)
    expect(ids).toContain('B')
    expect(ids).toContain('D')
    expect(ids).not.toContain('C')
  })
})
