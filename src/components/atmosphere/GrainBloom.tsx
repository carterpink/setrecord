import clsx from 'clsx'
import Bloom from './Bloom'
import { type BloomIcon } from './bloomIcons'

/* ============================================================
   GrainBloom — one contained neon glow per section, shaped by an app icon.
   Placement comes from a CSS class on the parent section (grit.css → .grainbloom--*).
   ============================================================ */

export type BloomTone = 'lime' | 'cyan' | 'magenta' | 'violet'

type GrainBloomProps = {
  tone?: BloomTone
  icon?: BloomIcon
  intensity?: number
  grain?: number
  density?: number
  seed?: number
  flow?: number
  sizeFrac?: number
  blurFrac?: number
  interactive?: boolean
  opacity?: number
  className?: string
  style?: React.CSSProperties
}

export default function GrainBloom({
  tone = 'cyan',
  icon,
  intensity = 1,
  grain,
  density,
  seed = 7,
  flow = 1,
  sizeFrac,
  blurFrac,
  interactive = false,
  opacity = 0.92,
  className,
  style
}: GrainBloomProps): React.JSX.Element {
  return (
    <div className={clsx('grainbloom', className)} aria-hidden style={{ opacity, ...style }}>
      <Bloom
        tone={tone}
        icon={icon}
        intensity={intensity}
        grain={grain}
        density={density}
        seed={seed}
        flow={flow}
        sizeFrac={sizeFrac}
        blurFrac={blurFrac}
        interactive={interactive}
      />
    </div>
  )
}
