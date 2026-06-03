import { useState } from 'react'
import { APP_NAME } from '@/utils/constants'
import { ArrowRight, GraduationCap, Headphones, Sparkles } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { Modal } from '@/components/shared/Modal'
import { useUiStore } from '@/stores/uiStore'

type Step = 'welcome' | 'proficiency' | 'import'

export function OnboardingModal(): React.JSX.Element {
  const { showModal, completeOnboarding } = useUiStore()
  const setLearnModeEnabled = useUiStore((s) => s.setLearnModeEnabled)
  const setIsBeginner = useUiStore((s) => s.setIsBeginner)

  const [step, setStep] = useState<Step>('welcome')

  function handleFindLibrary(): void {
    // Hand off to the ImportModal, which owns the full auto-detect → import →
    // done flow (including its own stats screen). Completing onboarding first
    // means only one blocking overlay is ever visible — AppShell's
    // AnimatePresence animates onboarding out before import animates in — and
    // marks onboarding done so the user is never re-nagged.
    completeOnboarding()
    showModal('import')
  }

  function selectProficiency(isBeginner: boolean): void {
    // `isBeginner` unlocks the free basic explainers (persists after the trial);
    // Learn Mode mirrors it as the default for the richer Pro overlay.
    setIsBeginner(isBeginner)
    setLearnModeEnabled(isBeginner)
    if (typeof window !== 'undefined' && window.setsense) {
      void window.setsense.setSettings({ hasSeenProficiencyAsk: true })
    }
    setStep('import')
  }

  return (
    <Modal
      onClose={completeOnboarding}
      ariaLabel={`Welcome to ${APP_NAME}`}
      style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0.12, 1] }}
        >
          {step === 'welcome' && (
            <>
              <div style={{ padding: '8px 0 24px' }}>
                <div className="ss-h1" style={{ marginBottom: 8 }}>
                  Welcome to {APP_NAME}
                </div>
                <div className="ss-body" style={{ opacity: 0.7 }}>
                  {APP_NAME} reads your existing DJ library and helps you build sets that flow —
                  which track plays next, and whether it&apos;ll sound clean. Let&apos;s load your
                  music.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 24
                }}
              >
                {[
                  { n: '1', label: 'Load your library' },
                  { n: '2', label: 'See what mixes' },
                  { n: '3', label: 'Build a set' }
                ].map((s) => (
                  <div
                    key={s.n}
                    style={{
                      flex: 1,
                      padding: '14px 10px',
                      borderRadius: 12,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        color: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      {s.n}
                    </span>
                    <span className="ss-caption" style={{ opacity: 0.8 }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={completeOnboarding}>
                  Skip for now
                </Button>
                <Button variant="primary" icon={ArrowRight} onClick={() => setStep('proficiency')}>
                  Get started
                </Button>
              </div>
            </>
          )}

          {step === 'proficiency' && (
            <>
              <div style={{ padding: '8px 0 20px' }}>
                <div className="ss-h2" style={{ marginBottom: 8 }}>
                  How much DJ experience do you have?
                </div>
                <div className="ss-body" style={{ opacity: 0.7 }}>
                  We&apos;ll tune the explanations to match.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <button
                  type="button"
                  className="proficiency-card"
                  onClick={() => selectProficiency(true)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <GraduationCap size={18} strokeWidth={1.6} aria-hidden="true" />
                    <span className="ss-h3">I&apos;m new to DJing</span>
                  </div>
                  <div className="ss-body-sm" style={{ opacity: 0.7 }}>
                    Plain-language tips appear the first time you see each thing — keys, BPM,
                    energy, transitions. They&apos;re free and stay on, so the app never feels like
                    jargon.
                  </div>
                </button>

                <button
                  type="button"
                  className="proficiency-card"
                  onClick={() => selectProficiency(false)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Headphones size={18} strokeWidth={1.6} aria-hidden="true" />
                    <span className="ss-h3">I&apos;ve mixed before</span>
                  </div>
                  <div className="ss-body-sm" style={{ opacity: 0.7 }}>
                    Keep the UI minimal. Learn Mode stays off — flip it on anytime in Settings if
                    you&apos;re teaching or reviewing a tricky transition.
                  </div>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="secondary" onClick={() => setStep('welcome')}>
                  Back
                </Button>
                <Button variant="secondary" onClick={completeOnboarding}>
                  Skip for now
                </Button>
              </div>
            </>
          )}

          {step === 'import' && (
            <>
              <div style={{ padding: '8px 0 24px' }}>
                <div className="ss-h2" style={{ marginBottom: 8 }}>
                  Find your library
                </div>
                <div className="ss-body" style={{ opacity: 0.7 }}>
                  We&apos;ll look for Rekordbox or Serato on this Mac and load your tracks
                  automatically.
                </div>
              </div>

              <button
                type="button"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: 32,
                  borderRadius: 12,
                  border: '1.5px dashed var(--border-emphasis)',
                  background: 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                  marginBottom: 24,
                  transition: 'border-color 150ms'
                }}
                onClick={handleFindLibrary}
              >
                <Sparkles size={32} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                <div className="ss-body-sm" style={{ opacity: 0.85, fontWeight: 500 }}>
                  Find my library
                </div>
                <div className="ss-caption" style={{ opacity: 0.6 }}>
                  Or load a Rekordbox XML export if you prefer.
                </div>
              </button>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={completeOnboarding}>
                  Skip for now
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  )
}
