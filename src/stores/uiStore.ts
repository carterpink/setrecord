import { create } from 'zustand'
import type { AppMode, Track } from '@/types'
import type { ProFeature } from '@/utils/entitlements'
import { usePlaybackStore } from '@/stores/playbackStore'

type ModalName =
  | 'import'
  | 'architect'
  | 'cueEditor'
  | 'validate'
  | 'export'
  | 'settings'
  | 'feedback'
  | 'postGigPrompt'
  | 'upgrade'
  | 'identityReady'

interface PostGigPromptData {
  sessionId: string
  setName: string
  tracks: Track[]
}

interface UIState {
  openModal: ModalName | null
  showModal: (name: ModalName) => void
  /** Which view the ImportModal opens into. 'guide' jumps straight to the XML walkthrough. */
  importInitialView: 'auto' | 'guide'
  /** Open the import flow directly on the "How to export Rekordbox XML" guide. */
  showImportGuide: () => void
  closeModal: () => void
  postGigPromptData: PostGigPromptData | null
  showPostGigPrompt: (data: PostGigPromptData) => void
  /** The Pro feature that triggered the paywall, for contextual upgrade copy. */
  upgradeContext: ProFeature | null
  showUpgrade: (feature?: ProFeature) => void
  /** License key delivered via a setsense://activate deep-link, awaiting auto-activation. */
  pendingActivationKey: string | null
  showUpgradeWithKey: (key: string) => void
  clearPendingActivationKey: () => void
  smartFilter: boolean
  toggleSmartFilter: () => void
  /** Rekordbox playlist filter for the library list. null = "All Tracks". */
  selectedPlaylistId: string | null
  setSelectedPlaylist: (id: string | null) => void
  /** Library track selected for suggestions (when no timeline track is selected). */
  selectedLibraryTrackId: string | null
  setSelectedLibraryTrack: (id: string | null) => void
  /** Library row density — standard 56px or compact 40px. */
  libraryDensity: 'standard' | 'compact'
  toggleLibraryDensity: () => void
  /** Key notation display preference. */
  keyNotation: 'camelot' | 'standard'
  setKeyNotation: (v: 'camelot' | 'standard') => void
  playlistSidebarCollapsed: boolean
  togglePlaylistSidebar: () => void
  // Incremented each time ⌘K is pressed — panels watch this to focus search
  searchFocusTick: number
  requestSearchFocus: () => void
  onboardingVisible: boolean
  showOnboarding: () => void
  hideOnboarding: () => void
  lightMode: boolean
  toggleLightMode: () => void
  // Background energy analysis status — null when idle, populated while the
  // analyser is draining the pending queue.
  energyAnalysis: { processed: number; total: number } | null
  setEnergyAnalysis: (status: { processed: number; total: number } | null) => void
  mode: AppMode
  setMode: (mode: AppMode) => void
  // Learn Mode — premium educational overlay (mirrors AppSettings, hydrated on boot)
  learnModeEnabled: boolean
  setLearnModeEnabled: (v: boolean) => void
  hydrateFromSettings: (s: { learnModeEnabled: boolean }) => void
  /** Suggestions panel source pool — independent of the library sidebar filter. */
  suggestionsSourcePlaylistIds: string[]
  setSuggestionsSourcePlaylistIds: (ids: string[]) => void
}

function getInitialLightMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('setsense-theme') === 'light'
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('setsense-playlist-sidebar') === 'collapsed'
}

function getInitialMode(): AppMode {
  if (typeof window === 'undefined') return 'Prepare'
  const saved = window.localStorage.getItem('setsense-mode')
  if (saved === 'Recall') return 'Recall'
  return 'Prepare'
}

function getInitialLibraryDensity(): 'standard' | 'compact' {
  if (typeof window === 'undefined') return 'standard'
  return window.localStorage.getItem('setsense-library-density') === 'compact'
    ? 'compact'
    : 'standard'
}

function getInitialKeyNotation(): 'camelot' | 'standard' {
  if (typeof window === 'undefined') return 'camelot'
  return window.localStorage.getItem('setsense-key-notation') === 'standard'
    ? 'standard'
    : 'camelot'
}

function getInitialSuggestionsSource(): string[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem('setsense-suggestions-source')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export const useUiStore = create<UIState>((set) => ({
  openModal: null,
  showModal: (name) => set({ openModal: name, importInitialView: 'auto' }),
  importInitialView: 'auto',
  showImportGuide: () => set({ openModal: 'import', importInitialView: 'guide' }),
  closeModal: () =>
    set((s) => ({
      openModal: null,
      importInitialView: 'auto' as const,
      // Drop post-gig data so a stale list can't reappear next open
      postGigPromptData: s.openModal === 'postGigPrompt' ? null : s.postGigPromptData,
      // Drop a consumed deep-link key when the upgrade modal closes
      pendingActivationKey: s.openModal === 'upgrade' ? null : s.pendingActivationKey
    })),
  postGigPromptData: null,
  showPostGigPrompt: (data) => set({ postGigPromptData: data, openModal: 'postGigPrompt' }),
  upgradeContext: null,
  showUpgrade: (feature) => set({ upgradeContext: feature ?? null, openModal: 'upgrade' }),
  pendingActivationKey: null,
  showUpgradeWithKey: (key) =>
    set({ pendingActivationKey: key, upgradeContext: null, openModal: 'upgrade' }),
  clearPendingActivationKey: () => set({ pendingActivationKey: null }),
  smartFilter: false,
  toggleSmartFilter: () => set((s) => ({ smartFilter: !s.smartFilter })),
  selectedPlaylistId: null,
  setSelectedPlaylist: (id) => set({ selectedPlaylistId: id }),
  selectedLibraryTrackId: null,
  setSelectedLibraryTrack: (id) => set({ selectedLibraryTrackId: id }),
  libraryDensity: getInitialLibraryDensity(),
  toggleLibraryDensity: () =>
    set((s) => {
      const next: 'standard' | 'compact' = s.libraryDensity === 'standard' ? 'compact' : 'standard'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('setsense-library-density', next)
      }
      return { libraryDensity: next }
    }),
  keyNotation: getInitialKeyNotation(),
  setKeyNotation: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setsense-key-notation', v)
    }
    set({ keyNotation: v })
  },
  playlistSidebarCollapsed: getInitialSidebarCollapsed(),
  togglePlaylistSidebar: () =>
    set((s) => {
      const next = !s.playlistSidebarCollapsed
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('setsense-playlist-sidebar', next ? 'collapsed' : 'expanded')
      }
      return { playlistSidebarCollapsed: next }
    }),
  searchFocusTick: 0,
  requestSearchFocus: () => set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })),
  onboardingVisible: false,
  showOnboarding: () => set({ onboardingVisible: true }),
  hideOnboarding: () => set({ onboardingVisible: false }),
  lightMode: getInitialLightMode(),
  toggleLightMode: () =>
    set((s) => {
      const lightMode = !s.lightMode
      window.localStorage.setItem('setsense-theme', lightMode ? 'light' : 'dark')
      return { lightMode }
    }),
  energyAnalysis: null,
  setEnergyAnalysis: (status) => set({ energyAnalysis: status }),
  mode: getInitialMode(),
  setMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setsense-mode', mode)
    }
    // Stop any in-flight preview so audio (and the global spacebar shortcut)
    // doesn't leak across tabs when leaving the panel that started it.
    usePlaybackStore.getState().stopPreview()
    set({ mode, openModal: null })
  },
  learnModeEnabled: false,
  setLearnModeEnabled: (v) => {
    set({ learnModeEnabled: v })
    if (typeof window !== 'undefined' && window.setsense) {
      void window.setsense.setSettings({ learnModeEnabled: v })
    }
  },
  hydrateFromSettings: ({ learnModeEnabled }) => set({ learnModeEnabled }),
  suggestionsSourcePlaylistIds: getInitialSuggestionsSource(),
  setSuggestionsSourcePlaylistIds: (ids) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setsense-suggestions-source', JSON.stringify(ids))
    }
    set({ suggestionsSourcePlaylistIds: ids })
  }
}))

// Dev aid: expose the UI store so tooling can drive modals during local testing.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __ssUiStore?: typeof useUiStore }).__ssUiStore = useUiStore
}
