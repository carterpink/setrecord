import { create } from 'zustand'
import { search as fuzzySearch } from 'fast-fuzzy'
import type {
  CuePoint,
  EnergySource,
  HotCue,
  Loop,
  ImportProgress,
  LibrarySourceId,
  LibraryStats,
  Playlist,
  RekordboxDetection,
  SourceDetection,
  TagCategory,
  Track,
  TrackTag
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
 *   - idle:          modal closed, nothing in progress
 *   - source-picker: choosing a DJ-software source (Rekordbox / Serato / …)
 *   - detecting:     running rekordbox:detect
 *   - detected:      master.db found, awaiting user confirmation
 *   - source-detected: payload source (Serato/Engine) found, awaiting confirmation
 *   - not-detected:  no usable Rekordbox install — show XML guide
 *   - importing:     actively reading + writing (progress events come in)
 *   - done:          finished, stats screen
 */
export type ImportState =
  | 'idle'
  | 'source-picker'
  | 'detecting'
  | 'detected'
  // Confirm screen for a payload-routed source (Serato, Engine DJ).
  | 'source-detected'
  | 'not-detected'
  | 'importing'
  | 'done'

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
  /** All detected DJ-software sources (drives the source picker). */
  availableSources: SourceDetection[]
  /** Which source the user picked in the source picker. */
  selectedSourceId: LibrarySourceId | null
  /** True when an in-place re-sync is available (master.db newer than last import). */
  libraryStale: boolean
  /** Error code from a failed import — drives "DB locked" / "key mismatch" UI. */
  importError: 'REKORDBOX_LOCKED' | 'REKORDBOX_KEY_MISMATCH' | 'GENERIC' | null

  loadLibrary: () => Promise<void>
  setSearchQuery: (q: string) => void
  /** Detect all sources and show the picker — the canonical Import entry point. */
  startImportFlow: () => Promise<void>
  /** Pick a source from the picker and route into its import flow. */
  selectSource: (id: LibrarySourceId) => Promise<void>
  /** Confirm a detected payload-routed library (Serato, Engine DJ) and import it. */
  confirmSourceImport: () => Promise<void>
  /** Kick off the Rekordbox auto-detect flow — used by Onboarding + TopBar + Settings Re-sync. */
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
  /** Replace a track's tags locally (optimistic / after an override round-trip). */
  patchTrackTags: (trackId: string, tags: TrackTag[]) => void
  /** Set one tag category from a user override (Pro), persisting + patching. */
  setTrackTags: (trackId: string, category: TagCategory, values: string[]) => Promise<void>
  /** Clear a user override so the category re-infers (Pro). */
  resetTrackTagsToAuto: (trackId: string, category?: TagCategory) => Promise<void>
  updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }) => Promise<void>
  // ── Bulk operations (power-user multi-select) ─────────────────────────────
  /** Bulk-edit metadata across many tracks (Pro). Resolves false if not entitled. */
  bulkUpdateMeta: (
    ids: string[],
    patch: {
      bpm?: number
      key?: string
      genre?: string
      rating?: number
      color?: string
      comment?: string
    }
  ) => Promise<boolean>
  /** Bulk-set energy across many tracks (Pro). */
  bulkSetEnergy: (ids: string[], energy: number) => Promise<boolean>
  /** Bulk tag edit for one category across many tracks (Pro). */
  bulkSetTags: (
    ids: string[],
    category: TagCategory,
    values: string[],
    mode: 'add' | 'remove' | 'replace'
  ) => Promise<boolean>
  /** Remove many tracks from the DB only (files untouched). Returns removed rows for Undo. */
  bulkDelete: (ids: string[]) => Promise<Track[]>
  /** Re-insert removed tracks (Undo). */
  bulkRestore: (tracks: Track[]) => Promise<void>
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
  availableSources: [],
  selectedSourceId: null,
  libraryStale: false,
  importError: null,

  loadLibrary: async () => {
    set({ isLoading: true })
    try {
      // Fetch tracks + playlists in parallel — both come from the same DB but the
      // round trips overlap, and the index can build while React rerenders the list.
      const [raw, playlists] = await Promise.all([
        window.setrecord.getLibrary(),
        window.setrecord.getPlaylists().catch(() => [] as Playlist[])
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
    await window.setrecord.setTrackEnergy(trackId, clamped)
  },

  patchTrackTags: (trackId, tags) => {
    const patch = (arr: Track[]): Track[] => arr.map((t) => (t.id === trackId ? { ...t, tags } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
  },

  setTrackTags: async (trackId, category, values) => {
    const updated = await window.setrecord.tagsSetOverride(trackId, category, values)
    if (updated) get().patchTrackTags(trackId, updated)
  },

  resetTrackTagsToAuto: async (trackId, category) => {
    const updated = await window.setrecord.tagsResetToAuto(trackId, category)
    if (updated) get().patchTrackTags(trackId, updated)
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
    await window.setrecord.updateTrackMeta(trackId, fields)
  },

  bulkUpdateMeta: async (ids, fields) => {
    const ok = await window.setrecord.tracksBulkUpdateMeta(ids, fields)
    if (!ok) return false
    const idSet = new Set(ids)
    const delta: Partial<Track> = {
      ...(fields.bpm != null ? { bpm: fields.bpm } : {}),
      ...(fields.key != null ? { key: fields.key } : {}),
      ...(fields.genre != null ? { genre: fields.genre } : {}),
      ...(fields.rating != null ? { rating: fields.rating } : {}),
      ...(fields.color != null ? { color: fields.color } : {}),
      ...(fields.comment != null ? { comment: fields.comment } : {})
    }
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) => (idSet.has(t.id) ? { ...t, ...delta } : t))
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
    return true
  },

  bulkSetEnergy: async (ids, energy) => {
    const clamped = Math.max(1, Math.min(10, Math.round(energy)))
    const ok = await window.setrecord.tracksBulkSetEnergy(ids, clamped)
    if (!ok) return false
    const idSet = new Set(ids)
    const patch = (arr: Track[]): Track[] =>
      arr.map((t) =>
        idSet.has(t.id) ? { ...t, energy: clamped, energySource: 'user' as EnergySource } : t
      )
    set((s) => ({ tracks: patch(s.tracks), searchResults: patch(s.searchResults) }))
    return true
  },

  bulkSetTags: async (ids, category, values, mode) => {
    const ok = await window.setrecord.tracksBulkSetTags(ids, category, values, mode)
    if (!ok) return false
    // Tags aren't patched optimistically (the merge logic lives in main) — reload
    // so the Tags view and per-track tags reflect the new state. Selection survives
    // (ids remain valid, so the retain guard keeps them).
    await get().loadLibrary()
    return true
  },

  bulkDelete: async (ids) => {
    const { removed } = await window.setrecord.tracksDelete(ids)
    const idSet = new Set(ids)
    const filter = (arr: Track[]): Track[] => arr.filter((t) => !idSet.has(t.id))
    set((s) => {
      const tracks = filter(s.tracks)
      return { tracks, searchResults: filter(s.searchResults), hasLibrary: tracks.length > 0 }
    })
    return removed
  },

  bulkRestore: async (tracks) => {
    await window.setrecord.tracksRestore(tracks)
    await get().loadLibrary()
  },

  relinkTrackFile: async (trackId) => {
    const filePath = await window.setrecord.relinkTrackFile(trackId)
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
    await window.setrecord.triggerHealthCheck()
  },

  startImportFlow: async () => {
    set({
      importState: 'detecting',
      detection: null,
      availableSources: [],
      selectedSourceId: null,
      importProgress: null,
      importError: null
    })
    try {
      const sources = await window.setrecord.detectImportSources()
      set({ availableSources: sources, importState: 'source-picker' })
    } catch (err) {
      console.error('[libraryStore] detectImportSources failed', err)
      // Fall back to the Rekordbox-only flow so import still works.
      await get().startAutoDetectFlow()
    }
  },

  selectSource: async (id) => {
    set({ selectedSourceId: id })
    if (id === 'rekordbox') {
      // Rekordbox owns its native consent-gated detect/import flow.
      await get().startAutoDetectFlow()
      return
    }
    // Payload-routed sources (Serato, Engine DJ): show the confirm screen when a
    // readable library was detected, else bounce back to the picker.
    const source = get().availableSources.find((s) => s.sourceId === id)
    if (source?.installed && !source.readError && source.libraryPath) {
      set({ importState: 'source-detected' })
    } else {
      set({ importState: 'source-picker' })
    }
  },

  confirmSourceImport: async () => {
    const id = get().selectedSourceId
    if (!id || id === 'rekordbox') return
    const source = get().availableSources.find((s) => s.sourceId === id)
    if (!source?.libraryPath) return

    set({ importState: 'importing', importProgress: null, importError: null })
    const unsubscribe = window.setrecord.onImportProgress((p) => set({ importProgress: p }))
    try {
      const result = await window.setrecord.runImport(id, source.libraryPath)
      set({ stats: result.stats, importState: 'done', libraryStale: false })
      void useLicenseStore.getState().hydrate()
      await get().loadLibrary()
      // Cues/beatgrids stream in via a background pass — reload when it finishes.
      const stop = window.setrecord.onPostImportProgress((p) => {
        if (p.phase === 'done') {
          stop()
          void get().loadLibrary()
        }
      })
    } catch (err) {
      console.error('[libraryStore] runImport failed for', id, err)
      set({ importState: 'source-picker', importError: 'GENERIC' })
    } finally {
      unsubscribe()
    }
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
      const detection = await window.setrecord.detectRekordbox()
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
    const unsubscribe = window.setrecord.onImportProgress((p) => {
      set({ importProgress: p })
    })
    try {
      const result = await window.setrecord.importFromRekordboxDb(detection.dbPath)
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
    const xmlPath = await window.setrecord.selectXmlFile()
    if (!xmlPath) return

    set({ importState: 'importing', importProgress: null, importError: null })
    const unsubscribe = window.setrecord.onImportProgress((p) => {
      set({ importProgress: p })
    })
    try {
      const result = await window.setrecord.importLibrary(xmlPath)
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
      availableSources: [],
      selectedSourceId: null,
      importProgress: null,
      importError: null
    })
  },

  checkStale: async () => {
    try {
      const status = await window.setrecord.checkRekordboxStale()
      set({ libraryStale: status.stale })
    } catch (err) {
      console.error('[libraryStore] checkStale failed', err)
    }
  }
}))
