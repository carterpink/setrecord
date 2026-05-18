import clsx from 'clsx'
import { useDraggable } from '@dnd-kit/core'
import { AlertCircle, ShoppingCart, Volume2 } from 'lucide-react'
import type { Track } from '@/types'
import { EnergyBar } from '@/components/shared/EnergyBar'
import { KeyChip } from '@/components/shared/KeyChip'
import { Waveform } from '@/components/shared/Waveform'
import { usePlaybackStore } from '@/stores/playbackStore'
import { formatBpm } from '@/utils/format'

function toBarLevel(energy: number): number {
  return Math.max(1, Math.round(energy * 4 / 10))
}

function energyTitle(energy: number, source?: string): string {
  return !source || source === 'pending' ? 'NRG: analysing…' : `NRG: ${energy} / 10`
}

interface TrackRowProps {
  track: Track
  playing?: boolean
  inSet?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
}

export function TrackRow({ track, playing, inSet, onClick, onDoubleClick }: TrackRowProps): React.JSX.Element {
  const isPhantom = track.phantom === true
  const missing = track.missingFile === true && !isPhantom
  const unavailable = missing || isPhantom
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${track.id}`,
    data: { source: 'library', track },
    disabled: unavailable,
  })

  // Only subscribe to currentTime when this row is the playing one — avoids
  // re-rendering every other row on every audio tick.
  const previewCurrentTime = usePlaybackStore((s) =>
    playing && !missing ? s.currentTime : 0
  )

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'track-row',
        playing && !missing && 'playing',
        inSet && 'in-set',
        unavailable && 'missing', isPhantom && 'phantom',
      )}
      style={{
        cursor: unavailable ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : unavailable ? 0.55 : 1,
        gridTemplateColumns: '36px 1fr auto auto auto',
        gridTemplateAreas: playing && !missing
          ? '"art meta bpm key nrg" "wave wave wave wave wave"'
          : '"art meta bpm key nrg"',
        rowGap: playing && !missing ? 6 : 0,
      }}
      onClick={unavailable ? undefined : onClick}
      onDoubleClick={unavailable ? undefined : onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !unavailable) onClick?.()
      }}
      title={
        isPhantom
          ? 'Phantom track — buy or download to enable'
          : missing
            ? `File not found: ${track.filePath}`
            : undefined
      }
      {...(unavailable ? {} : { ...listeners, ...attributes })}
    >
      <div
        className="track-art"
        style={{
          gridArea: 'art',
          ...(track.artGradient ? { background: track.artGradient } : {}),
        }}
        aria-hidden="true"
      >
        {isPhantom ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 'inherit',
            }}
          >
            <ShoppingCart size={14} strokeWidth={1.5} color="var(--text-primary)" />
          </div>
        ) : missing ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
              borderRadius: 'inherit',
            }}
          >
            <AlertCircle size={14} strokeWidth={1.5} color="var(--semantic-warning)" />
          </div>
        ) : playing ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
              borderRadius: 'inherit',
            }}
          >
            <Volume2 size={14} strokeWidth={1.5} color="var(--accent)" />
          </div>
        ) : null}
      </div>
      <div className="track-meta" style={{ gridArea: 'meta' }}>
        <div className="t" style={unavailable ? { color: 'var(--text-secondary)' } : undefined}>
          {track.title}
        </div>
        <div className="a">
          {isPhantom ? (
            <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
              {track.artist} · Phantom — not in library
            </span>
          ) : missing ? (
            <span style={{ color: 'var(--semantic-warning)', fontSize: 10 }}>File not found</span>
          ) : (
            track.artist
          )}
        </div>
      </div>
      <div className="track-bpm" style={{ gridArea: 'bpm' }}>{formatBpm(track.bpm)}</div>
      <div style={{ gridArea: 'key' }}>
        <KeyChip>{track.key}</KeyChip>
      </div>
      <div
        style={{
          gridArea: 'nrg',
          display: 'flex',
          alignItems: 'center',
          opacity: !track.energySource || track.energySource === 'pending' ? 0.3 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        <EnergyBar
          level={!track.energySource || track.energySource === 'pending' ? 0 : toBarLevel(track.energy)}
          title={energyTitle(track.energy, track.energySource)}
        />
      </div>
      {playing && !missing && (
        <div
          style={{ gridArea: 'wave', width: '100%' }}
          // Don't drag/select the row when scrubbing
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
}
