import { create } from 'zustand'

/**
 * First-sight coachmarks for Learn Mode. A coachmark is a small, one-time
 * annotation that auto-appears the first time a beginner encounters a concept
 * (Camelot key, BPM, energy score, transition dots) and never nags again once
 * dismissed.
 *
 * Two pieces of state:
 *  - `seen`: which coachmarks the user has dismissed, persisted to localStorage
 *    so they don't reappear on next launch.
 *  - `activeOwner` / `activeKey`: a single-slot claim so only ONE coachmark is
 *    ever visible at a time. The first eligible instance to mount claims the
 *    slot; the next one shows only after the first is dismissed.
 */
export type CoachmarkKey = 'camelot' | 'bpm' | 'energy' | 'transition' | 'energyCurve'

const STORAGE_KEY = 'setsense-coachmarks-seen'

function loadSeen(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function persistSeen(seen: Record<string, boolean>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen))
}

interface CoachmarkState {
  seen: Record<string, boolean>
  /** The coachmark key currently holding the single visible slot, if any. */
  activeKey: CoachmarkKey | null
  /** Unique id of the component instance presenting the active coachmark. */
  activeOwner: number | null
  /** Attempt to grab the single visible slot for `key`. No-op if already seen or slot taken. */
  claim: (key: CoachmarkKey, owner: number) => void
  /** Release the slot if `owner` holds it (e.g. on unmount). */
  release: (owner: number) => void
  /** Mark a coachmark seen forever and free the slot. */
  dismiss: (key: CoachmarkKey) => void
  /** Clear all seen state — used by the "Replay tips" Settings action. */
  reset: () => void
}

export const useCoachmarkStore = create<CoachmarkState>((set, get) => ({
  seen: loadSeen(),
  activeKey: null,
  activeOwner: null,
  claim: (key, owner) => {
    const s = get()
    if (s.seen[key]) return
    if (s.activeOwner === owner) return
    if (s.activeKey !== null) return
    set({ activeKey: key, activeOwner: owner })
  },
  release: (owner) =>
    set((s) => (s.activeOwner === owner ? { activeKey: null, activeOwner: null } : s)),
  dismiss: (key) =>
    set((s) => {
      const seen = { ...s.seen, [key]: true }
      persistSeen(seen)
      const clearing = s.activeKey === key
      return {
        seen,
        activeKey: clearing ? null : s.activeKey,
        activeOwner: clearing ? null : s.activeOwner
      }
    }),
  reset: () => {
    persistSeen({})
    set({ seen: {}, activeKey: null, activeOwner: null })
  }
}))

let nextOwnerId = 1
export function nextCoachmarkOwner(): number {
  return nextOwnerId++
}
