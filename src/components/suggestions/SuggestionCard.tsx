import clsx from 'clsx'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Suggestion } from '@/types'
import { KeyChip } from '@/components/shared/KeyChip'
import { formatBpm } from '@/utils/format'
import { MatchReasonChips } from './MatchReasonChips'

interface SuggestionCardProps {
  suggestion: Suggestion
  onAdd?: () => void
}

export function SuggestionCard({ suggestion, onAdd }: SuggestionCardProps): React.JSX.Element {
  const { track, matchReasons, best } = suggestion

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sugg-${track.id}`,
    data: { source: 'library', track },
  })

  return (
    <div
      ref={setNodeRef}
      className={clsx('sugg-card', best ? 'glass-3 best' : 'glass-2')}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onDoubleClick={onAdd}
      {...listeners}
      {...attributes}
    >
      {best ? <span className="best-badge">Best match</span> : null}

      <div className="sugg-row" style={{ marginTop: best ? 6 : 0 }}>
        <div>
          <div className="sugg-title">{track.title}</div>
          <div className="sugg-artist">{track.artist}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="sugg-mono">{formatBpm(track.bpm)}</div>
          <div style={{ marginTop: 4 }}>
            <KeyChip>{track.key}</KeyChip>
          </div>
        </div>
      </div>

      <MatchReasonChips reasons={matchReasons} />
    </div>
  )
}
