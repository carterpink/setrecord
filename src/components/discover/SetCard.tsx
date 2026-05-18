import { Clock, Eye, Music } from 'lucide-react'
import { motion } from '@/components/shared/Motion'
import type { DiscoverSet } from '@/types'
import { useUiStore } from '@/stores/uiStore'
import { ClarityBadge } from './ClarityBadge'

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

interface Props {
  set: DiscoverSet
}

export function SetCard({ set }: Props): React.JSX.Element {
  const openSetDetails = useUiStore((s) => s.openSetDetails)
  return (
    <motion.article
      className="set-card glass-2"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0.12, 1] }}
      onClick={() => openSetDetails(set.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openSetDetails(set.id)
        }
      }}
      aria-label={`Open set details for ${set.title}`}
    >
      <div className="set-card-thumb-wrap">
        <img
          src={set.thumbnailUrl}
          alt=""
          className="set-card-thumb"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="set-card-thumb-overlay">
          <ClarityBadge clarity={set.clarity} />
        </div>
      </div>
      <div className="set-card-body">
        <div className="set-card-dj">{set.djName}</div>
        {set.eventName && <div className="set-card-event">{set.eventName}</div>}
        <div className="set-card-desc">{set.description}</div>
        <div className="set-card-stats">
          <span title="Duration">
            <Clock size={12} strokeWidth={1.7} aria-hidden="true" />
            <span className="ss-mono">{formatDurationShort(set.durationSeconds)}</span>
          </span>
          <span title="Views">
            <Eye size={12} strokeWidth={1.7} aria-hidden="true" />
            <span className="ss-mono">{formatViews(set.viewCount)}</span>
          </span>
          <span title="Has tracklist" aria-label="Tracklist available">
            <Music size={12} strokeWidth={1.7} aria-hidden="true" />
          </span>
        </div>
      </div>
    </motion.article>
  )
}
