import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { motion, AnimatePresence } from '../shared/Motion'
import GrainBloom, { type BloomTone } from './GrainBloom'
import { type BloomIcon } from './bloomIcons'

/* ============================================================
   BloomCycle — an ambient backdrop that cycles through several grain-bloom
   icon shapes. Each bloom breathes (a gentle scale pulse) and crossfades into
   the next (the outgoing one swells + fades while the incoming one grows in).
   Every icon is rendered in a RANDOM tone ramp (lime+blue / blue+aqua /
   purple+pink — the multi-hue gradients defined in Bloom.tsx), so the colour
   varies shape to shape. Built on framer-motion + shared/Motion conventions and
   degrades to a single still bloom under prefers-reduced-motion.
   ============================================================ */

// House easing (matches Motion.tsx SMOOTH — graceful, slow reveals).
const SMOOTH = [0.25, 0.46, 0.45, 0.94] as const

// Tone palette to randomise across — each is a ready-made multi-hue ramp in
// Bloom.tsx: lime (lime+blue), cyan (blue+aqua), magenta (purple+pink). 1-in-3.
const PALETTE: readonly BloomTone[] = ['lime', 'cyan', 'magenta']

function pickTone(): BloomTone {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

// A rotation of pre-existing bloom icons — memory-system shapes that read as a
// quietly thinking brain behind the input.
const DEFAULT_ICONS: BloomIcon[] = [
  'brain',
  'sparkles',
  'waypoints',
  'ear',
  'layers',
  'library',
  'disc',
  'fingerprint',
  'telescope',
  'radio'
]

type BloomCycleProps = {
  /** Icons to cycle through, in order. */
  icons?: BloomIcon[]
  className?: string
  /** Light pools toward the pointer (a touch of magic on the hero). */
  interactive?: boolean
  seed?: number
  /** ms each bloom holds before crossfading to the next. */
  intervalMs?: number
}

export default function BloomCycle({
  icons = DEFAULT_ICONS,
  className,
  interactive = false,
  seed = 11,
  intervalMs = 6500
}: BloomCycleProps): React.JSX.Element {
  const reduce = useReducedMotion()
  // idx + tone advance together so each new icon gets a fresh random colour.
  // Lazy initialiser randomises the opening tone once, on mount — no
  // setState-in-effect, no cascading render (this is a CSR-only renderer).
  const [step, setStep] = useState<{ idx: number; tone: BloomTone }>(() => ({
    idx: 0,
    tone: pickTone()
  }))

  // Advance to the next bloom + a new random tone on an interval (paused under
  // reduced motion).
  useEffect(() => {
    if (reduce || icons.length < 2) return
    const id = window.setInterval(() => {
      setStep((s) => ({ idx: (s.idx + 1) % icons.length, tone: pickTone() }))
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [reduce, icons.length, intervalMs])

  const icon = icons[step.idx % icons.length] ?? icons[0]

  // Reduced motion: a single still bloom, no cycling, no breathing.
  if (reduce) {
    return (
      <div className={className} aria-hidden>
        <GrainBloom className="bloom-fill" icon={icons[0]} tone={step.tone} seed={seed} />
      </div>
    )
  }

  return (
    <div className={className} aria-hidden>
      <AnimatePresence>
        <motion.div
          key={`${step.idx}-${icon}-${step.tone}`}
          className="bloom-layer"
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.16 }}
          transition={{ duration: 1.7, ease: SMOOTH }}
        >
          {/* Inner wrapper carries the continuous breathing pulse, kept separate
              from the crossfade scale so the two compose cleanly. The transform
              never resizes the canvas (no rebuild) — only its painted box. */}
          <motion.div
            className="bloom-breathe"
            animate={{ scale: [1, 1.055, 1] }}
            transition={{ duration: 7.5, ease: 'easeInOut', repeat: Infinity }}
          >
            <GrainBloom
              className="bloom-fill"
              icon={icon}
              tone={step.tone}
              interactive={interactive}
              seed={seed}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
