import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useSetStore } from '@/stores/setStore'
import {
  useChecklistSteps,
  useActivationComplete,
  useProgressStore,
  type ChecklistStep
} from '@/stores/progressStore'

/**
 * First-run checklist on the Home front door. Uses the "endowed progress" effect
 * — the first step ships pre-completed so the bar never starts at 0%, which
 * measurably lifts completion (Nunes & Drèze, 2006). Each incomplete step routes
 * the user to where they can finish it. Disappears once the user activates
 * (imported + saw a suggestion + started a set) or dismisses it.
 */
export function OnboardingChecklist(): React.JSX.Element | null {
  const { t } = useTranslation('onboarding')
  const steps = useChecklistSteps()
  const activationComplete = useActivationComplete()
  const dismissed = useProgressStore((s) => s.progress.checklistDismissed)
  const dismissChecklist = useProgressStore((s) => s.dismissChecklist)
  const showModal = useUiStore((s) => s.showModal)
  const setMode = useUiStore((s) => s.setMode)
  const createSet = useSetStore((s) => s.createSet)

  if (dismissed || activationComplete) return null

  const done = steps.filter((s) => s.done).length
  const percent = Math.round((done / steps.length) * 100)

  const act = (step: ChecklistStep): void => {
    if (step.done) return
    switch (step.id) {
      case 'import':
        showModal('import')
        break
      case 'suggestion':
        setMode('Build')
        break
      case 'set':
        setMode('Build')
        createSet()
        break
    }
  }

  return (
    <motion.div
      className="glass-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0.12, 1] }}
      style={{
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        padding: 18,
        borderRadius: 14,
        textAlign: 'left'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12
        }}
      >
        <span className="ss-body-sm" style={{ fontWeight: 600 }}>
          {t('checklist.heading', { done, total: steps.length })}
        </span>
        <button
          type="button"
          aria-label={t('checklist.dismissAria')}
          onClick={() => void dismissChecklist()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex'
          }}
        >
          <X size={15} strokeWidth={1.7} />
        </button>
      </div>

      {/* Endowed-progress bar — never empty on first sight. */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--surface-3, rgba(255,255,255,0.08))',
          overflow: 'hidden',
          marginBottom: 14
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0.12, 1] }}
          style={{ height: '100%', background: 'var(--accent)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => act(step)}
            disabled={step.done}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 6px',
              borderRadius: 8,
              background: 'none',
              border: 'none',
              cursor: step.done ? 'default' : 'pointer',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: step.done ? 'var(--accent)' : 'transparent',
                border: step.done ? 'none' : '1.5px solid var(--border-emphasis)',
                color: 'var(--ink)'
              }}
            >
              {step.done && <Check size={12} strokeWidth={2.5} />}
            </span>
            <span
              className="ss-body-sm"
              style={{
                opacity: step.done ? 0.5 : 0.9,
                textDecoration: step.done ? 'line-through' : 'none'
              }}
            >
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
