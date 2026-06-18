/**
 * graphStore.ts — state for the Constellation graph view.
 *
 * Owns the active lens (mode), scope, seed track and the GraphData fetched from
 * the main process. Modelled on recallStore: thin async actions over the IPC
 * bridge, no-ops gracefully when the bridge is absent (renderer-only preview).
 */

import { create } from 'zustand'
import type { GraphData, GraphMode, GraphScope, GraphRequest } from '@/types'
import { useSetStore } from '@/stores/setStore'
import { useLiveStore } from '@/stores/liveStore'
import { buildPresentGraph } from '@/components/recall/graph/presentStrategy'

const SEED_KEY = 'setrecord-graph-seed'

function api(): Window['setrecord'] | undefined {
  return typeof window !== 'undefined' ? window.setrecord : undefined
}

function loadSeed(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(SEED_KEY)
}

/** Modes that are generated in the main process (Present is renderer-only, later). */
type IpcMode = GraphRequest['mode']
const IPC_MODES: GraphMode[] = ['past', 'future', 'diff']

type TimeWindow = NonNullable<GraphRequest['timeWindow']>

interface GraphState {
  mode: GraphMode
  scope: GraphScope
  seedTrackId: string | null
  /** Past time-scrubber window (null = all time). */
  timeWindow: TimeWindow | null
  data: GraphData | null
  loading: boolean
  error: boolean
  /** The node the user has selected (focus chip / detail). */
  selectedId: string | null
  /** Walk-a-path: when on, clicking track nodes appends them to `path`. */
  pathMode: boolean
  /** Ordered track ids the user is stitching into a set. */
  path: string[]

  // Mode/scope just set state; GraphSection's effect drives (gated) loading so
  // the Pro-gate can suppress fetches for locked lenses.
  setMode: (mode: GraphMode) => void
  setScope: (scope: GraphScope) => void
  setTimeWindow: (win: TimeWindow | null) => void
  /** Re-centre the neighborhood on a track and reload immediately. */
  focusTrack: (trackId: string) => Promise<void>
  /** Drill from a library cluster into a neighborhood seeded on its representative. */
  expandCluster: (repTrackId: string) => Promise<void>
  select: (id: string | null) => void
  loadGraph: () => Promise<void>

  togglePathMode: () => void
  /** Append the track if absent, remove it if already on the path. */
  togglePathNode: (trackId: string) => void
  setPath: (ids: string[]) => void
  clearPath: () => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  mode: 'past',
  scope: 'neighborhood',
  seedTrackId: loadSeed(),
  timeWindow: null,
  data: null,
  loading: false,
  error: false,
  selectedId: null,
  pathMode: false,
  path: [],

  togglePathMode: () => set((s) => ({ pathMode: !s.pathMode })),
  togglePathNode: (trackId) =>
    set((s) => ({
      path: s.path.includes(trackId) ? s.path.filter((id) => id !== trackId) : [...s.path, trackId]
    })),
  setPath: (ids) => set({ path: ids }),
  clearPath: () => set({ path: [] }),

  setMode: (mode) => {
    if (mode !== get().mode) set({ mode })
  },

  setScope: (scope) => {
    if (scope !== get().scope) set({ scope })
  },

  setTimeWindow: (win) => set({ timeWindow: win }),

  focusTrack: async (trackId) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SEED_KEY, trackId)
    set({ seedTrackId: trackId, selectedId: trackId })
    await get().loadGraph()
  },

  expandCluster: async (repTrackId) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SEED_KEY, repTrackId)
    set({ scope: 'neighborhood', seedTrackId: repTrackId, selectedId: repTrackId })
    await get().loadGraph()
  },

  select: (id) => set({ selectedId: id }),

  loadGraph: async () => {
    const s = api()
    const { mode, scope, seedTrackId } = get()

    // Present is built in the renderer from live store state — no IPC.
    if (mode === 'present') {
      const workingSet = useSetStore.getState().currentSet
      const live = useLiveStore.getState()
      const ordered = (workingSet?.tracks ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((st) => st.track)
      const data = buildPresentGraph({
        tracks: ordered,
        liveCurrentId: live.isLive ? (live.current?.id ?? null) : null
      })
      set({ data, loading: false, error: false })
      return
    }

    if (!s || !IPC_MODES.includes(mode)) {
      set({ data: null, loading: false })
      return
    }
    set({ loading: true, error: false })
    try {
      const contextTrackIds =
        scope === 'context'
          ? (useSetStore.getState().currentSet?.tracks ?? []).map((st) => st.trackId)
          : undefined
      const req: GraphRequest = {
        mode: mode as IpcMode,
        scope,
        seedTrackId: seedTrackId ?? undefined,
        contextTrackIds,
        timeWindow: get().timeWindow ?? undefined
      }
      const data = await s.buildGraph(req)
      // Adopt the auto-picked seed so the focus chip reflects what's centred.
      const nextSeed = data.meta.seedId ?? seedTrackId ?? null
      set({ data, seedTrackId: nextSeed })
    } catch {
      set({ error: true, data: null })
    } finally {
      set({ loading: false })
    }
  }
}))
