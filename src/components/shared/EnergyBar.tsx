import clsx from 'clsx'

interface EnergyBarProps {
  /** Number of segments lit (0–max). */
  level: number
  /** Total segments. Defaults to 4 — matches the design system. */
  max?: number
  /** Render segments left-to-right instead of bottom-up. */
  horizontal?: boolean
  className?: string
  style?: React.CSSProperties
  title?: string
}

export function EnergyBar({
  level,
  max = 4,
  horizontal,
  className,
  style,
  title
}: EnergyBarProps): React.JSX.Element {
  return (
    <span
      className={clsx('ebar', horizontal && 'h', className)}
      style={style}
      aria-label={`Energy ${level} of ${max}`}
      title={title}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < level ? 'on' : undefined} />
      ))}
    </span>
  )
}
