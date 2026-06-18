/**
 * GraphRenderer.ts — the swappable renderer contract.
 *
 * ForceGraphCanvas (canvas / react-force-graph-2d) implements this for MVP and
 * neighborhood/context scope. A GPU CosmosRenderer can implement the same props
 * later for whole-library scale (Phase 5) without touching GraphSection.
 */

import type { GraphData } from '@/types'

export interface GraphRendererProps {
  data: GraphData
  /** Currently selected node id (track id or `gig:<id>`). */
  selectedId: string | null
  /** A node was clicked — select it. */
  onSelect: (id: string | null) => void
  /** A track node was double-clicked / actioned — re-centre the neighborhood. */
  onFocusTrack: (trackId: string) => void
  /** A library cluster super-node was clicked — drill into it (memberIds[0]). */
  onExpandCluster?: (repTrackId: string) => void
  /** Walk-a-path: when on, clicking a track toggles it on the path instead of re-centring. */
  pathMode?: boolean
  /** Ordered track ids currently on the path (numbered gold rings). */
  pathIds?: string[]
  onPathToggle?: (trackId: string) => void
}
