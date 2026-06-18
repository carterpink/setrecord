import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('shared')
  const keyNotation = useUiStore((s) => s.keyNotation)
  const { color, background, border } = getCamelotColor(children)
  const label = keyNotation === 'standard' ? camelotToOpenKey(children) : children
  return (
    <Coachmark concept="camelot">
      <LearnTooltip explanation={explainCamelotKey(children)} iconLabel={t('key.iconLabel')}>
        <span
          className={clsx('camelot', className)}
          style={{ color, background, borderColor: border }}
          aria-label={t('key.aria', { key: label })}
        >
          {label}
        </span>
      </LearnTooltip>
    </Coachmark>
  )
}
