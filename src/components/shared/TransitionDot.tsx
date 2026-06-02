import clsx from 'clsx'
import type { TransitionDotKind } from '@/types'
import { Coachmark } from '@/components/learn/Coachmark'

interface TransitionDotProps {
  kind: TransitionDotKind
  className?: string
}

/**
 * 8px semantic dot with a soft glow. `trainwreck` renders a small triangle instead.
 */
export function TransitionDot({ kind, className }: TransitionDotProps): React.JSX.Element {
  const dot =
    kind === 'trainwreck' ? (
      <span className={clsx('triangle', className)} aria-hidden="true" />
    ) : (
      <span className={clsx('dot', kind, className)} aria-hidden="true" />
    )
  return <Coachmark concept="transition">{dot}</Coachmark>
}
