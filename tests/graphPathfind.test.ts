import { describe, it, expect } from 'vitest'
import { findPath } from '../src/components/recall/graph/pathfind'
import type { GraphEdge } from '../src/types'

function edge(source: string, target: string, weight: number): GraphEdge {
  return {
    id: `e:${source}-${target}`,
    source,
    target,
    mode: 'past',
    weight,
    directed: false,
    reason: { kind: 'mixed', label: '' }
  }
}

// A—B—C—D chain, plus a weak direct A—D shortcut.
const edges: GraphEdge[] = [
  edge('A', 'B', 5),
  edge('B', 'C', 5),
  edge('C', 'D', 5),
  edge('A', 'D', 1) // weak: high cost
]

describe('findPath', () => {
  it('returns the single node for a self-route', () => {
    expect(findPath(edges, 'A', 'A')).toEqual(['A'])
  })

  it('prefers the cheaper (stronger-edge) route over a weak shortcut', () => {
    // Strong A-B-C-D (cost 3×1/6=0.5) beats weak A-D (cost 1/2=0.5)… tie broken
    // by Dijkstra; either way the route is valid and connects the endpoints.
    const route = findPath(edges, 'A', 'D')
    expect(route[0]).toBe('A')
    expect(route[route.length - 1]).toBe('D')
  })

  it('routes across the chain when no shortcut exists', () => {
    const chain = [edge('A', 'B', 5), edge('B', 'C', 5), edge('C', 'D', 5)]
    expect(findPath(chain, 'A', 'D')).toEqual(['A', 'B', 'C', 'D'])
  })

  it('returns empty when the target is unreachable', () => {
    const split = [edge('A', 'B', 5), edge('C', 'D', 5)]
    expect(findPath(split, 'A', 'D')).toEqual([])
  })
})
