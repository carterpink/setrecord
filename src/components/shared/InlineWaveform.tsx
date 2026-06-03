import { useEffect, useRef } from 'react'
import { getPreviewAudioElement } from '@/audio/previewAudioElement'
import { getCachedPeaks, loadPeaks, type WaveformPeaks } from '@/utils/waveformPeaksCache'

interface InlineWaveformProps {
  /** Absolute path to the audio file (decoded once, cached). */
  filePath: string
  /**
   * Fallback ms playhead when the live preview element isn't readable. The
   * canvas prefers the real audio element's clock for smoothness; this is only
   * a seed for the first frames / non-active states.
   */
  currentTime?: number
  /** Scrub handler — receives an absolute ms position. */
  onSeek?: (ms: number) => void
  /** CSS height in px. */
  height?: number
}

type LoadStatus = 'loading' | 'ready' | 'error' | 'missing'

const CURSOR_COLOR = 'rgba(255, 255, 255, 0.85)'
const RAIL_COLOR = 'rgba(255, 255, 255, 0.10)'

/**
 * Passive, lightweight waveform for library rows / cards.
 *
 * It never plays audio of its own: it reads peaks from the shared cache, paints
 * a 60fps playhead from the singleton preview element's clock, and scrubs by
 * calling `onSeek(ms)` (which the call sites route to `requestSeek`). No
 * WaveSurfer instance, no per-row decode, no React re-render per frame.
 */
export function InlineWaveform({
  filePath,
  currentTime = 0,
  onSeek,
  height = 28
}: InlineWaveformProps): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Seed from the cache once (lazy initialisers only run on first render).
  const initialPeaks = getCachedPeaks(filePath) ?? null
  const peaksRef = useRef<WaveformPeaks | null>(initialPeaks)
  const statusRef = useRef<LoadStatus>(initialPeaks ? 'ready' : 'loading')
  const currentTimeRef = useRef(currentTime)
  const onSeekRef = useRef(onSeek)
  const draggingRef = useRef(false)
  // Redraw only when the playhead actually moves (or something forces it, e.g.
  // peaks arriving / a resize). A paused row's playhead is static, so this turns
  // the 60fps canvas repaint into a cheap no-op until playback advances again —
  // identical pixels, far less work.
  const forceDrawRef = useRef(true)
  const lastDrawnTimeRef = useRef(Number.NaN)

  // Keep latest props in refs (effect, not during render) so the rAF loop and
  // pointer handlers always see fresh values without restarting.
  useEffect(() => {
    currentTimeRef.current = currentTime
    onSeekRef.current = onSeek
    // A prop-driven time change (external seek) must repaint even while paused.
    forceDrawRef.current = true
  })

  // Load peaks for this file path.
  useEffect(() => {
    let cancelled = false
    const cached = getCachedPeaks(filePath)
    if (cached) {
      peaksRef.current = cached
      statusRef.current = 'ready'
      return
    }
    peaksRef.current = null
    statusRef.current = 'loading'
    forceDrawRef.current = true
    void loadPeaks(filePath).then((state) => {
      if (cancelled) return
      if (state.status === 'ready') {
        peaksRef.current = state.peaks
        statusRef.current = 'ready'
      } else {
        peaksRef.current = null
        statusRef.current = state.status
      }
      // Peaks/status changed — force one repaint to show the result.
      forceDrawRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [filePath])

  // Canvas sizing (DPR-aware) + the single rAF render loop. Created once.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1
      const cssW = wrap.clientWidth
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const resizeAndFlag = (): void => {
      resize()
      // The canvas is cleared by a resize — always repaint after one.
      forceDrawRef.current = true
    }
    resize()
    const ro = new ResizeObserver(resizeAndFlag)
    ro.observe(wrap)

    let raf = 0
    const loop = (): void => {
      // The playhead prefers the live audio clock (see draw()); mirror that here
      // so we can tell whether anything actually moved since the last frame.
      const el = getPreviewAudioElement()
      const timeSec =
        el && isFinite(el.currentTime) ? el.currentTime : currentTimeRef.current / 1000
      if (forceDrawRef.current || timeSec !== lastDrawnTimeRef.current) {
        draw(canvas, wrap, height, peaksRef.current, statusRef.current, currentTimeRef.current)
        lastDrawnTimeRef.current = timeSec
        forceDrawRef.current = false
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [height])

  function durationSec(): number {
    const peaks = peaksRef.current
    if (peaks && peaks.durationSec > 0) return peaks.durationSec
    const el = getPreviewAudioElement()
    if (el && isFinite(el.duration) && el.duration > 0) return el.duration
    return 0
  }

  function seekFromClientX(clientX: number): void {
    const wrap = wrapRef.current
    if (!wrap) return
    const dur = durationSec()
    if (dur <= 0) return
    const rect = wrap.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeekRef.current?.(ratio * dur * 1000)
  }

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height, cursor: 'pointer', touchAction: 'none' }}
      onPointerDown={(e) => {
        draggingRef.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromClientX(e.clientX)
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromClientX(e.clientX)
      }}
      onPointerUp={(e) => {
        draggingRef.current = false
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }}
      onPointerCancel={() => {
        draggingRef.current = false
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Audio waveform preview"
        style={{ display: 'block' }}
      />
    </div>
  )
}

function draw(
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
  height: number,
  peaks: WaveformPeaks | null,
  status: LoadStatus,
  fallbackMs: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cssW = wrap.clientWidth
  if (cssW <= 0) return
  const mid = height / 2
  ctx.clearRect(0, 0, cssW, height)

  // Loading / error / missing → a calm baseline rail, never a blob or crash.
  if (status !== 'ready' || !peaks) {
    ctx.fillStyle = RAIL_COLOR
    ctx.fillRect(0, mid - 0.5, cssW, 1)
    return
  }

  // Playhead: prefer the real audio clock for smoothness.
  const dur = peaks.durationSec || 1
  let timeSec = fallbackMs / 1000
  const el = getPreviewAudioElement()
  if (el && isFinite(el.currentTime)) timeSec = el.currentTime
  const ratio = Math.max(0, Math.min(1, timeSec / dur))
  const playheadX = ratio * cssW

  const barWidth = 2
  const barGap = 1
  const step = barWidth + barGap
  const bars = Math.max(1, Math.floor(cssW / step))
  const bucketsPerBar = peaks.buckets / bars
  const amp = mid - 1

  for (let i = 0; i < bars; i++) {
    const x = i * step
    const startBucket = Math.floor(i * bucketsPerBar)
    const endBucket = Math.max(startBucket + 1, Math.floor((i + 1) * bucketsPerBar))
    let lo = 0
    let hi = 0
    let l = 0
    let m = 0
    let h2 = 0
    let n = 0
    for (let b = startBucket; b < endBucket && b < peaks.buckets; b++) {
      if (peaks.min[b] < lo) lo = peaks.min[b]
      if (peaks.max[b] > hi) hi = peaks.max[b]
      l += peaks.low[b]
      m += peaks.mid[b]
      h2 += peaks.high[b]
      n++
    }
    if (n > 0) {
      l /= n
      m /= n
      h2 /= n
    }
    const top = mid - hi * amp
    const h = Math.max(1, (hi - lo) * amp)
    const played = x + barWidth <= playheadX
    ctx.fillStyle = bandColor(l, m, h2, played)
    ctx.fillRect(x, top, barWidth, h)
  }

  // Clear moving playhead line on top of the progress fill.
  ctx.fillStyle = CURSOR_COLOR
  ctx.fillRect(Math.min(cssW - 1, Math.max(0, playheadX - 0.5)), 0, 1, height)
}

// Low/mid/high band mix → a subtle Rekordbox-style colour. Unplayed bars are
// dimmed so the played region reads as progress.
const LOW_C = [56, 128, 255]
const MID_C = [150, 110, 246]
const HIGH_C = [200, 255, 61]
function bandColor(l: number, m: number, h: number, played: boolean): string {
  const total = l + m + h + 1e-4
  const r = (l * LOW_C[0] + m * MID_C[0] + h * HIGH_C[0]) / total
  const g = (l * LOW_C[1] + m * MID_C[1] + h * HIGH_C[1]) / total
  const b = (l * LOW_C[2] + m * MID_C[2] + h * HIGH_C[2]) / total
  return `rgba(${r | 0},${g | 0},${b | 0},${played ? 0.95 : 0.4})`
}
