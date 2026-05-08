import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { LibraryTab } from '@/types'
import { SearchInput } from '@/components/shared/SearchInput'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
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
  const { smartFilter, toggleSmartFilter } = useUiStore()
  const { startPreview, previewTrack, isPlaying } = usePlaybackStore()

  const setTrackIds = new Set(currentSet?.tracks.map((st) => st.trackId) ?? [])

  // The currently selected set track (for smart filter)
  const selectedSetTrack = currentSet?.tracks.find((st) => st.id === selectedTrackId) ?? null

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

  return (
    <div className="panel glass-1">
      <SearchInput
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
          {filterActive && selectedSetTrack && (
            <div className="smart-filter-banner">
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
            </div>
          )}

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
            <div className="library-empty">
              <div className="ss-h3">No library yet</div>
              <div className="ss-body-sm">
                Click Import in the top bar to load your Rekordbox XML export.
              </div>
            </div>
          )}

          {!isLoading && hasLibrary && (
            <div className="track-list">
              {displayTracks.length === 0 ? (
                <div className="library-empty" style={{ padding: 16 }}>
                  <div className="ss-body-sm">
                    {filterActive
                      ? 'No compatible tracks found. Try relaxing the BPM range or switching off smart filter.'
                      : `No tracks match "${searchQuery}"`}
                  </div>
                </div>
              ) : (
                displayTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    inSet={setTrackIds.has(track.id)}
                    playing={previewTrack?.id === track.id && isPlaying}
                    onDoubleClick={() => startPreview(track)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {tab === 'Sets' && (
        <div className="track-list">
          {savedSets.length === 0 ? (
            <div className="library-empty">
              <div className="ss-h3">No saved sets yet</div>
              <div className="ss-body-sm">
                Build a set in the timeline and it will appear here.
              </div>
            </div>
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
