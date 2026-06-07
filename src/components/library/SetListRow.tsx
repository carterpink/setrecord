import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { Set as DJSet } from '@/types'
import { formatDuration } from '@/utils/format'

interface SetListRowProps {
  set: DJSet
  isActive: boolean
  onLoad: () => void
}

export function SetListRow({ set, isActive, onLoad }: SetListRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation('library')
  const totalSeconds = set.tracks.reduce((s, st) => s + st.track.duration, 0)
  const updatedDate = new Date(set.updatedAt).toLocaleDateString(i18n.language, {
    day: '2-digit',
    month: 'short'
  })

  return (
    <div
      className={clsx('set-row', isActive && 'active')}
      onClick={onLoad}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onLoad()
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          className="ss-body"
          style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {set.name}
        </div>
        <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
          {t('sets.meta', {
            count: set.tracks.length,
            duration: formatDuration(totalSeconds),
            date: updatedDate
          })}
        </div>
      </div>
    </div>
  )
}
