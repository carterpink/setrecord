import clsx from 'clsx'
import { useId } from 'react'
import { motion } from 'framer-motion'

interface SegmentedControlProps<T extends string> {
  options: readonly T[]
  value: T
  onChange?: (next: T) => void
  className?: string
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
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  const layoutId = useId()
  return (
    <div className={clsx('segmented', className)} role="tablist">
      {options.map((opt) => {
        const isActive = value === opt
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
            <span className="seg-label">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}
