import clsx from 'clsx'

interface SegmentedControlProps<T extends string> {
  options: readonly T[]
  value: T
  onChange?: (next: T) => void
  className?: string
}

/**
 * Pill-shaped segmented control. The active option gets a chartreuse fill.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div className={clsx('segmented', className)} role="tablist">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={value === opt}
          className={value === opt ? 'active' : undefined}
          onClick={() => onChange?.(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
