import { useUiStore } from '@/stores/uiStore'
import { useCompleteness } from '@/stores/progressStore'

/**
 * A quiet "how analysed is your library" meter. Reads derived library stats —
 * no new persistence. Per the endowed-progress principle the displayed value is
 * floored above zero once a library exists: an imported, partly-analysed library
 * is already real progress, so we never show a demotivating 0%.
 */
export function CompletenessMeter(): React.JSX.Element | null {
  const completeness = useCompleteness()
  const energyAnalysis = useUiStore((s) => s.energyAnalysis)

  if (!completeness || completeness.percent >= 100) return null

  const percent = Math.max(8, completeness.percent)
  const analysing = energyAnalysis && energyAnalysis.total > 0
  const note = analysing
    ? `Analysing energy — ${energyAnalysis.total - energyAnalysis.processed} tracks to go`
    : completeness.pendingEnergy > 0
      ? `${completeness.pendingEnergy.toLocaleString()} tracks still need energy analysis`
      : 'Add keys and BPMs to complete your library'

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
          Library analysed
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
