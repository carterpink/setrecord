import clsx from 'clsx'
import { useDraggable } from '@dnd-kit/core'
import { Volume2 } from 'lucide-react'
import type { Track } from '@/types'
import { KeyChip } from '@/components/shared/KeyChip'
import { formatBpm } from '@/utils/format'

interface TrackRowProps {
  track: Track
  playing?: boolean
  inSet?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
}

export function TrackRow({ track, playing, inSet, onClick, onDoubleClick }: TrackRowProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${track.id}`,
    data: { source: 'library', track },
  })

  return (
    <div
      ref={setNodeRef}
      className={clsx('track-row', playing && 'playing', inSet && 'in-set')}
      style={{ cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.5 : 1 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick?.()
      }}
      {...listeners}
      {...attributes}
    >
      <div
        className="track-art"
        style={track.artGradient ? { background: track.artGradient } : undefined}
        aria-hidden="true"
      >
        {playing && (
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
        )}
      </div>
      <div className="track-meta">
        <div className="t">{track.title}</div>
        <div className="a">{track.artist}</div>
      </div>
      <div className="track-bpm">{formatBpm(track.bpm)}</div>
      <KeyChip>{track.key}</KeyChip>
    </div>
  )
}
