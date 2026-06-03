import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * NFR-603 accessibility regression gate — colour contrast.
 *
 * jsx-a11y / axe in jsdom can't compute colour contrast (no layout), so this
 * guards the locked ink/platinum/lime palette directly. It parses the REAL
 * `src/styles/tokens.css`, composites the semi-transparent text + glass tokens
 * over the aurora base, and asserts every body-text token clears WCAG 2.1 AA
 * (4.5:1 for normal text) on the worst-case surface in each theme.
 *
 * If anyone regresses a token (e.g. drops --text-tertiary back to 0.4), this
 * fails — in the same `npm test` step CI already runs.
 */

const here = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8')

// tokens.css defines dark tokens under `:root` and light overrides under
// `[data-theme='light']`. Split there so same-named tokens resolve per theme.
const lightMarker = tokensCss.indexOf("[data-theme='light']")
const darkScope = tokensCss.slice(0, lightMarker === -1 ? undefined : lightMarker)
const lightScope = lightMarker === -1 ? '' : tokensCss.slice(lightMarker)

function readToken(scope: string, name: string): string {
  const m = scope.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1].trim()
}

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(value: string): Rgba {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgba = value.match(/rgba?\(([^)]+)\)/)
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()))
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
  }
  throw new Error(`unsupported colour: ${value}`)
}

/** Alpha-composite an rgba foreground over an opaque rgb background. */
function composite(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1
  }
}

function relativeLuminance({ r, g, b }: Rgba): number {
  const lin = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

const AA_NORMAL = 4.5

/** Build the opaque surface backgrounds a theme's text actually renders on. */
function backgroundsFor(scope: string): { label: string; rgb: Rgba }[] {
  const base = parseColor(readToken(scope, 'aurora-black')) // opaque base
  const surfaces = ['surface-1', 'surface-2', 'surface-3'].map((name) => ({
    label: name,
    rgb: composite(parseColor(readToken(scope, name)), base)
  }))
  return [{ label: 'aurora-base', rgb: base }, ...surfaces]
}

/** Worst-case (minimum) contrast of a text token across all its backgrounds. */
function worstContrast(scope: string, textToken: string): { ratio: number; on: string } {
  const fg = parseColor(readToken(scope, textToken))
  let worst = { ratio: Infinity, on: '' }
  for (const bg of backgroundsFor(scope)) {
    const ratio = contrastRatio(composite(fg, bg.rgb), bg.rgb)
    if (ratio < worst.ratio) worst = { ratio, on: bg.label }
  }
  return worst
}

describe('palette contrast (WCAG 2.1 AA)', () => {
  // --text-tertiary is the historically failing one (0.4 ≈ 3.6:1); these are
  // body-text tokens that must clear 4.5:1 on every surface they sit on.
  const bodyTokens = ['text-primary', 'text-secondary', 'text-tertiary']

  for (const token of bodyTokens) {
    it(`dark: --${token} ≥ ${AA_NORMAL}:1 on every surface`, () => {
      const { ratio, on } = worstContrast(darkScope, token)
      expect(ratio, `--${token} on ${on} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
    })

    it(`light: --${token} ≥ ${AA_NORMAL}:1 on every surface`, () => {
      const { ratio, on } = worstContrast(lightScope, token)
      expect(ratio, `--${token} on ${on} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }

  it('lime CTA: --text-on-accent ≥ 4.5:1 on the --accent fill (both themes)', () => {
    for (const scope of [darkScope, lightScope]) {
      const accent = parseColor(readToken(scope, 'accent'))
      const onAccent = parseColor(readToken(scope, 'text-on-accent'))
      const ratio = contrastRatio(onAccent, accent)
      expect(ratio, `text-on-accent = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it('lime accent as text/links ≥ 4.5:1 on the dark base', () => {
    const accent = parseColor(readToken(darkScope, 'accent'))
    const base = parseColor(readToken(darkScope, 'aurora-black'))
    const ratio = contrastRatio(accent, base)
    expect(ratio, `accent on base = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})
