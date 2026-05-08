import { useCallback, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Play, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SetTrack } from '@/types'
import { formatBpm, formatDuration, formatPosition } from '@/utils/format'
import { TransitionDot } from '@/components/shared/TransitionDot'

interface TimelineTrackCardProps {
  setTrack: SetTrack
  isSelected?: boolean
  onSelect?: () => void
  onRemove?: () => void
}

export function TimelineTrackCard({
  setTrack,
  isSelected,
  onSelect,
  onRemove,
}: TimelineTrackCardProps): React.JSX.Element {
  const { track, position, transitionScore } = setTrack
  const score = transitionScore

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
      className={clsx('tl-card glass-2', isSelected && 'selected')}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.() }}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="tl-handle"
        aria-label={`Preview ${track.title}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Play size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <div className="tl-body">
        <div className="tl-row1">
          <span className="tl-num ss-mono">{formatPosition(position)}</span>
          <span className="ss-h3">{track.title}</span>
        </div>
        <div className="ss-body-sm">
          {track.artist} · {formatBpm(track.bpm)} · {track.key}
        </div>
        {score ? (
          <div className="tl-q">
            <TransitionDot kind={score.dotKind} />
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
    </div>
  )
}
