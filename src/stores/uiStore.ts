import { create } from 'zustand'
import type { AppMode, LanguagePreference, Track } from '@/types'
import type { ProFeature } from '@/utils/entitlements'
import { usePlaybackStore } from '@/stores/playbackStore'
import { applyLanguagePreference } from '@/i18n'

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
  /** License key delivered via a setrecord://activate deep-link, awaiting auto-activation. */
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
  setLibraryDensity: (v: 'standard' | 'compact') => void
  /** Key notation display preference. */
  keyNotation: 'camelot' | 'standard'
  setKeyNotation: (v: 'camelot' | 'standard') => void
  /** Freeze decorative animation (aurora drift, etc.). Mirrors AppSettings. */
  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void
  /** Which workspace SetRecord opens to on launch. 'last' restores the previous session. */
  launchMode: 'last' | AppMode
  setLaunchMode: (v: 'last' | AppMode) => void
  /** Enable the on-device push-to-talk voice input in the Home box. Mirrors AppSettings. */
  voiceInputEnabled: boolean
  setVoiceInputEnabled: (v: boolean) => void
  /** UI language preference. 'system' follows the OS locale. Hydrated on boot. */
  language: LanguagePreference
  setLanguage: (v: LanguagePreference) => void
  playlistSidebarCollapsed: boolean
  togglePlaylistSidebar: () => void
  // Incremented each time ⌘K is pressed — panels watch this to focus search
  searchFocusTick: number
  requestSearchFocus: () => void
  onboardingVisible: boolean
  showOnboarding: () => void
  hideOnboarding: () => void
  /** True once the user finished or skipped onboarding — gates the first-run modal. */
  hasCompletedOnboarding: boolean
  /** Persist completion and dismiss the onboarding modal in one call. */
  completeOnboarding: () => void
  // Background energy analysis status — null when idle, populated while the
  // analyser is draining the pending queue.
  energyAnalysis: { processed: number; total: number } | null
  setEnergyAnalysis: (status: { processed: number; total: number } | null) => void
  mode: AppMode
  setMode: (mode: AppMode) => void
  // Learn Mode — premium educational overlay (mirrors AppSettings, hydrated on boot)
  learnModeEnabled: boolean
  setLearnModeEnabled: (v: boolean) => void
  /**
   * Self-identified beginner. Distinct from Learn Mode: this unlocks the *free*
   * basic jargon explainers so beginners keep them after the trial lapses.
   */
  isBeginner: boolean
  setIsBeginner: (v: boolean) => void
  hydrateFromSettings: (s: {
    learnModeEnabled: boolean
    isBeginner: boolean
    hasCompletedOnboarding: boolean
    language: LanguagePreference
    keyNotation: 'camelot' | 'standard'
    reducedMotion: boolean
    launchMode: 'last' | AppMode
    voiceInputEnabled: boolean
  }) => void
  /** Suggestions panel source pool — independent of the library sidebar filter. */
  suggestionsSourcePlaylistIds: string[]
  setSuggestionsSourcePlaylistIds: (ids: string[]) => void
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('setrecord-playlist-sidebar') === 'collapsed'
}

function getInitialMode(): AppMode {
  // "Home" is the conversational front door; "Library" is the analytical
  // workspace; "Build" is the set-builder. Migrate legacy persisted values:
  // Recall/Discover → Home, Prepare → Build, old "Library" front-door → Home.
  if (typeof window === 'undefined') return 'Home'
  // An explicit "open to ___" launch preference wins over last-session restore.
  const launch = window.localStorage.getItem('setrecord-launch-mode')
  if (launch === 'Home' || launch === 'Library' || launch === 'Build') return launch as AppMode
  const saved = window.localStorage.getItem('setrecord-mode')
  if (saved === 'Prepare' || saved === 'Build') return 'Build'
  if (saved === 'Home' || saved === 'Library' || saved === 'Build') return saved as AppMode
  return 'Home'
}

function getInitialLibraryDensity(): 'standard' | 'compact' {
  if (typeof window === 'undefined') return 'standard'
  return window.localStorage.getItem('setrecord-library-density') === 'compact'
    ? 'compact'
    : 'standard'
}

function getInitialKeyNotation(): 'camelot' | 'standard' {
  if (typeof window === 'undefined') return 'camelot'
  return window.localStorage.getItem('setrecord-key-notation') === 'standard'
    ? 'standard'
    : 'camelot'
}

function getInitialReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('setrecord-reduced-motion') === 'true'
}

function getInitialLaunchMode(): 'last' | AppMode {
  if (typeof window === 'undefined') return 'last'
  const v = window.localStorage.getItem('setrecord-launch-mode')
  return v === 'Home' || v === 'Library' || v === 'Build' ? (v as AppMode) : 'last'
}

function getInitialVoiceInput(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem('setrecord-voice-input') !== 'off'
}

/** Toggle the document-level reduced-motion class that gates decorative CSS animation. */
function applyReducedMotionClass(on: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('ss-reduce-motion', on)
}

function getInitialSuggestionsSource(): string[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem('setrecord-suggestions-source')
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
        window.localStorage.setItem('setrecord-library-density', next)
      }
      return { libraryDensity: next }
    }),
  setLibraryDensity: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-library-density', v)
    }
    set({ libraryDensity: v })
  },
  keyNotation: getInitialKeyNotation(),
  setKeyNotation: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-key-notation', v)
    }
    set({ keyNotation: v })
    // Persist to AppSettings (source of truth) so it travels with backups and
    // stays consistent across machines — the localStorage write above is only a
    // fast first-paint cache.
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ keyNotation: v })
    }
  },
  reducedMotion: getInitialReducedMotion(),
  setReducedMotion: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-reduced-motion', v ? 'true' : 'false')
    }
    applyReducedMotionClass(v)
    set({ reducedMotion: v })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ reducedMotion: v })
    }
  },
  launchMode: getInitialLaunchMode(),
  setLaunchMode: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-launch-mode', v)
    }
    set({ launchMode: v })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ launchMode: v })
    }
  },
  voiceInputEnabled: getInitialVoiceInput(),
  setVoiceInputEnabled: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-voice-input', v ? 'on' : 'off')
    }
    set({ voiceInputEnabled: v })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ voiceInputEnabled: v })
    }
  },
  // Mirrors AppSettings.language; the real value is hydrated on boot in AppShell.
  // Defaults to 'system' so first paint follows the OS locale (set in i18n init).
  language: 'system',
  setLanguage: (v) => {
    set({ language: v })
    applyLanguagePreference(v)
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ language: v })
    }
  },
  playlistSidebarCollapsed: getInitialSidebarCollapsed(),
  togglePlaylistSidebar: () =>
    set((s) => {
      const next = !s.playlistSidebarCollapsed
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('setrecord-playlist-sidebar', next ? 'collapsed' : 'expanded')
      }
      return { playlistSidebarCollapsed: next }
    }),
  searchFocusTick: 0,
  requestSearchFocus: () => set((s) => ({ searchFocusTick: s.searchFocusTick + 1 })),
  onboardingVisible: false,
  showOnboarding: () => set({ onboardingVisible: true }),
  hideOnboarding: () => set({ onboardingVisible: false }),
  hasCompletedOnboarding: false,
  completeOnboarding: () => {
    set({ hasCompletedOnboarding: true, onboardingVisible: false })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ hasCompletedOnboarding: true })
    }
  },
  energyAnalysis: null,
  setEnergyAnalysis: (status) => set({ energyAnalysis: status }),
  mode: getInitialMode(),
  setMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-mode', mode)
    }
    // Stop any in-flight preview so audio (and the global spacebar shortcut)
    // doesn't leak across tabs when leaving the panel that started it.
    usePlaybackStore.getState().stopPreview()
    set({ mode, openModal: null })
  },
  learnModeEnabled: false,
  setLearnModeEnabled: (v) => {
    set({ learnModeEnabled: v })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ learnModeEnabled: v })
    }
  },
  isBeginner: false,
  setIsBeginner: (v) => {
    set({ isBeginner: v })
    if (typeof window !== 'undefined' && window.setrecord) {
      void window.setrecord.setSettings({ isBeginner: v })
    }
  },
  hydrateFromSettings: ({
    learnModeEnabled,
    isBeginner,
    hasCompletedOnboarding,
    language,
    keyNotation,
    reducedMotion,
    launchMode,
    voiceInputEnabled
  }) => {
    applyLanguagePreference(language)
    applyReducedMotionClass(reducedMotion)
    set({
      learnModeEnabled,
      isBeginner,
      hasCompletedOnboarding,
      language,
      keyNotation,
      reducedMotion,
      launchMode,
      voiceInputEnabled
    })
  },
  suggestionsSourcePlaylistIds: getInitialSuggestionsSource(),
  setSuggestionsSourcePlaylistIds: (ids) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('setrecord-suggestions-source', JSON.stringify(ids))
    }
    set({ suggestionsSourcePlaylistIds: ids })
  }
}))

// Apply the persisted reduced-motion preference before first paint so
// motion-sensitive users don't see a frame of aurora drift on boot.
applyReducedMotionClass(getInitialReducedMotion())

// Dev aid: expose the UI store so tooling can drive modals during local testing.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __ssUiStore?: typeof useUiStore }).__ssUiStore = useUiStore
}
