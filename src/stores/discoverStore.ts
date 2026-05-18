import { create } from 'zustand'
import type {
  DiscoverFilters,
  DiscoverSet,
  DiscoverTrack,
  DiscoverSortMode,
  DiscoverTab,
  TasteProfile,
} from '@/types'
import { MOCK_TASTE_PROFILE, loadDiscoverSets } from '@/data/mockDiscoverSets'
import { deriveClarityReason } from '@/utils/clarityReason'

export type DiscoverErrorCode = 'no_key' | 'quota_exceeded' | 'network' | 'api_error' | 'unknown'

interface DiscoverState {
  sets: DiscoverSet[]
  activeTab: DiscoverTab
  filters: DiscoverFilters
  sortMode: DiscoverSortMode
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  nextPageToken: string | null
  errorCode: DiscoverErrorCode | null
  errorMessage: string | null
  tasteProfile: TasteProfile
  tasteProfileLoaded: boolean
  loadSets: (opts?: { forceRefresh?: boolean }) => Promise<void>
  loadMoreSets: () => Promise<void>
  setActiveTab: (tab: DiscoverTab) => void
  setFilter: <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => void
  resetFilters: () => void
  setSortMode: (mode: DiscoverSortMode) => void
  getSetById: (id: string) => DiscoverSet | undefined
  getVisibleSets: () => DiscoverSet[]
  /** Patch a single set in the store (used after lazy tracklist fetch). */
  patchSet: (videoId: string, updates: Partial<DiscoverSet>) => void
  /** Load persisted taste profile from settings; falls back to mock in browser preview. */
  loadTasteProfile: () => Promise<void>
  /** Re-derive clarity badges for all currently-loaded sets against the current taste profile. */
  recomputeClarities: () => void
  /** Fetch a set's tracklist via IPC and recompute its clarity in one update. */
  loadTracklistForSet: (videoId: string) => Promise<{ tracklist: DiscoverTrack[]; confidence: number } | null>
  /** Append an artist to favouriteArtists (case-insensitive dedupe), persist, recompute clarities. */
  followArtist: (artist: string) => Promise<void>
}

const DEFAULT_FILTERS: DiscoverFilters = {
  genres: [],
  durationBuckets: [],
  minViews: 0,
  uploadedSince: 'all',
}

function durationBucket(seconds: number): DiscoverFilters['durationBuckets'][number] {
  const m = seconds / 60
  if (m < 60) return '<60'
  if (m < 120) return '60-120'
  if (m < 180) return '120-180'
  return '>180'
}

function withinUploadedSince(uploadedAt: string, since: DiscoverFilters['uploadedSince']): boolean {
  if (since === 'all') return true
  const upMs = new Date(uploadedAt).getTime()
  if (Number.isNaN(upMs)) return false
  const windowMs = since === 'week' ? 7 : since === 'month' ? 30 : 365
  return Date.now() - upMs <= windowMs * 24 * 60 * 60 * 1000
}

const HAS_IPC = typeof window !== 'undefined' && typeof window.setsense?.discoverBrowse === 'function'

async function fetchPage(
  tasteProfile: TasteProfile,
  genres: string[],
  pageToken: string | null,
  forceRefresh: boolean,
): Promise<{ sets: DiscoverSet[]; nextPageToken: string | null; hasMore: boolean; errorCode?: DiscoverErrorCode; errorMessage?: string }> {
  if (!HAS_IPC) {
    // Browser preview — use mock data
    const sets = await loadDiscoverSets()
    return { sets, nextPageToken: null, hasMore: false }
  }

  try {
    const result = await window.setsense.discoverBrowse(tasteProfile, {
      genres,
      pageToken,
      forceRefresh,
      pageSize: 25,
    })

    if (result.error) {
      if (result.error.code === 'no_key') {
        const mockSets = await loadDiscoverSets()
        return {
          sets: mockSets,
          nextPageToken: null,
          hasMore: false,
          errorCode: 'no_key',
          errorMessage: result.error.message,
        }
      }
      return {
        sets: result.sets,
        nextPageToken: result.nextPageToken,
        hasMore: result.hasMore,
        errorCode: result.error.code as DiscoverErrorCode,
        errorMessage: result.error.message,
      }
    }

    if (result.sets.length === 0 && !pageToken) {
      const mockSets = await loadDiscoverSets()
      return { sets: mockSets, nextPageToken: null, hasMore: false }
    }

    return { sets: result.sets, nextPageToken: result.nextPageToken, hasMore: result.hasMore }
  } catch {
    const mockSets = await loadDiscoverSets()
    return {
      sets: mockSets,
      nextPageToken: null,
      hasMore: false,
      errorCode: 'network',
      errorMessage: 'Could not reach YouTube — showing curated sets',
    }
  }
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  sets: [],
  activeTab: 'explore',
  filters: DEFAULT_FILTERS,
  sortMode: 'recommended',
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  nextPageToken: null,
  errorCode: null,
  errorMessage: null,
  tasteProfile: { favouriteArtists: [], favouriteGenres: [], followedDJs: [] },
  tasteProfileLoaded: false,

  loadSets: async ({ forceRefresh = false } = {}) => {
    if (!forceRefresh && get().sets.length > 0) return
    set({ isLoading: true, errorCode: null, errorMessage: null, sets: [], nextPageToken: null, hasMore: false })
    const { tasteProfile, filters } = get()
    const { sets, nextPageToken, hasMore, errorCode, errorMessage } =
      await fetchPage(tasteProfile, filters.genres, null, forceRefresh)
    set({
      sets,
      nextPageToken: nextPageToken ?? null,
      hasMore: hasMore ?? false,
      isLoading: false,
      errorCode: errorCode ?? null,
      errorMessage: errorMessage ?? null,
    })
  },

  loadMoreSets: async () => {
    const { isLoading, isLoadingMore, hasMore, nextPageToken, tasteProfile, filters, sets } = get()
    if (isLoading || isLoadingMore || !hasMore || !nextPageToken) return
    set({ isLoadingMore: true })
    const result = await fetchPage(tasteProfile, filters.genres, nextPageToken, false)
    // Deduplicate by videoId
    const existingIds = new Set(sets.map((s) => s.id))
    const newSets = result.sets.filter((s) => !existingIds.has(s.id))
    set({
      sets: [...sets, ...newSets],
      nextPageToken: result.nextPageToken ?? null,
      hasMore: result.hasMore ?? false,
      isLoadingMore: false,
    })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),

  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  setSortMode: (mode) => set({ sortMode: mode }),

  getSetById: (id) => get().sets.find((s) => s.id === id),

  patchSet: (videoId, updates) =>
    set((s) => ({
      sets: s.sets.map((existing) =>
        existing.id === videoId ? { ...existing, ...updates } : existing
      ),
    })),

  loadTasteProfile: async () => {
    if (typeof window !== 'undefined' && typeof window.setsense?.getSettings === 'function') {
      try {
        const s = await window.setsense.getSettings()
        const profile: TasteProfile = {
          favouriteArtists: s.favouriteArtists ?? [],
          favouriteGenres: s.favouriteGenres ?? [],
          followedDJs: s.followedDJs ?? [],
        }
        set({ tasteProfile: profile, tasteProfileLoaded: true })
        get().recomputeClarities()
        return
      } catch {
        // fall through to mock
      }
    }
    set({ tasteProfile: MOCK_TASTE_PROFILE, tasteProfileLoaded: true })
    get().recomputeClarities()
  },

  recomputeClarities: () =>
    set((s) => ({
      sets: s.sets.map((item) => ({
        ...item,
        clarity: deriveClarityReason(item, s.tasteProfile),
      })),
    })),

  loadTracklistForSet: async (videoId) => {
    if (typeof window === 'undefined' || typeof window.setsense?.discoverGetTracklist !== 'function') {
      return null
    }
    const result = await window.setsense.discoverGetTracklist(videoId)
    if (!result) return null
    set((s) => ({
      sets: s.sets.map((existing) => {
        if (existing.id !== videoId) return existing
        const updated: DiscoverSet = {
          ...existing,
          tracklist: result.tracklist,
          tracklistConfidence: result.confidence,
          tracklistSource: result.source as DiscoverSet['tracklistSource'],
        }
        return { ...updated, clarity: deriveClarityReason(updated, s.tasteProfile) }
      }),
    }))
    return { tracklist: result.tracklist, confidence: result.confidence }
  },

  followArtist: async (artist) => {
    const trimmed = artist.trim()
    if (!trimmed) return
    const { favouriteArtists } = get().tasteProfile
    if (favouriteArtists.some((a) => a.toLowerCase() === trimmed.toLowerCase())) return
    const next = [...favouriteArtists, trimmed]
    set((s) => ({ tasteProfile: { ...s.tasteProfile, favouriteArtists: next } }))
    if (typeof window !== 'undefined' && typeof window.setsense?.setSettings === 'function') {
      try {
        await window.setsense.setSettings({ favouriteArtists: next })
      } catch (err) {
        console.error('Failed to persist favouriteArtists', err)
      }
    }
    get().recomputeClarities()
  },

  getVisibleSets: () => {
    const { sets, activeTab, filters, sortMode, tasteProfile } = get()
    let out = sets

    if (activeTab === 'following') {
      out = out.filter((s) =>
        s.clarity.kind === 'following-dj' ||
        s.clarity.kind === 'plays-artist' ||
        tasteProfile.followedDJs.some((dj) => dj.toLowerCase() === s.djName.toLowerCase())
      )
    }

    if (filters.genres.length > 0) {
      const selected = new Set(filters.genres.map((g) => g.toLowerCase()))
      out = out.filter((s) => s.tags.some((t) => selected.has(t.toLowerCase())))
    }

    if (filters.durationBuckets.length > 0) {
      const sel = new Set(filters.durationBuckets)
      out = out.filter((s) => sel.has(durationBucket(s.durationSeconds)))
    }

    if (filters.minViews > 0) {
      out = out.filter((s) => s.viewCount >= filters.minViews)
    }

    if (filters.uploadedSince !== 'all') {
      out = out.filter((s) => withinUploadedSince(s.uploadedAt, filters.uploadedSince))
    }

    const sorted = [...out]
    if (sortMode === 'newest') {
      sorted.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    } else if (sortMode === 'mostViewed') {
      sorted.sort((a, b) => b.viewCount - a.viewCount)
    } else {
      const rank = (k: DiscoverSet['clarity']['kind']): number =>
        k === 'following-dj' ? 0 : k === 'plays-artist' ? 1 : k === 'matches-genre' ? 2 : 3
      sorted.sort((a, b) => {
        const d = rank(a.clarity.kind) - rank(b.clarity.kind)
        return d !== 0 ? d : b.viewCount - a.viewCount
      })
    }
    return sorted
  },
}))

