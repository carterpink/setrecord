import clsx from 'clsx'
import type { MatchReason } from '@/types'

interface MatchReasonChipsProps {
  reasons: readonly MatchReason[]
}

/**
 * Wraps a small flex row of pill-shaped match reasons.
 * `quality === 'positive'` reasons get the chartreuse accent variant.
 */
export function MatchReasonChips({ reasons }: MatchReasonChipsProps): React.JSX.Element {
  return (
    <div className="reason-chips">
      {reasons.map((reason, i) => (
        <span
          key={`${reason.label}-${i}`}
          className={clsx('reason-chip', reason.quality === 'positive' && 'accent')}
        >
          {reason.label}
        </span>
      ))}
    </div>
  )
}
