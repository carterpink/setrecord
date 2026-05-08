import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import type { Set as DJSet, SetTrack, Track, ArchitectParams } from '@/types'

let _saveTimer: ReturnType<typeof setTimeout> | null = null

interface SetActions {
  loadSets: () => Promise<void>
  loadCurrentSet: (id: string) => Promise<void>
  createSet: (name?: string) => void
  renameCurrentSet: (name: string) => void
  addTrack: (track: Track) => void
  removeTrack: (setTrackId: string) => void
  reorderTracks: (activeId: string, overId: string) => void
  setSelectedTrack: (id: string | null) => void
  deleteCurrentSet: () => Promise<void>
  computeAllTransitions: () => Promise<void>
  populateFromArchitect: (tracks: SetTrack[], params: ArchitectParams, name?: string) => void
}

interface SetState {
  currentSet: DJSet | null
  savedSets: DJSet[]
  selectedTrackId: string | null
}

function autoSetName(): string {
  return `New set ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

function reindex(tracks: SetTrack[]): SetTrack[] {
  return tracks.map((st, i) => ({ ...st, position: i }))
}

function syncSavedSets(savedSets: DJSet[], updated: DJSet): DJSet[] {
  return savedSets.some((s) => s.id === updated.id)
    ? savedSets.map((s) => (s.id === updated.id ? updated : s))
    : savedSets
}

export const useSetStore = create<SetState & SetActions>((set, get) => ({
  currentSet: null,
  savedSets: [],
  selectedTrackId: null,

  loadSets: async () => {
    try {
      const sets = await window.setsense.getSets()
      // Auto-restore the most recently updated set so the timeline isn't blank on every launch.
      // getSets() returns sets ordered by updated_at DESC, so sets[0] is the latest.
      const { currentSet } = get()
      set({
        savedSets: sets,
        currentSet: currentSet ?? sets[0] ?? null,
      })
      // Recompute transition scores for the restored set
      if (!currentSet && sets[0]) {
        void get().computeAllTransitions()
      }
    } catch {
      // IPC not available (e.g. browser-only preview)
    }
  },

  loadCurrentSet: async (id: string) => {
    try {
      const loaded = await window.setsense.getSet(id)
      if (loaded) set({ currentSet: loaded, selectedTrackId: null })
    } catch {
      // IPC not available
    }
  },

  createSet: (name?: string) => {
    const now = new Date().toISOString()
    const newSet: DJSet = {
      id: crypto.randomUUID(),
      name: name ?? autoSetName(),
      createdAt: now,
      updatedAt: now,
      tracks: [],
      targetHardware: 'CDJ-2000NXS2',
    }
    set((s) => ({
      currentSet: newSet,
      savedSets: [newSet, ...s.savedSets],
      selectedTrackId: null,
    }))
    _scheduleSave(get)
  },

  renameCurrentSet: (name: string) => {
    const { currentSet, savedSets } = get()
    if (!currentSet) return
    const updated = { ...currentSet, name, updatedAt: new Date().toISOString() }
    set({ currentSet: updated, savedSets: syncSavedSets(savedSets, updated) })
    _scheduleSave(get)
  },

  addTrack: (track: Track) => {
    let { currentSet } = get()
    if (!currentSet) {
      get().createSet()
      currentSet = get().currentSet!
    }
    if (currentSet.tracks.some((st) => st.trackId === track.id)) return
    const newSetTrack: SetTrack = {
      id: crypto.randomUUID(),
      trackId: track.id,
      track,
      position: currentSet.tracks.length,
    }
    const updated: DJSet = {
      ...currentSet,
      tracks: [...currentSet.tracks, newSetTrack],
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({
      currentSet: updated,
      savedSets: syncSavedSets(s.savedSets, updated),
      selectedTrackId: newSetTrack.id,   // auto-select so suggestions update immediately
    }))
    _scheduleSave(get)
    void get().computeAllTransitions()
  },

  removeTrack: (setTrackId: string) => {
    const { currentSet } = get()
    if (!currentSet) return
    const filtered = currentSet.tracks.filter((st) => st.id !== setTrackId)
    const updated: DJSet = {
      ...currentSet,
      tracks: reindex(filtered),
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({
      currentSet: updated,
      savedSets: syncSavedSets(s.savedSets, updated),
      selectedTrackId: s.selectedTrackId === setTrackId ? null : s.selectedTrackId,
    }))
    _scheduleSave(get)
  },

  reorderTracks: (activeId: string, overId: string) => {
    const { currentSet } = get()
    if (!currentSet) return
    const oldIndex = currentSet.tracks.findIndex((st) => st.id === activeId)
    const newIndex = currentSet.tracks.findIndex((st) => st.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = reindex(arrayMove(currentSet.tracks, oldIndex, newIndex))
    const updated: DJSet = {
      ...currentSet,
      tracks: reordered,
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({ currentSet: updated, savedSets: syncSavedSets(s.savedSets, updated) }))
    _scheduleSave(get)
    void get().computeAllTransitions()
  },

  setSelectedTrack: (id: string | null) => {
    set({ selectedTrackId: id })
  },

  computeAllTransitions: async () => {
    const { currentSet } = get()
    if (!currentSet || currentSet.tracks.length < 2) return
    const sorted = [...currentSet.tracks].sort((a, b) => a.position - b.position)
    try {
      const scores = await Promise.all(
        sorted.slice(1).map((st, i) =>
          window.setsense.scoreTransition(sorted[i].trackId, st.trackId),
        ),
      )
      // Re-read state in case the set changed while we awaited
      const latest = get().currentSet
      if (!latest || latest.id !== currentSet.id || latest.tracks.length !== sorted.length) return

      const latestSorted = [...latest.tracks].sort((a, b) => a.position - b.position)
      const updatedTracks = latestSorted.map((st, i) => ({
        ...st,
        transitionScore: i > 0 ? (scores[i - 1] ?? undefined) : undefined,
      }))
      const updatedSet: DJSet = { ...latest, tracks: updatedTracks }
      set((s) => ({ currentSet: updatedSet, savedSets: syncSavedSets(s.savedSets, updatedSet) }))
      _scheduleSave(get)
    } catch {
      // IPC not available (browser preview)
    }
  },

  populateFromArchitect: (tracks: SetTrack[], params: ArchitectParams, name?: string) => {
    const now = new Date().toISOString()
    const setName = name ?? `${params.vibe} — ${params.slotTime}`
    const newSet: DJSet = {
      id: crypto.randomUUID(),
      name: setName,
      createdAt: now,
      updatedAt: now,
      tracks,
      vibe: params.vibe,
      venue: params.venueType,
      slotTime: params.slotTime,
      energyCurveType: params.energyCurveType,
      targetBpmMin: params.bpmMin,
      targetBpmMax: params.bpmMax,
      targetHardware: 'CDJ-2000NXS2',
    }
    set((s) => ({
      currentSet: newSet,
      savedSets: [newSet, ...s.savedSets],
      selectedTrackId: tracks[tracks.length - 1]?.id ?? null,
    }))
    _scheduleSave(get)
  },

  deleteCurrentSet: async () => {
    const { currentSet, savedSets } = get()
    if (!currentSet) return
    try {
      await window.setsense.deleteSet(currentSet.id)
    } catch {
      // IPC not available
    }
    set({
      currentSet: null,
      savedSets: savedSets.filter((s) => s.id !== currentSet.id),
      selectedTrackId: null,
    })
  },
}))

function _scheduleSave(get: () => SetState & SetActions): void {
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    const { currentSet, savedSets } = get()
    if (!currentSet) return
    window.setsense
      .saveSet(currentSet)
      .then((saved) => {
        if (saved) {
          useSetStore.setState({
            savedSets: savedSets.map((s) => (s.id === saved.id ? saved : s)),
          })
        }
      })
      .catch((err) => console.error('[setStore] persist failed:', err))
  }, 500)
}
