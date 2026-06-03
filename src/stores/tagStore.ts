import { create } from 'zustand'
import type { TagCoverage } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'

/**
 * State for the Tags view: library-wide tag coverage + the re-tag job. Per-track
 * tags live on Track (libraryStore); this store owns the aggregate facets and the
 * "Re-tag library" progress. Progress events are streamed in via onTagsProgress
 * (wired from the Tags view) so the store doesn't hold a listener itself.
 */
interface TagState {
  coverage: TagCoverage | null
  loadingCoverage: boolean
  retagging: boolean
  progress: { processed: number; total: number } | null

  loadCoverage: () => Promise<void>
  /** Start a full-library re-tag. Completion is driven by handleProgress('done'). */
  retag: () => Promise<void>
  /** Feed a tags-progress event; reloads library + coverage when the job finishes. */
  handleProgress: (p: { processed: number; total: number; phase: 'tagging' | 'done' }) => void
}

export const useTagStore = create<TagState>((set, get) => ({
  coverage: null,
  loadingCoverage: false,
  retagging: false,
  progress: null,

  loadCoverage: async () => {
    set({ loadingCoverage: true })
    try {
      const coverage = await window.setsense.tagsCoverage()
      set({ coverage, loadingCoverage: false })
    } catch {
      set({ loadingCoverage: false })
    }
  },

  retag: async () => {
    set({ retagging: true, progress: { processed: 0, total: 0 } })
    try {
      await window.setsense.tagsRetag()
    } catch {
      set({ retagging: false, progress: null })
    }
  },

  handleProgress: (p) => {
    if (p.phase === 'done') {
      set({ retagging: false, progress: null })
      // Pull the freshly re-tagged library + coverage back into the UI.
      void useLibraryStore.getState().loadLibrary()
      void get().loadCoverage()
    } else {
      set({ retagging: true, progress: { processed: p.processed, total: p.total } })
    }
  }
}))
