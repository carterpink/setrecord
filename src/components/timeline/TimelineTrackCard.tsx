import { memo, useCallback, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { AlertCircle, ExternalLink, Pause, Play, ShoppingCart, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SetTrack, Track } from '@/types'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useUiStore } from '@/stores/uiStore'
import { formatBpm, formatDuration, formatPosition } from '@/utils/format'
import { EnergyBar } from '@/components/shared/EnergyBar'
import { TransitionDot } from '@/components/shared/TransitionDot'
import { Waveform } from '@/components/shared/Waveform'
import { KeyChip } from '@/components/shared/KeyChip'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { explainTransition } from '@/utils/learnMode/explanations'

function toBarLevel(energy: number): number {
  return Math.max(1, Math.round(energy * 4 / 10))
}

function energyTitle(energy: number, source?: string): string {
  return !source || source === 'pending' ? 'NRG: analysing…' : `NRG: ${energy} / 10`
}

interface TimelineTrackCardProps {
  setTrack: SetTrack
  /** Previous track in the set — used by Learn Mode to explain the transition into this slot. */
  previousTrack?: Track
  isSelected?: boolean
  onSelect?: () => void
  onRemove?: () => void
}

export const TimelineTrackCard = memo(function TimelineTrackCard({
  setTrack,
  previousTrack,
  isSelected,
  onSelect,
  onRemove,
}: TimelineTrackCardProps): React.JSX.Element {
  const { track, position, transitionScore } = setTrack
  const score = transitionScore
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const isPhantom = track.phantom === true
  const missing = track.missingFile === true && !isPhantom
  const { startPreview, togglePlay, previewTrack, isPlaying } = usePlaybackStore()
  const isThisPlaying = previewTrack?.id === track.id && isPlaying && !missing && !isPhantom
  // Only subscribe to currentTime ticks when this card is the playing one
  const previewCurrentTime = usePlaybackStore((s) =>
    isThisPlaying ? s.currentTime : 0
  )

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: setTrack.id,
    data: { source: 'timeline', setTrack },
  })

  // Combined ref: dnd-kit needs setNodeRef, we need the DOM node for scrollIntoView
  const domRef = useRef<HTMLDivElement | null>(null)
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      domRef.current = node
    },
    [setNodeRef],
  )

  // Scroll this card into view whenever it becomes selected
  useEffect(() => {
    if (isSelected && domRef.current) {
      domRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={combinedRef}
      style={style}
      className={clsx('tl-card glass-2', isSelected && 'selected', isPhantom && 'phantom')}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.() }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className={clsx('tl-handle', isThisPlaying && 'playing')}
        aria-label={
          isPhantom
            ? 'Phantom track — not in your library yet'
            : missing
              ? 'File not found'
              : isThisPlaying
                ? `Pause ${track.title}`
                : `Preview ${track.title}`
        }
        disabled={missing || isPhantom}
        title={
          isPhantom
            ? 'Buy or download this track to enable preview'
            : missing
              ? `File not found: ${track.filePath}`
              : undefined
        }
        style={missing || isPhantom ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (missing || isPhantom) return
          if (previewTrack?.id === track.id) {
            togglePlay()
          } else {
            startPreview(track)
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isPhantom ? (
          <ShoppingCart size={14} strokeWidth={1.5} aria-hidden="true" />
        ) : missing ? (
          <AlertCircle size={14} strokeWidth={1.5} color="var(--semantic-warning)" aria-hidden="true" />
        ) : isThisPlaying ? (
          <Pause size={14} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Play size={14} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>

      <div className="tl-body">
        <div className="tl-row1">
          <span className="tl-num ss-mono">{formatPosition(position)}</span>
          <span className="ss-h3">{track.title}</span>
        </div>
        <div className="ss-body-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{track.artist} · {formatBpm(track.bpm)} · <KeyChip>{track.key}</KeyChip></span>
          <EnergyBar
            horizontal
            level={!track.energySource || track.energySource === 'pending' ? 0 : toBarLevel(track.energy)}
            title={energyTitle(track.energy, track.energySource)}
            style={{
              marginLeft: 4,
              opacity: !track.energySource || track.energySource === 'pending' ? 0.3 : 1,
              transition: 'opacity 0.4s ease',
            }}
          />
        </div>
        {missing && (
          <div
            className="ss-caption"
            style={{ color: 'var(--semantic-warning)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <AlertCircle size={10} strokeWidth={2} />
            File not found
          </div>
        )}
        {isPhantom && track.discoverMeta && (
          <div className="tl-phantom-shop ss-caption">
            <button
              type="button"
              className="tl-shop-link"
              title="Search Beatport"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(track.discoverMeta!.beatportUrl)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} strokeWidth={1.7} aria-hidden="true" />
              Beatport
            </button>
            <button
              type="button"
              className="tl-shop-link"
              title="Search SoundCloud"
              onClick={(e) => {
                e.stopPropagation()
                void window.setsense.openExternal(track.discoverMeta!.soundcloudUrl)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} strokeWidth={1.7} aria-hidden="true" />
              SoundCloud
            </button>
          </div>
        )}
        {score ? (
          <div className="tl-q" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <TransitionDot kind={score.dotKind} />
            {learnModeEnabled && previousTrack ? (
              <LearnTooltip
                explanation={explainTransition(score, previousTrack, track)}
                iconLabel={`Explain transition: ${score.label}`}
              >
                <span
                  className="ss-caption"
                  style={{
                    color:
                      score.dotKind === 'trainwreck'
                        ? 'var(--semantic-danger)'
                        : `var(--semantic-${score.dotKind})`,
                  }}
                >
                  {score.label}
                </span>
              </LearnTooltip>
            ) : (
              <span
                className="ss-caption"
                style={{
                  color:
                    score.dotKind === 'trainwreck'
                      ? 'var(--semantic-danger)'
                      : `var(--semantic-${score.dotKind})`,
                }}
              >
                {score.label}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="tl-time">{formatDuration(track.duration)}</div>

      {onRemove && (
        <button
          type="button"
          className="icon-btn sm"
          aria-label={`Remove ${track.title}`}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={13} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {isThisPlaying && (
        <div
          className="tl-wave"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Waveform
            filePath={track.filePath}
            compact
            currentTime={previewCurrentTime}
            onSeek={(ms) => usePlaybackStore.getState().requestSeek(ms)}
          />
        </div>
      )}
    </div>
  )
})
