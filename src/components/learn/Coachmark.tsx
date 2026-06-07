import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { useIsPro } from '@/stores/licenseStore'
import { nextCoachmarkOwner, useCoachmarkStore, type CoachmarkKey } from '@/stores/coachmarkStore'
import { COACHMARK_COPY } from '@/utils/learnMode/coachmarks'

interface CoachmarkProps {
  /** Which one-time concept this anchor teaches. */
  concept: CoachmarkKey
  children: ReactNode
}

const POP_WIDTH = 248

/**
 * Wraps a chip/value and, the first time a Learn-Mode beginner sees that concept,
 * auto-shows a small annotation pointing at it. Dismissing persists forever and
 * frees the single coachmark slot so the next concept can introduce itself.
 *
 * For advanced users (Learn Mode off) or non-Pro accounts it renders children
 * verbatim with zero extra work — the common case stays free of noise.
 */
export function Coachmark({ concept, children }: CoachmarkProps): React.JSX.Element {
  const { t } = useTranslation('learn')
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const isBeginner = useUiStore((s) => s.isBeginner)
  const isPro = useIsPro()
  // Beginners always get the free first-sight tips (they persist after the
  // trial); advanced Learn-Mode users still need Pro for them.
  const eligible = (isBeginner || learnModeEnabled) && (isBeginner || isPro)

  const [ownerId] = useState(nextCoachmarkOwner)
  const seen = useCoachmarkStore((s) => Boolean(s.seen[concept]))
  const activeKey = useCoachmarkStore((s) => s.activeKey)
  const activeOwner = useCoachmarkStore((s) => s.activeOwner)
  const claim = useCoachmarkStore((s) => s.claim)
  const release = useCoachmarkStore((s) => s.release)
  const dismiss = useCoachmarkStore((s) => s.dismiss)

  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const visible = eligible && !seen && activeKey === concept && activeOwner === ownerId

  // Try to grab the single coachmark slot. Re-runs when the slot frees up so a
  // later concept can claim it once the previous one is dismissed.
  useEffect(() => {
    if (eligible && !seen && activeKey === null) claim(concept, ownerId)
    // `activeKey` in deps lets a waiting instance re-attempt once the slot clears.
  }, [eligible, seen, activeKey, concept, claim, ownerId])

  // Free the slot only on unmount — no-op if this instance never held it.
  useEffect(() => () => release(ownerId), [release, ownerId])

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) return
    function compute(): void {
      if (!anchorRef.current) return
      const r = anchorRef.current.getBoundingClientRect()
      const winW = window.innerWidth
      let left = r.left
      if (left + POP_WIDTH > winW - 8) left = Math.max(8, winW - POP_WIDTH - 8)
      setPos({ top: r.bottom + 8, left })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [visible])

  const copy = useMemo(() => COACHMARK_COPY[concept], [concept])

  // Fast path: nothing to teach — return children untouched.
  if (!eligible || seen) return <>{children}</>

  return (
    <>
      <span ref={anchorRef} className={visible ? 'coach-anchor' : undefined}>
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {visible && pos && (
            <motion.div
              role="dialog"
              aria-label={copy.title}
              className="learn-coach glass-3"
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: POP_WIDTH,
                zIndex: 9998
              }}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0.12, 1] }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="coach-head">
                <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
                <span className="coach-title">{copy.title}</span>
              </div>
              <div className="coach-body">{copy.body}</div>
              <button
                type="button"
                className="coach-dismiss"
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss(concept)
                }}
              >
                {t('coachmark.dismiss')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
