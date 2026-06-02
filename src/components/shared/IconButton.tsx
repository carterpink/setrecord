import clsx from 'clsx'
import type { ButtonHTMLAttributes, ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ComponentType<LucideProps>
  size?: 'md' | 'sm'
  active?: boolean
  /** Required for screen readers since there is no visible label. */
  'aria-label': string
}

/**
 * Square icon-only button. 36×36 by default, 28×28 with size="sm".
 * Used for toolbar / dock / panel-header actions.
 */
export function IconButton({
  icon: Icon,
  size = 'md',
  active,
  className,
  ...rest
}: IconButtonProps): React.JSX.Element {
  const iconSize = size === 'sm' ? 14 : 16
  return (
    <button
      type="button"
      className={clsx('icon-btn', size === 'sm' && 'sm', active && 'active', className)}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}
