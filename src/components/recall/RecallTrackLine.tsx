import clsx from 'clsx'
import { Plus, Volume2, AlertCircle } from 'lucide-react'
import type { Track } from '@/types'
import { KeyChip } from '@/components/shared/KeyChip'
import { EnergyChip } from '@/components/shared/EnergyChip'
import { InlineWaveform } from '@/components/shared/InlineWaveform'
import { toMediaUrl } from '@/utils/mediaUrl'
import { formatBpm } from '@/utils/format'
import { useSetStore } from '@/stores/setStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'

interface RecallTrackLineProps {
  track: Track
  /** Optional note shown under the title (e.g. a gem reason). */
  note?: string
  /** Optional trailing badge (e.g. a transition count). */
  badge?: React.ReactNode
  /** Show a "+" add-to-set button. */
  addable?: boolean
  /** Compact mode: title truncated with ellipsis + hover-reveal (used in Combos lists). */
  compact?: boolean
}

/**
 * Recall's track row. Behaves like the Prepare library TrackRow: click to
 * preview (with an inline waveform while playing), chip-style energy, and an
 * add button that drops the track into the current set with a move toast.
 */
export function RecallTrackLine({
  track,
  note,
  badge,
  addable = true,
  compact = false
}: RecallTrackLineProps): React.JSX.Element {
  const addTrackAndToast = useSetStore((s) => s.addTrackAndToast)
  const startPreview = usePlaybackStore((s) => s.startPreview)
  const playing = usePlaybackStore((s) => s.previewTrack?.id === track.id && s.isPlaying)
  const previewCurrentTime = usePlaybackStore((s) => (playing ? s.currentTime : 0))

  const missing = track.missingFile === true && track.phantom !== true

  const handleAdd = (e: React.MouseEvent): void => {
    e.stopPropagation()
    addTrackAndToast(track)
  }

  return (
    <div
      className={clsx(
        'recall-line',
        playing && 'playing',
        missing && 'missing',
        compact && 'compact'
      )}
      role="button"
      tabIndex={0}
      title={missing ? `File not found: ${track.filePath}` : `${track.title} — ${track.artist}`}
      onClick={() => {
        if (!missing) startPreview(track)
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !missing) {
          e.preventDefault()
          startPreview(track)
        }
      }}
    >
      <div
        className="recall-line-art"
        style={track.artGradient ? { background: track.artGradient } : undefined}
      >
        {track.albumArtPath && <img src={toMediaUrl(track.albumArtPath)} alt="" loading="lazy" />}
        {missing ? (
          <span className="recall-line-art-badge">
            <AlertCircle size={13} strokeWidth={1.7} color="var(--semantic-warning)" />
          </span>
        ) : playing ? (
          <span className="recall-line-art-badge">
            <Volume2 size={13} strokeWidth={1.7} color="var(--accent)" />
          </span>
        ) : null}
      </div>
      <div className="recall-line-meta">
        <span className="recall-line-title" title={compact ? track.title : undefined}>
          {track.title}
        </span>
        <span className="recall-line-artist" title={compact ? track.artist : undefined}>
          {track.artist}
        </span>
        {note && <span className="recall-line-note">{note}</span>}
      </div>
      <span className="recall-line-bpm">{formatBpm(track.bpm)}</span>
      {track.key && <KeyChip>{track.key}</KeyChip>}
      <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <EnergyChip
          value={track.energy}
          isPending={!track.energySource || track.energySource === 'pending'}
          isOverride={track.energySource === 'user'}
          editable={!missing}
          onChange={(v) => void useLibraryStore.getState().setTrackEnergy(track.id, v)}
        />
      </span>
      {badge}
      {addable && (
        <button
          type="button"
          className="recall-line-add"
          title="Add to current set"
          aria-label="Add to current set"
          onClick={handleAdd}
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      )}
      {playing && !missing && (
        <div
          className="recall-line-wave"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <InlineWaveform
            filePath={track.filePath}
            currentTime={previewCurrentTime}
            onSeek={(ms) => usePlaybackStore.getState().requestSeek(ms)}
          />
        </div>
      )}
    </div>
  )
}
