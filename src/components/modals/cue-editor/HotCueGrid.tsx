import { useTranslation } from 'react-i18next'
import type { HotCue } from '@/types'
import { HOT_CUE_COLORS, HOT_CUE_LABELS } from '@/utils/constants'
import { formatMs } from '@/utils/format'

interface HotCueGridProps {
  hotCues: HotCue[]
  /** Toggle (set at playhead / clear) the hot cue at the given index. */
  onToggle: (index: number) => void
}

/** 4×2 grid of A–H hot-cue buttons. Filled buttons show their colour + time. */
export function HotCueGrid({ hotCues, onToggle }: HotCueGridProps): React.JSX.Element {
  const { t } = useTranslation('modals')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {HOT_CUE_LABELS.map((label, index) => {
        const hc = hotCues.find((h) => h.index === index)
        const color = HOT_CUE_COLORS[index]
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(index)}
            style={{
              padding: '10px 8px',
              borderRadius: 8,
              border: hc ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.12)',
              background: hc ? `${color}18` : 'rgba(255,255,255,0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition:
                'background-color var(--dur-hover) var(--ease-snappy), border-color var(--dur-hover) var(--ease-snappy)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: hc ? color : 'rgba(255,255,255,0.2)'
                }}
              />
              <span
                className="ss-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: hc ? color : 'var(--text-secondary)'
                }}
              >
                {label}
              </span>
            </div>
            {hc ? (
              <span className="ss-caption" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                {formatMs(hc.position)}
              </span>
            ) : (
              <span className="ss-caption" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                {t('cueEditor.hotCueEmpty')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
