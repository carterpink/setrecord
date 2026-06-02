import { useEffect, useRef, useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'
import type { IdentitySnapshot } from '@/types'
import { useToastStore } from '@/stores/toastStore'

/**
 * "DJ Wrapped" — a self-contained shareable card summarising the user's
 * library identity. Drawn directly to <canvas> so it (a) renders with the same
 * Space Grotesk / JetBrains Mono fonts the app uses, and (b) can be copied to
 * clipboard or downloaded without serializing through Image() — the SVG path
 * was failing in Electron's renderer when the blob URL hit the image loader.
 *
 * Layout: 800×1000 portrait, IG-Story-friendly aspect, rendered at 2× for
 * retina-quality PNG output.
 */

const CARD_W = 800
const CARD_H = 1000
const SCALE = 2

const FONT_SANS = "'Space Grotesk', 'SF Pro Display', -apple-system, system-ui, sans-serif"
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace"
const FONT_DISPLAY = "'Instrument Serif', Georgia, serif"

const COLOUR_BG = '#060309'
const COLOUR_BG_TOP = '#1a0a2e'
const COLOUR_BG_MID = '#0a0612'
const COLOUR_ACCENT = '#CFFF04'
const COLOUR_TEXT = '#f5f5f7'
const COLOUR_DIM = '#a3a3ad'
const COLOUR_DIMMER = 'rgba(255, 255, 255, 0.08)'
const COLOUR_TILE_BG = 'rgba(255, 255, 255, 0.04)'

function formatBig(n: number): string {
  return n.toLocaleString('en-US')
}

function topLabel<T extends { label: string; count: number }>(rows: T[]): T | null {
  return rows[0] ?? null
}

function topBpmZone(snap: IdentitySnapshot): string {
  const real = snap.bpmHistogram.filter((b) => b.range !== 'unknown')
  if (real.length === 0) return '—'
  return real.reduce((max, b) => (b.count > max.count ? b : max)).range
}

function topEnergy(snap: IdentitySnapshot): number | null {
  if (snap.energyDistribution.length === 0) return null
  return snap.energyDistribution.reduce((max, e) => (e.count > max.count ? e : max)).level
}

/** Render the share card to the provided canvas context. */
function drawCard(ctx: CanvasRenderingContext2D, snap: IdentitySnapshot): void {
  ctx.save()
  ctx.scale(SCALE, SCALE)

  // ── Background — radial gradients approximated as layered linear + radials.
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  bgGrad.addColorStop(0, COLOUR_BG_MID)
  bgGrad.addColorStop(0.5, COLOUR_BG_TOP)
  bgGrad.addColorStop(1, COLOUR_BG)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const aurora1 = ctx.createRadialGradient(
    CARD_W * 0.3,
    CARD_H * 0.2,
    0,
    CARD_W * 0.3,
    CARD_H * 0.2,
    CARD_W * 0.8
  )
  aurora1.addColorStop(0, 'rgba(58, 26, 94, 0.6)')
  aurora1.addColorStop(1, 'rgba(10, 6, 18, 0)')
  ctx.fillStyle = aurora1
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const aurora2 = ctx.createRadialGradient(
    CARD_W * 0.8,
    CARD_H * 0.7,
    0,
    CARD_W * 0.8,
    CARD_H * 0.7,
    CARD_W * 0.6
  )
  aurora2.addColorStop(0, 'rgba(14, 48, 80, 0.5)')
  aurora2.addColorStop(1, 'rgba(10, 6, 18, 0)')
  ctx.fillStyle = aurora2
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // ── Top eyebrow + headline
  ctx.fillStyle = COLOUR_ACCENT
  ctx.font = `500 14px ${FONT_SANS}`
  ctx.textBaseline = 'alphabetic'
  // Letter-spacing isn't directly settable on canvas; approximate via wider tracking
  // by inserting hair spaces — but Space Grotesk reads cleanly without it.
  ctx.fillText('SETSENSE · YOUR SOUND', 60, 80)

  ctx.fillStyle = COLOUR_TEXT
  ctx.font = `700 48px ${FONT_SANS}`
  ctx.fillText(`${formatBig(snap.totalTracks)} tracks`, 60, 134)

  ctx.fillStyle = COLOUR_DIM
  ctx.font = `400 16px ${FONT_SANS}`
  ctx.fillText('in your library', 60, 162)

  // ── Stat tiles (three across)
  const tiles: Array<{ label: string; value: string; valueSuffix?: string }> = [
    { label: 'TOP BPM ZONE', value: topBpmZone(snap) },
    { label: 'TOP KEY', value: topLabel(snap.keyDistribution)?.label ?? '—' },
    {
      label: 'PEAK ENERGY',
      value: topEnergy(snap) !== null ? String(topEnergy(snap)) : '—',
      valueSuffix: topEnergy(snap) !== null ? '/ 10' : undefined
    }
  ]
  const tileW = 220
  const tileH = 120
  const tileGap = 10
  const tileY = 200
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]
    const x = 60 + i * (tileW + tileGap)
    ctx.fillStyle = COLOUR_TILE_BG
    drawRoundRect(ctx, x, tileY, tileW, tileH, 14)
    ctx.fill()
    ctx.strokeStyle = COLOUR_DIMMER
    ctx.lineWidth = 1
    drawRoundRect(ctx, x, tileY, tileW, tileH, 14)
    ctx.stroke()

    ctx.fillStyle = COLOUR_DIM
    ctx.font = `500 11px ${FONT_SANS}`
    ctx.fillText(tile.label, x + 18, tileY + 32)

    ctx.fillStyle = COLOUR_ACCENT
    ctx.font = `600 38px ${FONT_MONO}`
    const valueX = x + 18
    const valueY = tileY + 90
    ctx.fillText(tile.value, valueX, valueY)

    if (tile.valueSuffix) {
      const m = ctx.measureText(tile.value)
      ctx.fillStyle = COLOUR_DIM
      ctx.font = `400 18px ${FONT_MONO}`
      ctx.fillText(' ' + tile.valueSuffix, valueX + m.width + 4, valueY)
    }
  }

  // ── Defining sound (top genre, oversized)
  const topGenre = topLabel(snap.genreDistribution)
  ctx.fillStyle = COLOUR_DIM
  ctx.font = `500 12px ${FONT_SANS}`
  ctx.fillText('DEFINING SOUND', 60, 380)

  ctx.fillStyle = COLOUR_TEXT
  // Use display serif for editorial feel on the hero line — matches app's `--font-display`.
  ctx.font = `400 56px ${FONT_DISPLAY}`
  ctx.fillText(topGenre ? topGenre.label : '—', 60, 436)

  ctx.fillStyle = COLOUR_DIM
  ctx.font = `400 14px ${FONT_SANS}`
  if (topGenre) {
    const pct = Math.round((topGenre.count / Math.max(1, snap.totalTracks)) * 100)
    ctx.fillText(`${formatBig(topGenre.count)} tracks · ${pct}% of library`, 60, 462)
  }

  // ── Top artists
  ctx.fillStyle = COLOUR_DIM
  ctx.font = `500 12px ${FONT_SANS}`
  ctx.fillText('TOP ARTISTS', 60, 522)

  const artists = snap.topArtists.slice(0, 5)
  ctx.font = `500 22px ${FONT_SANS}`
  for (let i = 0; i < artists.length; i++) {
    const a = artists[i]
    const y = 560 + i * 32
    ctx.fillStyle = COLOUR_TEXT
    ctx.textAlign = 'left'
    ctx.fillText(`${i + 1}. ${a.label}`, 60, y)

    ctx.fillStyle = COLOUR_DIM
    ctx.font = `400 18px ${FONT_MONO}`
    ctx.textAlign = 'right'
    ctx.fillText(String(a.count), 740, y)
    ctx.font = `500 22px ${FONT_SANS}`
  }
  ctx.textAlign = 'left'

  // ── Energy bars
  ctx.fillStyle = COLOUR_DIM
  ctx.font = `500 12px ${FONT_SANS}`
  ctx.fillText('ENERGY PROFILE', 60, 720)

  const energies = snap.energyDistribution
  if (energies.length > 0) {
    const maxE = energies.reduce((m, e) => Math.max(m, e.count), 1)
    const barsX = 60
    const barsY = 740
    const barW = 56
    const barGap = 12
    const barsTotalH = 140
    for (let i = 0; i < energies.length; i++) {
      const e = energies[i]
      const h = Math.max(2, (e.count / maxE) * barsTotalH)
      const x = barsX + i * (barW + barGap)
      const y = barsY + (barsTotalH - h)
      ctx.fillStyle = COLOUR_ACCENT
      ctx.globalAlpha = 0.45 + (e.count / maxE) * 0.55
      drawRoundRect(ctx, x, y, barW, h, 6)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = COLOUR_DIM
      ctx.font = `400 13px ${FONT_MONO}`
      ctx.textAlign = 'center'
      ctx.fillText(String(e.level), x + barW / 2, barsY + barsTotalH + 22)
    }
    ctx.textAlign = 'left'
  }

  // ── Footer
  ctx.fillStyle = COLOUR_DIM
  ctx.font = `400 13px ${FONT_SANS}`
  ctx.fillText('made with', 60, CARD_H - 50)
  ctx.fillStyle = COLOUR_ACCENT
  ctx.font = `600 13px ${FONT_SANS}`
  ctx.fillText('setsense', 60 + ctx.measureText('made with ').width, CARD_H - 50)

  ctx.restore()
}

/** Rounded rectangle path helper (Path2D + roundRect aren't universally available). */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

async function ensureFontsReady(): Promise<void> {
  // Wait for app fonts to be loaded before drawing — otherwise the first frame
  // can fall back to a system font. document.fonts.ready resolves once every
  // CSS-declared @font-face is loaded (Google Fonts have already been kicked
  // off by the document <link> tag).
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {
      /* non-fatal */
    }
  }
}

export function IdentityShareCard({ identity }: { identity: IdentitySnapshot }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const toast = useToastStore()

  // Redraw on every identity change (or first mount).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureFontsReady()
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Reset + draw
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCard(ctx, identity)
    })()
    return () => {
      cancelled = true
    }
  }, [identity])

  const exportPng = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current
      if (!canvas) {
        reject(new Error('Canvas not ready'))
        return
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      }, 'image/png')
    })
  }

  const copy = async (): Promise<void> => {
    try {
      const png = await exportPng()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setCopied(true)
      toast.success('Card copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Could not copy: ' + (err instanceof Error ? err.message : 'unknown'))
    }
  }

  const download = async (): Promise<void> => {
    try {
      const png = await exportPng()
      const url = URL.createObjectURL(png)
      const a = document.createElement('a')
      a.href = url
      a.download = `setsense-identity-${new Date().toISOString().slice(0, 10)}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Card downloaded')
    } catch (err) {
      toast.error('Could not download: ' + (err instanceof Error ? err.message : 'unknown'))
    }
  }

  return (
    <div className="identity-share">
      <div className="identity-share-preview">
        <canvas
          ref={canvasRef}
          width={CARD_W * SCALE}
          height={CARD_H * SCALE}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
      <div className="identity-share-actions">
        <button type="button" className="identity-share-btn primary" onClick={() => void copy()}>
          {copied ? <Check size={14} strokeWidth={1.7} /> : <Copy size={14} strokeWidth={1.7} />}
          {copied ? 'Copied' : 'Copy as image'}
        </button>
        <button type="button" className="identity-share-btn" onClick={() => void download()}>
          <Download size={14} strokeWidth={1.7} />
          Download PNG
        </button>
      </div>
    </div>
  )
}
