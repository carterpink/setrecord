import clsx from 'clsx'

interface ToggleProps {
  on: boolean
  onChange?: (next: boolean) => void
  className?: string
  'aria-label'?: string
}

/**
 * 40×24 liquid-glass pill with a sliding, springy 18px knob. On = chartreuse.
 * Styling/animation live in `.toggle` (globals.css).
 */
export function Toggle({
  on,
  onChange,
  className,
  'aria-label': ariaLabel
}: ToggleProps): React.JSX.Element {
  return (
    <span
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      tabIndex={0}
      className={clsx('toggle', on && 'on', className)}
      onClick={() => onChange?.(!on)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange?.(!on)
        }
      }}
    />
  )
}
