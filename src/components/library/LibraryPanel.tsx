import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlignJustify,
  ArrowDownUp,
  Flag,
  Folder,
  ListMusic,
  ListPlus,
  Menu,
  Music,
  Pencil,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react'
import type { AudioFormat, ComboResult, CrateRule, LibraryTab, SmartCrate, Track } from '@/types'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { camelotCompatible } from '@/utils/camelot'
import { TrackRow } from './TrackRow'
import { SetListRow } from './SetListRow'
import { PlaylistSidebar } from './PlaylistSidebar'
import { CratesLibraryTab } from './CratesLibraryTab'
import { TagEditorPopover } from './tags/TagEditorPopover'
import { TrackContextMenu, type MenuItem } from './TrackContextMenu'
import { SelectionToolbar } from './SelectionToolbar'
import { LibraryListHeader, type SortColumn } from './LibraryListHeader'
import { useTrackInspectStore } from '@/stores/trackInspectStore'
import { useIsPro } from '@/stores/licenseStore'
import { useToastStore } from '@/stores/toastStore'

const TABS: readonly LibraryTab[] = ['Collection', 'Crates', 'Sets'] as const

type SortField =
  | 'artist'
  | 'title'
  | 'bpm'
  | 'energy'
  | 'key'
  | 'dateAdded'
  | 'playCount'
  | 'duration'
  | 'rating'
type SortDir = 'asc' | 'desc'

interface TrackFilters {
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  key?: string
  genre?: string
  format?: string[]
}

const SORT_FIELDS: readonly SortField[] = [
  'artist',
  'title',
  'bpm',
  'energy',
  'key',
  'dateAdded',
  'playCount',
  'duration',
  'rating'
]

const CAMELOT_KEYS = [
  '1A',
  '2A',
  '3A',
  '4A',
  '5A',
  '6A',
  '7A',
  '8A',
  '9A',
  '10A',
  '11A',
  '12A',
  '1B',
  '2B',
  '3B',
  '4B',
  '5B',
  '6B',
  '7B',
  '8B',
  '9B',
  '10B',
  '11B',
  '12B'
]

const FORMATS = ['mp3', 'aiff', 'wav', 'flac', 'm4a']

function anyActive(f: TrackFilters): boolean {
  return !!(
    f.bpmMin ||
    f.bpmMax ||
    f.energyMin ||
    f.energyMax ||
    f.key ||
    f.genre ||
    (f.format && f.format.length > 0)
  )
}

export function LibraryPanel(): React.JSX.Element {
  const { t } = useTranslation('library')
  const [tab, setTab] = useState<LibraryTab>('Collection')
  const {
    tracks,
    searchQuery,
    searchResults,
    isLoading,
    hasLibrary,
    setSearchQuery,
    playlists,
    playlistTrackIndex
  } = useLibraryStore()
  const {
    savedSets,
    currentSet,
    loadSets,
    loadCurrentSet,
    selectedTrackId,
    addTrackAfterSelected
  } = useSetStore()
  const {
    smartFilter,
    toggleSmartFilter,
    searchFocusTick,
    selectedPlaylistId,
    setSelectedPlaylist,
    selectedLibraryTrackId,
    setSelectedLibraryTrack,
    libraryDensity,
    toggleLibraryDensity,
    showModal
  } = useUiStore()
  const { startPreview, previewTrack, isPlaying } = usePlaybackStore()

  // ── Multi-selection (power-user bulk actions) ─────────────────────────────
  const { t: tp } = useTranslation('power')
  const isPro = useIsPro()
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const selectionCount = selectedIds.size
  const handleSelectToggle = useCallback((track: Track, mods: { shiftKey: boolean }) => {
    const sel = useSelectionStore.getState()
    if (mods.shiftKey && sel.anchorId) sel.selectRange(sel.anchorId, track.id)
    else sel.toggle(track.id)
  }, [])

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('artist')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  function handleSort(field: SortColumn): void {
    if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TrackFilters>({})
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  // ── Search tip (one-time dismissible callout) ─────────────────────────────
  const [tipDismissed, setTipDismissed] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem('setrecord-search-tip-dismissed') === 'true'
  )
  function dismissTip(): void {
    setTipDismissed(true)
    localStorage.setItem('setrecord-search-tip-dismissed', 'true')
  }

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ track: Track; x: number; y: number } | null>(null)

  // ── Tag editor state (per-track override popover) ─────────────────────────
  const [tagEditorTrack, setTagEditorTrack] = useState<Track | null>(null)

  // ── Combos popover state ──────────────────────────────────────────────────
  const [combosData, setCombosData] = useState<{ track: Track; results: ComboResult[] } | null>(
    null
  )

  // Track Résumé / Courage overlays are app-global (rendered full-screen at the
  // app root via trackInspectStore) so they're never squished inside this panel.
  const openResume = useTrackInspectStore((s) => s.openResume)
  const openCourage = useTrackInspectStore((s) => s.openCourage)

  const selectedPlaylist = selectedPlaylistId
    ? (playlists.find((p) => p.id === selectedPlaylistId) ?? null)
    : null

  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (searchFocusTick > 0) {
      setTab('Collection')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [searchFocusTick])

  const setTrackIds = new Set(currentSet?.tracks.map((st) => st.trackId) ?? [])

  // The currently selected set track (for smart filter)
  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId) ?? null

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setSearchQuery(q), 150)
    },
    [setSearchQuery]
  )

  useEffect(() => {
    if (tab === 'Sets') loadSets()
  }, [tab, loadSets])

  // ── Filter chain ──────────────────────────────────────────────────────────
  // search → playlist → explicit filters → smart filter → sort
  const baseTracks = searchQuery.trim() ? searchResults : tracks

  const playlistFiltered = selectedPlaylistId
    ? baseTracks.filter((t) => playlistTrackIndex.get(selectedPlaylistId)?.has(t.id))
    : baseTracks

  // Explicit BPM/energy/key/genre/format filters
  const filterApplied = anyActive(filters)
    ? playlistFiltered.filter((t) => {
        if (filters.bpmMin != null && t.bpm < filters.bpmMin) return false
        if (filters.bpmMax != null && t.bpm > filters.bpmMax) return false
        if (filters.energyMin != null && t.energy < filters.energyMin) return false
        if (filters.energyMax != null && t.energy > filters.energyMax) return false
        if (filters.key && t.key !== filters.key) return false
        if (filters.genre && !t.genre?.toLowerCase().includes(filters.genre.toLowerCase()))
          return false
        if (filters.format && filters.format.length > 0 && !filters.format.includes(t.format))
          return false
        return true
      })
    : playlistFiltered

  // Smart filter — extended to use a library-selected track when no set track is active
  const filterReferenceTrack =
    selectedSetTrack?.track ??
    (smartFilter && selectedLibraryTrackId
      ? (tracks.find((t) => t.id === selectedLibraryTrackId) ?? null)
      : null)
  const smartFilterActive = smartFilter && filterReferenceTrack !== null
  const smartFiltered = smartFilterActive
    ? filterApplied.filter((t) => {
        const bpmOk = Math.abs(t.bpm - filterReferenceTrack!.bpm) <= 8
        const keyOk = camelotCompatible(filterReferenceTrack!.key, t.key)
        return bpmOk && keyOk
      })
    : filterApplied

  // Sort
  const displayTracks = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...smartFiltered].sort((a, b) => {
      switch (sortField) {
        case 'artist':
          return dir * a.artist.localeCompare(b.artist)
        case 'title':
          return dir * a.title.localeCompare(b.title)
        case 'bpm':
          return dir * (a.bpm - b.bpm)
        case 'energy':
          return dir * (a.energy - b.energy)
        case 'key':
          return dir * a.key.localeCompare(b.key)
        case 'dateAdded':
          return dir * (a.dateAdded ?? '').localeCompare(b.dateAdded ?? '')
        case 'playCount':
          return dir * ((a.playCount ?? 0) - (b.playCount ?? 0))
        case 'duration':
          return dir * (a.duration - b.duration)
        case 'rating':
          return dir * ((a.rating ?? 0) - (b.rating ?? 0))
        default:
          return 0
      }
    })
  }, [smartFiltered, sortField, sortDir])

  // Publish the current Collection ordering so range-select and ⌘A resolve even
  // from the global keyboard handler. Drop selected ids that left the library.
  useEffect(() => {
    useSelectionStore.getState().setOrderedIds(displayTracks.map((t) => t.id))
  }, [displayTracks])
  useEffect(() => {
    useSelectionStore.getState().retain(new Set(tracks.map((t) => t.id)))
  }, [tracks])
  // Selection only lives in the Collection list — drop it when leaving the tab.
  useEffect(() => {
    if (tab !== 'Collection') useSelectionStore.getState().clear()
  }, [tab])

  const playingTrackId = previewTrack && isPlaying ? previewTrack.id : null
  const rowHeight = libraryDensity === 'compact' ? 40 : 56
  // eslint-disable-next-line react-hooks/incompatible-library -- false positive: useVirtualizer is a valid hook, not a memo-incompatible utility
  const rowVirtualizer = useVirtualizer({
    count: displayTracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (displayTracks[index]?.id === playingTrackId ? 96 : rowHeight),
    overscan: 10,
    getItemKey: (index) =>
      `${displayTracks[index]?.id ?? index}:${displayTracks[index]?.id === playingTrackId ? 'p' : 'n'}:${libraryDensity}`
  })

  // ── Context menu helpers ──────────────────────────────────────────────────
  function handleContextMenu(track: Track, e: React.MouseEvent): void {
    e.preventDefault()
    setCtxMenu({ track, x: e.clientX, y: e.clientY })
  }

  async function handleShowCombos(track: Track): Promise<void> {
    setCombosData({ track, results: [] })
    try {
      const results = await window.setrecord.recallCombos(track.id)
      setCombosData({ track, results })
    } catch {
      setCombosData({ track, results: [] })
    }
  }

  function handleFindSimilar(track: Track): void {
    setSelectedLibraryTrack(track.id)
    if (!smartFilter) toggleSmartFilter()
  }

  function handleEditCues(track: Track): void {
    startPreview(track)
    showModal('cueEditor')
  }

  // Bulk context-menu variant: shown when a multi-selection is right-clicked.
  const ctxBulk = !!ctxMenu && selectedIds.has(ctxMenu.track.id) && selectionCount > 1
  function buildBulkItems(): MenuItem[] {
    const ids = [...selectedIds]
    const count = selectionCount
    const selTracks = tracks.filter((tr) => selectedIds.has(tr.id))
    const toast = useToastStore.getState()
    const sel = useSelectionStore.getState()
    return [
      {
        icon: ListPlus,
        label: tp('context.addToSet', { count }),
        action: () => {
          useSetStore.getState().addTracksToCurrent(selTracks)
          toast.success(tp('toolbar.addedToSet', { count }))
          sel.clear()
        }
      },
      {
        icon: Pencil,
        label: tp('context.edit', { count }),
        action: () => {
          if (isPro) showModal('bulkEdit')
          else useUiStore.getState().showUpgrade('bulkEdit')
        }
      },
      {
        icon: Flag,
        label: tp('context.flag', { count }),
        action: () => {
          void window.setrecord.lifecycleFlagForGig(ids)
          toast.success(tp('toolbar.flagged', { count }))
          sel.clear()
        }
      },
      {
        icon: Trash2,
        label: tp('context.remove', { count }),
        action: () => showModal('removeConfirm')
      },
      { icon: X, label: tp('context.clear'), action: () => useSelectionStore.getState().clear() }
    ]
  }

  // Save the active filter set as a reusable Smart Crate (Pro). The fuzzy search
  // term isn't representable as a rule, so only the structured filters carry over.
  async function saveFilterAsCrate(): Promise<void> {
    if (!anyActive(filters)) {
      useToastStore.getState().info(tp('saveCrate.empty'))
      return
    }
    if (!isPro) {
      useUiStore.getState().showUpgrade('smartCrates')
      return
    }
    const rule: CrateRule = {}
    if (filters.bpmMin != null) rule.bpmMin = filters.bpmMin
    if (filters.bpmMax != null) rule.bpmMax = filters.bpmMax
    if (filters.energyMin != null) rule.energyMin = filters.energyMin
    if (filters.energyMax != null) rule.energyMax = filters.energyMax
    if (filters.key) rule.keyExact = filters.key
    if (filters.genre) rule.genreIncludes = filters.genre
    if (filters.format && filters.format.length === 1)
      rule.format = filters.format[0] as AudioFormat
    const parts: string[] = []
    if (filters.bpmMin != null || filters.bpmMax != null)
      parts.push(`${filters.bpmMin ?? 60}–${filters.bpmMax ?? 200} BPM`)
    if (filters.energyMin != null || filters.energyMax != null)
      parts.push(`E${filters.energyMin ?? 1}–${filters.energyMax ?? 10}`)
    if (filters.key) parts.push(filters.key)
    if (filters.genre) parts.push(filters.genre)
    const name = parts.join(' · ') || tp('saveCrate.defaultName')
    const crate: SmartCrate = { id: crypto.randomUUID(), name, rules: [rule], match: 'all' }
    await window.setrecord.recallSaveCrate(crate)
    useToastStore.getState().success(tp('saveCrate.saved', { name }))
  }

  // ── Active filter chip helpers ────────────────────────────────────────────
  function clearFilter(key: keyof TrackFilters): void {
    setFilters((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="panel glass-1">
      <SearchInput
        ref={searchRef}
        placeholder={t('search.placeholder')}
        kbd="⌘K"
        onChange={handleSearch}
        defaultValue={searchQuery}
      />

      {/* One-time search tip */}
      {!tipDismissed && (
        <div className="search-tip">
          <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('search.tip')}
          </span>
          <button
            className="smart-filter-dismiss"
            onClick={dismissTip}
            aria-label={t('search.dismissTip')}
          >
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="library-tabs">
        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={setTab}
          icons={{ Collection: Music, Crates: Folder, Sets: ListMusic }}
        />
      </div>

      {tab === 'Collection' && (
        <>
          {/* Sort / filter / density toolbar */}
          <div className="library-toolbar">
            <div className="library-sort-control">
              <select
                className="library-sort-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                aria-label={t('sort.byAria')}
                title={t('sort.byTitle')}
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {t(`sort.fields.${f}`)}
                  </option>
                ))}
              </select>
              <button
                className="library-sort-dir"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={sortDir === 'asc' ? t('sort.ascending') : t('sort.descending')}
                title={sortDir === 'asc' ? t('sort.ascendingTitle') : t('sort.descendingTitle')}
              >
                <ArrowDownUp
                  size={12}
                  strokeWidth={1.8}
                  className="sort-icon"
                  style={{ transform: sortDir === 'desc' ? 'scaleY(-1)' : 'scaleY(1)' }}
                />
              </button>
            </div>
            <div className="library-toolbar-actions">
              <IconButton
                icon={SlidersHorizontal}
                size="sm"
                active={anyActive(filters) || filterPanelOpen}
                onClick={() => setFilterPanelOpen((v) => !v)}
                aria-label={t('toolbar.filterAria')}
                title={t('toolbar.filterTitle')}
              />
              <IconButton
                icon={libraryDensity === 'compact' ? AlignJustify : Menu}
                size="sm"
                active={libraryDensity === 'compact'}
                onClick={toggleLibraryDensity}
                aria-label={
                  libraryDensity === 'compact'
                    ? t('toolbar.standardViewAria')
                    : t('toolbar.compactViewAria')
                }
                title={
                  libraryDensity === 'compact'
                    ? t('toolbar.standardViewTitle')
                    : t('toolbar.compactViewTitle')
                }
              />
            </div>
          </div>

          {/* Collapsible filter panel */}
          <AnimatePresence initial={false}>
            {filterPanelOpen && (
              <motion.div
                className="filter-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div className="filter-panel-inner">
                  <div className="filter-row filter-row--stacked">
                    <span className="filter-label ss-caption">{t('filters.bpm')}</span>
                    <RangeSlider
                      min={60}
                      max={200}
                      step={1}
                      low={filters.bpmMin ?? 60}
                      high={filters.bpmMax ?? 200}
                      formatLabel={(v) => String(v)}
                      onChange={(lo, hi) =>
                        setFilters((f) => ({
                          ...f,
                          bpmMin: lo === 60 ? undefined : lo,
                          bpmMax: hi === 200 ? undefined : hi
                        }))
                      }
                    />
                  </div>
                  <div className="filter-row filter-row--stacked">
                    <span className="filter-label ss-caption">{t('filters.energy')}</span>
                    <RangeSlider
                      min={1}
                      max={10}
                      step={1}
                      low={filters.energyMin ?? 1}
                      high={filters.energyMax ?? 10}
                      formatLabel={(v) => String(v)}
                      onChange={(lo, hi) =>
                        setFilters((f) => ({
                          ...f,
                          energyMin: lo === 1 ? undefined : lo,
                          energyMax: hi === 10 ? undefined : hi
                        }))
                      }
                    />
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">{t('filters.key')}</span>
                    <select
                      className="filter-select"
                      value={filters.key ?? ''}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, key: e.target.value || undefined }))
                      }
                    >
                      <option value="">{t('filters.anyKey')}</option>
                      {CAMELOT_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">{t('filters.genre')}</span>
                    <input
                      className="filter-text"
                      type="text"
                      placeholder={t('filters.genrePlaceholder')}
                      value={filters.genre ?? ''}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, genre: e.target.value || undefined }))
                      }
                    />
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">{t('filters.format')}</span>
                    <div className="filter-chips">
                      {FORMATS.map((fmt) => {
                        const active = filters.format?.includes(fmt)
                        return (
                          <button
                            key={fmt}
                            className={`filter-fmt-chip ${active ? 'active' : ''}`}
                            onClick={() =>
                              setFilters((f) => {
                                const cur = f.format ?? []
                                const next = active ? cur.filter((x) => x !== fmt) : [...cur, fmt]
                                return { ...f, format: next.length ? next : undefined }
                              })
                            }
                          >
                            {fmt.toUpperCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {anyActive(filters) && (
                    <div className="filter-footer">
                      <button
                        className="filter-save-crate ss-caption"
                        onClick={() => void saveFilterAsCrate()}
                      >
                        {tp('saveCrate.button')}
                      </button>
                      <button
                        className="filter-clear-all ss-caption"
                        onClick={() => setFilters({})}
                      >
                        {t('filters.clearAll')}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter chips */}
          {anyActive(filters) && (
            <div className="active-filter-chips">
              {filters.bpmMin != null && (
                <span className="active-filter-chip">
                  {t('filters.chipBpmMin', { value: filters.bpmMin })}
                  <button onClick={() => clearFilter('bpmMin')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.bpmMax != null && (
                <span className="active-filter-chip">
                  {t('filters.chipBpmMax', { value: filters.bpmMax })}
                  <button onClick={() => clearFilter('bpmMax')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.energyMin != null && (
                <span className="active-filter-chip">
                  {t('filters.chipEnergyMin', { value: filters.energyMin })}
                  <button onClick={() => clearFilter('energyMin')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.energyMax != null && (
                <span className="active-filter-chip">
                  {t('filters.chipEnergyMax', { value: filters.energyMax })}
                  <button onClick={() => clearFilter('energyMax')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.key && (
                <span className="active-filter-chip">
                  {t('filters.chipKey', { value: filters.key })}
                  <button onClick={() => clearFilter('key')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.genre && (
                <span className="active-filter-chip">
                  {t('filters.chipGenre', { value: filters.genre })}
                  <button onClick={() => clearFilter('genre')}>
                    <X size={9} />
                  </button>
                </span>
              )}
              {filters.format?.map((fmt) => (
                <span key={fmt} className="active-filter-chip">
                  {fmt.toUpperCase()}
                  <button
                    onClick={() =>
                      setFilters((f) => ({ ...f, format: f.format?.filter((x) => x !== fmt) }))
                    }
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'Collection' && (
        <div className="library-split">
          <PlaylistSidebar />
          <div className="library-main">
            {/* Playlist filter banner */}
            <AnimatePresence initial={false}>
              {selectedPlaylist && (
                <motion.div
                  key="playlist-filter-banner"
                  className="playlist-filter-banner"
                  initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 8, marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0.12, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <span className="ss-caption">
                    <Trans
                      t={t}
                      i18nKey="banner.showingPlaylist"
                      values={{ name: selectedPlaylist.name }}
                      components={[<strong key="0" />]}
                    />
                  </span>
                  <button
                    className="smart-filter-dismiss"
                    onClick={() => setSelectedPlaylist(null)}
                    aria-label={t('banner.showAllTracks')}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Smart filter banner */}
            <AnimatePresence initial={false}>
              {smartFilterActive && filterReferenceTrack && (
                <motion.div
                  key="smart-filter-banner"
                  className="smart-filter-banner"
                  initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 8, marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0.12, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <span className="ss-caption">
                    <Trans
                      t={t}
                      i18nKey="banner.showingFit"
                      values={{ title: filterReferenceTrack.title }}
                      components={[<strong key="0" />]}
                    />
                  </span>
                  <button
                    className="smart-filter-dismiss"
                    onClick={toggleSmartFilter}
                    aria-label={t('banner.clearSmartFilter')}
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isLoading && (
              <div className="track-list library-skeleton">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="track-row">
                    <div className="track-art" style={{ background: 'var(--border-subtle)' }} />
                    <div className="track-meta">
                      <div
                        className="t"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 4,
                          height: 12,
                          width: '70%'
                        }}
                      />
                      <div
                        className="a"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          borderRadius: 4,
                          height: 10,
                          width: '50%',
                          marginTop: 4
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !hasLibrary && <NoLibraryState body={t('empty.noLibrary')} />}

            {!isLoading && hasLibrary && libraryDensity === 'standard' && (
              <LibraryListHeader sortField={sortField} sortDir={sortDir} onSort={handleSort} />
            )}

            {!isLoading && hasLibrary && (
              <div
                ref={scrollContainerRef}
                className="track-list"
                style={{ overflowY: 'auto', flex: 1 }}
                // NFR-107 benchmark markers — the cold-start harness waits for
                // data-bench-library-ready and the scroll harness scrolls this
                // element. Inert in production. See bench/app/run.mjs.
                data-bench-library-ready="true"
                data-bench-track-count={displayTracks.length}
              >
                {displayTracks.length === 0 ? (
                  <div className="library-empty" style={{ padding: 16 }}>
                    <div className="ss-body-sm">
                      {smartFilterActive
                        ? t('empty.noCompatible')
                        : anyActive(filters)
                          ? t('empty.noFilterMatch')
                          : selectedPlaylist
                            ? t('empty.noPlaylistTracks', { name: selectedPlaylist.name })
                            : t('empty.noSearchMatch', { query: searchQuery })}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: rowVirtualizer.getTotalSize(),
                      width: '100%',
                      position: 'relative'
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const track = displayTracks[virtualRow.index]
                      return (
                        <div
                          key={virtualRow.key}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: virtualRow.size,
                            transform: `translateY(${virtualRow.start}px)`
                          }}
                        >
                          <TrackRow
                            track={track}
                            inSet={setTrackIds.has(track.id)}
                            playing={previewTrack?.id === track.id && isPlaying}
                            selected={selectedLibraryTrackId === track.id}
                            multiSelected={selectedIds.has(track.id)}
                            selectionActive={selectionCount > 0}
                            compact={libraryDensity === 'compact'}
                            onClick={() => {
                              useSelectionStore.getState().clear()
                              setSelectedLibraryTrack(track.id)
                              useSetStore.getState().setSelectedTrack(null)
                              startPreview(track)
                            }}
                            onDoubleClick={() => addTrackAfterSelected(track)}
                            onContextMenu={(e) => handleContextMenu(track, e)}
                            onMenuKey={(c) => setCtxMenu({ track, x: c.x, y: c.y })}
                            onShowCombos={() => handleShowCombos(track)}
                            onSelectToggle={(mods) => handleSelectToggle(track, mods)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <SelectionToolbar />
          </div>
        </div>
      )}

      {tab === 'Crates' && <CratesLibraryTab />}

      {tab === 'Sets' && (
        <div className="track-list">
          {savedSets.length === 0 ? (
            <EmptyState icon={ListMusic} title={t('sets.emptyTitle')} body={t('sets.emptyBody')} />
          ) : (
            savedSets.map((s) => (
              <SetListRow
                key={s.id}
                set={s}
                isActive={currentSet?.id === s.id}
                onLoad={() => loadCurrentSet(s.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Context menu (portal-rendered in TrackContextMenu) */}
      {ctxMenu && (
        <TrackContextMenu
          track={ctxMenu.track}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onPreview={() => {
            startPreview(ctxMenu.track)
            setCtxMenu(null)
          }}
          onFindSimilar={() => {
            handleFindSimilar(ctxMenu.track)
            setCtxMenu(null)
          }}
          onShowCourage={() => {
            void openCourage(ctxMenu.track)
            setCtxMenu(null)
          }}
          onAddToSet={() => {
            addTrackAfterSelected(ctxMenu.track)
            setCtxMenu(null)
          }}
          onEditCues={() => {
            handleEditCues(ctxMenu.track)
            setCtxMenu(null)
          }}
          onShowCombos={() => {
            void handleShowCombos(ctxMenu.track)
            setCtxMenu(null)
          }}
          onShowResume={() => {
            void openResume(ctxMenu.track)
            setCtxMenu(null)
          }}
          onEditTags={() => {
            setTagEditorTrack(ctxMenu.track)
            setCtxMenu(null)
          }}
          bulkItems={ctxBulk ? buildBulkItems() : undefined}
          bulkHeader={ctxBulk ? tp('context.header', { count: selectionCount }) : undefined}
        />
      )}

      {/* Tag override popover (Pro) */}
      {tagEditorTrack && (
        <TagEditorPopover track={tagEditorTrack} onClose={() => setTagEditorTrack(null)} />
      )}

      {/* Combos popover */}
      {combosData && (
        <div
          className="combos-overlay"
          role="dialog"
          aria-label={t('combos.dialogAria', { title: combosData.track.title })}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCombosData(null)
          }}
        >
          <div className="combos-popover glass-3">
            <div className="combos-header">
              <div>
                <div
                  className="ss-label"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}
                >
                  {t('combos.after')}
                </div>
                <div className="ss-body-sm" style={{ fontWeight: 500 }}>
                  {combosData.track.title}
                </div>
              </div>
              <button
                className="smart-filter-dismiss"
                onClick={() => setCombosData(null)}
                aria-label={t('combos.close')}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
            {combosData.results.length === 0 ? (
              <div
                className="ss-caption"
                style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}
              >
                {t('combos.empty')}
              </div>
            ) : (
              <div className="combos-list">
                {combosData.results.slice(0, 5).map((c) => (
                  <div key={c.track.id} className="combo-row">
                    <div className="combo-track">
                      <div className="ss-body-sm">{c.track.title}</div>
                      <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                        {c.track.artist}
                      </div>
                    </div>
                    <span className="combo-count ss-caption">
                      {t('combos.count', { count: c.count })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
