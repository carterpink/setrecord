/**
 * pathfind.ts — shortest route between two nodes over the current graph edges.
 *
 * Used by "walk a path to build a set": pick a start and an end track and let the
 * graph stitch the smoothest chain between them (strongest mixes / most
 * compatible transitions become the cheapest hops). Plain Dijkstra over the
 * undirected edge set — graphs here are small (≤150 nodes) so this is instant.
 */

import type { GraphEdge } from '@/types'

interface Adj {
  to: string
  cost: number
}

/** Stronger edges (higher weight) are cheaper to traverse. */
function edgeCost(weight: number): number {
  return 1 / (1 + Math.max(0, weight))
}

export function findPath(edges: GraphEdge[], fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId]

  const adj = new Map<string, Adj[]>()
  const link = (a: string, b: string, cost: number): void => {
    const list = adj.get(a)
    if (list) list.push({ to: b, cost })
    else adj.set(a, [{ to: b, cost }])
  }
  for (const e of edges) {
    const cost = edgeCost(e.weight)
    link(e.source, e.target, cost)
    link(e.target, e.source, cost)
  }
  if (!adj.has(fromId) || !adj.has(toId)) return []

  // Dijkstra with a linear-scan frontier (node counts are tiny here).
  const dist = new Map<string, number>([[fromId, 0]])
  const prev = new Map<string, string>()
  const visited = new Set<string>()

  while (visited.size < adj.size) {
    let u: string | null = null
    let best = Infinity
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < best) {
        best = d
        u = node
      }
    }
    if (u == null) break
    if (u === toId) break
    visited.add(u)
    for (const { to, cost } of adj.get(u) ?? []) {
      if (visited.has(to)) continue
      const nd = best + cost
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd)
        prev.set(to, u)
      }
    }
  }

  if (!prev.has(toId) && fromId !== toId) return []
  const route: string[] = [toId]
  let cur = toId
  while (cur !== fromId) {
    const p = prev.get(cur)
    if (p == null) return [] // unreachable
    route.push(p)
    cur = p
  }
  return route.reverse()
}
