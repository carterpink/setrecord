import { create } from 'zustand'
import { search as fuzzySearch } from 'fast-fuzzy'
import type {
  CuePoint,
  EnergySource,
  HotCue,
  Loop,
  ImportProgress,
  LibraryStats,
  Playlist,
  RekordboxDetection,
  Track
} from '@/types'
import { gradientForId } from '@/utils/format'
import { useLicenseStore } from '@/stores/licenseStore'

/**
 * State machine for the Import flow.
 *
 *   idle ────────► detecting ─► detected ─────► importing ─► done
 *                       │           │              ▲
 *                       ▼           ▼              │
 *                  not-detected ───┴──► (XML picker)
 *
 *   - idle:         modal closed, nothing in progress
 *   - detecting:    running rekordbox:detect
 *   - detected:     master.db found, awaiting user confirmation
 *   - not-detected: no usable Rekordbox install — show XML guide
 *   - importing:    actively reading + writing (progress events come in)
 *   - done:         finished, stats screen
 */
export type ImportState = 'idle' | 'detecting' | 'detected' | 'not-detected' | 'importing' | 'done'

/** Attach a deterministic gradient to every track that lacks real artwork. */
function withGradient(tracks: Track[]): Track[] {
  return tracks.map((t) => (t.artGradient ? t : { ...t, artGradient: gradientForId(t.id) }))
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
  /** Rekordbox playlists imported alongside tracks. Flat list; tree built from parentId. */
  playlists: Playlist[]
  /** Map<playlistId, Set<trackId>> — derived from playlists on load for O(1) filter lookup. */
  playlistTrackIndex: Map<string, Set<string>>
  // ── Import flow ─────────────────────────────────────────────────────────
  /** Current state of the import flow (drives ImportModal rendering). */
  importState: ImportState
  /** Result of the most recent rekordbox:detect call. */
  detection: RekordboxDetection | null
  /** True when an in-place re-sync is available (master.db newer than last import). */
  libraryStale: boolean
  /** Error code from a failed import — drives "DB locked" / "key mismatch" UI. */
  importError: 'REKORDBOX_LOCKED' | 'REKORDBOX_KEY_MISMATCH' | 'GENERIC' | null

  loadLibrary: () => Promise<void>
  setSearchQuery: (q: string) => void
  /** Kick off the auto-detect flow — used by Onboarding step 3 + TopBar Import + Settings Re-sync. */
  startAutoDetectFlow: () => Promise<void>
  /** Confirm a detected master.db and import from it. */
  confirmAutoDetectImport: () => Promise<void>
  /** Fall back to the XML file picker + import. */
  triggerXmlImport: () => Promise<void>
  /** Jump straight to the not-detected XML guide (e.g. from a "How to export" link). */
  showXmlGuide: () => void
  /** Reset import state (close modal). */
  resetImportFlow: () => void
  /** Refresh stale flag from main (call on launch + window focus). */
  checkStale: () => Promise<void>
  patchTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => void
  patchTrackBeatgrid: (trackId: string, bpm: number, beatgridOffset: number) => void
  patchTrackLoops: (trackId: string, loops: Loop[]) => void
  patchTrackEnergy: (trackId: string, energy: number, source: EnergySource) => void
  patchTrackArtwork: (trackId: string, albumArtPath: string) => void
  setTrackEnergy: (trackId: string, energy: number) => Promise<void>
  updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }) => Promise<void>
  relinkTrackFile: (trackId: string) => Promise<string | null>
  applyFileStatusChanges: (changes: Array<{ id: string; missing: boolean }>) => void
  refreshFileHealth: () => Promise<void>
}

function buildPlaylistIndex(playlists: Playlist[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const p of playlists) {
    map.set(p.id, new Set(p.trackIds))
  }
  return map
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  searchQuery: '',
  searchResults: [],
  isLoading: false,
  hasLibrary: false,
  stats: null,
  importProgress: null,
  playlists: [],
  playlistTrackIndex: new Map(),
  importState: 'idle',
  detection: null,
  libraryStale: false,
  importError: null,

  loadLibrary: async () => {
    set({ isLoading: true })
    try {
      // Fetch tracks + playlists in parallel — both come from the same DB but the
      // round trips overlap, and the index can build while React rerenders the list.
      const [raw, playlists] = await Promise.all([
        window.setsense.getLibrary(),
        window.setsense.getPlaylists().catch(() => [] as Playlist[])
      ])
      const tracks = withGradient(raw)
      set({
        tracks,
        hasLibrary: tracks.length > 0,
        isLoading: false,
        playlists,
        playlistTrackIndex: buildPlaylistIndex(playlists)
      })
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
      keySelector: (t) => [t.title, t.artist, t.album ?? '']
    })
    set({ searchQuery: q, searchResults: results as Track[] })
  },

  patchTrackCues: (trackId, cuePoints, hotCues) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (t.id === trackId ? { ...t, cuePoints, hotCues } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  patchTrackBeatgrid: (trackId, bpm, beatgridOffset) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (t.id === trackId ? { ...t, bpm, beatgridOffset } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  patchTrackLoops: (trackId, loops) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (t.id === trackId ? { ...t, loops } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  patchTrackEnergy: (trackId, energy, source) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (t.id === trackId ? { ...t, energy, energySource: source } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  patchTrackArtwork: (trackId, albumArtPath) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) =>
        t.id === trackId ? { ...t, albumArtPath, albumArtSource: 'embedded' as const } : t
      )
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  setTrackEnergy: async (trackId, energy) => {
    const clamped = Math.max(1, Math.min(10, Math.round(energy)))
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) =>
        t.id === trackId ? { ...t, energy: clamped, energySource: 'user' as EnergySource } : t
      )
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
    await window.setsense.setTrackEnergy(trackId, clamped)
  },

  updateTrackMeta: async (trackId, fields) => {
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) =>
        t.id === trackId
          ? {
              ...t,
              ...(fields.bpm != null ? { bpm: fields.bpm } : {}),
              ...(fields.key != null ? { key: fields.key } : {})
            }
          : t
      )
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
    await window.setsense.updateTrackMeta(trackId, fields)
  },

  relinkTrackFile: async (trackId) => {
    const filePath = await window.setsense.relinkTrackFile(trackId)
    if (filePath) {
      const patch = (arr: Track[]): Track[] =>
        arr.map((t) => (t.id === trackId ? { ...t, filePath, missingFile: false } : t))
      set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
    }
    return filePath
  },

  applyFileStatusChanges: (changes) => {
    if (changes.length === 0) return
    const changeMap = new Map(changes.map((c) => [c.id, c.missing]))
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (changeMap.has(t.id) ? { ...t, missingFile: changeMap.get(t.id) } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  refreshFileHealth: async () => {
    await window.setsense.triggerHealthCheck()
  },

  startAutoDetectFlow: async () => {
    // Cleanup any stale progress from a prior import session.
    set({
      importState: 'detecting',
      detection: null,
      importProgress: null,
      importError: null
    })
    try {
      const detection = await window.setsense.detectRekordbox()
      // 'detected' covers anything where master.db exists (even if locked or
      // key-mismatched) — the modal renders a contextual CTA. Only fall back
      // to the not-detected XML guide when there's no master.db at all.
      const found = detection.installed && !!detection.dbPath && (detection.dbSize ?? 0) > 0
      set({
        detection,
        importState: found ? 'detected' : 'not-detected'
      })
    } catch (err) {
      console.error('[libraryStore] detect failed', err)
      set({ importState: 'not-detected', detection: null })
    }
  },

  confirmAutoDetectImport: async () => {
    const { detection } = get()
    if (!detection?.dbPath) return

    set({ importState: 'importing', importProgress: null, importError: null })
    const unsubscribe = window.setsense.onImportProgress((p) => {
      set({ importProgress: p })
    })
    try {
      const result = await window.setsense.importFromRekordboxDb(detection.dbPath)
      set({ stats: result.stats, importState: 'done', libraryStale: false })
      // A successful import may have armed the free Pro trial — re-read entitlement.
      void useLicenseStore.getState().hydrate()
      await get().loadLibrary()
    } catch (err) {
      const code =
        (err as { code?: string } | null)?.code === 'REKORDBOX_LOCKED'
          ? 'REKORDBOX_LOCKED'
          : (err as { code?: string } | null)?.code === 'REKORDBOX_KEY_MISMATCH'
            ? 'REKORDBOX_KEY_MISMATCH'
            : 'GENERIC'
      console.error('[libraryStore] importFromRekordboxDb failed', err)
      set({ importState: 'not-detected', importError: code })
    } finally {
      unsubscribe()
    }
  },

  triggerXmlImport: async () => {
    const xmlPath = await window.setsense.selectXmlFile()
    if (!xmlPath) return

    set({ importState: 'importing', importProgress: null, importError: null })
    const unsubscribe = window.setsense.onImportProgress((p) => {
      set({ importProgress: p })
    })
    try {
      const result = await window.setsense.importLibrary(xmlPath)
      set({ stats: result.stats, importState: 'done', libraryStale: false })
      // A successful import may have armed the free Pro trial — re-read entitlement.
      void useLicenseStore.getState().hydrate()
      await get().loadLibrary()
    } catch (err) {
      console.error('[libraryStore] importLibrary (XML) failed', err)
      set({ importState: 'not-detected', importError: 'GENERIC' })
    } finally {
      unsubscribe()
    }
  },

  showXmlGuide: () => {
    // Land on the friendly "couldn't find Rekordbox" guide without running
    // auto-detect. importError stays null so it reads as a how-to, not a failure.
    set({
      importState: 'not-detected',
      detection: null,
      importProgress: null,
      importError: null
    })
  },

  resetImportFlow: () => {
    set({
      importState: 'idle',
      detection: null,
      importProgress: null,
      importError: null
    })
  },

  checkStale: async () => {
    try {
      const status = await window.setsense.checkRekordboxStale()
      set({ libraryStale: status.stale })
    } catch (err) {
      console.error('[libraryStore] checkStale failed', err)
    }
  }
}))
