import { describe, it, expect } from 'vitest'
import { buildClusterGraph } from '../electron/algorithms/graph/cluster'
import { makeTrack } from './fixtures'
import type { Track } from '../src/types'

// Two genres that are harmonically compatible (8A vs 8A), one off on its own.
function library(): Track[] {
  return [
    makeTrack({ id: 'th1', genre: 'Tech House', key: '8A', bpm: 126, playCount: 5 }),
    makeTrack({ id: 'th2', genre: 'Tech House', key: '8A', bpm: 127 }),
    makeTrack({ id: 'ho1', genre: 'House', key: '8A', bpm: 124, playCount: 9 }),
    makeTrack({ id: 'ho2', genre: 'House', key: '9A', bpm: 123 }),
    makeTrack({ id: 'tr1', genre: 'Trance', key: '2A', bpm: 138 })
  ]
}

// Tech House → House mixed once (th1 → ho1).
const adjacency = new Map<string, Map<string, number>>([['th1', new Map([['ho1', 1]])]])

describe('buildClusterGraph', () => {
  it('past: aggregates inter-genre transitions into super-node edges', () => {
    const g = buildClusterGraph({ tracks: library(), mode: 'past', adjacency })
    expect(g.nodes.every((n) => n.kind === 'cluster')).toBe(true)
    const edge = g.edges.find(
      (e) =>
        (e.source === 'cluster:Tech House' && e.target === 'cluster:House') ||
        (e.source === 'cluster:House' && e.target === 'cluster:Tech House')
    )
    expect(edge?.reason.kind).toBe('mixed')
    expect(edge?.weight).toBe(1)
    // cluster carries its members, representative (highest playCount) first.
    const house = g.nodes.find((n) => n.id === 'cluster:House')
    expect(house?.kind === 'cluster' && house.memberIds[0]).toBe('ho1')
  })

  it('future: connects compatible genres and flags never-bridged ones novel', () => {
    const g = buildClusterGraph({ tracks: library(), mode: 'future', adjacency })
    const th = g.edges.find((e) => /Tech House/.test(e.source + e.target) && /House/.test(e.source + e.target))
    expect(th?.reason.kind).toBe('compatible')
    // Tech House↔House were mixed (adjacency) → not novel.
    expect(th?.reason.novel).toBe(false)
  })

  it('diff: keeps only genre pairs never bridged in history', () => {
    const g = buildClusterGraph({ tracks: library(), mode: 'diff', adjacency })
    expect(g.edges.every((e) => e.reason.novel === true)).toBe(true)
    // The mixed Tech House↔House pair must be excluded.
    const bridged = g.edges.find(
      (e) => /Tech House/.test(e.source + e.target) && /(^|:)House/.test(e.source + e.target)
    )
    expect(bridged).toBeUndefined()
  })
})
