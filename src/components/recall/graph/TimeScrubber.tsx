/**
 * TimeScrubber.tsx — Past-lens time filter. Drag back through your history and
 * the constellation re-forms to just the mixes from that window, so you can
 * watch how your sound has moved over time.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGraphStore } from '@/stores/graphStore'

const DAY_MS = 86_400_000

const STOPS: { label?: string; days: number | null }[] = [
  { days: null }, // all time
  { label: '1y', days: 365 },
  { label: '6m', days: 182 },
  { label: '90d', days: 90 },
  { label: '30d', days: 30 }
]

export function TimeScrubber(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const setTimeWindow = useGraphStore((s) => s.setTimeWindow)
  const [idx, setIdx] = useState(0)

  const apply = (i: number): void => {
    setIdx(i)
    const days = STOPS[i].days
    setTimeWindow(
      days == null ? null : { after: new Date(Date.now() - days * DAY_MS).toISOString() }
    )
  }

  return (
    <div className="graph-scrubber">
      <span className="graph-scrubber-title">{t('graph.scrub.title')}</span>
      <input
        type="range"
        min={0}
        max={STOPS.length - 1}
        step={1}
        value={idx}
        aria-label={t('graph.scrub.title')}
        onChange={(e) => apply(Number(e.target.value))}
      />
      <span className="graph-scrubber-value">
        {STOPS[idx].days == null ? t('graph.scrub.all') : STOPS[idx].label}
      </span>
    </div>
  )
}
