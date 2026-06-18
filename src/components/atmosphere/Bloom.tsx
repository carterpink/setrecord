import { useEffect, useRef } from 'react'
import { BLOOM_ICONS, type BloomIcon } from './bloomIcons'

/* ============================================================
   Bloom — high-res grain on an icon stencil, with light flowing over it.

   Reverse-engineered from framer.com/state-of-sites-2026 (frame-diffed + zoomed):
   the grain is FULL-RESOLUTION (crisp ~1px particles) and STATIC, while a smooth
   light/colour field sweeps across it, lighting different particles. Colour ramps
   with brightness: deep violet/indigo (dim) → blue → cyan → white-hot (lit).

   Architecture (fast AND crisp):
   • A static grain mask (offscreen, full device-res) — drawn ONCE. Here we fill an
     app-icon silhouette (Library, Search, Layers…) with stippled high-res dots, so
     each section's bloom is a meaningful shape, not an abstract blob.
   • A low-res moving colour/light field (offscreen) — redrawn each frame. Cheap.
   • Composite: draw the smooth colour upscaled, then `destination-in` the grain mask
     → crisp grain dots coloured by the moving light, black/absent elsewhere. The
     light's migration over the fixed stencil IS the motion.
   ============================================================ */

// Each tone is a MULTI-HUE gradient (deep violet → blue → key colour), like the
// Framer blooms — not one hue fading to white. White-hot is added separately, only
// at the lit peaks. Lime is the signature "hot" colour (where Framer used gold).
type Stop = [number, number, number, number]
const RAMPS: Record<string, Stop[]> = {
  lime: [
    [0, 0, 0, 0],
    [0.22, 52, 18, 104],
    [0.46, 36, 92, 206],
    [0.72, 120, 200, 30],
    [1, 172, 240, 54]
  ],
  cyan: [
    [0, 0, 0, 0],
    [0.22, 70, 20, 124],
    [0.46, 40, 80, 234],
    [0.72, 56, 186, 250],
    [1, 96, 216, 255]
  ],
  magenta: [
    [0, 0, 0, 0],
    [0.22, 36, 34, 128],
    [0.46, 124, 54, 224],
    [0.72, 236, 66, 188],
    [1, 255, 104, 206]
  ],
  violet: [
    [0, 0, 0, 0],
    [0.22, 42, 24, 124],
    [0.46, 80, 62, 236],
    [0.72, 150, 104, 250],
    [1, 178, 134, 255]
  ]
}

function rampColor(stops: Stop[], v: number, out: [number, number, number]): void {
  if (v <= 0) {
    out[0] = out[1] = out[2] = 0
    return
  }
  if (v >= 1) {
    const last = stops[stops.length - 1]
    out[0] = last[1]
    out[1] = last[2]
    out[2] = last[3]
    return
  }
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const a = stops[i - 1]
      const b = stops[i]
      const f = (v - a[0]) / (b[0] - a[0])
      out[0] = a[1] + (b[1] - a[1]) * f
      out[1] = a[2] + (b[2] - a[2]) * f
      out[2] = a[3] + (b[3] - a[3]) * f
      return
    }
  }
}

export default function Bloom({
  tone = 'cyan',
  icon,
  intensity = 1,
  grain = 1,
  density = 1,
  seed = 7,
  flow = 1,
  sizeFrac = 0.74,
  blurFrac = 0.011,
  interactive = false,
  className,
  style
}: {
  tone?: keyof typeof RAMPS
  icon?: BloomIcon
  intensity?: number
  /** grain dot brightness gain. */
  grain?: number
  /** stipple coverage density. */
  density?: number
  seed?: number
  flow?: number
  /** the light pools toward the pointer (use on the hero — a quiet bit of magic). */
  interactive?: boolean
  /** icon size as a fraction of the smaller canvas side. */
  sizeFrac?: number
  /** soft-falloff blur of the stencil, as a fraction of the smaller side. */
  blurFrac?: number
  className?: string
  style?: React.CSSProperties
}): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasEl = ref.current
    const ctx = canvasEl?.getContext('2d')
    if (!canvasEl || !ctx) return
    const canvas = canvasEl
    const paint = ctx // non-null alias that survives into the frame() closure
    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const ramp = RAMPS[tone] || RAMPS.cyan
    const iconDef = icon ? BLOOM_ICONS[icon] : null

    // Pointer-reactive light: target (tx,ty) set on move, eased toward in frame().
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove =
      interactive && !reduce
        ? (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect()
            if (r.width < 2) return
            let nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
            let ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
            nx = nx < -1.6 ? -1.6 : nx > 1.6 ? 1.6 : nx
            ny = ny < -1.6 ? -1.6 : ny > 1.6 ? 1.6 : ny
            ptr.tx = nx
            ptr.ty = ny
          }
        : null
    if (onMove) window.addEventListener('pointermove', onMove, { passive: true })

    // Offscreen layers.
    const gMask = document.createElement('canvas') // static grain (full res)
    const gctx = gMask.getContext('2d')!
    let lW = 0
    let lH = 0
    let lImg: ImageData | null = null
    const lLayer = document.createElement('canvas') // moving colour (low res)
    const lctx = lLayer.getContext('2d')!
    let W = 0
    let H = 0
    const col: [number, number, number] = [0, 0, 0]

    function buildStencilCoverage(w: number, h: number): Float32Array {
      // Draw the stencil crisp, then a blurred copy → soft coverage (dusty edges).
      const a = document.createElement('canvas')
      a.width = w
      a.height = h
      const actx = a.getContext('2d')!
      actx.clearRect(0, 0, w, h)
      const minSide = Math.min(w, h)
      if (iconDef) {
        const target = minSide * sizeFrac
        const scale = target / iconDef.vb
        actx.save()
        actx.translate(w / 2, h / 2)
        actx.scale(scale, scale)
        actx.translate(-iconDef.vb / 2, -iconDef.vb / 2)
        actx.strokeStyle = '#fff'
        actx.lineCap = 'round'
        actx.lineJoin = 'round'
        actx.lineWidth = iconDef.sw * iconDef.thicken
        for (const d of iconDef.paths) actx.stroke(new Path2D(d))
        actx.restore()
      } else {
        // Fallback: a soft organic blob.
        const g = actx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, minSide * 0.5)
        g.addColorStop(0, '#fff')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        actx.fillStyle = g
        actx.fillRect(0, 0, w, h)
      }
      // Blur into a second canvas for the soft falloff.
      const b = document.createElement('canvas')
      b.width = w
      b.height = h
      const bctx = b.getContext('2d')!
      bctx.filter = `blur(${Math.max(1, minSide * blurFrac)}px)`
      bctx.drawImage(a, 0, 0)
      const data = bctx.getImageData(0, 0, w, h).data
      const cov = new Float32Array(w * h)
      // A faint radial halo so there's ambient dust around the icon.
      const cxp = w / 2
      const cyp = h / 2
      const rad = minSide * 0.52
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x
          let c = data[i * 4 + 3] / 255
          const dx = (x - cxp) / rad
          const dy = (y - cyp) / rad
          let halo = 1 - Math.sqrt(dx * dx + dy * dy)
          if (halo < 0) halo = 0
          halo = halo * halo * 0.13 // faint dust around the icon; icon stays the shape
          if (halo > c) c = halo
          cov[i] = c > 1 ? 1 : c
        }
      }
      return cov
    }

    function build(): boolean {
      const rect = canvas.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return false
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // Full device-res grain, capped so the one-time stipple stays snappy.
      const cap = 1280
      let nw = Math.round(rect.width * dpr)
      let nh = Math.round(rect.height * dpr)
      const m = Math.max(nw, nh)
      if (m > cap) {
        nw = Math.round((nw * cap) / m)
        nh = Math.round((nh * cap) / m)
      }
      if (nw === W && nh === H) return true
      W = nw
      H = nh
      canvas.width = W
      canvas.height = H
      gMask.width = W
      gMask.height = H

      // Static grain mask: crisp white dots, density follows the stencil coverage.
      const cov = buildStencilCoverage(W, H)
      const g = gctx.createImageData(W, H)
      const gd = g.data
      let s = (seed * 2654435761) >>> 0
      const rnd = (): number => {
        s ^= s << 13
        s ^= s >>> 17
        s ^= s << 5
        s >>>= 0
        return s / 4294967296
      }
      for (let i = 0; i < cov.length; i++) {
        const c = cov[i]
        const j = i * 4
        // Probability a grain particle sits at this pixel. CAPPED below 1 so even the
        // densest part of a thick stroke keeps gaps between particles — otherwise the
        // core fills 100% and smears into a solid neon band, and you only see grain at
        // the blurred edge (the bug). With a cap, the grain reads THROUGH the icon.
        let p = Math.pow(c, 1.05) * density
        if (p > 0.8) p = 0.8
        if (c > 0.004 && rnd() < p) {
          gd[j] = 255
          gd[j + 1] = 255
          gd[j + 2] = 255
          // Per-particle alpha varies the grain's opacity, so the dither texture
          // survives even where the moving light is hottest (a flat 255 would let the
          // smooth colour layer show through as a solid fill). This is the dusty,
          // luminous grain of the Framer reference — present inside the shape, not just
          // around it.
          const a = 0.34 + rnd() * 0.66
          gd[j + 3] = (a * 255) | 0
        } else {
          gd[j + 3] = 0
        }
      }
      gctx.putImageData(g, 0, 0)

      // Low-res colour/light buffer.
      lW = Math.max(2, Math.round(W * 0.32))
      lH = Math.max(2, Math.round(H * 0.32))
      lLayer.width = lW
      lLayer.height = lH
      lImg = lctx.createImageData(lW, lH)
      return true
    }

    // Three drifting light sources — their motion is the whole animation.
    function frame(t: number): void {
      if (!lImg) return
      const tf = t * flow
      ptr.x += (ptr.tx - ptr.x) * 0.06
      ptr.y += (ptr.ty - ptr.y) * 0.06
      const px = ptr.x * 0.5
      const py = ptr.y * 0.5
      const l0x = 0.5 * Math.sin(tf * 0.000196) + px
      const l0y = 0.48 * Math.cos(tf * 0.00016 + 1.1) + py
      const l1x = 0.56 * Math.sin(tf * 0.000132 + 2.3) + px
      const l1y = 0.5 * Math.cos(tf * 0.000216 + 3.0) + py
      const l2x = 0.48 * Math.sin(tf * 0.000242 + 4.2) + px
      const l2y = 0.54 * Math.cos(tf * 0.000114 + 5.1) + py
      const d = lImg.data
      for (let y = 0; y < lH; y++) {
        const v = (y / lH - 0.5) * 2
        for (let x = 0; x < lW; x++) {
          const u = (x / lW - 0.5) * 2
          const d0x = u - l0x
          const d0y = v - l0y
          const d1x = u - l1x
          const d1y = v - l1y
          const d2x = u - l2x
          const d2y = v - l2y
          // MAX of the lobes (not sum) so overlapping lights never pile up into a big
          // white plateau — each lobe lights a small moving core; the rest stays colour.
          const a0 = 0.8 / (1 + (d0x * d0x + d0y * d0y) * 3.4)
          const a1 = 0.74 / (1 + (d1x * d1x + d1y * d1y) * 3.9)
          const a2 = 0.66 / (1 + (d2x * d2x + d2y * d2y) * 4.4)
          let L = a0 > a1 ? a0 : a1
          if (a2 > L) L = a2
          // Ambient floor so the stencil always carries faint deep-hue grain.
          let B = 0.18 + L
          B *= grain
          if (B > 1) B = 1
          // Hue index drifts in space + time → the multi-colour gradient flows across
          // the stencil (deep violet → blue → key colour), independent of brightness.
          let cIdx = B + 0.16 * Math.sin(u * 2.4 + v * 1.7 + tf * 0.00072)
          if (cIdx < 0) cIdx = 0
          else if (cIdx > 1) cIdx = 1
          rampColor(ramp, cIdx, col)
          // No white peak — the ramp tops out at the bright brand colour (cleaner read).
          const j = (y * lW + x) * 4
          d[j] = col[0]
          d[j + 1] = col[1]
          d[j + 2] = col[2]
          d[j + 3] = 255 * intensity
        }
      }
      lctx.putImageData(lImg, 0, 0)

      // Composite: smooth colour upscaled, clipped to the crisp grain dots.
      paint.globalCompositeOperation = 'source-over'
      paint.globalAlpha = 1
      paint.clearRect(0, 0, W, H)
      paint.imageSmoothingEnabled = true
      paint.drawImage(lLayer, 0, 0, W, H)
      paint.globalCompositeOperation = 'destination-in'
      paint.drawImage(gMask, 0, 0)
      // (No full-canvas underglow — that painted a faint square behind the grain.)
      paint.globalCompositeOperation = 'source-over'
      paint.globalAlpha = 1
    }

    let raf = 0
    let lastT = -999
    let visible = false
    function loop(t: number): void {
      if (t - lastT > 33) {
        lastT = t
        frame(t)
      }
      raf = requestAnimationFrame(loop)
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting)
        if (visible) {
          if (!build()) return
          if (reduce) {
            frame(3000)
          } else if (!raf) {
            lastT = -999
            raf = requestAnimationFrame(loop)
          }
        } else if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      },
      { rootMargin: '300px 0px' }
    )
    io.observe(canvas)
    const ro = new ResizeObserver(() => {
      if (build() && (reduce || !visible)) frame(3000)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      if (onMove) window.removeEventListener('pointermove', onMove)
    }
  }, [tone, icon, intensity, grain, density, seed, flow, sizeFrac, blurFrac, interactive])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
    />
  )
}
