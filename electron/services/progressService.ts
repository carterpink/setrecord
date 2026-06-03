/**
 * Local persistence for the retention / activation layer (brief #22, Phase B).
 *
 * Tracks the Hook-Model activation funnel (first import → first suggestion seen
 * → first set started → first export), gentle milestone celebrations, a weekly
 * activity streak, and onboarding-checklist dismissal.
 *
 * Design notes:
 *  - The streak is WEEKLY, not daily. DJs prep in bursts and gig weekly, so a
 *    daily login streak would be both ineffective and a guilt-inducing dark
 *    pattern. We count consecutive *active weeks* and never nag about breaking
 *    one — the renderer shows it as a quiet badge, nothing more.
 *  - All date math runs here in the main process so winding the system clock
 *    can't be exploited and the renderer stays clock-agnostic.
 *  - Activation timestamps are write-once; milestones are claimed atomically so
 *    a celebration fires at most once.
 */

import ElectronStore from 'electron-store'
import type { ProgressState, FirstEvent } from '../../src/types'

export type { ProgressState, FirstEvent }

const DEFAULTS: ProgressState = {
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

const store = new ElectronStore<ProgressState>({ name: 'progress', defaults: DEFAULTS })

const FIRST_FIELD: Record<FirstEvent, keyof ProgressState> = {
  import: 'firstImportAt',
  suggestion: 'firstSuggestionSeenAt',
  set: 'firstSetStartedAt',
  export: 'firstExportAt'
}

/**
 * Monday-based week index since the Unix epoch. The epoch (1970-01-01) was a
 * Thursday, so we shift by +3 days to make each new week tick over on Monday.
 * Consecutive weeks differ by exactly 1, which is all the streak logic needs.
 */
export function weekOrdinal(nowMs: number): number {
  const dayNumber = Math.floor(nowMs / 86_400_000)
  return Math.floor((dayNumber + 3) / 7)
}

export function getProgress(): ProgressState {
  return {
    firstImportAt: store.get('firstImportAt') ?? null,
    firstSuggestionSeenAt: store.get('firstSuggestionSeenAt') ?? null,
    firstSetStartedAt: store.get('firstSetStartedAt') ?? null,
    firstExportAt: store.get('firstExportAt') ?? null,
    milestonesSeen: store.get('milestonesSeen') ?? [],
    lastActiveWeek: store.get('lastActiveWeek') ?? null,
    currentStreak: store.get('currentStreak') ?? 0,
    longestStreak: store.get('longestStreak') ?? 0,
    checklistDismissed: store.get('checklistDismissed') ?? false
  }
}

/** Generic merge for plain fields (e.g. checklistDismissed). */
export function setProgress(partial: Partial<ProgressState>): ProgressState {
  if (partial.checklistDismissed !== undefined)
    store.set('checklistDismissed', partial.checklistDismissed)
  return getProgress()
}

/** Record an activation event the first time it happens; later calls are no-ops. */
export function markFirst(event: FirstEvent, nowMs: number = Date.now()): ProgressState {
  const field = FIRST_FIELD[event]
  if (!store.get(field)) store.set(field, new Date(nowMs).toISOString())
  return getProgress()
}

/**
 * Claim a milestone celebration. Returns true only on the first claim, so the
 * renderer fires a toast exactly once. Idempotent thereafter.
 */
export function claimMilestone(id: string): boolean {
  const seen = store.get('milestonesSeen') ?? []
  if (seen.includes(id)) return false
  store.set('milestonesSeen', [...seen, id])
  return true
}

/**
 * Pure weekly-streak transition. Same week → unchanged; immediately-previous
 * week → extend; any other gap → reset to 1. Extracted so the streak rules can
 * be unit-tested without touching the electron-store singleton.
 */
export function computeStreak(
  lastActiveWeek: number | null,
  currentStreak: number,
  wk: number
): { currentStreak: number; changed: boolean } {
  if (lastActiveWeek === wk) return { currentStreak, changed: false }
  return { currentStreak: lastActiveWeek === wk - 1 ? currentStreak + 1 : 1, changed: true }
}

/**
 * Mark this week active and update the weekly streak. Same week → no change;
 * immediately-previous week → extend; any gap → reset to 1.
 */
export function recordActivity(nowMs: number = Date.now()): ProgressState {
  const wk = weekOrdinal(nowMs)
  const last = store.get('lastActiveWeek') ?? null
  const { currentStreak, changed } = computeStreak(last, store.get('currentStreak') ?? 0, wk)
  if (changed) {
    store.set('currentStreak', currentStreak)
    store.set('lastActiveWeek', wk)
    const longest = store.get('longestStreak') ?? 0
    if (currentStreak > longest) store.set('longestStreak', currentStreak)
  }
  return getProgress()
}

/** Wipe all progress (test-only / "reset onboarding" support). */
export function clearProgress(): void {
  store.set(DEFAULTS)
}
