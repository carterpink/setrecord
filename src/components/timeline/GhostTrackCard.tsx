import { Plus } from 'lucide-react'
import type { Suggestion } from '@/types'
import { formatBpm, formatDuration } from '@/utils/format'

interface GhostTrackCardProps {
  suggestion: Suggestion
  onAdd: () => void
}

export function GhostTrackCard({ suggestion, onAdd }: GhostTrackCardProps): React.JSX.Element {
  const { track } = suggestion

  return (
    // tl-card grid: 32px | 1fr | auto | auto — ghost must fill all four columns
    <div className="tl-card glass-2" style={{ opacity: 0.4, pointerEvents: 'none' }}>
      {/* col 1: 32px handle placeholder — keeps grid aligned */}
      <div style={{ width: 32, height: 32, flexShrink: 0 }} aria-hidden="true" />

      {/* col 2: body — mirrors real card structure so spacing is identical */}
      <div className="tl-body">
        <div className="tl-row1">
          <span className="tl-num ss-mono" aria-hidden="true" />
          <span className="ss-h3">{track.title}</span>
        </div>
        <div className="ss-body-sm">
          {track.artist} · {formatBpm(track.bpm)} · {track.key}
        </div>
        <div className="tl-q">
          <span className="ss-caption" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Best suggestion
          </span>
        </div>
      </div>

      {/* col 3: duration */}
      <div className="tl-time">{formatDuration(track.duration)}</div>

      {/* col 4: add button — pointer-events punched through the dimmed overlay */}
      <button
        type="button"
        className="icon-btn sm"
        aria-label={`Add ${track.title} to set`}
        style={{ pointerEvents: 'all' }}
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Plus size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
