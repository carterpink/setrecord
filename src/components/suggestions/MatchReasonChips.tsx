import clsx from 'clsx'
import type { MatchReason, Track } from '@/types'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { explainMatchReason } from '@/utils/learnMode/explanations'
import { useUiStore } from '@/stores/uiStore'

interface MatchReasonChipsProps {
  reasons: readonly MatchReason[]
  /** Currently-selected track in the set — required to generate Learn Mode explanations. */
  fromTrack?: Track
  /** Candidate track being recommended. */
  toTrack?: Track
}

/**
 * Wraps a small flex row of pill-shaped match reasons.
 * `quality === 'positive'` reasons get the chartreuse accent variant.
 * When Learn Mode is on (and from/to tracks are provided), each chip gets
 * an [i] icon that opens an explanatory popover.
 */
export function MatchReasonChips({
  reasons,
  fromTrack,
  toTrack,
}: MatchReasonChipsProps): React.JSX.Element {
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const canExplain = learnModeEnabled && fromTrack && toTrack

  return (
    <div className="reason-chips">
      {reasons.map((reason, i) => {
        const chip = (
          <span
            className={clsx('reason-chip', reason.quality === 'positive' && 'accent')}
          >
            {reason.label}
          </span>
        )
        if (!canExplain) {
          return <span key={`${reason.label}-${i}`}>{chip}</span>
        }
        return (
          <LearnTooltip
            key={`${reason.label}-${i}`}
            explanation={explainMatchReason(reason, fromTrack, toTrack)}
            iconLabel={`Explain ${reason.label}`}
          >
            {chip}
          </LearnTooltip>
        )
      })}
    </div>
  )
}
