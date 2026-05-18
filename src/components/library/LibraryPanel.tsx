import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FolderOpen, ListMusic, X } from 'lucide-react'
import type { LibraryTab } from '@/types'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { camelotCompatible } from '@/utils/camelot'
import { TrackRow } from './TrackRow'
import { SetListRow } from './SetListRow'

const TABS: readonly LibraryTab[] = ['Library', 'Sets'] as const

export function LibraryPanel(): React.JSX.Element {
  const [tab, setTab] = useState<LibraryTab>('Library')
  const { tracks, searchQuery, searchResults, isLoading, hasLibrary, setSearchQuery } =
    useLibraryStore()
  const { savedSets, currentSet, loadSets, loadCurrentSet, selectedTrackId } =
    useSetStore()
  const { smartFilter, toggleSmartFilter, searchFocusTick } = useUiStore()
  const { startPreview, previewTrack, isPlaying } = usePlaybackStore()

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
    [setSearchQuery],
  )

  useEffect(() => {
    if (tab === 'Sets') loadSets()
  }, [tab, loadSets])

  // Base list: search results or full library
  const baseTracks = searchQuery.trim() ? searchResults : tracks

  // Apply smart filter on top if active and a track is selected
  const filterActive = smartFilter && selectedSetTrack !== null
  const displayTracks = filterActive
    ? baseTracks.filter((t) => {
        const bpmOk = Math.abs(t.bpm - selectedSetTrack.track.bpm) <= 8
        const keyOk = camelotCompatible(selectedSetTrack.track.key, t.key)
        return bpmOk && keyOk
      })
    : baseTracks

  const playingTrackId = previewTrack && isPlaying ? previewTrack.id : null
  const rowVirtualizer = useVirtualizer({
    count: displayTracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => (displayTracks[index]?.id === playingTrackId ? 96 : 56),
    overscan: 10,
    // Re-key when the playing row changes so estimateSize is re-evaluated
    getItemKey: (index) => `${displayTracks[index]?.id ?? index}:${displayTracks[index]?.id === playingTrackId ? 'p' : 'n'}`,
  })

  return (
    <div className="panel glass-1">
      <SearchInput
        ref={searchRef}
        placeholder="Search library, sets, cue points…"
        kbd="⌘K"
        onChange={handleSearch}
        defaultValue={searchQuery}
      />

      <div className="library-tabs">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'Library' && (
        <>
          {/* Smart filter banner */}
          <AnimatePresence initial={false}>
            {filterActive && selectedSetTrack && (
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
                  Showing tracks that fit{' '}
                  <strong>{selectedSetTrack.track.title}</strong>
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
                  <div className="track-art" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <div className="track-meta">
                    <div
                      className="t"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 4,
                        height: 12,
                        width: '70%',
                      }}
                    />
                    <div
                      className="a"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 4,
                        height: 10,
                        width: '50%',
                        marginTop: 4,
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
                    {filterActive
                      ? 'No compatible tracks found. Try relaxing the BPM range or switching off smart filter.'
                      : `No tracks match "${searchQuery}"`}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
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
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TrackRow
                          track={track}
                          inSet={setTrackIds.has(track.id)}
                          playing={previewTrack?.id === track.id && isPlaying}
                          onDoubleClick={() => startPreview(track)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

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
    </div>
  )
}
