import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  level: 1 | 2 | 3
  children?: ReactNode
}

/**
 * The three SetSense glass surfaces.
 * Glass 1 = scrollable panels, Glass 2 = cards/dropdowns, Glass 3 = modals/dock.
 * Token values live in src/styles/tokens.css.
 */
export function Glass({ level, className, children, ...rest }: GlassProps): React.JSX.Element {
  return (
    <div className={clsx(`glass-${level}`, className)} {...rest}>
      {children}
    </div>
  )
}
