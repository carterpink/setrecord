import clsx from 'clsx'
import { formatBpm } from '@/utils/format'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { Coachmark } from '@/components/learn/Coachmark'
import { explainBpmView } from '@/utils/learnMode/explanations'
import { BEGINNER_TOOLTIP_COPY } from '@/utils/learnMode/coachmarks'

interface BpmChipProps {
  /** Raw BPM value; formatted with the shared `formatBpm` helper. */
  children: number
  /** Preserves the caller's existing layout class (e.g. "track-bpm", "sugg-mono"). */
  className?: string
}

/**
 * Renders a BPM value with the same first-sight coachmark + (i) explainer the
 * key/energy chips carry, so beginners learn what tempo means the moment they
 * first see it. Unlike `KeyChip` this is a plain text wrapper (not a pill) — it
 * keeps the caller's class so existing layouts are untouched.
 */
export function BpmChip({ children, className }: BpmChipProps): React.JSX.Element {
  return (
    <Coachmark concept="bpm">
      <LearnTooltip
        explanation={explainBpmView()}
        basic={BEGINNER_TOOLTIP_COPY.bpm}
        iconLabel="What is BPM?"
      >
        <span className={clsx(className)} aria-label={`${formatBpm(children)} BPM`}>
          {formatBpm(children)}
        </span>
      </LearnTooltip>
    </Coachmark>
  )
}
