import clsx from 'clsx'
import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Optional keyboard hint shown on the right (e.g. "⌘K"). */
  kbd?: string
  className?: string
}

/**
 * Glass-1 search field with a leading search icon and optional kbd hint.
 * Shortcut wiring (⌘K to focus) lands in Phase 8.
 */
export function SearchInput({
  kbd,
  className,
  placeholder = 'Search…',
  ...rest
}: SearchInputProps): React.JSX.Element {
  return (
    <label className={clsx('search-input', className)}>
      <Search className="search-icon" strokeWidth={1.5} aria-hidden="true" />
      <input type="text" placeholder={placeholder} {...rest} />
      {kbd ? <span className="kbd">{kbd}</span> : null}
    </label>
  )
}
