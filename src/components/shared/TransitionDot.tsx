import clsx from 'clsx'
import type { TransitionDotKind } from '@/types'

interface TransitionDotProps {
  kind: TransitionDotKind
  className?: string
}

/**
 * 8px semantic dot with a soft glow. `trainwreck` renders a small triangle instead.
 */
export function TransitionDot({ kind, className }: TransitionDotProps): React.JSX.Element {
  if (kind === 'trainwreck') {
    return <span className={clsx('triangle', className)} aria-hidden="true" />
  }
  return <span className={clsx('dot', kind, className)} aria-hidden="true" />
}
