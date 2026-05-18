/**
 * Bright, consistent per-position colours for Camelot wheel keys.
 * Numbers 1–12 map to 12 hues evenly spaced around the colour wheel.
 * A and B at the same number share the same hue (same wheel position).
 */

interface CamelotColor {
  /** Foreground text colour */
  color: string
  /** Pill background at ~12% opacity */
  background: string
  /** Pill border at ~35% opacity */
  border: string
}

// 12 hues × 30° — vivid, dark-UI-safe
const HUES: Record<number, number> = {
  1:  0,    // red
  2:  28,   // orange
  3:  52,   // amber
  4:  82,   // yellow-green
  5:  122,  // green
  6:  155,  // emerald
  7:  178,  // cyan
  8:  205,  // sky blue
  9:  225,  // blue
  10: 258,  // indigo
  11: 288,  // purple
  12: 322,  // pink
}

// Per-number saturation/lightness tweaks so every colour reads cleanly
const PARAMS: Record<number, { s: number; l: number }> = {
  1:  { s: 85, l: 62 },
  2:  { s: 88, l: 60 },
  3:  { s: 86, l: 57 },
  4:  { s: 72, l: 55 },
  5:  { s: 65, l: 56 },
  6:  { s: 72, l: 52 },
  7:  { s: 78, l: 54 },
  8:  { s: 82, l: 62 },
  9:  { s: 78, l: 67 },
  10: { s: 72, l: 68 },
  11: { s: 68, l: 66 },
  12: { s: 78, l: 63 },
}

function hexFromHsl(h: number, s: number, l: number): string {
  const sl = s / 100
  const ll = l / 100
  const a = sl * Math.min(ll, 1 - ll)
  const f = (n: number): string => {
    const k = (n + h / 30) % 12
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function buildColor(num: number): CamelotColor {
  const h = HUES[num]
  const { s, l } = PARAMS[num]
  const hex = hexFromHsl(h, s, l)
  const [r, g, b] = hexToRgb(hex)
  return {
    color: hex,
    background: `rgba(${r}, ${g}, ${b}, 0.12)`,
    border: `rgba(${r}, ${g}, ${b}, 0.38)`,
  }
}

const COLOR_MAP: Record<string, CamelotColor> = {}
for (let n = 1; n <= 12; n++) {
  const c = buildColor(n)
  COLOR_MAP[`${n}A`] = c
  COLOR_MAP[`${n}B`] = c
}

export function getCamelotColor(key: string): CamelotColor {
  return COLOR_MAP[key] ?? {
    color: '#5eead4',
    background: 'rgba(94, 234, 212, 0.12)',
    border: 'rgba(94, 234, 212, 0.38)',
  }
}
