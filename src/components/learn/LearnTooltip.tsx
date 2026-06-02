import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUiStore } from '@/stores/uiStore'
import { isProUser } from '@/utils/premium'
import type { LearnExplanation } from '@/utils/learnMode/explanations'
import { HarmonicWheelDiagram } from './diagrams/HarmonicWheelDiagram'
import { BpmRampDiagram } from './diagrams/BpmRampDiagram'
import { EnergyCurveDiagram } from './diagrams/EnergyCurveDiagram'
import { TransitionRiskBreakdown } from './diagrams/TransitionRiskBreakdown'

interface LearnTooltipProps {
  explanation: LearnExplanation
  children: ReactNode
  hideIcon?: boolean
  iconLabel?: string
}

function DiagramRenderer({
  explanation
}: {
  explanation: LearnExplanation
}): React.JSX.Element | null {
  const d = explanation.diagram
  if (!d) return null
  switch (d.kind) {
    case 'harmonic-wheel':
      return <HarmonicWheelDiagram fromKey={d.fromKey} toKey={d.toKey} />
    case 'bpm-ramp':
      return <BpmRampDiagram fromBpm={d.fromBpm} toBpm={d.toBpm} />
    case 'energy-curve':
      return <EnergyCurveDiagram target={d.target} actual={d.actual} />
    case 'risk-breakdown':
      return <TransitionRiskBreakdown factors={d.factors} />
  }
}

const POP_WIDTH = 290

export function LearnTooltip({
  explanation,
  children,
  hideIcon,
  iconLabel = 'Show explanation'
}: LearnTooltipProps): React.JSX.Element {
  const learnModeEnabled = useUiStore((s) => s.learnModeEnabled)
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  // pixel position of the popover, computed from the trigger button
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Recompute position whenever the popover opens or window scrolls/resizes
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    function compute(): void {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      const winW = window.innerWidth
      let left = r.left
      if (left + POP_WIDTH > winW - 8) left = Math.max(8, winW - POP_WIDTH - 8)
      setPos({ top: r.bottom + 6, left })
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent): void {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!learnModeEnabled || hideIcon) {
    return <>{children}</>
  }

  const proLocked = !isProUser()

  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <button
          ref={btnRef}
          type="button"
          className="learn-info-btn"
          aria-label={iconLabel}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen((v) => !v)
            }
          }}
        >
          <Info size={11} strokeWidth={2} aria-hidden="true" />
        </button>
      </span>

      {/* Portal to document.body so stacking contexts inside cards can't trap it */}
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={popRef}
              role="dialog"
              aria-label="Explanation"
              className="learn-pop glass-3"
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: POP_WIDTH,
                zIndex: 9999
              }}
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.32, 0.72, 0.12, 1] }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {proLocked ? (
                <div className="ss-body-sm">
                  Learn Mode is a Pro feature. Upgrade to unlock explanations.
                </div>
              ) : (
                <>
                  <div className="ss-body-sm" style={{ fontWeight: 600, marginBottom: 4 }}>
                    {explanation.summary}
                  </div>
                  <div className="ss-caption" style={{ opacity: 0.85, lineHeight: 1.45 }}>
                    {explanation.detail}
                  </div>
                  {explanation.diagram && (
                    <div style={{ marginTop: 12 }}>
                      <DiagramRenderer explanation={explanation} />
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
