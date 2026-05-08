import clsx from 'clsx'
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Optional Lucide icon component (e.g. `Upload`, `Download`). */
  icon?: ComponentType<LucideProps>
  children?: ReactNode
}

/**
 * 36px-tall pill button with chartreuse primary, glass-2 secondary, and
 * transparent ghost variants. Lucide stroke icons only.
 */
export function Button({
  variant = 'secondary',
  icon: Icon,
  children,
  className,
  ...rest
}: ButtonProps): React.JSX.Element {
  const variantClass: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  }

  return (
    <button type="button" className={clsx('btn', variantClass[variant], className)} {...rest}>
      {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
