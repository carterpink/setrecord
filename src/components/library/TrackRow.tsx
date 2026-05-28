import clsx from 'clsx'
import { useDraggable } from '@dnd-kit/core'
import { AlertCircle, History, ShoppingCart, Volume2 } from 'lucide-react'
import type { Track } from '@/types'
import { EnergyChip } from '@/components/shared/EnergyChip'
import { KeyChip } from '@/components/shared/KeyChip'
import { Waveform } from '@/components/shared/Waveform'
import { useClickOrDoubleClick } from '@/hooks/useClickOrDoubleClick'
import { useLibraryStore } from '@/stores/libraryStore'
import { usePlaybackStore } from '@/stores/playbackStore'
import { formatBpm } from '@/utils/format'
import { toMediaUrl } from '@/utils/mediaUrl'

interface TrackRowProps {
  track: Track
  playing?: boolean
  inSet?: boolean
  compact?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onShowCombos?: () => void
}

export function TrackRow({
  track,
  playing,
  inSet,
  compact,
  onClick,
  onDoubleClick,
  onContextMenu,
  onShowCombos,
}: TrackRowProps): React.JSX.Element {
  const isPhantom = track.phantom === true
  const missing = track.missingFile === true && !isPhantom
  const unavailable = missing || isPhantom
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${track.id}`,
    data: { source: 'library', track },
    disabled: unavailable,
  })

  // When both single-click and double-click handlers are supplied, defer the
  // single action by ~240ms so a double-click can cancel it before it fires.
  const disambiguated = useClickOrDoubleClick(
    onClick ?? (() => {}),
    onDoubleClick ?? (() => {}),
  )
  const useDisambiguation = !!onClick && !!onDoubleClick
  const handleClick = useDisambiguation ? disambiguated.onClick : onClick
  const handleDoubleClick = useDisambiguation ? disambiguated.onDoubleClick : onDoubleClick

  // Only subscribe to currentTime when this row is the playing one — avoids
  // re-rendering every other row on every audio tick.
  const previewCurrentTime = usePlaybackStore((s) =>
    playing && !missing ? s.currentTime : 0
  )

  if (compact) {
    // Compact 40px single-line layout: no artwork, title · artist inline
    return (
      <div
        ref={setNodeRef}
        className={clsx('track-row', 'track-row--compact', playing && !missing && 'playing', inSet && 'in-set', unavailable && 'missing', isPhantom && 'phantom')}
        style={{
          cursor: unavailable ? 'default' : isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.5 : unavailable ? 0.55 : 1,
        }}
        onClick={unavailable ? undefined : handleClick}
        onDoubleClick={unavailable ? undefined : handleDoubleClick}
        onContextMenu={unavailable ? undefined : onContextMenu}
        onKeyDown={(e) => { if (e.key === 'Enter' && !unavailable) onClick?.() }}
        title={isPhantom ? 'Phantom track' : missing ? `File not found: ${track.filePath}` : undefined}
        {...(unavailable ? {} : { ...listeners, ...attributes })}
      >
        <div className="compact-meta">
          <span className="compact-title">{track.title}</span>
          <span className="compact-sep" aria-hidden="true"> · </span>
          <span className="compact-artist">{track.artist}</span>
        </div>
        <div className="compact-actions">
          <span className="track-bpm">{formatBpm(track.bpm)}</span>
          <KeyChip>{track.key}</KeyChip>
          {onShowCombos && !unavailable && (
            <button
              className="row-history-btn"
              onClick={(e) => { e.stopPropagation(); onShowCombos() }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="What have I played after this?"
              title="What have I played after this?"
            >
              <History size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    )
  }

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
      onClick={unavailable ? undefined : handleClick}
      onDoubleClick={unavailable ? undefined : handleDoubleClick}
      onContextMenu={unavailable ? undefined : onContextMenu}
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
        {track.albumArtPath && (
          <img
            src={toMediaUrl(track.albumArtPath)}
            alt=""
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 'inherit',
            }}
            onError={(e) => {
              // Cache file deleted/corrupt — fall back to the gradient behind it.
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
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
        style={{ gridArea: 'nrg', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <EnergyChip
          value={track.energy}
          isPending={!track.energySource || track.energySource === 'pending'}
          isOverride={track.energySource === 'user'}
          editable={!unavailable}
          onChange={(v) => void useLibraryStore.getState().setTrackEnergy(track.id, v)}
        />
        {onShowCombos && !unavailable && (
          <button
            className="row-history-btn"
            onClick={(e) => { e.stopPropagation(); onShowCombos() }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="What have I played after this?"
            title="What have I played after this?"
          >
            <History size={12} strokeWidth={1.5} />
          </button>
        )}
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
