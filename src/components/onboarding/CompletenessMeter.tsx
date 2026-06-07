import { useTranslation } from 'react-i18next'
import { useUiStore } from '@/stores/uiStore'
import { useCompleteness } from '@/stores/progressStore'

/**
 * A quiet "how analysed is your library" meter. Reads derived library stats —
 * no new persistence. Per the endowed-progress principle the displayed value is
 * floored above zero once a library exists: an imported, partly-analysed library
 * is already real progress, so we never show a demotivating 0%.
 */
export function CompletenessMeter(): React.JSX.Element | null {
  const { t, i18n } = useTranslation('onboarding')
  const completeness = useCompleteness()
  const energyAnalysis = useUiStore((s) => s.energyAnalysis)

  if (!completeness || completeness.percent >= 100) return null

  const percent = Math.max(8, completeness.percent)
  const analysing = energyAnalysis && energyAnalysis.total > 0
  const note = analysing
    ? t('meter.analysing', { count: energyAnalysis.total - energyAnalysis.processed })
    : completeness.pendingEnergy > 0
      ? t('meter.pendingEnergy', {
          count: completeness.pendingEnergy,
          formattedCount: completeness.pendingEnergy.toLocaleString(i18n.language)
        })
      : t('meter.addKeysBpms')

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span className="ss-caption" style={{ opacity: 0.7 }}>
          {t('meter.libraryAnalysed')}
        </span>
        <span className="ss-caption" style={{ opacity: 0.7 }}>
          {completeness.percent}%
        </span>
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 3,
          background: 'var(--surface-3, rgba(255,255,255,0.08))',
          overflow: 'hidden'
        }}
      >
        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <span className="ss-caption" style={{ opacity: 0.5 }}>
        {note}
      </span>
    </div>
  )
}
