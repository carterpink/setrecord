import clsx from 'clsx'
import type { Set as DJSet } from '@/types'
import { formatDuration } from '@/utils/format'

interface SetListRowProps {
  set: DJSet
  isActive: boolean
  onLoad: () => void
}

export function SetListRow({ set, isActive, onLoad }: SetListRowProps): React.JSX.Element {
  const totalSeconds = set.tracks.reduce((s, st) => s + st.track.duration, 0)
  const updatedDate = new Date(set.updatedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })

  return (
    <div
      className={clsx('set-row', isActive && 'active')}
      onClick={onLoad}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onLoad() }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="ss-body" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {set.name}
        </div>
        <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
          {set.tracks.length} track{set.tracks.length !== 1 ? 's' : ''} · {formatDuration(totalSeconds)} · {updatedDate}
        </div>
      </div>
    </div>
  )
}
