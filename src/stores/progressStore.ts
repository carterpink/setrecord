import { create } from 'zustand'
import type { FirstEvent, ProgressState } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'

const DEFAULT_PROGRESS: ProgressState = {
  firstImportAt: null,
  firstSuggestionSeenAt: null,
  firstSetStartedAt: null,
  firstExportAt: null,
  milestonesSeen: [],
  lastActiveWeek: null,
  currentStreak: 0,
  longestStreak: 0,
  checklistDismissed: false
}

/**
 * True in browser preview AND in tests/older builds where `window.setsense`
 * exists but predates the progress API. Checking for one progress method (they
 * ship together) lets every action fall back to local state instead of throwing.
 */
function bridgeMissing(): boolean {
  return (
    typeof window === 'undefined' ||
    typeof window.setsense === 'undefined' ||
    typeof window.setsense.progressGet !== 'function'
  )
}

const FIELD_FOR: Record<FirstEvent, keyof ProgressState> = {
  import: 'firstImportAt',
  suggestion: 'firstSuggestionSeenAt',
  set: 'firstSetStartedAt',
  export: 'firstExportAt'
}

interface ProgressStoreState {
  progress: ProgressState
  loaded: boolean
  hydrate: () => Promise<void>
  /** Record an activation event the first time it happens (write-once in main). */
  markFirst: (event: FirstEvent) => Promise<void>
  /** Mark the current week active and roll the weekly streak forward. */
  recordActivity: () => Promise<void>
  /** Claim a one-time milestone celebration; resolves true only on the first claim. */
  claimMilestone: (id: string) => Promise<boolean>
  dismissChecklist: () => Promise<void>
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  progress: DEFAULT_PROGRESS,
  loaded: false,

  hydrate: async () => {
    if (bridgeMissing()) {
      set({ progress: DEFAULT_PROGRESS, loaded: true })
      return
    }
    try {
      const progress = await window.setsense.progressGet()
      set({ progress, loaded: true })
    } catch {
      set({ progress: DEFAULT_PROGRESS, loaded: true })
    }
  },

  markFirst: async (event) => {
    // Skip the IPC round-trip once the timestamp exists — it's write-once anyway.
    if (get().progress[FIELD_FOR[event]]) return
    if (bridgeMissing()) {
      set((s) => ({ progress: { ...s.progress, [FIELD_FOR[event]]: new Date().toISOString() } }))
      return
    }
    const progress = await window.setsense.progressMarkFirst(event)
    set({ progress })
  },

  recordActivity: async () => {
    if (bridgeMissing()) return
    const progress = await window.setsense.progressRecordActivity()
    set({ progress })
  },

  claimMilestone: async (id) => {
    if (get().progress.milestonesSeen.includes(id)) return false
    if (bridgeMissing()) {
      set((s) => ({
        progress: { ...s.progress, milestonesSeen: [...s.progress.milestonesSeen, id] }
      }))
      return true
    }
    const claimed = await window.setsense.progressClaimMilestone(id)
    if (claimed) {
      set((s) => ({
        progress: { ...s.progress, milestonesSeen: [...s.progress.milestonesSeen, id] }
      }))
    }
    return claimed
  },

  dismissChecklist: async () => {
    set((s) => ({ progress: { ...s.progress, checklistDismissed: true } }))
    if (!bridgeMissing()) await window.setsense.progressSet({ checklistDismissed: true })
  }
}))

export interface ChecklistStep {
  id: 'welcome' | 'import' | 'suggestion' | 'set'
  label: string
  done: boolean
}

/**
 * The onboarding checklist with "endowed progress" — step 1 ("Welcome") ships
 * pre-completed so the bar never starts at 0%, which measurably lifts completion
 * (Nunes & Drèze, 2006). The import step also counts a library loaded before
 * this feature existed.
 */
export function useChecklistSteps(): ChecklistStep[] {
  const progress = useProgressStore((s) => s.progress)
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  return [
    { id: 'welcome', label: 'Welcome to SetSense', done: true },
    {
      id: 'import',
      label: 'Load your library',
      done: Boolean(progress.firstImportAt) || hasLibrary
    },
    {
      id: 'suggestion',
      label: 'See what mixes next',
      done: Boolean(progress.firstSuggestionSeenAt)
    },
    { id: 'set', label: 'Start a set', done: Boolean(progress.firstSetStartedAt) }
  ]
}

/** Activation = imported a library, saw a suggestion, and started a set. */
export function useActivationComplete(): boolean {
  const progress = useProgressStore((s) => s.progress)
  const hasLibrary = useLibraryStore((s) => s.hasLibrary)
  return (
    (Boolean(progress.firstImportAt) || hasLibrary) &&
    Boolean(progress.firstSuggestionSeenAt) &&
    Boolean(progress.firstSetStartedAt)
  )
}

/**
 * Library-completeness % from analysed metadata. Counts tracks that have a key,
 * a BPM, and a non-pending energy score. Returns null when there's no library.
 * Per endowed-progress, callers should floor the displayed value above 0 once a
 * library exists — an imported, partly-analysed library is already real progress.
 */
export function useCompleteness(): { percent: number; pendingEnergy: number } | null {
  const stats = useLibraryStore((s) => s.stats)
  if (!stats || stats.totalTracks === 0) return null
  const total = stats.totalTracks
  // Each missing dimension subtracts from a perfect score, averaged across the
  // three analysed dimensions (key, bpm, energy).
  const complete =
    (total - stats.tracksWithoutKey) / total +
    (total - stats.tracksWithoutBpm) / total +
    (total - stats.tracksWithPendingEnergy) / total
  const percent = Math.round((complete / 3) * 100)
  return { percent, pendingEnergy: stats.tracksWithPendingEnergy }
}
