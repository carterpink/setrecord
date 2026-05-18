import clsx from 'clsx'
import { getCamelotColor } from '@/utils/camelotColors'

interface KeyChipProps {
  /** Camelot notation, e.g. "9A", "11B". */
  children: string
  className?: string
}

export function KeyChip({ children, className }: KeyChipProps): React.JSX.Element {
  const { color, background, border } = getCamelotColor(children)
  return (
    <span
      className={clsx('camelot', className)}
      style={{ color, background, borderColor: border }}
    >
      {children}
    </span>
  )
}
