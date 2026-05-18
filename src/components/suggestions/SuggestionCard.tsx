import clsx from 'clsx'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Suggestion, Track } from '@/types'
import { KeyChip } from '@/components/shared/KeyChip'
import { motion } from '@/components/shared/Motion'
import type { Variants } from 'framer-motion'
import { formatBpm } from '@/utils/format'
import { MatchReasonChips } from './MatchReasonChips'

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.32, 0.72, 0.12, 1] },
  },
}

interface SuggestionCardProps {
  suggestion: Suggestion
  /** The currently-selected set track — used to generate Learn Mode "from → to" explanations. */
  fromTrack?: Track
  onAdd?: () => void
}

export function SuggestionCard({ suggestion, fromTrack, onAdd }: SuggestionCardProps): React.JSX.Element {
  const { track, matchReasons, best } = suggestion

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sugg-${track.id}`,
    data: { source: 'library', track },
  })

  return (
    <motion.div
      ref={setNodeRef}
      className={clsx('sugg-card', best ? 'glass-3 best' : 'glass-2')}
      variants={cardVariants}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onDoubleClick={onAdd}
      {...listeners}
      {...attributes}
    >
      {best ? (
        <motion.span
          className="best-badge"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0.12, 1], delay: 0.1 }}
        >
          Best match
        </motion.span>
      ) : null}

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

      <MatchReasonChips reasons={matchReasons} fromTrack={fromTrack} toTrack={track} />
    </motion.div>
  )
}
