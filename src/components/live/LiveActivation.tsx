import { motion } from 'framer-motion'
import './liveActivation.css'

/**
 * Full-screen "intelligence" activation that plays once when SetRecord Live goes
 * live — a luminous bloom + flowing gradient waves + edge glow, in the spirit of
 * the iOS Siri activation. Purely decorative; fades out to hand off to the HUD.
 */

const VW = 2400 // viewBox width — twice the tile so a -1200 drift loops seamlessly
const VH = 240

/** A sine wave path spanning the full viewBox. `periods` must be even so the
 *  first half tiles into the second (seamless horizontal drift). */
function wavePath(amp: number, periods: number): string {
  const steps = 96
  const mid = VH / 2
  let d = `M 0 ${mid.toFixed(1)}`
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * VW
    const y = mid + Math.sin((i / steps) * Math.PI * 2 * periods) * amp
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

const WAVE_1 = wavePath(42, 6)
const WAVE_2 = wavePath(28, 8)
const WAVE_3 = wavePath(56, 4)

export function LiveActivation(): React.JSX.Element {
  return (
    <motion.div
      className="lv-activate"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="lv-activate-edge" />
      <div className="lv-activate-bloom" />
      <svg className="lv-activate-waves" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lv-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#CFFF04" />
            <stop offset="50%" stopColor="#4FD7FF" />
            <stop offset="100%" stopColor="#FF3D9A" />
          </linearGradient>
        </defs>
        <g className="lv-wave-g lv-wave-g1">
          <path className="lv-wave" stroke="url(#lv-grad)" d={WAVE_1} />
        </g>
        <g className="lv-wave-g lv-wave-g2">
          <path className="lv-wave" stroke="url(#lv-grad)" d={WAVE_2} />
        </g>
        <g className="lv-wave-g lv-wave-g3">
          <path className="lv-wave" stroke="url(#lv-grad)" d={WAVE_3} />
        </g>
      </svg>
    </motion.div>
  )
}
