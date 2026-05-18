import clsx from 'clsx'
import { Search } from 'lucide-react'
import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Optional keyboard hint shown on the right (e.g. "⌘K"). */
  kbd?: string
  className?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { kbd, className, placeholder = 'Search…', ...rest },
  ref,
) {
  return (
    <label className={clsx('search-input', className)}>
      <Search className="search-icon" strokeWidth={1.5} aria-hidden="true" />
      <input ref={ref} type="text" placeholder={placeholder} {...rest} />
      {kbd ? <span className="kbd">{kbd}</span> : null}
    </label>
  )
})
