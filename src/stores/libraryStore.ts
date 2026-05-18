import { create } from 'zustand'
import { search as fuzzySearch } from 'fast-fuzzy'
import type { CuePoint, EnergySource, HotCue, ImportProgress, LibraryStats, Track } from '@/types'
import { gradientForId } from '@/utils/format'

/** Attach a deterministic gradient to every track that lacks real artwork. */
function withGradient(tracks: Track[]): Track[] {
  return tracks.map((t) =>
    t.artGradient ? t : { ...t, artGradient: gradientForId(t.id) }
  )
}

interface LibraryState {
  tracks: Track[]
  searchQuery: string
  /** Non-empty only when searchQuery !== ''. Caller renders these instead of tracks. */
  searchResults: Track[]
  isLoading: boolean
  hasLibrary: boolean
  stats: LibraryStats | null
  importProgress: ImportProgress | null

  loadLibrary: () => Promise<void>
  setSearchQuery: (q: string) => void
  triggerImport: () => Promise<void>
  patchTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => void
  patchTrackEnergy: (trackId: string, energy: number, source: EnergySource) => void
  applyFileStatusChanges: (changes: Array<{ id: string; missing: boolean }>) => void
  refreshFileHealth: () => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  searchQuery: '',
  searchResults: [],
  isLoading: false,
  hasLibrary: false,
  stats: null,
  importProgress: null,

  loadLibrary: async () => {
    set({ isLoading: true })
    try {
      const raw = await window.setsense.getLibrary()
      const tracks = withGradient(raw)
      set({ tracks, hasLibrary: tracks.length > 0, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  setSearchQuery: (q: string) => {
    const { tracks } = get()
    if (!q.trim()) {
      set({ searchQuery: q, searchResults: [] })
      return
    }
    const results = fuzzySearch(q, tracks, {
      keySelector: (t) => [t.title, t.artist, t.album ?? ''],
    })
    set({ searchQuery: q, searchResults: results as Track[] })
  },

  patchTrackCues: (trackId, cuePoints, hotCues) => {
    const patch = (arr: Track[]) =>
      arr.map((t) => (t.id === trackId ? { ...t, cuePoints, hotCues } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  patchTrackEnergy: (trackId, energy, source) => {
    const patch = (arr: Track[]) =>
      arr.map((t) => (t.id === trackId ? { ...t, energy, energySource: source } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  applyFileStatusChanges: (changes) => {
    if (changes.length === 0) return
    const changeMap = new Map(changes.map((c) => [c.id, c.missing]))
    const patch = (arr: Track[]) =>
      arr.map((t) =>
        changeMap.has(t.id) ? { ...t, missingFile: changeMap.get(t.id) } : t
      )
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  refreshFileHealth: async () => {
    await window.setsense.triggerHealthCheck()
  },

  triggerImport: async () => {
    const xmlPath = await window.setsense.selectXmlFile()
    if (!xmlPath) return

    const unsubscribe = window.setsense.onImportProgress((p) => {
      set({ importProgress: p })
    })

    try {
      const result = await window.setsense.importLibrary(xmlPath)
      set({ stats: result.stats })
      await get().loadLibrary()
    } finally {
      unsubscribe()
    }
  },
}))
