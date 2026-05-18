import { create } from 'zustand'
import type { AppMode } from '@/types'

type ModalName =
  | 'import'
  | 'architect'
  | 'cueEditor'
  | 'validate'
  | 'export'
  | 'settings'
  | 'setDetails'
  | 'bulkImportConfirm'

interface UIState {
  openModal: ModalName | null
  showModal: (name: ModalName) => void
  closeModal: () => void
  smartFilter: boolean
  toggleSmartFilter: () => void
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
  // Top-level app mode (Prepare = 3-panel set builder, Discover = YouTube set discovery)
  mode: AppMode
  setMode: (mode: AppMode) => void
  // Which discover set is currently open in SetDetailsModal
  activeDiscoverSetId: string | null
  openSetDetails: (setId: string) => void
  // Learn Mode — premium educational overlay (mirrors AppSettings, hydrated on boot)
  learnModeEnabled: boolean
  isPro: boolean
  setLearnModeEnabled: (v: boolean) => void
  hydrateFromSettings: (s: { learnModeEnabled: boolean; isPro: boolean }) => void
}

function getInitialLightMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem('setsense-theme') === 'light'
}

function getInitialMode(): AppMode {
  if (typeof window === 'undefined') return 'Prepare'
  return window.localStorage.getItem('setsense-mode') === 'Discover' ? 'Discover' : 'Prepare'
}

export const useUiStore = create<UIState>((set) => ({
  openModal: null,
  showModal: (name) => set({ openModal: name }),
  closeModal: () => set((s) => ({
    openModal: null,
    // Clear the discover set ref when SetDetailsModal closes so re-opening fetches fresh state
    activeDiscoverSetId: s.openModal === 'setDetails' ? null : s.activeDiscoverSetId,
  })),
  smartFilter: false,
  toggleSmartFilter: () => set((s) => ({ smartFilter: !s.smartFilter })),
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
    // Close any open modal on mode switch and clear the active discover set
    set({ mode, openModal: null, activeDiscoverSetId: null })
  },
  activeDiscoverSetId: null,
  openSetDetails: (setId) => set({ activeDiscoverSetId: setId, openModal: 'setDetails' }),
  learnModeEnabled: false,
  isPro: true,
  setLearnModeEnabled: (v) => {
    set({ learnModeEnabled: v })
    if (typeof window !== 'undefined' && window.setsense) {
      void window.setsense.setSettings({ learnModeEnabled: v })
    }
  },
  hydrateFromSettings: ({ learnModeEnabled, isPro }) =>
    set({ learnModeEnabled, isPro }),
}))
