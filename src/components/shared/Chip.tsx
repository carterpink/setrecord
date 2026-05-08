import clsx from 'clsx'
import type { ReactNode } from 'react'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

/**
 * Pill with optional `selected` accent state. Used in modals + match-reason rows.
 */
export function Chip({ selected, onClick, children, className }: ChipProps): React.JSX.Element {
  return (
    <span
      className={clsx('chip', selected && 'selected', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </span>
  )
}
