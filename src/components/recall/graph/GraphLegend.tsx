/**
 * GraphLegend.tsx — a small floating key explaining what the threads mean in the
 * current lens. Keeps the constellation legible without a manual.
 */

import { useTranslation } from 'react-i18next'
import type { GraphMode } from '@/types'

interface LegendRow {
  swatch: string
  labelKey: string
}

const ROWS: Record<GraphMode, LegendRow[]> = {
  past: [
    { swatch: 'var(--graph-mixed)', labelKey: 'graph.legend.mixed' },
    { swatch: 'var(--graph-gig)', labelKey: 'graph.legend.gig' }
  ],
  present: [{ swatch: 'var(--graph-present)', labelKey: 'graph.legend.path' }],
  future: [{ swatch: 'var(--graph-compatible)', labelKey: 'graph.legend.compatible' }],
  diff: [{ swatch: 'var(--graph-novel)', labelKey: 'graph.legend.novel' }]
}

export function GraphLegend({ mode }: { mode: GraphMode }): React.JSX.Element {
  const { t } = useTranslation('recall')
  const rows = ROWS[mode]
  return (
    <div className="graph-legend" aria-hidden>
      {rows.map((r) => (
        <span key={r.labelKey} className="graph-legend-row">
          <span className="graph-legend-swatch" style={{ background: r.swatch }} />
          {t(r.labelKey)}
        </span>
      ))}
    </div>
  )
}
