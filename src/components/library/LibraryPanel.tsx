import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AlignJustify, ArrowDownUp, FolderOpen, ListMusic, Menu, SlidersHorizontal, X } from 'lucide-react'
import type { ComboResult, LibraryTab, Track } from '@/types'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { IconButton } from '@/components/shared/IconButton'
import { RangeSlider } from '@/components/shared/RangeSlider'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { camelotCompatible } from '@/utils/camelot'
import { TrackRow } from './TrackRow'
import { SetListRow } from './SetListRow'
import { PlaylistSidebar } from './PlaylistSidebar'
import { CratesLibraryTab } from './CratesLibraryTab'
import { TrackContextMenu } from './TrackContextMenu'

const TABS: readonly LibraryTab[] = ['Library', 'Crates', 'Sets'] as const

type SortField = 'artist' | 'title' | 'bpm' | 'energy' | 'key' | 'dateAdded' | 'playCount' | 'duration' | 'rating'
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

const SORT_LABELS: Record<SortField, string> = {
  artist: 'Artist', title: 'Title', bpm: 'BPM', energy: 'Energy',
  key: 'Key', dateAdded: 'Date added', playCount: 'Play count',
  duration: 'Duration', rating: 'Rating',
}

const CAMELOT_KEYS = [
  '1A','2A','3A','4A','5A','6A','7A','8A','9A','10A','11A','12A',
  '1B','2B','3B','4B','5B','6B','7B','8B','9B','10B','11B','12B',
]

const FORMATS = ['mp3', 'aiff', 'wav', 'flac', 'm4a']

function anyActive(f: TrackFilters): boolean {
  return !!(
    f.bpmMin || f.bpmMax || f.energyMin || f.energyMax ||
    f.key || f.genre || (f.format && f.format.length > 0)
  )
}

export function LibraryPanel(): React.JSX.Element {
  const [tab, setTab] = useState<LibraryTab>('Library')
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
    showModal,
  } = useUiStore()
  const { startPreview, previewTrack, isPlaying } = usePlaybackStore()

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>('artist')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TrackFilters>({})
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  // ── Search tip (one-time dismissible callout) ─────────────────────────────
  const [tipDismissed, setTipDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('setsense-search-tip-dismissed') === 'true'
  )
  function dismissTip() {
    setTipDismissed(true)
    localStorage.setItem('setsense-search-tip-dismissed', 'true')
  }

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ track: Track; x: number; y: number } | null>(null)

  // ── Combos popover state ──────────────────────────────────────────────────
  const [combosData, setCombosData] = useState<{ track: Track; results: ComboResult[] } | null>(null)

  const selectedPlaylist = selectedPlaylistId
    ? (playlists.find((p) => p.id === selectedPlaylistId) ?? null)
    : null

  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (searchFocusTick > 0) {
      setTab('Library')
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
        if (filters.genre && !t.genre?.toLowerCase().includes(filters.genre.toLowerCase())) return false
        if (filters.format && filters.format.length > 0 && !filters.format.includes(t.format)) return false
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
        case 'artist':    return dir * a.artist.localeCompare(b.artist)
        case 'title':     return dir * a.title.localeCompare(b.title)
        case 'bpm':       return dir * (a.bpm - b.bpm)
        case 'energy':    return dir * (a.energy - b.energy)
        case 'key':       return dir * a.key.localeCompare(b.key)
        case 'dateAdded': return dir * (a.dateAdded ?? '').localeCompare(b.dateAdded ?? '')
        case 'playCount': return dir * ((a.playCount ?? 0) - (b.playCount ?? 0))
        case 'duration':  return dir * (a.duration - b.duration)
        case 'rating':    return dir * ((a.rating ?? 0) - (b.rating ?? 0))
        default: return 0
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartFiltered, sortField, sortDir])

  const playingTrackId = previewTrack && isPlaying ? previewTrack.id : null
  const rowHeight = libraryDensity === 'compact' ? 40 : 56
  const rowVirtualizer = useVirtualizer({
    count: displayTracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (displayTracks[index]?.id === playingTrackId ? 96 : rowHeight),
    overscan: 10,
    getItemKey: (index) =>
      `${displayTracks[index]?.id ?? index}:${displayTracks[index]?.id === playingTrackId ? 'p' : 'n'}:${libraryDensity}`
  })

  // ── Context menu helpers ──────────────────────────────────────────────────
  function handleContextMenu(track: Track, e: React.MouseEvent) {
    e.preventDefault()
    setCtxMenu({ track, x: e.clientX, y: e.clientY })
  }

  async function handleShowCombos(track: Track) {
    setCombosData({ track, results: [] })
    try {
      const results = await window.setsense.recallCombos(track.id)
      setCombosData({ track, results })
    } catch {
      setCombosData({ track, results: [] })
    }
  }

  function handleFindSimilar(track: Track) {
    setSelectedLibraryTrack(track.id)
    if (!smartFilter) toggleSmartFilter()
  }

  function handleEditCues(track: Track) {
    startPreview(track)
    showModal('cueEditor')
  }

  // ── Active filter chip helpers ────────────────────────────────────────────
  function clearFilter(key: keyof TrackFilters) {
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
        placeholder="Search library, sets, cue points…"
        kbd="⌘K"
        onChange={handleSearch}
        defaultValue={searchQuery}
      />

      {/* One-time search tip */}
      {!tipDismissed && (
        <div className="search-tip">
          <span className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
            Also searches cue point labels — try "intro" or "drop"
          </span>
          <button className="smart-filter-dismiss" onClick={dismissTip} aria-label="Dismiss tip">
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="library-tabs">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'Library' && (
        <>
          {/* Sort / filter / density toolbar */}
          <div className="library-toolbar">
            <div className="library-sort-control">
              <select
                className="library-sort-select"
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                aria-label="Sort by"
                title="Sort library"
              >
                {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
                  <option key={f} value={f}>{SORT_LABELS[f]}</option>
                ))}
              </select>
              <button
                className="library-sort-dir"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label={sortDir === 'asc' ? 'Sort ascending — click for descending' : 'Sort descending — click for ascending'}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
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
                aria-label="Filter library"
                title="Filter"
              />
              <IconButton
                icon={libraryDensity === 'compact' ? AlignJustify : Menu}
                size="sm"
                active={libraryDensity === 'compact'}
                onClick={toggleLibraryDensity}
                aria-label={libraryDensity === 'compact' ? 'Switch to standard view' : 'Switch to compact view'}
                title={libraryDensity === 'compact' ? 'Standard view' : 'Compact view'}
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
                    <span className="filter-label ss-caption">BPM</span>
                    <RangeSlider
                      min={60} max={200} step={1}
                      low={filters.bpmMin ?? 60}
                      high={filters.bpmMax ?? 200}
                      formatLabel={(v) => String(v)}
                      onChange={(lo, hi) => setFilters((f) => ({
                        ...f,
                        bpmMin: lo === 60 ? undefined : lo,
                        bpmMax: hi === 200 ? undefined : hi,
                      }))}
                    />
                  </div>
                  <div className="filter-row filter-row--stacked">
                    <span className="filter-label ss-caption">Energy</span>
                    <RangeSlider
                      min={1} max={10} step={1}
                      low={filters.energyMin ?? 1}
                      high={filters.energyMax ?? 10}
                      formatLabel={(v) => String(v)}
                      onChange={(lo, hi) => setFilters((f) => ({
                        ...f,
                        energyMin: lo === 1 ? undefined : lo,
                        energyMax: hi === 10 ? undefined : hi,
                      }))}
                    />
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">Key</span>
                    <select
                      className="filter-select"
                      value={filters.key ?? ''}
                      onChange={(e) => setFilters((f) => ({ ...f, key: e.target.value || undefined }))}
                    >
                      <option value="">Any</option>
                      {CAMELOT_KEYS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">Genre</span>
                    <input
                      className="filter-text"
                      type="text"
                      placeholder="e.g. tech house"
                      value={filters.genre ?? ''}
                      onChange={(e) => setFilters((f) => ({ ...f, genre: e.target.value || undefined }))}
                    />
                  </div>
                  <div className="filter-row">
                    <span className="filter-label ss-caption">Format</span>
                    <div className="filter-chips">
                      {FORMATS.map((fmt) => {
                        const active = filters.format?.includes(fmt)
                        return (
                          <button
                            key={fmt}
                            className={`filter-fmt-chip ${active ? 'active' : ''}`}
                            onClick={() => setFilters((f) => {
                              const cur = f.format ?? []
                              const next = active ? cur.filter((x) => x !== fmt) : [...cur, fmt]
                              return { ...f, format: next.length ? next : undefined }
                            })}
                          >
                            {fmt.toUpperCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {anyActive(filters) && (
                    <button
                      className="filter-clear-all ss-caption"
                      onClick={() => setFilters({})}
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter chips */}
          {anyActive(filters) && (
            <div className="active-filter-chips">
              {filters.bpmMin != null && (
                <span className="active-filter-chip">BPM ≥ {filters.bpmMin}<button onClick={() => clearFilter('bpmMin')}><X size={9} /></button></span>
              )}
              {filters.bpmMax != null && (
                <span className="active-filter-chip">BPM ≤ {filters.bpmMax}<button onClick={() => clearFilter('bpmMax')}><X size={9} /></button></span>
              )}
              {filters.energyMin != null && (
                <span className="active-filter-chip">Energy ≥ {filters.energyMin}<button onClick={() => clearFilter('energyMin')}><X size={9} /></button></span>
              )}
              {filters.energyMax != null && (
                <span className="active-filter-chip">Energy ≤ {filters.energyMax}<button onClick={() => clearFilter('energyMax')}><X size={9} /></button></span>
              )}
              {filters.key && (
                <span className="active-filter-chip">Key: {filters.key}<button onClick={() => clearFilter('key')}><X size={9} /></button></span>
              )}
              {filters.genre && (
                <span className="active-filter-chip">Genre: {filters.genre}<button onClick={() => clearFilter('genre')}><X size={9} /></button></span>
              )}
              {filters.format?.map((fmt) => (
                <span key={fmt} className="active-filter-chip">{fmt.toUpperCase()}<button onClick={() => setFilters((f) => ({ ...f, format: f.format?.filter((x) => x !== fmt) }))}><X size={9} /></button></span>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'Library' && (
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
                    Showing playlist <strong>{selectedPlaylist.name}</strong>
                  </span>
                  <button
                    className="smart-filter-dismiss"
                    onClick={() => setSelectedPlaylist(null)}
                    aria-label="Show all tracks"
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
                    Showing tracks that fit <strong>{filterReferenceTrack.title}</strong>
                  </span>
                  <button
                    className="smart-filter-dismiss"
                    onClick={toggleSmartFilter}
                    aria-label="Clear smart filter"
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

            {!isLoading && !hasLibrary && (
              <EmptyState
                icon={FolderOpen}
                title="No library yet"
                body="Click Import in the top bar to load your Rekordbox XML export."
              />
            )}

            {!isLoading && hasLibrary && (
              <div
                ref={scrollContainerRef}
                className="track-list"
                style={{ overflowY: 'auto', flex: 1 }}
              >
                {displayTracks.length === 0 ? (
                  <div className="library-empty" style={{ padding: 16 }}>
                    <div className="ss-body-sm">
                      {smartFilterActive
                        ? 'No compatible tracks found. Try relaxing the BPM range or switching off smart filter.'
                        : anyActive(filters)
                          ? 'No tracks match the active filters.'
                          : selectedPlaylist
                            ? `No tracks in "${selectedPlaylist.name}".`
                            : `No tracks match "${searchQuery}"`}
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
                            compact={libraryDensity === 'compact'}
                            onClick={() => {
                              setSelectedLibraryTrack(track.id)
                              useSetStore.getState().setSelectedTrack(null)
                              startPreview(track)
                            }}
                            onDoubleClick={() => addTrackAfterSelected(track)}
                            onContextMenu={(e) => handleContextMenu(track, e)}
                            onShowCombos={() => handleShowCombos(track)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Crates' && <CratesLibraryTab />}

      {tab === 'Sets' && (
        <div className="track-list">
          {savedSets.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title="No saved sets yet"
              body="Build a set in the timeline and it will appear here."
            />
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
          onPreview={() => { startPreview(ctxMenu.track); setCtxMenu(null) }}
          onFindSimilar={() => { handleFindSimilar(ctxMenu.track); setCtxMenu(null) }}
          onAddToSet={() => { addTrackAfterSelected(ctxMenu.track); setCtxMenu(null) }}
          onEditCues={() => { handleEditCues(ctxMenu.track); setCtxMenu(null) }}
          onShowCombos={() => { void handleShowCombos(ctxMenu.track); setCtxMenu(null) }}
        />
      )}

      {/* Combos popover */}
      {combosData && (
        <div
          className="combos-overlay"
          role="dialog"
          aria-label={`Tracks played after ${combosData.track.title}`}
          onClick={(e) => { if (e.target === e.currentTarget) setCombosData(null) }}
        >
          <div className="combos-popover glass-3">
            <div className="combos-header">
              <div>
                <div className="ss-label" style={{ color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>After</div>
                <div className="ss-body-sm" style={{ fontWeight: 500 }}>{combosData.track.title}</div>
              </div>
              <button className="smart-filter-dismiss" onClick={() => setCombosData(null)} aria-label="Close">
                <X size={12} strokeWidth={2} />
              </button>
            </div>
            {combosData.results.length === 0 ? (
              <div className="ss-caption" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>
                No play history yet. Import your Rekordbox performance data to see this.
              </div>
            ) : (
              <div className="combos-list">
                {combosData.results.slice(0, 5).map((c) => (
                  <div key={c.track.id} className="combo-row">
                    <div className="combo-track">
                      <div className="ss-body-sm">{c.track.title}</div>
                      <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>{c.track.artist}</div>
                    </div>
                    <span className="combo-count ss-caption">{c.count}×</span>
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
