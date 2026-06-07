import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts'
import type { EnergyCurveType, SetTrack } from '@/types'
import { getTargetCurve } from '@/utils/energyCurve'

interface Props {
  tracks: SetTrack[]
  selectedPosition: number | null
  viewMode?: 'energy' | 'bpm'
  energyCurveType?: EnergyCurveType
}

interface CurvePoint {
  position: number
  actual: number
  target: number
}

interface DotRenderProps {
  cx?: number
  cy?: number
  payload?: CurvePoint
}

function SelectedDot(
  props: DotRenderProps & { selectedPosition: number | null }
): React.JSX.Element | null {
  const { cx, cy, payload, selectedPosition } = props
  if (!payload || payload.position !== selectedPosition) return null
  return <circle cx={cx} cy={cy} r={4} fill="#C8FF3D" stroke="none" />
}

export function EnergyCurveGraph({
  tracks,
  selectedPosition,
  viewMode = 'energy',
  energyCurveType
}: Props): React.JSX.Element {
  const { t } = useTranslation('timeline')
  if (tracks.length === 0) {
    return (
      <div className="tl-curve glass-2" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />
    )
  }

  const targetCurve = energyCurveType ? getTargetCurve(energyCurveType, tracks.length) : null

  const data: CurvePoint[] = tracks.map((st, i) => ({
    position: i + 1,
    actual:
      viewMode === 'energy'
        ? (st.energyOverride ?? st.track.energy)
        : Math.round(st.track.bpm * 10) / 10,
    target: targetCurve ? targetCurve[i] : 5
  }))

  const yDomain: [number | string, number | string] =
    viewMode === 'energy' ? [1, 10] : ['auto', 'auto']

  return (
    <div className="tl-curve glass-2">
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 0 }}>
          <XAxis dataKey="position" hide />
          <YAxis domain={yDomain} hide />
          <Tooltip
            contentStyle={{
              background: 'rgba(20,22,32,0.95)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 11,
              color: 'rgba(255,255,255,0.85)',
              padding: '4px 8px'
            }}
            itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
            labelStyle={{ color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}
            labelFormatter={(v) => t('curve.trackLabel', { position: v })}
            formatter={(value, name) => [
              value,
              name === 'actual'
                ? viewMode === 'energy'
                  ? t('curve.seriesEnergy')
                  : t('curve.seriesBpm')
                : t('curve.seriesTarget')
            ]}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          {selectedPosition != null && (
            <ReferenceLine
              x={selectedPosition}
              stroke="#C8FF3D"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          )}
          {viewMode === 'energy' && (
            <Line
              type="monotone"
              dataKey="target"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1.5}
              strokeDasharray="3 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#C8FF3D"
            strokeWidth={1.5}
            dot={(props: DotRenderProps) => (
              <SelectedDot
                key={`dot-${props.payload?.position}`}
                {...props}
                selectedPosition={selectedPosition}
              />
            )}
            activeDot={{ r: 4, fill: '#C8FF3D', stroke: 'none' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
