import clsx from 'clsx'
import { getCamelotColor } from '@/utils/camelotColors'
import { camelotToOpenKey } from '@/utils/camelot'
import { useUiStore } from '@/stores/uiStore'

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
    <span
      className={clsx('camelot', className)}
      style={{ color, background, borderColor: border }}
    >
      {label}
    </span>
  )
}
