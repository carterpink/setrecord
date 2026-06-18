import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * NFR-603 accessibility regression gate — colour contrast.
 *
 * jsx-a11y / axe in jsdom can't compute colour contrast (no layout), so this
 * guards the locked ink/platinum/lime palette directly. It parses the REAL
 * `src/styles/tokens.css`, composites the semi-transparent text tokens over the
 * worst-case surface in EACH theme (grit default, aurora rollback, light), and
 * asserts every body-text token clears WCAG 2.1 AA (4.5:1 for normal text).
 *
 * If anyone regresses a token (e.g. drops --text-tertiary back to 0.4), this
 * fails — in the same `npm test` step CI already runs.
 */

const here = dirname(fileURLToPath(import.meta.url))
// Strip comments first — prose that mentions selectors/braces must not confuse
// the block parser (the top-of-file comment references the theme selectors).
const tokensCss = readFileSync(join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
)

/** Return the `{ … }` body of the first real rule with this selector (not prose). */
function blockBody(selector: string): string {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{')
  const m = re.exec(tokensCss)
  if (!m) throw new Error(`selector ${selector} not found`)
  const open = m.index + m[0].length - 1
  let depth = 0
  for (let i = open; i < tokensCss.length; i++) {
    if (tokensCss[i] === '{') depth++
    else if (tokensCss[i] === '}') {
      depth--
      if (depth === 0) return tokensCss.slice(open + 1, i)
    }
  }
  throw new Error(`unbalanced block for ${selector}`)
}

function tokenMap(body: string): Record<string, string> {
  const map: Record<string, string> = {}
  const re = /--([\w-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) map[m[1]] = m[2].trim()
  return map
}

// `:root` is the grit default; aurora + light inherit from it and override.
const root = tokenMap(blockBody(':root'))
const THEMES: Record<string, Record<string, string>> = {
  grit: root,
  aurora: { ...root, ...tokenMap(blockBody("[data-theme='aurora']")) },
  light: { ...root, ...tokenMap(blockBody("[data-theme='light']")) }
}

function readToken(theme: Record<string, string>, name: string): string {
  const v = theme[name]
  if (v === undefined) throw new Error(`token --${name} not found`)
  return v
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
function backgroundsFor(theme: Record<string, string>): { label: string; rgb: Rgba }[] {
  const base = parseColor(readToken(theme, 'aurora-black')) // opaque base (canvas)
  const surfaces = ['surface-1', 'surface-2', 'surface-3'].map((name) => ({
    label: name,
    rgb: composite(parseColor(readToken(theme, name)), base)
  }))
  return [{ label: 'canvas-base', rgb: base }, ...surfaces]
}

/** Worst-case (minimum) contrast of a text token across all its backgrounds. */
function worstContrast(
  theme: Record<string, string>,
  textToken: string
): { ratio: number; on: string } {
  const fg = parseColor(readToken(theme, textToken))
  let worst = { ratio: Infinity, on: '' }
  for (const bg of backgroundsFor(theme)) {
    const ratio = contrastRatio(composite(fg, bg.rgb), bg.rgb)
    if (ratio < worst.ratio) worst = { ratio, on: bg.label }
  }
  return worst
}

describe('palette contrast (WCAG 2.1 AA)', () => {
  // --text-tertiary is the historically failing one (0.4 ≈ 3.6:1); these are
  // body-text tokens that must clear 4.5:1 on every surface they sit on.
  const bodyTokens = ['text-primary', 'text-secondary', 'text-tertiary']
  const themeNames = ['grit', 'aurora', 'light'] as const

  for (const themeName of themeNames) {
    for (const token of bodyTokens) {
      it(`${themeName}: --${token} ≥ ${AA_NORMAL}:1 on every surface`, () => {
        const { ratio, on } = worstContrast(THEMES[themeName], token)
        expect(
          ratio,
          `${themeName} --${token} on ${on} = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(AA_NORMAL)
      })
    }

    it(`${themeName}: --text-on-accent ≥ 4.5:1 on the --accent fill`, () => {
      const accent = parseColor(readToken(THEMES[themeName], 'accent'))
      const onAccent = parseColor(readToken(THEMES[themeName], 'text-on-accent'))
      const ratio = contrastRatio(onAccent, accent)
      expect(ratio, `${themeName} text-on-accent = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        AA_NORMAL
      )
    })
  }

  it('lime accent as text/links ≥ 4.5:1 on the dark (grit) base', () => {
    const accent = parseColor(readToken(THEMES.grit, 'accent'))
    const base = parseColor(readToken(THEMES.grit, 'aurora-black'))
    const ratio = contrastRatio(accent, base)
    expect(ratio, `accent on base = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})
