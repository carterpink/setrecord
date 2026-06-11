import { create } from 'zustand'

/**
 * Library multi-selection state (power-user features).
 *
 * Holds the set of selected track ids plus a range "anchor" for Shift-click,
 * and a snapshot of the currently-displayed ordered ids so range / select-all
 * can resolve without threading the list through every caller (the global
 * keyboard handler has no view context otherwise).
 *
 * `orderedIds` is published by LibraryPanel and reflects the Collection list as
 * currently filtered/sorted. It is cleared when the library view goes away so a
 * stale Cmd+A can't select ids that aren't on screen.
 */
interface SelectionState {
  /** Selected library track ids. */
  selectedIds: Set<string>
  /** Range anchor — the last single-toggled row. */
  anchorId: string | null
  /** Ordered ids of the currently displayed Collection list (published by LibraryPanel). */
  orderedIds: string[]

  isSelected: (id: string) => boolean
  /** Toggle one id; becomes the new range anchor. */
  toggle: (id: string) => void
  /** Replace the whole selection with a single id. */
  selectOnly: (id: string) => void
  /** Additively select the inclusive range between two ids in `orderedIds`. */
  selectRange: (fromId: string, toId: string) => void
  /** Select every id currently in `orderedIds`. */
  selectAll: () => void
  /** Clear the selection. */
  clear: () => void
  /** Publish the current Collection list ordering (call from LibraryPanel). */
  setOrderedIds: (ids: string[]) => void
  /** Drop ids that no longer exist (after a bulk delete or list change). */
  retain: (validIds: Set<string>) => void
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set(),
  anchorId: null,
  orderedIds: [],

  isSelected: (id) => get().selectedIds.has(id),

  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next, anchorId: id }
    }),

  selectOnly: (id) => set({ selectedIds: new Set([id]), anchorId: id }),

  selectRange: (fromId, toId) =>
    set((s) => {
      const ids = s.orderedIds
      const from = ids.indexOf(fromId)
      const to = ids.indexOf(toId)
      if (from === -1 || to === -1) {
        // Anchor scrolled out of the list — fall back to a single toggle.
        const next = new Set(s.selectedIds)
        next.add(toId)
        return { selectedIds: next, anchorId: toId }
      }
      const [lo, hi] = from <= to ? [from, to] : [to, from]
      const next = new Set(s.selectedIds)
      for (let i = lo; i <= hi; i++) next.add(ids[i])
      // Keep the original anchor so successive Shift-clicks extend from it.
      return { selectedIds: next, anchorId: fromId }
    }),

  selectAll: () => set((s) => ({ selectedIds: new Set(s.orderedIds), anchorId: null })),

  clear: () => set({ selectedIds: new Set(), anchorId: null }),

  setOrderedIds: (ids) => set({ orderedIds: ids }),

  retain: (validIds) =>
    set((s) => {
      let changed = false
      const next = new Set<string>()
      for (const id of s.selectedIds) {
        if (validIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? { selectedIds: next } : {}
    })
}))

/** Reactive count of selected library tracks. */
export function useSelectionCount(): number {
  return useSelectionStore((s) => s.selectedIds.size)
}
