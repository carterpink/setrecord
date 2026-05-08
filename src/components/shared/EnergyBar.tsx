import clsx from 'clsx'

interface EnergyBarProps {
  /** Number of segments lit (0–max). */
  level: number
  /** Total segments. Defaults to 4 — matches the design system. */
  max?: number
  className?: string
}

/**
 * 4-segment vertical bar (column-reverse so it fills bottom-up).
 * Lit segments use the chartreuse accent.
 */
export function EnergyBar({ level, max = 4, className }: EnergyBarProps): React.JSX.Element {
  return (
    <span className={clsx('ebar', className)} aria-label={`Energy ${level} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < level ? 'on' : undefined} />
      ))}
    </span>
  )
}
