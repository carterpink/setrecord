import { useEffect } from 'react'
import FocusLock from 'react-focus-lock'
import { motion, modalBackdrop, modalPanel } from './Motion'
import GrainBloom, { type BloomTone } from '@/components/atmosphere/GrainBloom'
import { type BloomIcon } from '@/components/atmosphere/bloomIcons'

/**
 * Shared modal primitive. Centralises the accessibility contract that every
 * dialog must honour (WCAG 2.1 AA):
 *  - role="dialog" + aria-modal, named by `ariaLabel` or `labelledById`
 *  - focus trapped inside + restored to the trigger on close (react-focus-lock)
 *  - Escape closes (2.1.1 Keyboard) — works even when focus is in a field
 *  - backdrop click closes (mouse parity)
 *  - the rest of the app is marked `inert` + aria-hidden while open, so SR and
 *    keyboard users can't wander into the background (2.4.3 Focus Order)
 *
 * Each modal still supplies its own header/body markup as children, so this is
 * a low-risk wrapper rather than a rigid layout.
 */

// Ref-count so stacked/overlapping modals don't prematurely un-inert the app.
let openCount = 0
function setAppInert(on: boolean): void {
  const app = document.querySelector('.app')
  if (!app) return
  if (on) {
    app.setAttribute('inert', '')
    app.setAttribute('aria-hidden', 'true')
  } else {
    app.removeAttribute('inert')
    app.removeAttribute('aria-hidden')
  }
}

interface ModalProps {
  onClose: () => void
  /** Accessible name as a plain string. */
  ariaLabel?: string
  /** id of the element that labels the dialog (preferred when a visible title exists). */
  labelledById?: string
  /** id of an element that describes the dialog. */
  describedById?: string
  maxWidth?: number
  /** Extra classes appended to the panel (panel always has `modal glass-3`). */
  className?: string
  style?: React.CSSProperties
  /** Allow backdrop click to close (default true). */
  closeOnBackdrop?: boolean
  /** Allow Escape to close (default true). Set false for blocking flows (e.g. onboarding). */
  closeOnEscape?: boolean
  /** Optional grit background glyph behind the panel (a quiet neon grain bloom). */
  bloom?: { icon?: BloomIcon; tone?: BloomTone }
  children: React.ReactNode
}

export function Modal({
  onClose,
  ariaLabel,
  labelledById,
  describedById,
  maxWidth,
  className,
  style,
  closeOnBackdrop = true,
  closeOnEscape = true,
  bloom,
  children
}: ModalProps): React.JSX.Element {
  // Escape closes — bound to the document so it fires regardless of which
  // focused element (input, button, the panel) currently has focus.
  useEffect(() => {
    if (!closeOnEscape) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, closeOnEscape])

  // Mark the rest of the app inert while this modal is mounted.
  useEffect(() => {
    openCount += 1
    if (openCount === 1) setAppInert(true)
    return () => {
      openCount -= 1
      if (openCount === 0) setAppInert(false)
    }
  }, [])

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <FocusLock returnFocus>
        <motion.div
          className={`modal glass-3${bloom ? ' grit-bloomhost' : ''}${className ? ` ${className}` : ''}`}
          variants={modalPanel}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={maxWidth ? { maxWidth, ...style } : style}
          role="dialog"
          aria-modal="true"
          aria-label={labelledById ? undefined : ariaLabel}
          aria-labelledby={labelledById}
          aria-describedby={describedById}
          onClick={(e) => e.stopPropagation()}
        >
          {bloom && (
            <GrainBloom
              className="grainbloom--modal"
              icon={bloom.icon}
              tone={bloom.tone ?? 'lime'}
              sizeFrac={0.82}
              seed={3}
            />
          )}
          {children}
        </motion.div>
      </FocusLock>
    </motion.div>
  )
}
