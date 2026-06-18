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
  /** When provided the badge renders as a <button> and responds to clicks. */
  onClick?: () => void
  title?: string
}

/**
 * Pill-shaped status badge. Used for "Set safety", health summaries, etc.
 * Pass `onClick` to render it as an interactive button.
 */
export function Badge({
  dot,
  label,
  value,
  glass = 1,
  className,
  onClick,
  title
}: BadgeProps): React.JSX.Element {
  const cls = clsx('badge', `glass-${glass}`, onClick && 'badge--clickable', className)
  const inner = (
    <>
      {dot ? <TransitionDot kind={dot} /> : null}
      <span className="lbl">{label}</span>
      {value ? <span className="v">{value}</span> : null}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} title={title}>
        {inner}
      </button>
    )
  }
  return (
    <span className={cls} title={title}>
      {inner}
    </span>
  )
}
