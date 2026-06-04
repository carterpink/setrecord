import clsx from 'clsx'
import { useId } from 'react'
import { motion } from 'framer-motion'

/** Icon component accepted per option (lucide-react icons satisfy this). */
type SegmentIcon = React.ComponentType<
  { size?: number; strokeWidth?: number } & React.AriaAttributes
>

interface SegmentedControlProps<T extends string> {
  options: readonly T[]
  value: T
  onChange?: (next: T) => void
  className?: string
  /** Accessible name for the control group (WCAG 4.1.2). */
  ariaLabel?: string
  /** id of an element labelling the control group. */
  ariaLabelledby?: string
  /** Optional icon per option — rendered before the label. */
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
        const Icon: SegmentIcon | undefined = icons?.[opt]
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
