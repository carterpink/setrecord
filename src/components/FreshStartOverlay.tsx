import { useEffect, useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from '@/components/shared/Motion'

/**
 * Full-screen "starting fresh" animation shown while the app wipes itself back to
 * first-launch (see DangerZoneSection in SettingsModal). It ticks through what's
 * being cleared one item at a time, then fires `onComplete` — which invokes the
 * main-process wipe + relaunch. The relaunch tears this window down, so the
 * overlay never has to animate out: the whole app simply restarts into onboarding.
 */

const STEPS = ['Library', 'Settings', 'Play history', 'Artwork', 'Caches'] as const

// Per-item dwell + a final beat before we trigger the wipe. Tuned so the whole
// sequence reads as deliberate (~2s) without feeling slow.
const STEP_MS = 300
const FINAL_BEAT_MS = 550

export function FreshStartOverlay({ onComplete }: { onComplete: () => void }): React.JSX.Element {
  const [doneCount, setDoneCount] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= STEPS.length; i++) {
      timers.push(setTimeout(() => setDoneCount(i), STEP_MS * i))
    }
    timers.push(
      setTimeout(
        () => {
          if (firedRef.current) return
          firedRef.current = true
          onComplete()
        },
        STEP_MS * STEPS.length + FINAL_BEAT_MS
      )
    )
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const allDone = doneCount >= STEPS.length

  return (
    <motion.div
      className="fresh-start-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      role="alertdialog"
      aria-label="Resetting SetSense"
      aria-live="assertive"
    >
      <div className="fresh-start-card">
        <motion.div
          className="fresh-start-icon"
          animate={allDone ? { scale: [1, 1.12, 1], opacity: [1, 1, 0.55] } : { scale: 1 }}
          transition={{ duration: 0.5 }}
          aria-hidden="true"
        >
          <Trash2 size={28} strokeWidth={1.6} />
        </motion.div>

        <div className="fresh-start-title ss-h2">
          {allDone ? 'Starting fresh…' : 'Clearing SetSense'}
        </div>

        <ul className="fresh-start-list">
          {STEPS.map((label, i) => {
            const status = i < doneCount ? 'done' : i === doneCount ? 'active' : 'pending'
            return (
              <li key={label} className={`fresh-start-item is-${status}`}>
                <span className="fresh-start-mark" aria-hidden="true">
                  <AnimatePresence mode="wait" initial={false}>
                    {status === 'done' ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.18 }}
                        style={{ display: 'inline-flex' }}
                      >
                        <Check size={15} strokeWidth={2.4} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="dot"
                        className="fresh-start-dot"
                        animate={
                          status === 'active'
                            ? { opacity: [0.4, 1, 0.4], scale: [0.85, 1, 0.85] }
                            : { opacity: 0.35 }
                        }
                        transition={
                          status === 'active'
                            ? { duration: 0.7, repeat: Infinity }
                            : { duration: 0.2 }
                        }
                      />
                    )}
                  </AnimatePresence>
                </span>
                <span className="fresh-start-label">{label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </motion.div>
  )
}
