import clsx from 'clsx'
import type { TransitionDotKind } from '@/types'
import { TransitionDot } from './TransitionDot'

interface BadgeProps {
  /** Optional semantic dot displayed left of the label */
  dot?: TransitionDotKind
  label: string
  /** Optional value (rendered in primary text + tabular numerals) */
  value?: string
  /** Glass surface level. 1 (subtle) by default. */
  glass?: 1 | 2 | 3
  className?: string
}

/**
 * Pill-shaped status badge. Used for "Set safety", health summaries, etc.
 */
export function Badge({ dot, label, value, glass = 1, className }: BadgeProps): React.JSX.Element {
  return (
    <span className={clsx('badge', `glass-${glass}`, className)}>
      {dot ? <TransitionDot kind={dot} /> : null}
      <span className="lbl">{label}</span>
      {value ? <span className="v">{value}</span> : null}
    </span>
  )
}
