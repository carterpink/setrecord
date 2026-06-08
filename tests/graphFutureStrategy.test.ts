import { describe, it, expect } from 'vitest'
import { buildFutureGraph, pairKey } from '../electron/algorithms/graph/futureStrategy'
import { makeTrack } from './fixtures'
import type { Track } from '../src/types'

// Seed plus three candidates of decreasing compatibility, and one incompatible.
function tracks(): Track[] {
  return [
    makeTrack({ id: 'S', key: '8A', bpm: 128, genre: 'Tech House', energy: 7, playCount: 9 }),
    makeTrack({ id: 'P', key: '8A', bpm: 128, genre: 'Tech House', energy: 7 }), // perfect, score ~9
    makeTrack({ id: 'C', key: '9A', bpm: 130, genre: 'Tech House', energy: 7 }), // compatible, ~7.6
    makeTrack({ id: 'G', key: '8B', bpm: 126, genre: 'House', energy: 6 }), // some signals
    makeTrack({ id: 'X', key: '2A', bpm: 150, genre: 'Trance', energy: 2 }) // incompatible → no edge
  ]
}

describe('buildFutureGraph', () => {
  it('emits compatible edges and excludes incompatible tracks below threshold', () => {
    const g = buildFutureGraph({
      tracks: tracks(),
      mixedPairs: new Set(),
      mode: 'future',
      seedTrackId: 'S'
    })
    const ids = g.nodes.map((n) => (n.kind === 'track' ? n.trackId : n.id))
    expect(ids).toContain('S')
    expect(ids).toContain('P')
    expect(ids).not.toContain('X') // clashing key, far BPM, different genre → below minScore

    const sp = g.edges.find((e) => e.source === 'S' && e.target === 'P')
    expect(sp).toBeTruthy()
    expect(sp?.reason.kind).toBe('compatible')
    expect(sp?.directed).toBe(false)
    expect(sp?.reason.camelot).toBe('perfect')
    expect(sp?.id).toBe(`future:${pairKey('S', 'P')}`)
  })

  it('flags edges novel unless the pair has actually been mixed', () => {
    const g = buildFutureGraph({
      tracks: tracks(),
      mixedPairs: new Set([pairKey('S', 'P')]), // S↔P already mixed
      mode: 'future',
      seedTrackId: 'S'
    })
    const sp = g.edges.find((e) => e.source === 'S' && e.target === 'P')
    const sc = g.edges.find((e) => e.source === 'S' && e.target === 'C')
    expect(sp?.reason.novel).toBe(false)
    expect(sc?.reason.novel).toBe(true)
  })

  it('diff mode keeps only never-mixed pairs', () => {
    const g = buildFutureGraph({
      tracks: tracks(),
      mixedPairs: new Set([pairKey('S', 'P')]),
      mode: 'diff',
      seedTrackId: 'S'
    })
    expect(g.edges.length).toBeGreaterThan(0)
    expect(g.edges.every((e) => e.reason.novel === true)).toBe(true)
    // The one pair already mixed must not appear directly off the seed…
    expect(g.edges.some((e) => e.source === 'S' && e.target === 'P')).toBe(false)
    expect(g.meta.mode).toBe('diff')
  })

  it('drops the seed and returns empty when every compatible pair is already mixed', () => {
    // S has exactly one compatible neighbour (P); X is incompatible. Once S↔P is
    // in history, Diff has nothing novel to show → empty graph, not a lone dot.
    const tiny: Track[] = [
      makeTrack({ id: 'S', key: '8A', bpm: 128, genre: 'Tech House', energy: 7 }),
      makeTrack({ id: 'P', key: '8A', bpm: 128, genre: 'Tech House', energy: 7 }),
      makeTrack({ id: 'X', key: '2A', bpm: 150, genre: 'Trance', energy: 2 })
    ]
    const g = buildFutureGraph({
      tracks: tiny,
      mixedPairs: new Set([pairKey('S', 'P')]),
      mode: 'diff',
      seedTrackId: 'S'
    })
    expect(g.nodes).toHaveLength(0)
    expect(g.edges).toHaveLength(0)
  })

  it('respects top-K per node', () => {
    const g = buildFutureGraph({
      tracks: tracks(),
      mixedPairs: new Set(),
      mode: 'future',
      seedTrackId: 'S',
      topK: 1,
      bfsDepth: 1
    })
    // Depth-1, topK=1 → only the single best candidate (P, perfect) off the seed.
    const fromSeed = g.edges.filter((e) => e.source === 'S' || e.target === 'S')
    expect(fromSeed).toHaveLength(1)
    expect(fromSeed[0].target === 'P' || fromSeed[0].source === 'P').toBe(true)
  })

  it('works with zero play history (cold start) and auto-picks a seed', () => {
    const g = buildFutureGraph({ tracks: tracks(), mixedPairs: new Set(), mode: 'future' })
    expect(g.meta.seedId).toBe('S') // highest playCount
    expect(g.edges.every((e) => e.reason.novel === true)).toBe(true) // nothing mixed yet
  })
})
