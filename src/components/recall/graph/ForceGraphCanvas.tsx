/**
 * ForceGraphCanvas.tsx — canvas force-directed renderer (react-force-graph-2d).
 *
 * Paints the Constellation on a pure-black field: lime track nodes, platinum gig
 * hubs, and threads whose flowing directional particles show the direction you
 * actually mixed in. Implements GraphRendererProps so it can be swapped for a GPU
 * renderer at whole-library scale later.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphEdge, GraphNode } from '@/types'
import type { GraphRendererProps } from './GraphRenderer'

const ACCENT = '#CFFF04' // lime — tracks + mixed threads (Past)
const ACCENT_ALT = '#5eead4' // teal — compatible threads (Future/Diff) + selection ring
const PRESENT = '#ffd166' // gold — the live path you're on right now (Present)
const GIG = 'rgba(255,255,255,0.82)' // platinum — gig hubs
const BG = '#06070A'

/** Node as the force sim sees it — our node plus the x/y the layout writes in. */
type FGNode = GraphNode & { x?: number; y?: number }
/** Link endpoints start as ids and are swapped for node refs once laid out. */
type FGLink = Omit<GraphEdge, 'source' | 'target'> & {
  source: string | FGNode
  target: string | FGNode
}

/** The handful of imperative + force methods we drive on the graph. */
interface ForceFn {
  strength: (s: number | ((d: unknown) => number)) => ForceFn
  distance: (d: number | ((l: unknown) => number)) => ForceFn
}
interface FGMethods {
  zoomToFit: (durationMs?: number, paddingPx?: number) => void
  zoom: (k: number, durationMs?: number) => void
  centerAt: (x?: number, y?: number, durationMs?: number) => void
  d3Force: (name: string) => ForceFn | undefined
  d3ReheatSimulation: () => void
}

/**
 * Minimal, precisely-typed surface over react-force-graph-2d. The library's own
 * generics are deeply nested and fight a discriminated-union node type, so we
 * pin exactly the props we use to our domain types via a single boundary cast.
 */
interface ForceGraphProps {
  graphData: { nodes: FGNode[]; links: FGLink[] }
  width: number
  height: number
  backgroundColor?: string
  nodeId?: string
  nodeRelSize?: number
  nodeLabel?: (n: FGNode) => string
  nodeCanvasObject?: (n: FGNode, ctx: CanvasRenderingContext2D, scale: number) => void
  nodeCanvasObjectMode?: (n: FGNode) => string
  nodePointerAreaPaint?: (n: FGNode, color: string, ctx: CanvasRenderingContext2D) => void
  linkColor?: (l: FGLink) => string
  linkWidth?: (l: FGLink) => number
  linkDirectionalParticles?: (l: FGLink) => number
  linkDirectionalParticleWidth?: number
  linkDirectionalParticleSpeed?: (l: FGLink) => number
  linkDirectionalParticleColor?: (l: FGLink) => string
  onNodeHover?: (n: FGNode | null) => void
  onNodeClick?: (n: FGNode) => void
  onBackgroundClick?: () => void
  onEngineStop?: () => void
  cooldownTicks?: number
  warmupTicks?: number
  d3VelocityDecay?: number
}
const FG = ForceGraph2D as unknown as React.ForwardRefExoticComponent<
  ForceGraphProps & React.RefAttributes<FGMethods>
>

/** Resolve a link endpoint (the lib swaps ids for node refs after layout). */
function endId(end: string | FGNode): string {
  return typeof end === 'object' ? String(end.id) : String(end)
}

function nodeRadius(node: FGNode): number {
  if (node.kind === 'cluster') return 5 + Math.min(16, Math.sqrt(node.size) * 1.4)
  if (node.kind === 'gig') return 2.5 + Math.min(4.5, node.degree * 0.3)
  return 1.6 + Math.min(4, node.degree * 0.4)
}

export function ForceGraphCanvas({
  data,
  selectedId,
  onSelect,
  onFocusTrack,
  onExpandCluster,
  pathMode,
  pathIds,
  onPathToggle
}: GraphRendererProps): React.JSX.Element {
  const pathIndex = new Map((pathIds ?? []).map((id, i) => [id, i + 1]))
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<FGMethods | null>(null)
  // Remembered node positions so switching lenses MORPHS the threads instead of
  // reshuffling the whole field — nodes that persist keep their coordinates.
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Measure the container so the canvas fills the full-bleed section.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fresh copies each load — the lib mutates nodes/links with x/y/velocity.
  const [fgData, setFgData] = useState<{ nodes: FGNode[]; links: FGLink[] }>(() => ({
    nodes: data.nodes.map((n) => ({ ...n }) as FGNode),
    links: data.edges.map((e) => ({ ...e }) as FGLink)
  }))

  // Rebuild on data change, seeding persisting nodes from their last known
  // position so switching lenses MORPHS the threads rather than re-randomising.
  // (Reading posRef here, in an effect, keeps render pure.)
  useEffect(() => {
    setFgData({
      nodes: data.nodes.map((n) => {
        const p = posRef.current.get(n.id)
        return (p ? { ...n, x: p.x, y: p.y } : { ...n }) as FGNode
      }),
      links: data.edges.map((e) => ({ ...e }) as FGLink)
    })
  }, [data])

  // Spread the constellation out so it doesn't collapse into a clump.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-90)
    fg.d3Force('link')?.distance((l) => {
      const link = l as FGLink
      return link.reason.kind === 'gig-membership' ? 26 : 48
    })
    fg.d3ReheatSimulation()
  }, [fgData])

  const handleEngineStop = useCallback(() => {
    const fg = fgRef.current
    if (!fg) return
    // Remember where everything settled so the next lens can morph from here.
    for (const n of fgData.nodes) {
      if (n.x != null && n.y != null) posRef.current.set(n.id, { x: n.x, y: n.y })
    }
    // A lone node (e.g. a seed with no mixes) has no extent — zoomToFit would
    // magnify it into a screen-filling blob, so frame it at a fixed zoom.
    if (fgData.nodes.length <= 1) {
      const only = fgData.nodes[0]
      fg.centerAt(only?.x ?? 0, only?.y ?? 0, 600)
      fg.zoom(2, 600)
      return
    }
    // Only frame once the layout has actually spread.
    const xs = fgData.nodes.map((n) => n.x ?? 0)
    const ys = fgData.nodes.map((n) => n.y ?? 0)
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    if (spread < 20) return
    fg.zoomToFit(600, 56)
  }, [fgData])

  const paintNode = (n: FGNode, ctx: CanvasRenderingContext2D, scale: number): void => {
    const x = n.x ?? 0
    const y = n.y ?? 0
    const r = nodeRadius(n)
    const isSel = n.id === selectedId
    const isHover = n.id === hoverId
    const isGig = n.kind === 'gig'
    const isCluster = n.kind === 'cluster'

    // Soft glow for tracks + clusters (the "stars").
    if (!isGig) {
      ctx.beginPath()
      ctx.arc(x, y, r * (isCluster ? 1.3 : 2.2), 0, Math.PI * 2)
      ctx.fillStyle = isCluster ? 'rgba(207,255,4,0.08)' : 'rgba(207,255,4,0.05)'
      ctx.fill()
    }

    ctx.beginPath()
    if (isGig) {
      // Diamond hub for gigs.
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r, y)
      ctx.closePath()
      ctx.fillStyle = GIG
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = isCluster ? 'rgba(207,255,4,0.35)' : ACCENT
    }
    ctx.fill()
    if (isCluster) {
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.5 / scale
      ctx.stroke()
    }

    if (isSel || isHover) {
      ctx.beginPath()
      ctx.arc(x, y, r + 2.5, 0, Math.PI * 2)
      ctx.strokeStyle = isSel ? ACCENT_ALT : 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5 / scale
      ctx.stroke()
    }

    // Path membership: a numbered gold ring marking this track's step in the set.
    const pathNum = pathIndex.get(String(n.id))
    if (pathNum != null) {
      ctx.beginPath()
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2)
      ctx.strokeStyle = PRESENT
      ctx.lineWidth = 2 / scale
      ctx.stroke()
      const fs = 9 / scale
      ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`
      ctx.fillStyle = PRESENT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(pathNum), x, y - r - 6 / scale)
    }

    // Labels: constant on-screen size; only when zoomed in or focused, so the
    // field stays clean as a constellation rather than a wall of text.
    const label = n.kind === 'gig' ? (n.venue ?? n.name) : n.kind === 'track' ? n.title : n.label
    if (label && (isSel || isHover || isCluster || scale > 2.4)) {
      const fontSize = 11 / scale // divide by zoom → fixed pixels on screen
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const text = label.length > 28 ? `${label.slice(0, 27)}…` : label
      // Legibility plate behind the text.
      if (isSel || isHover) {
        const w = ctx.measureText(text).width
        ctx.fillStyle = 'rgba(6,7,10,0.7)'
        ctx.fillRect(x - w / 2 - 3 / scale, y + r + 2 / scale, w + 6 / scale, fontSize + 3 / scale)
      }
      ctx.fillStyle = isGig ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.82)'
      ctx.fillText(text, x, y + r + 3 / scale)
    }
  }

  const linkColor = (l: FGLink): string => {
    const touchesSel =
      selectedId != null && (endId(l.source) === selectedId || endId(l.target) === selectedId)
    switch (l.reason.kind) {
      case 'gig-membership':
        return touchesSel ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)'
      case 'mixed':
        // Lime — transitions you've actually played.
        return touchesSel ? 'rgba(207,255,4,0.85)' : 'rgba(207,255,4,0.22)'
      case 'live-path':
        // Gold — the set you're building / playing right now.
        return touchesSel ? 'rgba(255,209,102,0.95)' : 'rgba(255,209,102,0.7)'
      case 'compatible':
        // Teal for "you could mix this"; bright teal when it's novel (never mixed)
        // — the discovery glow that Diff is built around.
        if (l.reason.novel) return touchesSel ? 'rgba(94,234,212,0.95)' : 'rgba(94,234,212,0.5)'
        return touchesSel ? 'rgba(94,234,212,0.6)' : 'rgba(94,234,212,0.18)'
      default:
        return 'rgba(255,255,255,0.15)'
    }
  }

  // Particles flow along directed past mixes (direction), the live path (the
  // "now" energy), and novel discovery edges (draw the eye to "never tried").
  const linkParticles = (l: FGLink): number => {
    if (l.reason.kind === 'mixed') return Math.min(3, l.weight)
    if (l.reason.kind === 'live-path') return 3
    if (l.reason.kind === 'compatible' && l.reason.novel) return 2
    return 0
  }
  const particleColor = (l: FGLink): string => {
    if (l.reason.kind === 'live-path') return PRESENT
    if (l.reason.kind === 'compatible') return ACCENT_ALT
    return ACCENT
  }

  if (size.w === 0) return <div ref={wrapRef} className="graph-canvas-wrap" />

  return (
    <div ref={wrapRef} className="graph-canvas-wrap">
      <FG
        ref={fgRef}
        graphData={fgData}
        width={size.w}
        height={size.h}
        backgroundColor={BG}
        nodeId="id"
        nodeRelSize={4}
        d3VelocityDecay={0.3}
        nodeLabel={(n) =>
          n.kind === 'gig'
            ? `${n.venue ?? n.name} · ${n.trackCount} tracks`
            : n.kind === 'track'
              ? `${n.title} — ${n.artist}`
              : n.label
        }
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={linkColor}
        linkWidth={(l) =>
          l.reason.kind === 'live-path' ? 2.5 : Math.min(2.5, 0.4 + l.weight * 0.35)
        }
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleSpeed={(l) => 0.004 + Math.min(0.01, l.weight * 0.002)}
        linkDirectionalParticleColor={particleColor}
        onEngineStop={handleEngineStop}
        onNodeHover={(n) => setHoverId(n ? String(n.id) : null)}
        onNodeClick={(n) => {
          onSelect(String(n.id))
          if (pathMode && n.kind === 'track') {
            onPathToggle?.(n.trackId)
            return
          }
          if (n.kind === 'track') onFocusTrack(n.trackId)
          else if (n.kind === 'cluster') onExpandCluster?.(n.memberIds[0])
        }}
        onBackgroundClick={() => onSelect(null)}
        cooldownTicks={200}
        warmupTicks={24}
      />
    </div>
  )
}
