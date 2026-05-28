import { useEffect } from 'react'
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
import { useRecallStore } from '@/stores/recallStore'

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
        {rows.length === 0 && <li className="recall-stat-empty">No data</li>}
      </ol>
    </div>
  )
}

export function IdentitySection(): React.JSX.Element {
  const identity = useRecallStore((s) => s.identity)
  const loading = useRecallStore((s) => s.identityLoading)
  const loadIdentity = useRecallStore((s) => s.loadIdentity)

  useEffect(() => {
    void loadIdentity()
  }, [loadIdentity])

  if (loading && !identity) {
    return (
      <div className="recall-section">
        <div className="recall-empty">Reading your fingerprint…</div>
      </div>
    )
  }
  if (!identity) {
    return (
      <div className="recall-section">
        <div className="recall-empty">No library data yet.</div>
      </div>
    )
  }

  return (
    <div className="recall-section">
      <header className="recall-section-head">
        <h2 className="ss-h2">Identity</h2>
        <p className="recall-section-sub">
          Your sound, in aggregate — the shape of everything you collect and play.
        </p>
      </header>

      <div className="recall-charts">
        <div className="recall-chart-card glass-2">
          <h3 className="recall-stat-title">BPM spread</h3>
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
          <h3 className="recall-stat-title">Energy profile</h3>
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
            <h3 className="recall-stat-title">Library growth</h3>
            <p className="recall-chart-sub">
              tracks added per quarter (by file date added) · plays once you log history
            </p>
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
                  name="added"
                />
                <Line
                  type="monotone"
                  dataKey="performedCount"
                  stroke="var(--text-tertiary)"
                  strokeWidth={1.5}
                  dot={false}
                  name="played"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="recall-stat-grid">
        <StatList title="Top genres" rows={identity.genreDistribution} />
        <StatList title="Top artists" rows={identity.topArtists} />
        <StatList title="Top labels" rows={identity.topLabels} />
        <StatList title="Key spread" rows={identity.keyDistribution} />
      </div>
    </div>
  )
}
