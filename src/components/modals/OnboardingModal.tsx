import { useState } from 'react'
import { ArrowRight, CheckCircle, FolderOpen, GraduationCap, Headphones } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { motion, AnimatePresence, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'

type Step = 'welcome' | 'proficiency' | 'import' | 'done'

export function OnboardingModal(): React.JSX.Element {
  const { hideOnboarding } = useUiStore()
  const setLearnModeEnabled = useUiStore((s) => s.setLearnModeEnabled)
  const { triggerImport, tracks, isLoading } = useLibraryStore()

  const [step, setStep] = useState<Step>('welcome')
  const [importing, setImporting] = useState(false)

  async function handleImport(): Promise<void> {
    setImporting(true)
    try {
      await triggerImport()
      const count = useLibraryStore.getState().tracks.length
      if (count > 0) setStep('done')
    } finally {
      setImporting(false)
    }
  }

  function selectProficiency(isBeginner: boolean): void {
    setLearnModeEnabled(isBeginner)
    if (typeof window !== 'undefined' && window.setsense) {
      void window.setsense.setSettings({ hasSeenProficiencyAsk: true })
    }
    setStep('import')
  }

  const trackCount = tracks.length

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to SetSense"
    >
      <motion.div
        className="modal-panel glass-3"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}
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
              <div className="ss-h1" style={{ marginBottom: 8 }}>Welcome to SetSense</div>
              <div className="ss-body" style={{ opacity: 0.7 }}>
                Build better sets. Export to any Pioneer CDJ. No surprises at the venue.
              </div>
            </div>

            <div
              style={{
                padding: 20,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                marginBottom: 24,
                textAlign: 'left',
              }}
            >
              <div className="ss-body-sm" style={{ opacity: 0.6, marginBottom: 16 }}>
                Two quick questions, then we&apos;ll load your library.
              </div>
              <div className="ss-caption" style={{ opacity: 0.5 }}>
                You can change everything later in Settings.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={hideOnboarding}>
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
              <div className="ss-h2" style={{ marginBottom: 8 }}>How much DJ experience do you have?</div>
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
                  Turn on Learn Mode by default. Every recommendation comes with a short
                  explanation and a diagram so you learn while you build.
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
              <Button variant="secondary" onClick={hideOnboarding}>
                Skip for now
              </Button>
            </div>
          </>
        )}

        {step === 'import' && (
          <>
            <div style={{ padding: '8px 0 24px' }}>
              <div className="ss-h2" style={{ marginBottom: 8 }}>Import your library</div>
              <div className="ss-body" style={{ opacity: 0.7 }}>
                Select your Rekordbox XML export file to load your tracks.
              </div>
            </div>

            <button
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: 32,
                borderRadius: 12,
                border: '1.5px dashed rgba(255,255,255,0.2)',
                background: 'transparent',
                cursor: importing ? 'wait' : 'pointer',
                width: '100%',
                marginBottom: 24,
                transition: 'border-color 150ms',
              }}
              onClick={handleImport}
              disabled={importing}
            >
              <FolderOpen size={32} strokeWidth={1.5} style={{ opacity: 0.6 }} />
              <div className="ss-body-sm" style={{ opacity: 0.7 }}>
                {importing ? (isLoading ? 'Importing…' : 'Opening file picker…') : 'Click to select XML file'}
              </div>
            </button>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={hideOnboarding}>
                Skip for now
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ padding: '8px 0 24px' }}>
              <CheckCircle
                size={48}
                strokeWidth={1.5}
                style={{ color: '#C8FF3D', marginBottom: 16 }}
              />
              <div className="ss-h2" style={{ marginBottom: 8 }}>Library imported</div>
              <div className="ss-body" style={{ opacity: 0.7 }}>
                {trackCount.toLocaleString()} track{trackCount !== 1 ? 's' : ''} loaded and ready.
              </div>
            </div>

            <Button variant="primary" onClick={hideOnboarding} style={{ width: '100%' }}>
              Start building
            </Button>
          </>
        )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
