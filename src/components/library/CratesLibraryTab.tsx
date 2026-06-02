import { useEffect } from 'react'
import { Layers, ChevronLeft } from 'lucide-react'
import type { CrateWithCount } from '@/types'
import { useRecallStore } from '@/stores/recallStore'
import { useSetStore } from '@/stores/setStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { TrackRow } from './TrackRow'

/** Cap rows rendered at once — this list isn't virtualised. */
const MAX_RENDER = 200

/**
 * Smart crates inside the Prepare panel — the same living, rule-based crates
 * from Recall, but their tracks render as full library rows so you can preview,
 * drag, and double-click straight into the working set.
 */
export function CratesLibraryTab(): React.JSX.Element {
  const crates = useRecallStore((s) => s.crates)
  const loading = useRecallStore((s) => s.cratesLoading)
  const loadCrates = useRecallStore((s) => s.loadCrates)
  const selectCrate = useRecallStore((s) => s.selectCrate)
  const selected = useRecallStore((s) => s.selectedCrate)
  const selectedLoading = useRecallStore((s) => s.selectedCrateLoading)

  const { currentSet, addTrackAfterSelected } = useSetStore()
  const { startPreview, previewTrack, isPlaying } = usePlaybackStore()
  const setTrackIds = new Set(currentSet?.tracks.map((st) => st.trackId) ?? [])

  useEffect(() => {
    void loadCrates()
  }, [loadCrates])

  if (selected) {
    return (
      <div className="track-list" style={{ overflowY: 'auto', flex: 1 }}>
        <button type="button" className="crate-back" onClick={() => void selectCrate(null)}>
          <ChevronLeft size={14} strokeWidth={1.7} /> All crates
        </button>
        <div className="crate-tab-head">
          <span className="crate-tab-name">{selected.crate.name}</span>
          <span className="crate-tab-count">{selected.tracks.length} tracks</span>
        </div>
        {selectedLoading && (
          <div className="library-empty" style={{ padding: 16 }}>
            Evaluating crate…
          </div>
        )}
        {!selectedLoading &&
          selected.tracks
            .slice(0, MAX_RENDER)
            .map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                inSet={setTrackIds.has(track.id)}
                playing={previewTrack?.id === track.id && isPlaying}
                onClick={() => startPreview(track)}
                onDoubleClick={() => addTrackAfterSelected(track)}
              />
            ))}
        {selected.tracks.length > MAX_RENDER && (
          <div className="recall-more-note">
            Showing first {MAX_RENDER} of {selected.tracks.length}.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="track-list" style={{ overflowY: 'auto', flex: 1, padding: 10 }}>
      {loading && crates.length === 0 && (
        <div className="library-empty" style={{ padding: 16 }}>
          Loading crates…
        </div>
      )}
      <div className="recall-crate-grid">
        {crates.map((crate: CrateWithCount) => (
          <button
            key={crate.id}
            type="button"
            className="recall-crate-card glass-2"
            onClick={() => void selectCrate(crate)}
          >
            <Layers size={18} strokeWidth={1.5} />
            <span className="recall-crate-name">{crate.name}</span>
            <span className="recall-crate-count">{crate.trackCount} tracks</span>
          </button>
        ))}
      </div>
      <p className="crate-tab-hint">
        Crates re-fill themselves from rules. Create and edit them on the Recall tab.
      </p>
    </div>
  )
}
