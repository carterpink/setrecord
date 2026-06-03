import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { CuePoint, HotCue, Loop } from '@/types'
import type { WaveformPeaks } from '@/utils/waveformPeaksCache'
import { beatsInRange, type Beatgrid, barBeatAt } from '@/utils/beatgrid'
import type { PhraseSegment, PhraseKind } from '@/utils/phrases'
import { HOT_CUE_COLORS } from '@/utils/constants'

const LOW_C: [number, number, number] = [56, 128, 255] // bass — blue
const MID_C: [number, number, number] = [150, 110, 246] // mid — violet
const HIGH_C: [number, number, number] = [200, 255, 61] // treble — lime accent

const CUE_COLOR = '#22C55E'
const MEMORY_COLOR = '#F97316'

const PHRASE_COLORS: Record<PhraseKind, string> = {
  intro: '#3B82F6',
  build: '#F59E0B',
  drop: '#CFFF04',
  break: '#A855F7',
  outro: '#64748B'
}
const PHRASE_LABEL: Record<PhraseKind, string> = {
  intro: 'INTRO',
  build: 'BUILD',
  drop: 'DROP',
  break: 'BREAK',
  outro: 'OUTRO'
}

const MIN_PX_PER_SEC = 1
const MAX_PX_PER_SEC = 600

export interface ProWaveformHandle {
  zoomTo(pxPerSec: number): void
  zoomBy(factor: number): void
  zoomFit(): void
  getZoom(): number
  setFollow(follow: boolean): void
  centerOn(ms: number): void
}

interface ProWaveformProps {
  peaks: WaveformPeaks | null
  status: 'loading' | 'ready' | 'error' | 'missing'
  durationMs: number
  grid: Beatgrid | null
  cuePoints: CuePoint[]
  hotCues: HotCue[]
  loops: Loop[]
  phrases: PhraseSegment[]
  showGrid: boolean
  showPhrases: boolean
  /** Live playhead source. */
  audio: HTMLAudioElement | null
  onSeek: (ms: number) => void
  /** Fires when zoom (px/sec) changes — for the parent's zoom slider. */
  onZoomChange?: (pxPerSec: number) => void
  /** A loop being drafted (in set, out not yet) rendered live. */
  draftLoop?: { startMs: number; endMs: number } | null
  height?: number
  minimapHeight?: number
}

/**
 * Pro-grade canvas waveform: 3-band colour, beatgrid, cues/loops/phrase overlays,
 * an overview minimap, zoom/scroll/follow, and needle-drag seeking. A single rAF
 * loop blits a cached static layer + the moving playhead, so 60fps stays cheap.
 */
export const ProWaveform = forwardRef<ProWaveformHandle, ProWaveformProps>(
  function ProWaveform(props, ref): React.JSX.Element {
    const { height = 150, minimapHeight = 34 } = props

    const wrapRef = useRef<HTMLDivElement>(null)
    const mainRef = useRef<HTMLCanvasElement>(null)
    const miniRef = useRef<HTMLCanvasElement>(null)
    const staticRef = useRef<HTMLCanvasElement | null>(null)

    // Live props in a ref so the rAF loop / pointer handlers never go stale and the
    // loop never restarts. Updated in an effect (not during render).
    const p = useRef(props)
    useEffect(() => {
      p.current = props
    })

    const view = useRef({ pxPerSec: 0, scrollMs: 0, follow: false })
    const widthRef = useRef(0)
    const dirtyRef = useRef(true)
    const dragRef = useRef<null | 'main' | 'mini'>(null)
    const lastZoomEmit = useRef(0)
    // Last blitted playhead/scroll/zoom — lets the loop skip the per-frame blit +
    // minimap draw on frames where nothing moved (paused, not scrubbing). Same
    // pixels, no wasted canvas work.
    const lastDrawRef = useRef({ cur: Number.NaN, scrollMs: Number.NaN, pxPerSec: Number.NaN })

    const visibleMs = (): number => {
      const w = widthRef.current
      const pps = view.current.pxPerSec
      if (pps <= 0) return p.current.durationMs || 0
      return (w / pps) * 1000
    }
    const clampScroll = (ms: number): number => {
      const max = Math.max(0, p.current.durationMs - visibleMs())
      return Math.max(0, Math.min(max, ms))
    }
    const msAtX = (x: number): number => view.current.scrollMs + (x / view.current.pxPerSec) * 1000
    const xAtMs = (ms: number): number =>
      ((ms - view.current.scrollMs) / 1000) * view.current.pxPerSec

    const fitZoom = (): number => {
      const w = widthRef.current
      const durSec = p.current.durationMs / 1000
      return durSec > 0 && w > 0 ? w / durSec : 1
    }
    const setZoom = (pps: number, anchorMs?: number): void => {
      const w = widthRef.current
      const clamped = Math.max(Math.max(MIN_PX_PER_SEC, fitZoom()), Math.min(MAX_PX_PER_SEC, pps))
      const anchor = anchorMs ?? view.current.scrollMs + visibleMs() / 2
      view.current.pxPerSec = clamped
      // keep anchor time at same screen fraction
      view.current.scrollMs = clampScroll(anchor - ((w / clamped) * 1000) / 2)
      dirtyRef.current = true
      const now = performance.now()
      if (now - lastZoomEmit.current > 30) {
        lastZoomEmit.current = now
        p.current.onZoomChange?.(clamped)
      }
    }

    useImperativeHandle(
      ref,
      (): ProWaveformHandle => ({
        zoomTo: (pps) => setZoom(pps),
        zoomBy: (factor) => setZoom(view.current.pxPerSec * factor),
        zoomFit: () => {
          view.current.pxPerSec = fitZoom()
          view.current.scrollMs = 0
          dirtyRef.current = true
          p.current.onZoomChange?.(view.current.pxPerSec)
        },
        getZoom: () => view.current.pxPerSec,
        setFollow: (f) => {
          view.current.follow = f
          dirtyRef.current = true
        },
        centerOn: (ms) => {
          view.current.scrollMs = clampScroll(ms - visibleMs() / 2)
          dirtyRef.current = true
        }
      }),
      [] // eslint-disable-line react-hooks/exhaustive-deps
    )

    // Mark static layer dirty whenever data/flags change.
    useEffect(() => {
      dirtyRef.current = true
    }, [
      props.peaks,
      props.status,
      props.durationMs,
      props.grid,
      props.cuePoints,
      props.hotCues,
      props.loops,
      props.phrases,
      props.showGrid,
      props.showPhrases,
      props.draftLoop
    ])

    // Sizing + rAF render loop (created once).
    useEffect(() => {
      const wrap = wrapRef.current
      const main = mainRef.current
      const mini = miniRef.current
      if (!wrap || !main || !mini) return
      staticRef.current = document.createElement('canvas')

      const resize = (): void => {
        const dpr = window.devicePixelRatio || 1
        const w = wrap.clientWidth
        widthRef.current = w
        for (const [c, h] of [
          [main, height],
          [mini, minimapHeight]
        ] as const) {
          c.width = Math.max(1, Math.round(w * dpr))
          c.height = Math.max(1, Math.round(h * dpr))
          c.style.width = `${w}px`
          c.style.height = `${h}px`
          const ctx = c.getContext('2d')
          if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        const sc = staticRef.current
        if (sc) {
          sc.width = Math.max(1, Math.round(w * dpr))
          sc.height = Math.max(1, Math.round(height * dpr))
          const sctx = sc.getContext('2d')
          if (sctx) sctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        // First-time zoom = fit.
        if (view.current.pxPerSec <= 0 && p.current.durationMs > 0 && w > 0) {
          view.current.pxPerSec = fitZoom()
          p.current.onZoomChange?.(view.current.pxPerSec)
        }
        dirtyRef.current = true
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(wrap)

      let raf = 0
      const loop = (): void => {
        // Init zoom once duration arrives.
        if (view.current.pxPerSec <= 0 && p.current.durationMs > 0 && widthRef.current > 0) {
          view.current.pxPerSec = fitZoom()
          p.current.onZoomChange?.(view.current.pxPerSec)
          dirtyRef.current = true
        }
        const cur = currentMs()
        if (view.current.follow && p.current.audio && !p.current.audio.paused) {
          view.current.scrollMs = clampScroll(cur - visibleMs() / 2)
          dirtyRef.current = true
        }
        const wasDirty = dirtyRef.current
        if (wasDirty) {
          renderStatic()
          dirtyRef.current = false
        }
        // Only repaint the moving layer when the playhead or view actually
        // changed (or the static layer was just rebuilt). A paused, un-scrubbed
        // waveform produces an identical frame, so skip it.
        const v = view.current
        const ld = lastDrawRef.current
        if (
          wasDirty ||
          cur !== ld.cur ||
          v.scrollMs !== ld.scrollMs ||
          v.pxPerSec !== ld.pxPerSec
        ) {
          blitAndPlayhead(cur)
          drawMinimap(cur)
          ld.cur = cur
          ld.scrollMs = v.scrollMs
          ld.pxPerSec = v.pxPerSec
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        staticRef.current = null
      }
    }, [height, minimapHeight]) // eslint-disable-line react-hooks/exhaustive-deps

    function currentMs(): number {
      const a = p.current.audio
      return a && isFinite(a.currentTime) ? a.currentTime * 1000 : 0
    }

    // ── Static layer: waveform + grid + phrases + cues + loops ──────────────────
    function renderStatic(): void {
      const sc = staticRef.current
      if (!sc) return
      const ctx = sc.getContext('2d')
      const w = widthRef.current
      if (!ctx || w <= 0) return
      ctx.clearRect(0, 0, w, height)

      const { peaks, status, durationMs, grid, showGrid, showPhrases, phrases, loops, draftLoop } =
        p.current
      const mid = height / 2
      const pps = view.current.pxPerSec
      const scrollMs = view.current.scrollMs
      const visMs = visibleMs()

      // background
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(0, 0, w, height)

      if (status !== 'ready' || !peaks || durationMs <= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)'
        ctx.fillRect(0, mid - 0.5, w, 1)
        return
      }

      // phrase strip (bottom band)
      const phraseH = showPhrases && phrases.length ? 14 : 0
      const waveBottom = height - phraseH
      const waveMid = waveBottom / 2

      // colored waveform — one vertical bar per pixel column
      const buckets = peaks.buckets
      for (let x = 0; x < w; x++) {
        const ms0 = scrollMs + (x / pps) * 1000
        const ms1 = scrollMs + ((x + 1) / pps) * 1000
        let b0 = Math.floor((ms0 / durationMs) * buckets)
        let b1 = Math.ceil((ms1 / durationMs) * buckets)
        if (b1 <= b0) b1 = b0 + 1
        b0 = Math.max(0, Math.min(buckets - 1, b0))
        b1 = Math.max(b0 + 1, Math.min(buckets, b1))
        let amp = 0
        let l = 0
        let m = 0
        let h = 0
        for (let b = b0; b < b1; b++) {
          const a = Math.max(Math.abs(peaks.min[b]), peaks.max[b])
          if (a > amp) amp = a
          l += peaks.low[b]
          m += peaks.mid[b]
          h += peaks.high[b]
        }
        const n = b1 - b0
        l /= n
        m /= n
        h /= n
        const total = l + m + h + 1e-4
        const r = (l * LOW_C[0] + m * MID_C[0] + h * HIGH_C[0]) / total
        const g = (l * LOW_C[1] + m * MID_C[1] + h * HIGH_C[1]) / total
        const bl = (l * LOW_C[2] + m * MID_C[2] + h * HIGH_C[2]) / total
        const barH = Math.max(1, amp * (waveMid - 2) * 2)
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`
        ctx.fillRect(x, waveMid - barH / 2, 1, barH)
      }

      // subtle centre line
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(0, waveMid - 0.5, w, 1)

      // beatgrid
      if (showGrid && grid && grid.bpm > 0) {
        const beatSpacingPx = (60 / grid.bpm) * pps
        const barSpacingPx = beatSpacingPx * grid.beatsPerBar
        if (barSpacingPx >= 6) {
          const lines = beatsInRange(grid, scrollMs - 50, scrollMs + visMs + 50)
          for (const line of lines) {
            const x = xAtMs(line.ms)
            if (x < -1 || x > w + 1) continue
            if (line.isDownbeat) {
              ctx.fillStyle = 'rgba(255,255,255,0.6)'
              ctx.fillRect(x, 0, 1, waveBottom)
              ctx.fillStyle = 'rgba(255,255,255,0.95)'
              ctx.fillRect(x, 0, 1, 6)
              if (barSpacingPx >= 26) {
                const bar = barBeatAt(grid, line.ms).bar
                ctx.fillStyle = 'rgba(255,255,255,0.7)'
                ctx.font = '600 9px ui-monospace, monospace'
                ctx.fillText(String(bar), x + 3, 11)
              }
            } else if (beatSpacingPx >= 5) {
              ctx.fillStyle = 'rgba(255,255,255,0.22)'
              ctx.fillRect(x, 0, 1, waveBottom)
            }
          }
        }
      }

      // loops
      const allLoops = [...loops]
      if (draftLoop) allLoops.push({ startMs: draftLoop.startMs, endMs: draftLoop.endMs })
      for (const lp of allLoops) {
        const x0 = xAtMs(lp.startMs)
        const x1 = xAtMs(Math.max(lp.endMs, lp.startMs))
        if (x1 < 0 || x0 > w) continue
        ctx.fillStyle = 'rgba(207,255,4,0.13)'
        ctx.fillRect(x0, 0, Math.max(2, x1 - x0), waveBottom)
        ctx.fillStyle = 'rgba(207,255,4,0.8)'
        ctx.fillRect(x0, 0, 1.5, waveBottom)
        ctx.fillRect(x1 - 1.5, 0, 1.5, waveBottom)
      }

      // cues + hot cues
      drawCue(ctx, scrollMs, visMs, waveBottom)

      // phrase strip
      if (phraseH > 0) {
        for (const seg of phrases) {
          const x0 = xAtMs(seg.startMs)
          const x1 = xAtMs(seg.endMs)
          if (x1 < 0 || x0 > w) continue
          const col = PHRASE_COLORS[seg.kind]
          ctx.fillStyle = hexA(col, 0.5)
          ctx.fillRect(x0, waveBottom, Math.max(1, x1 - x0), phraseH)
          if (x1 - x0 > 34) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)'
            ctx.font = '700 8px ui-monospace, monospace'
            ctx.fillText(PHRASE_LABEL[seg.kind], x0 + 4, waveBottom + 10)
          }
        }
      }
    }

    function drawCue(
      ctx: CanvasRenderingContext2D,
      scrollMs: number,
      visMs: number,
      waveBottom: number
    ): void {
      const { cuePoints, hotCues } = p.current
      const w = widthRef.current
      for (const cp of cuePoints) {
        if (cp.position < scrollMs - 50 || cp.position > scrollMs + visMs + 50) continue
        const x = xAtMs(cp.position)
        const col = cp.type === 'cue' ? CUE_COLOR : MEMORY_COLOR
        ctx.fillStyle = col
        ctx.fillRect(x, 0, 1.5, waveBottom)
        flag(ctx, x, col, cp.type === 'cue' ? 'CUE' : 'MEM', w)
      }
      for (const hc of hotCues) {
        if (hc.position < scrollMs - 50 || hc.position > scrollMs + visMs + 50) continue
        const x = xAtMs(hc.position)
        const col = HOT_CUE_COLORS[hc.index] ?? '#fff'
        ctx.fillStyle = col
        ctx.fillRect(x, 0, 1.5, waveBottom)
        flag(ctx, x, col, 'ABCDEFGH'[hc.index] ?? '?', w)
      }
    }

    function flag(
      ctx: CanvasRenderingContext2D,
      x: number,
      color: string,
      label: string,
      w: number
    ): void {
      const fx = Math.min(x, w - 18)
      ctx.fillStyle = color
      ctx.fillRect(fx, 0, label.length > 1 ? 22 : 13, 11)
      ctx.fillStyle = '#0a0a0a'
      ctx.font = '700 8px ui-monospace, monospace'
      ctx.fillText(label, fx + 2, 8)
    }

    // ── Per-frame: blit static + playhead ───────────────────────────────────────
    function blitAndPlayhead(cur: number): void {
      const main = mainRef.current
      const sc = staticRef.current
      const w = widthRef.current
      if (!main || !sc) return
      const ctx = main.getContext('2d')
      if (!ctx || w <= 0) return
      ctx.clearRect(0, 0, w, height)
      ctx.drawImage(sc, 0, 0, w, height)

      // subtle progress veil over the played (past) region — keeps the upcoming
      // track bright while marking where you've been.
      const px = xAtMs(cur)
      if (px > 0) {
        ctx.fillStyle = 'rgba(4,2,10,0.34)'
        ctx.fillRect(0, 0, Math.min(w, px), height)
      }
      // playhead
      if (px >= -2 && px <= w + 2) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(px - 1, 0, 2, height)
        ctx.beginPath()
        ctx.moveTo(px - 5, 0)
        ctx.lineTo(px + 5, 0)
        ctx.lineTo(px, 6)
        ctx.closePath()
        ctx.fill()
      }
    }

    // ── Minimap (overview) ───────────────────────────────────────────────────────
    function drawMinimap(cur: number): void {
      const mini = miniRef.current
      const w = widthRef.current
      if (!mini) return
      const ctx = mini.getContext('2d')
      if (!ctx || w <= 0) return
      const h = minimapHeight
      const mid = h / 2
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, 0, w, h)

      const { peaks, status, durationMs } = p.current
      if (status === 'ready' && peaks && durationMs > 0) {
        const buckets = peaks.buckets
        for (let x = 0; x < w; x++) {
          const b0 = Math.floor((x / w) * buckets)
          const b1 = Math.max(b0 + 1, Math.floor(((x + 1) / w) * buckets))
          let amp = 0
          let l = 0
          let m = 0
          let hi = 0
          for (let b = b0; b < Math.min(b1, buckets); b++) {
            const a = Math.max(Math.abs(peaks.min[b]), peaks.max[b])
            if (a > amp) amp = a
            l += peaks.low[b]
            m += peaks.mid[b]
            hi += peaks.high[b]
          }
          const n = Math.max(1, Math.min(b1, buckets) - b0)
          const total = l / n + m / n + hi / n + 1e-4
          const r = ((l / n) * LOW_C[0] + (m / n) * MID_C[0] + (hi / n) * HIGH_C[0]) / total
          const g = ((l / n) * LOW_C[1] + (m / n) * MID_C[1] + (hi / n) * HIGH_C[1]) / total
          const bl = ((l / n) * LOW_C[2] + (m / n) * MID_C[2] + (hi / n) * HIGH_C[2]) / total
          const barH = Math.max(1, amp * (mid - 1) * 2)
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${bl | 0},0.85)`
          ctx.fillRect(x, mid - barH / 2, 1, barH)
        }
        // viewport window
        const vx = (view.current.scrollMs / durationMs) * w
        const vw = Math.max(4, (visibleMs() / durationMs) * w)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(vx, 0, vw, h)
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 1
        ctx.strokeRect(vx + 0.5, 0.5, vw - 1, h - 1)
        // playhead tick
        const px = (cur / durationMs) * w
        ctx.fillStyle = '#CFFF04'
        ctx.fillRect(px - 0.5, 0, 1, h)
      }
    }

    // ── Pointer handling ────────────────────────────────────────────────────────
    function seekAtClientX(clientX: number, el: HTMLElement, fromMini: boolean): void {
      const rect = el.getBoundingClientRect()
      const x = clientX - rect.left
      if (fromMini) {
        const dur = p.current.durationMs
        if (dur <= 0) return
        const ms = (x / rect.width) * dur
        // center the viewport on click, and seek
        view.current.scrollMs = clampScroll(ms - visibleMs() / 2)
        dirtyRef.current = true
        p.current.onSeek(Math.max(0, Math.min(dur, ms)))
      } else {
        const ms = msAtX(x)
        p.current.onSeek(Math.max(0, Math.min(p.current.durationMs, ms)))
      }
    }

    return (
      <div ref={wrapRef} style={{ width: '100%', userSelect: 'none' }}>
        <canvas
          ref={miniRef}
          role="img"
          aria-label="Track overview waveform. Click or drag to scrub; use the playback controls and arrow keys to navigate."
          style={{ display: 'block', width: '100%', cursor: 'pointer', borderRadius: 6 }}
          onPointerDown={(e) => {
            dragRef.current = 'mini'
            e.currentTarget.setPointerCapture(e.pointerId)
            seekAtClientX(e.clientX, e.currentTarget, true)
          }}
          onPointerMove={(e) => {
            if (dragRef.current === 'mini') seekAtClientX(e.clientX, e.currentTarget, true)
          }}
          onPointerUp={(e) => {
            dragRef.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId)
          }}
        />
        <canvas
          ref={mainRef}
          role="img"
          aria-label="Detailed waveform. Click or drag to set the playhead; Space plays or pauses, left and right arrows nudge by 100ms."
          style={{
            display: 'block',
            width: '100%',
            cursor: 'ew-resize',
            marginTop: 6,
            borderRadius: 8
          }}
          onPointerDown={(e) => {
            dragRef.current = 'main'
            e.currentTarget.setPointerCapture(e.pointerId)
            seekAtClientX(e.clientX, e.currentTarget, false)
          }}
          onPointerMove={(e) => {
            if (dragRef.current === 'main') seekAtClientX(e.clientX, e.currentTarget, false)
          }}
          onPointerUp={(e) => {
            dragRef.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              const rect = e.currentTarget.getBoundingClientRect()
              const anchor = msAtX(e.clientX - rect.left)
              setZoom(view.current.pxPerSec * (e.deltaY < 0 ? 1.12 : 0.89), anchor)
            } else {
              const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) || 0
              view.current.scrollMs = clampScroll(
                view.current.scrollMs + (delta / view.current.pxPerSec) * 1000
              )
              dirtyRef.current = true
            }
          }}
        />
      </div>
    )
  }
)

function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
