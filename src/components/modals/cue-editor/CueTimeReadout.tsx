import { useEffect, useRef } from 'react'
import { barBeatAt, type Beatgrid } from '@/utils/beatgrid'
import { formatMs } from '@/utils/format'

interface CueTimeReadoutProps {
  audio: HTMLAudioElement | null
  durationMs: number
  grid: Beatgrid | null
}

/**
 * Live time + bar.beat readout driven by its own rAF straight from the audio
 * clock — writes to the DOM imperatively so it never re-renders the editor.
 */
export function CueTimeReadout({
  audio,
  durationMs,
  grid
}: CueTimeReadoutProps): React.JSX.Element {
  const timeRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const gridRef = useRef(grid)
  const durRef = useRef(durationMs)
  const audioRef = useRef(audio)
  useEffect(() => {
    gridRef.current = grid
    durRef.current = durationMs
    audioRef.current = audio
  })

  useEffect(() => {
    let raf = 0
    let lastT = -1
    let lastBar = ''
    const loop = (): void => {
      const a = audioRef.current
      const ms = a && isFinite(a.currentTime) ? a.currentTime * 1000 : 0
      const tenths = Math.floor(ms / 100)
      if (tenths !== lastT && timeRef.current) {
        lastT = tenths
        timeRef.current.textContent = `${formatMs(ms)} / ${formatMs(durRef.current)}`
      }
      if (barRef.current) {
        const g = gridRef.current
        const bb = g && g.bpm > 0 ? barBeatAt(g, ms) : null
        const label = bb ? `${bb.bar}.${bb.beat}` : '—'
        if (label !== lastBar) {
          lastBar = label
          barRef.current.textContent = label
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span
        ref={timeRef}
        className="ss-mono"
        style={{ fontSize: 14, letterSpacing: '0.02em', color: 'var(--text-primary)' }}
      >
        0:00.0 / {formatMs(durationMs)}
      </span>
      <span
        ref={barRef}
        className="ss-mono"
        style={{
          fontSize: 12,
          color: 'var(--accent)',
          padding: '1px 7px',
          borderRadius: 6,
          background: 'var(--accent-dim-12)'
        }}
      >
        —
      </span>
    </div>
  )
}
