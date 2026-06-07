import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { RiskFactor } from '@/utils/learnMode/explanations'

interface TransitionRiskBreakdownProps {
  factors: readonly RiskFactor[]
}

const ICONS = {
  good: CheckCircle2,
  warning: AlertTriangle,
  risk: ShieldAlert
}

const COLORS = {
  good: 'var(--semantic-success, #6dd58c)',
  warning: 'var(--semantic-warning, #f5c451)',
  risk: 'var(--semantic-danger, #ff6e6e)'
}

export function TransitionRiskBreakdown({
  factors
}: TransitionRiskBreakdownProps): React.JSX.Element {
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      {factors.map((f, i) => {
        const Icon = ICONS[f.quality]
        return (
          <li key={`${f.label}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Icon
              size={14}
              strokeWidth={1.7}
              color={COLORS[f.quality]}
              style={{ flexShrink: 0, marginTop: 2 }}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ss-body-sm" style={{ fontWeight: 500 }}>
                {f.label}
              </div>
              <div className="ss-caption" style={{ opacity: 0.7, marginTop: 1 }}>
                {f.detail}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
