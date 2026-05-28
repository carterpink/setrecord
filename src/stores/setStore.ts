import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import type { Set as DJSet, SetTrack, Track, ArchitectParams } from '@/types'
import { useToastStore } from '@/stores/toastStore'

let _saveTimer: ReturnType<typeof setTimeout> | null = null

export type SaveStatus = 'idle' | 'saving' | 'unsaved' | 'error'

interface SetActions {
  loadSets: () => Promise<void>
  loadCurrentSet: (id: string) => Promise<void>
  createSet: (name?: string) => void
  renameCurrentSet: (name: string) => void
  addTrack: (track: Track) => void
  /** Add to the current set and surface an animated toast with a move-to-another-set picker. */
  addTrackAndToast: (track: Track) => void
  /** Move an already-added track from one set to another (used by the add toast). */
  moveTrackToSet: (trackId: string, fromSetId: string, toSetId: string) => void
  addTrackAt: (track: Track, position: number) => void
  addTrackAfterSelected: (track: Track) => void
  removeTrack: (setTrackId: string) => void
  reorderTracks: (activeId: string, overId: string) => void
  /** Create a brand-new set from an ordered list of tracks (used by Intelligence "Save as set"). */
  createSetFromTracks: (name: string, tracks: Track[]) => void
  /** Append tracks (de-duped) to the current set, creating one if needed. */
  addTracksToCurrent: (tracks: Track[]) => void
  toggleLock: (setTrackId: string) => void
  setEnergyOverride: (setTrackId: string, energy: number | null) => void
  setSelectedTrack: (id: string | null) => void
  deleteCurrentSet: () => Promise<void>
  computeAllTransitions: () => Promise<void>
  populateFromArchitect: (tracks: SetTrack[], params: ArchitectParams, name?: string) => void
  retrySave: () => void
}

interface SetState {
  currentSet: DJSet | null
  savedSets: DJSet[]
  selectedTrackId: string | null
  saveStatus: SaveStatus
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
  saveStatus: 'idle',

  loadSets: async () => {
    try {
      const sets = await window.setsense.getSets()
      // Auto-restore the most recently updated set so the timeline isn't blank on every launch.
      // getSets() returns sets ordered by updated_at DESC, so sets[0] is the latest.
      const { currentSet } = get()
      set({
        savedSets: sets,
        currentSet: currentSet ?? sets[0] ?? null
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
      targetHardware: 'CDJ-2000NXS2'
    }
    set((s) => ({
      currentSet: newSet,
      savedSets: [newSet, ...s.savedSets],
      selectedTrackId: null
    }))
    _scheduleSave(get, set)
  },

  renameCurrentSet: (name: string) => {
    const { currentSet, savedSets } = get()
    if (!currentSet) return
    const updated = { ...currentSet, name, updatedAt: new Date().toISOString() }
    set({ currentSet: updated, savedSets: syncSavedSets(savedSets, updated) })
    _scheduleSave(get, set)
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
      position: currentSet.tracks.length
    }
    const updated: DJSet = {
      ...currentSet,
      tracks: [...currentSet.tracks, newSetTrack],
      updatedAt: new Date().toISOString()
    }
    set((s) => ({
      currentSet: updated,
      savedSets: syncSavedSets(s.savedSets, updated),
      selectedTrackId: newSetTrack.id // auto-select so suggestions update immediately
    }))
    _scheduleSave(get, set)
    void get().computeAllTransitions()
  },

  addTrackAndToast: (track: Track) => {
    const cur = get().currentSet
    if (cur?.tracks.some((st) => st.trackId === track.id)) {
      useToastStore.getState().push({ kind: 'info', message: `Already in ${cur.name}` })
      return
    }
    get().addTrack(track)
    const now = get().currentSet
    if (!now) return
    useToastStore.getState().push({
      kind: 'success',
      message: `Added to ${now.name}`,
      setMove: { trackId: track.id, fromSetId: now.id }
    })
  },

  moveTrackToSet: (trackId, fromSetId, toSetId) => {
    if (fromSetId === toSetId) return
    const state = get()
    // Fold the (possibly newer) current set into the saved list so we operate on fresh data.
    const all = state.currentSet
      ? syncSavedSets(state.savedSets, state.currentSet)
      : state.savedSets
    const from = all.find((s) => s.id === fromSetId)
    const to = all.find((s) => s.id === toSetId)
    if (!from || !to) return
    const moving = from.tracks.find((st) => st.trackId === trackId)
    if (!moving) return

    const now = new Date().toISOString()
    const newFrom: DJSet = {
      ...from,
      tracks: reindex(from.tracks.filter((st) => st.trackId !== trackId)),
      updatedAt: now
    }
    const newToTracks = to.tracks.some((st) => st.trackId === trackId)
      ? to.tracks
      : [
          ...to.tracks,
          { id: crypto.randomUUID(), trackId, track: moving.track, position: to.tracks.length }
        ]
    const newTo: DJSet = { ...to, tracks: reindex(newToTracks), updatedAt: now }

    // The source set won't be current after the move, so persist it explicitly.
    void window.setsense.saveSet(newFrom).catch(() => {})
    let nextSaved = syncSavedSets(all, newFrom)
    nextSaved = syncSavedSets(nextSaved, newTo)
    set({ currentSet: newTo, savedSets: nextSaved, selectedTrackId: null })
    _scheduleSave(get, set)
    void get().computeAllTransitions()
    useToastStore.getState().push({ kind: 'success', message: `Moved to ${newTo.name}` })
  },

  addTrackAt: (track: Track, position: number) => {
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
      position: 0 // re-assigned by reindex below
    }
    const clamped = Math.max(0, Math.min(position, currentSet.tracks.length))
    const next = [
      ...currentSet.tracks.slice(0, clamped),
      newSetTrack,
      ...currentSet.tracks.slice(clamped)
    ]
    const updated: DJSet = {
      ...currentSet,
      tracks: reindex(next),
      updatedAt: new Date().toISOString()
    }
    set((s) => ({
      currentSet: updated,
      savedSets: syncSavedSets(s.savedSets, updated),
      selectedTrackId: newSetTrack.id
    }))
    _scheduleSave(get, set)
    void get().computeAllTransitions()
  },

  addTrackAfterSelected: (track: Track) => {
    const { currentSet, selectedTrackId } = get()
    if (!currentSet || !selectedTrackId) {
      get().addTrack(track)
      return
    }
    const idx = currentSet.tracks.findIndex((st) => st.id === selectedTrackId)
    if (idx === -1) {
      get().addTrack(track)
      return
    }
    get().addTrackAt(track, idx + 1)
  },

  removeTrack: (setTrackId: string) => {
    const { currentSet } = get()
    if (!currentSet) return
    const filtered = currentSet.tracks.filter((st) => st.id !== setTrackId)
    const updated: DJSet = {
      ...currentSet,
      tracks: reindex(filtered),
      updatedAt: new Date().toISOString()
    }
    set((s) => ({
      currentSet: updated,
      savedSets: syncSavedSets(s.savedSets, updated),
      selectedTrackId: s.selectedTrackId === setTrackId ? null : s.selectedTrackId
    }))
    _scheduleSave(get, set)
  },

  reorderTracks: (activeId: string, overId: string) => {
    const { currentSet } = get()
    if (!currentSet) return
    const oldIndex = currentSet.tracks.findIndex((st) => st.id === activeId)
    const newIndex = currentSet.tracks.findIndex((st) => st.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    // Locked tracks anchor in place — refuse any move that involves one.
    if (currentSet.tracks[oldIndex].locked || currentSet.tracks[newIndex].locked) return
    const reordered = reindex(arrayMove(currentSet.tracks, oldIndex, newIndex))
    const updated: DJSet = {
      ...currentSet,
      tracks: reordered,
      updatedAt: new Date().toISOString()
    }
    set((s) => ({ currentSet: updated, savedSets: syncSavedSets(s.savedSets, updated) }))
    _scheduleSave(get, set)
    void get().computeAllTransitions()
  },

  createSetFromTracks: (name: string, tracks: Track[]) => {
    const now = new Date().toISOString()
    const newSet: DJSet = {
      id: crypto.randomUUID(),
      name: name.trim() || autoSetName(),
      createdAt: now,
      updatedAt: now,
      tracks: tracks.map((track, i) => ({
        id: crypto.randomUUID(),
        trackId: track.id,
        track,
        position: i
      })),
      targetHardware: 'CDJ-2000NXS2'
    }
    set((s) => ({
      currentSet: newSet,
      savedSets: [newSet, ...s.savedSets],
      selectedTrackId: null
    }))
    _scheduleSave(get, set)
    void get().computeAllTransitions()
    useToastStore.getState().push({
      kind: 'success',
      message: `Saved "${newSet.name}" — ${newSet.tracks.length} tracks`
    })
  },

  addTracksToCurrent: (tracks: Track[]) => {
    let { currentSet } = get()
    if (!currentSet) {
      get().createSet()
      currentSet = get().currentSet!
    }
    const existing = new Set(currentSet.tracks.map((st) => st.trackId))
    const fresh = tracks.filter((t) => !existing.has(t.id))
    if (fresh.length === 0) {
      useToastStore
        .getState()
        .push({ kind: 'info', message: 'All of those are already in the set' })
      return
    }
    const base = currentSet.tracks.length
    const appended = fresh.map((track, i) => ({
      id: crypto.randomUUID(),
      trackId: track.id,
      track,
      position: base + i
    }))
    const updated: DJSet = {
      ...currentSet,
      tracks: [...currentSet.tracks, ...appended],
      updatedAt: new Date().toISOString()
    }
    set((s) => ({ currentSet: updated, savedSets: syncSavedSets(s.savedSets, updated) }))
    _scheduleSave(get, set)
    void get().computeAllTransitions()
    useToastStore.getState().push({
      kind: 'success',
      message: `Added ${fresh.length} to ${updated.name}`
    })
  },

  setSelectedTrack: (id: string | null) => {
    set({ selectedTrackId: id })
  },

  toggleLock: (setTrackId: string) => {
    const { currentSet } = get()
    if (!currentSet) return
    const idx = currentSet.tracks.findIndex((st) => st.id === setTrackId)
    if (idx === -1) return
    const next = currentSet.tracks.map((st, i) => (i === idx ? { ...st, locked: !st.locked } : st))
    const updated: DJSet = {
      ...currentSet,
      tracks: next,
      updatedAt: new Date().toISOString()
    }
    set((s) => ({ currentSet: updated, savedSets: syncSavedSets(s.savedSets, updated) }))
    _scheduleSave(get, set)
  },

  setEnergyOverride: (setTrackId, energy) => {
    const { currentSet } = get()
    if (!currentSet) return
    const next = currentSet.tracks.map((st) =>
      st.id === setTrackId
        ? {
            ...st,
            energyOverride:
              energy === null ? undefined : Math.max(1, Math.min(10, Math.round(energy)))
          }
        : st
    )
    const updated: DJSet = { ...currentSet, tracks: next, updatedAt: new Date().toISOString() }
    set((s) => ({ currentSet: updated, savedSets: syncSavedSets(s.savedSets, updated) }))
    _scheduleSave(get, set)
  },

  computeAllTransitions: async () => {
    const { currentSet } = get()
    if (!currentSet || currentSet.tracks.length < 2) return
    const sorted = [...currentSet.tracks].sort((a, b) => a.position - b.position)
    try {
      const scores = await Promise.all(
        sorted
          .slice(1)
          .map((st, i) => window.setsense.scoreTransition(sorted[i].trackId, st.trackId))
      )
      // Re-read state in case the set changed while we awaited
      const latest = get().currentSet
      if (!latest || latest.id !== currentSet.id || latest.tracks.length !== sorted.length) return

      const latestSorted = [...latest.tracks].sort((a, b) => a.position - b.position)
      const updatedTracks = latestSorted.map((st, i) => ({
        ...st,
        transitionScore: i > 0 ? (scores[i - 1] ?? undefined) : undefined
      }))
      const updatedSet: DJSet = { ...latest, tracks: updatedTracks }
      set((s) => ({ currentSet: updatedSet, savedSets: syncSavedSets(s.savedSets, updatedSet) }))
      _scheduleSave(get, set)
    } catch {
      // IPC not available (browser preview)
    }
  },

  populateFromArchitect: (tracks: SetTrack[], params: ArchitectParams, name?: string) => {
    const now = new Date().toISOString()
    const { currentSet } = get()
    // If the current set has locked tracks, merge into it: the algorithm has
    // already preserved the locks at their positions. Keep id/name/createdAt so
    // the user's working set isn't duplicated in the sidebar.
    const hasLocks = currentSet?.tracks.some((t) => t.locked) ?? false
    if (hasLocks && currentSet) {
      const merged: DJSet = {
        ...currentSet,
        tracks,
        updatedAt: now,
        vibe: params.vibe,
        venue: params.venueType,
        slotTime: params.slotTime,
        energyCurveType: params.energyCurveType,
        targetBpmMin: params.bpmMin,
        targetBpmMax: params.bpmMax
      }
      set((s) => ({
        currentSet: merged,
        savedSets: syncSavedSets(s.savedSets, merged),
        selectedTrackId: tracks[tracks.length - 1]?.id ?? null
      }))
      _scheduleSave(get, set)
      return
    }
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
      targetHardware: 'CDJ-2000NXS2'
    }
    set((s) => ({
      currentSet: newSet,
      savedSets: [newSet, ...s.savedSets],
      selectedTrackId: tracks[tracks.length - 1]?.id ?? null
    }))
    _scheduleSave(get, set)
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
      selectedTrackId: null
    })
  },

  retrySave: () => {
    _flushSave(get, set)
  }
}))

/**
 * Schedule a debounced auto-save. Marks the set as 'unsaved' immediately so the
 * UI can show a pending indicator even before the timer fires. On the trailing
 * edge we invoke _flushSave which handles persistence + one-shot retry.
 */
function _scheduleSave(
  get: () => SetState & SetActions,
  setState: (partial: Partial<SetState>) => void
): void {
  setState({ saveStatus: 'unsaved' })
  if (_saveTimer !== null) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    void _flushSave(get, setState)
  }, 500)
}

/**
 * Run the actual IPC write. Retries once on transient failure (e.g. main-process
 * is briefly unavailable). If the second attempt also fails, surface a toast so
 * the user knows their work isn't durable — no more silent console.error.
 */
async function _flushSave(
  get: () => SetState & SetActions,
  setState: (partial: Partial<SetState>) => void
): Promise<void> {
  const { currentSet, savedSets } = get()
  if (!currentSet) {
    setState({ saveStatus: 'idle' })
    return
  }
  setState({ saveStatus: 'saving' })

  const attempt = async (): Promise<DJSet | null | undefined> => {
    return await window.setsense.saveSet(currentSet)
  }

  try {
    const saved = await attempt()
    if (saved) {
      useSetStore.setState({
        savedSets: savedSets.map((s) => (s.id === saved.id ? saved : s))
      })
    }
    setState({ saveStatus: 'idle' })
  } catch (firstErr) {
    console.error('[setStore] save attempt 1 failed, retrying:', firstErr)
    await new Promise((r) => setTimeout(r, 400))
    try {
      const saved = await attempt()
      if (saved) {
        useSetStore.setState({
          savedSets: savedSets.map((s) => (s.id === saved.id ? saved : s))
        })
      }
      setState({ saveStatus: 'idle' })
    } catch (secondErr) {
      console.error('[setStore] save retry failed:', secondErr)
      setState({ saveStatus: 'error' })
      useToastStore
        .getState()
        .error('Could not save your set. Click the warning by the set name to retry.', 8000)
    }
  }
}
