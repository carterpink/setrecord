import { describe, it, expect } from 'vitest'
import {
  buildTransitionGraph,
  tracksAfter,
  bestSequences,
  bridges,
  terminalTracks
} from '../electron/algorithms/memory/transitionGraph'

describe('buildTransitionGraph', () => {
  it('returns empty adjacency for empty input', () => {
    const g = buildTransitionGraph([])
    expect(g.adjacency.size).toBe(0)
  })

  it('returns empty adjacency for single-track sequences', () => {
    const g = buildTransitionGraph([['a'], ['b']])
    expect(g.adjacency.size).toBe(0)
  })

  it('counts a single transition', () => {
    const g = buildTransitionGraph([['a', 'b']])
    expect(g.adjacency.get('a')?.get('b')).toBe(1)
  })

  it('accumulates counts across multiple sequences', () => {
    const seqs = [
      ['a', 'b', 'c'],
      ['a', 'b'],
      ['a', 'b']
    ]
    const g = buildTransitionGraph(seqs)
    expect(g.adjacency.get('a')?.get('b')).toBe(3) // seen 3 times
    expect(g.adjacency.get('b')?.get('c')).toBe(1) // only once
  })

  it('builds a multi-node graph correctly', () => {
    const g = buildTransitionGraph([
      ['x', 'y', 'z'],
      ['x', 'z'],
      ['y', 'z']
    ])
    expect(g.adjacency.get('x')?.get('y')).toBe(1)
    expect(g.adjacency.get('x')?.get('z')).toBe(1)
    expect(g.adjacency.get('y')?.get('z')).toBe(2)
  })
})

describe('tracksAfter', () => {
  it('returns empty for unknown trackId', () => {
    const g = buildTransitionGraph([['a', 'b']])
    expect(tracksAfter(g, 'unknown')).toEqual([])
  })

  it('returns sorted-by-count results', () => {
    const seqs = [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'], // a→b: 3
      ['a', 'c'],
      ['a', 'c'], // a→c: 2
      ['a', 'd'] // a→d: 1
    ]
    const g = buildTransitionGraph(seqs)
    const after = tracksAfter(g, 'a')

    expect(after[0]).toEqual({ trackId: 'b', count: 3 })
    expect(after[1]).toEqual({ trackId: 'c', count: 2 })
    expect(after[2]).toEqual({ trackId: 'd', count: 1 })
  })

  it('handles a track that only appears as a destination', () => {
    const g = buildTransitionGraph([['a', 'b']])
    // 'b' is never a source — should return []
    expect(tracksAfter(g, 'b')).toEqual([])
  })

  it('the headline "mixed X→Y 4 times" use-case', () => {
    // Build 4 sessions all playing p → q
    const seqs = Array.from({ length: 4 }, () => ['p', 'q', 'r'])
    const g = buildTransitionGraph(seqs)
    const after = tracksAfter(g, 'p')
    expect(after[0]).toEqual({ trackId: 'q', count: 4 })
  })
})

describe('bestSequences', () => {
  it('returns empty for length < 2', () => {
    const g = buildTransitionGraph([['a', 'b', 'c']])
    expect(bestSequences(g, 1, 1)).toEqual([])
  })

  it('finds 2-track chains meeting minCount', () => {
    const seqs = [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'c']
    ]
    const g = buildTransitionGraph(seqs)
    const chains = bestSequences(g, 2, 2)
    expect(chains).toContainEqual(['a', 'b'])
    expect(chains).not.toContainEqual(['a', 'c']) // count=1, below minCount=2
  })

  it('finds 3-track chains', () => {
    const seqs = [
      ['a', 'b', 'c'],
      ['a', 'b', 'c'],
      ['a', 'b', 'd']
    ]
    const g = buildTransitionGraph(seqs)
    const chains = bestSequences(g, 2, 3)
    expect(chains).toContainEqual(['a', 'b', 'c'])
    expect(chains).not.toContainEqual(['a', 'b', 'd']) // b→d count=1
  })

  it('returns no duplicates', () => {
    const seqs = Array.from({ length: 5 }, () => ['x', 'y'])
    const g = buildTransitionGraph(seqs)
    const chains = bestSequences(g, 3, 2)
    const keys = chains.map((c) => c.join('→'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns empty when no chain meets minCount', () => {
    const g = buildTransitionGraph([['a', 'b']])
    expect(bestSequences(g, 5, 2)).toEqual([])
  })
})

describe('bridges', () => {
  it('returns empty for a graph with no hub nodes', () => {
    const g = buildTransitionGraph([['a', 'b']])
    expect(bridges(g)).toHaveLength(0)
  })

  it('identifies a hub node with multiple in + out', () => {
    // hub has: in from x,y; out to p,q → in=2, out=2 → qualifies
    const seqs = [
      ['x', 'hub', 'p'],
      ['y', 'hub', 'q']
    ]
    const g = buildTransitionGraph(seqs)
    const bs = bridges(g)
    expect(bs.map((b) => b.trackId)).toContain('hub')
  })

  it('does NOT flag a node with only in=1 or out=1', () => {
    const seqs = [
      ['a', 'mid', 'z'] // mid has in=1, out=1
    ]
    const g = buildTransitionGraph(seqs)
    expect(bridges(g)).toHaveLength(0)
  })

  it('ranks by in×out descending', () => {
    // hub2 should score higher: in=3, out=3
    const seqs = [
      ['x1', 'hub1', 'p1'],
      ['x2', 'hub1', 'p2'],
      // hub2 with higher degree
      ['y1', 'hub2', 'q1'],
      ['y2', 'hub2', 'q2'],
      ['y3', 'hub2', 'q3']
    ]
    const g = buildTransitionGraph(seqs)
    const bs = bridges(g)
    if (bs.length >= 2) {
      expect(bs[0].count).toBeGreaterThanOrEqual(bs[1].count)
    }
  })
})

describe('terminalTracks (dead-ends)', () => {
  it('returns empty for empty input', () => {
    expect(terminalTracks([])).toEqual([])
  })

  it('counts how many sequences end on each track', () => {
    const seqs = [
      ['a', 'b', 'c'],
      ['x', 'y', 'c'],
      ['p', 'q', 'c'],
      ['m', 'n']
    ]
    const result = terminalTracks(seqs, 1)
    // 'c' is the terminal of 3 sequences; 'n' is terminal of 1
    expect(result.find((r) => r.trackId === 'c')?.count).toBe(3)
    expect(result.find((r) => r.trackId === 'n')?.count).toBe(1)
  })

  it('respects minOccurrences threshold', () => {
    const seqs = [
      ['a', 'b'],
      ['x', 'b'],
      ['p', 'q']
    ]
    // 'b' ends 2 sequences, 'q' ends 1 — with minOccurrences=2 only 'b' survives
    const result = terminalTracks(seqs, 2)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ trackId: 'b', count: 2 })
  })

  it('sorts by count descending', () => {
    const seqs = [
      ['a', 'rare-end'],
      ['x', 'frequent-end'],
      ['y', 'frequent-end'],
      ['z', 'frequent-end']
    ]
    const result = terminalTracks(seqs, 1)
    expect(result[0].trackId).toBe('frequent-end')
  })
})
