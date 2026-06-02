import clsx from 'clsx'
import { getCamelotColor } from '@/utils/camelotColors'
import { camelotToOpenKey } from '@/utils/camelot'
import { useUiStore } from '@/stores/uiStore'
import { LearnTooltip } from '@/components/learn/LearnTooltip'
import { Coachmark } from '@/components/learn/Coachmark'
import { explainCamelotKey } from '@/utils/learnMode/explanations'

interface KeyChipProps {
  /** Camelot notation, e.g. "9A", "11B". */
  children: string
  className?: string
}

export function KeyChip({ children, className }: KeyChipProps): React.JSX.Element {
  const keyNotation = useUiStore((s) => s.keyNotation)
  const { color, background, border } = getCamelotColor(children)
  const label = keyNotation === 'standard' ? camelotToOpenKey(children) : children
  return (
    <Coachmark concept="camelot">
      <LearnTooltip explanation={explainCamelotKey(children)} iconLabel="What is a Camelot key?">
        <span
          className={clsx('camelot', className)}
          style={{ color, background, borderColor: border }}
        >
          {label}
        </span>
      </LearnTooltip>
    </Coachmark>
  )
}
