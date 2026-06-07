import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line
} from 'recharts'
import { Share2, Fingerprint } from 'lucide-react'
import { useRecallStore } from '@/stores/recallStore'
import { getCamelotColor } from '@/utils/camelotColors'
import { NoLibraryState } from '@/components/shared/NoLibraryState'
import { IdentityShareCard } from './IdentityShareCard'
import type { IdentitySnapshot } from '@/types'

// Dark, glassy tooltip matching the app — recharts' default is a white box.
const TOOLTIP = {
  contentStyle: {
    background: 'rgba(20, 22, 30, 0.96)',
    border: '1px solid var(--border-default)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 12,
    boxShadow: '0 12px 32px rgba(0,0,0,0.45)'
  },
  labelStyle: { color: 'var(--text-tertiary)', marginBottom: 2 },
  itemStyle: { color: 'var(--text-primary)' },
  cursor: { fill: 'rgba(255,255,255,0.05)' }
} as const

function StatList({
  title,
  rows
}: {
  title: string
  rows: { label: string; count: number }[]
}): React.JSX.Element {
  const { t } = useTranslation('recall')
  return (
    <div className="recall-stat-card glass-2">
      <h3 className="recall-stat-title">{title}</h3>
      <ol className="recall-stat-list">
        {rows.slice(0, 8).map((r) => (
          <li key={r.label}>
            <span className="recall-stat-label">{r.label || '—'}</span>
            <span className="recall-stat-count">{r.count}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="recall-stat-empty">{t('identity.fillsIn')}</li>}
      </ol>
    </div>
  )
}

/**
 * Custom stacked-bar chart for "which keys dominate at each BPM zone." Recharts
 * stacked bars need every Bar pre-declared at render time, but a 24-key library
 * with ~12 zones makes that unwieldy. A hand-rolled SVG bar keeps the JSX tight
 * and lets each Camelot segment use its wheel-position colour from camelotColors.
 */
function KeyByBpmChart({ data }: { data: IdentitySnapshot['keyByBpmZone'] }): React.JSX.Element {
  const { t } = useTranslation('recall')
  if (data.length === 0) {
    return (
      <div className="recall-stat-empty" style={{ padding: 24 }}>
        {t('identity.noKeyBpm')}
      </div>
    )
  }

  const PADDING = { top: 12, right: 8, bottom: 28, left: 36 }
  const HEIGHT = 220
  const innerH = HEIGHT - PADDING.top - PADDING.bottom

  // Max zone total drives the bar height scale.
  const maxTotal = Math.max(...data.map((z) => z.total))

  // Render-time width is unknown — use viewBox + a flex container.
  const WIDTH = Math.max(600, data.length * 64)
  const innerW = WIDTH - PADDING.left - PADDING.right
  const barSlot = innerW / data.length
  const barW = Math.min(48, barSlot - 12)

  return (
    <div className="recall-keybpm-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" width="100%">
        {/* Y-axis tick */}
        <text
          x={PADDING.left - 6}
          y={PADDING.top + 4}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-tertiary)"
          fontFamily="var(--font-sans)"
        >
          {maxTotal}
        </text>
        <text
          x={PADDING.left - 6}
          y={PADDING.top + innerH}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-tertiary)"
          fontFamily="var(--font-sans)"
        >
          0
        </text>

        {data.map((zone, zi) => {
          const cx = PADDING.left + zi * barSlot + barSlot / 2
          const x = cx - barW / 2

          // Sort keys by count descending so the dominant key sits at the
          // bottom of the stack (visually heaviest).
          const entries = Object.entries(zone.keys).sort((a, b) => b[1] - a[1])

          let yCursor = PADDING.top + innerH
          const segments = entries.map(([key, count]) => {
            const h = (count / maxTotal) * innerH
            yCursor -= h
            const colour = getCamelotColor(key)
            return (
              <rect
                key={key}
                x={x}
                y={yCursor}
                width={barW}
                height={h}
                fill={colour.color}
                opacity={0.85}
              >
                <title>{t('identity.keyByBpmTooltip', { range: zone.range, key, count })}</title>
              </rect>
            )
          })

          // Label the dominant key on top of the bar when there's room.
          const topKey = entries[0]?.[0]

          return (
            <g key={zone.range}>
              {segments}
              {topKey && (
                <text
                  x={cx}
                  y={PADDING.top + innerH - (zone.total / maxTotal) * innerH - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-secondary)"
                  fontFamily="var(--font-sans)"
                >
                  {topKey}
                </text>
              )}
              <text
                x={cx}
                y={PADDING.top + innerH + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-sans)"
              >
                {zone.range}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function IdentitySection(): React.JSX.Element {
  const { t } = useTranslation('recall')
  const identity = useRecallStore((s) => s.identity)
  const loading = useRecallStore((s) => s.identityLoading)
  const loadIdentity = useRecallStore((s) => s.loadIdentity)
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    void loadIdentity()
  }, [loadIdentity])

  const hasShareData = useMemo(() => (identity ? identity.totalTracks > 0 : false), [identity])

  if (loading && !identity) {
    return (
      <div className="recall-section">
        <div className="recall-empty">{t('identity.reading')}</div>
      </div>
    )
  }
  if (!identity) {
    return (
      <div className="recall-section">
        <NoLibraryState
          icon={Fingerprint}
          title={t('identity.noLibraryTitle')}
          body={t('identity.noLibraryBody')}
        />
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <div className="recall-section-head-row">
          <div>
            <h2 className="ss-h2">{t('identity.title')}</h2>
            <p className="recall-section-sub">{t('identity.subtitle')}</p>
          </div>
          {hasShareData && (
            <button
              type="button"
              className="identity-share-toggle"
              onClick={() => setShowShare((s) => !s)}
            >
              <Share2 size={14} strokeWidth={1.7} />
              {showShare ? t('identity.hideShareCard') : t('identity.shareAsImage')}
            </button>
          )}
        </div>
      </header>

      {showShare && <IdentityShareCard identity={identity} />}

      <div className="recall-charts">
        <div className="recall-chart-card glass-2">
          <h3 className="recall-stat-title">{t('identity.bpmSpread')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={identity.bpmHistogram}>
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} width={28} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="recall-chart-card glass-2">
          <h3 className="recall-stat-title">{t('identity.energyProfile')}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={identity.energyDistribution}>
              <XAxis dataKey="level" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} width={28} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {identity.tasteTimeline.length > 0 && (
          <div className="recall-chart-card glass-2 recall-chart-wide">
            <h3 className="recall-stat-title">{t('identity.libraryGrowth')}</h3>
            <p className="recall-chart-sub">{t('identity.libraryGrowthSub')}</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={identity.tasteTimeline}>
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} width={28} />
                <Tooltip {...TOOLTIP} cursor={{ stroke: 'var(--border-emphasis)' }} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                  name={t('identity.addedSeries')}
                />
                <Line
                  type="monotone"
                  dataKey="performedCount"
                  stroke="var(--text-tertiary)"
                  strokeWidth={1.5}
                  dot={false}
                  name={t('identity.playedSeries')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {identity.keyByBpmZone.length > 0 && (
          <div className="recall-chart-card glass-2 recall-chart-wide">
            <h3 className="recall-stat-title">{t('identity.keyPalette')}</h3>
            <p className="recall-chart-sub">{t('identity.keyPaletteSub')}</p>
            <KeyByBpmChart data={identity.keyByBpmZone} />
          </div>
        )}
      </div>

      <div className="recall-stat-grid">
        <StatList title={t('identity.topGenres')} rows={identity.genreDistribution} />
        <StatList title={t('identity.topArtists')} rows={identity.topArtists} />
        <StatList title={t('identity.topLabels')} rows={identity.topLabels} />
        <StatList title={t('identity.keySpread')} rows={identity.keyDistribution} />
      </div>
    </div>
  )
}
