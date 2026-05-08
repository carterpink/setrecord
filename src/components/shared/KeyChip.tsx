import clsx from 'clsx'

interface KeyChipProps {
  /** Camelot notation, e.g. "9A", "11B". */
  children: string
  className?: string
}

/**
 * Camelot key chip — the only place the cyan-mint backup accent appears.
 * It's a typographic mark, not a colored icon.
 */
export function KeyChip({ children, className }: KeyChipProps): React.JSX.Element {
  return <span className={clsx('camelot', className)}>{children}</span>
}
