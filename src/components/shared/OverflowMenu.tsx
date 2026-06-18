import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { MoreHorizontal, type LucideProps } from 'lucide-react'
import clsx from 'clsx'
import { motion, AnimatePresence } from '@/components/shared/Motion'

interface OverflowMenuProps {
  /** Accessible label for the trigger button. */
  'aria-label': string
  /** Show a small accent dot on the trigger (e.g. "something needs attention"). */
  dot?: boolean
  title?: string
  /**
   * Menu rows. Receives a `close` callback so an item can dismiss the menu
   * after acting (or deliberately keep it open — e.g. a theme toggle).
   */
  children: (close: () => void) => ReactNode
}

/**
 * Right-anchored "more actions" dropdown. Collapses several low-frequency
 * toolbar utilities (Import, theme, feedback, settings…) behind a single
 * kebab button. Mirrors the click-outside + Escape + glass-panel pattern used
 * by the USB and playlist dropdowns.
 */
export function OverflowMenu({
  'aria-label': ariaLabel,
  dot,
  title,
  children
}: OverflowMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = (): void => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="overflow-menu-wrap" ref={ref}>
      <button
        type="button"
        className={clsx('overflow-menu-trigger', open && 'overflow-menu-trigger--open')}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal size={16} strokeWidth={1.7} aria-hidden="true" />
        {dot && <span className="overflow-menu-dot" aria-hidden="true" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="overflow-menu-panel glass-3"
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0.12, 1] }}
          >
            {children(close)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface OverflowMenuItemProps {
  icon: ComponentType<LucideProps>
  label: string
  /** Optional trailing hint text (e.g. a state like "Dark"). */
  hint?: string
  /** Accent dot on the row — mirrors the trigger dot for the relevant action. */
  badge?: boolean
  onClick: () => void
}

/** A single row inside an {@link OverflowMenu}. */
export function OverflowMenuItem({
  icon: Icon,
  label,
  hint,
  badge,
  onClick
}: OverflowMenuItemProps): React.JSX.Element {
  return (
    <button type="button" className="overflow-menu-item" role="menuitem" onClick={onClick}>
      <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
      <span className="overflow-menu-item-label">{label}</span>
      {badge && <span className="overflow-menu-item-dot" aria-hidden="true" />}
      {hint && <span className="overflow-menu-item-hint">{hint}</span>}
    </button>
  )
}
