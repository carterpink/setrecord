import clsx from 'clsx'
import { useId } from 'react'
import { motion } from 'framer-motion'

/** Decorative icon rendered before an option label (e.g. a lucide glyph). */
type SegmentIcon = React.ComponentType<{
  size?: number
  strokeWidth?: number
  'aria-hidden'?: boolean
}>

interface SegmentedControlProps<T extends string> {
  options: readonly T[]
  value: T
  onChange?: (next: T) => void
  className?: string
  /** Accessible name for the control group (WCAG 4.1.2). */
  ariaLabel?: string
  /** id of an element labelling the control group. */
  ariaLabelledby?: string
  /** Optional icon per option — rendered before the label (decorative). */
  icons?: Partial<Record<T, SegmentIcon>>
}

/**
 * Pill-shaped segmented control. The active option gets a chartreuse fill
 * that slides between options via a shared `layoutId`. Each instance gets a
 * unique id so multiple controls on screen don't share an indicator.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
  ariaLabelledby,
  icons
}: SegmentedControlProps<T>): React.JSX.Element {
  const layoutId = useId()
  return (
    <div
      className={clsx('segmented', className)}
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
    >
      {options.map((opt) => {
        const isActive = value === opt
        // Cast collapses the deferred `Record<T, …>[T]` indexed-access type to a
        // concrete component so the JSX below resolves even when T widens to string.
        const Icon = icons?.[opt] as SegmentIcon | undefined
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'active' : undefined}
            onClick={() => onChange?.(opt)}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="seg-indicator"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                aria-hidden="true"
              />
            )}
            {Icon && <Icon size={13} strokeWidth={1.6} aria-hidden />}
            <span className="seg-label">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}
