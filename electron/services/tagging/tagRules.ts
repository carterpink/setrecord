/**
 * Deterministic tag inference.
 *
 * Pure functions mapping a track's audio features + metadata onto the curated
 * plain-language taxonomy (src/utils/tagging/taxonomy.ts). No Electron, no fs,
 * no model — instant and fully testable. This is the single source of truth the
 * tagRules tests assert against; the optional LLM pass (genreBlend.ts) only
 * *refines* the genre-blend category, never these.
 *
 * Every slug emitted here MUST exist in the taxonomy. The test
 * tests/tagRules.test.ts cross-checks that invariant.
 */

import type { TagCategory } from '../../../src/types'

/** Normalised audio features + the metadata the rules read. */
export interface TagInput {
  /** Final 1..10 energy score. */
  energy: number
  /** Normalised components, all 0..1. */
  rms: number
  brightness: number
  loudness: number
  vocalness: number
  bpm: number
  /** Camelot key, e.g. "9A" (A = minor, B = major). May be empty. */
  key: string
  genre?: string
  durationSec: number
}

export interface AutoTag {
  category: TagCategory
  value: string
}

// ───────── small helpers ─────────

function energyNorm(energy: number): number {
  return Math.max(0, Math.min(1, (energy - 1) / 9))
}

/** True when the Camelot key is major (ends in 'B'). Unknown keys → false. */
export function isMajorKey(key: string): boolean {
  return /b$/i.test(key.trim())
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x < 0) return 0
  if (x > 1) return 1
  return x
}

// ───────── per-category rules ─────────

/** Energy band — single value, straight off the 1..10 score. */
export function energyTag(energy: number): string {
  if (energy <= 3) return 'cooldown'
  if (energy <= 5) return 'warm-up'
  if (energy <= 7) return 'builder'
  return 'peak-time'
}

/** Vocals — single value, three coarse buckets off the vocal proxy. */
export function vocalsTag(vocalness: number): string {
  if (vocalness < 0.25) return 'instrumental'
  if (vocalness < 0.55) return 'vocal-touches'
  return 'vocal-led'
}

/** Time of night — single value from energy + brightness. */
export function timeTag(input: TagInput): string {
  const { energy, brightness } = input
  if (energy <= 3) return brightness >= 0.45 ? 'sunset' : 'after-hours'
  if (energy <= 5) return brightness >= 0.5 ? 'sunset' : 'prime'
  if (energy <= 7) return 'prime'
  return brightness < 0.5 ? 'late-night' : 'prime'
}

/** Best-for — up to 2, priority-ordered. */
export function bestForTags(input: TagInput): string[] {
  const { energy, vocalness } = input
  const major = isMajorKey(input.key)
  const out: string[] = []
  if (energy >= 8) out.push('peak')
  if (energy <= 4) out.push('opener')
  if (energy <= 5 && (major || vocalness > 0.5)) out.push('closer')
  if (vocalness < 0.2 && energy >= 4 && energy <= 7) out.push('tool')
  if (out.length === 0) out.push(energy >= 6 ? 'peak' : 'opener')
  return out.slice(0, 2)
}

/** Vibe — up to 2, the highest-scoring feels. */
export function vibeTags(input: TagInput): string[] {
  const bright = clamp01(input.brightness)
  const dark = 1 - bright
  const power = clamp01(input.rms)
  const loud = clamp01(input.loudness)
  const e = energyNorm(input.energy)
  const major = isMajorKey(input.key) ? 1 : 0
  const minor = major ? 0 : 1
  const instrumental = input.vocalness < 0.3 ? 1 : 0.7

  // Triangular "peak around X" helper.
  const peakAround = (x: number, centre: number, width: number): number =>
    clamp01(1 - Math.abs(x - centre) / width)

  const scores: Record<string, number> = {
    euphoric: bright * (major ? 1 : 0.4) * (0.5 + e),
    warm: (major ? 1 : 0.5) * peakAround(bright, 0.55, 0.5) * (0.6 + e * 0.4),
    dreamy: (1 - power) * (0.4 + bright * 0.4) * (1 - e * 0.5),
    dark: dark * (minor ? 1 : 0.6) * (0.4 + e),
    moody: (minor ? 1 : 0.5) * peakAround(bright, 0.45, 0.5),
    driving: power * (0.4 + e) * 0.95,
    hypnotic: power * dark * peakAround(e, 0.5, 0.6) * instrumental,
    raw: loud * power * dark
  }

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s > 0)

  if (ranked.length === 0) return ['driving']
  const out = [ranked[0][0]]
  // Add the runner-up only if it's a meaningfully distinct, strong feel.
  if (ranked[1] && ranked[1][1] >= 0.25 && ranked[1][1] >= ranked[0][1] * 0.6) {
    out.push(ranked[1][0])
  }
  return out
}

// ───────── genre-blend (deterministic seed; LLM may refine later) ─────────

/**
 * Ordered alias → slug table. Longer / more specific phrases first so
 * "tech house" wins over "house" and "melodic techno" over "techno".
 */
const GENRE_ALIASES: ReadonlyArray<[RegExp, string]> = [
  [/\bmelodic\s*(house\s*&?\s*techno|techno)\b/i, 'melodic-techno'],
  [/\bmelodic\s*house\b/i, 'melodic-house'],
  [/\bafro\s*(house|tech)\b/i, 'afro-house'],
  [/\bdeep\s*house\b/i, 'deep-house'],
  [/\btech\s*house\b/i, 'tech-house'],
  [/\bprogressive\b|\bprog\b/i, 'progressive'],
  [/\bnu[\s-]?disco\b/i, 'nu-disco'],
  [/\bindie\s*dance\b/i, 'indie-dance'],
  [/\bdrum\s*(&|and|n)\s*bass\b|\bdnb\b/i, 'drum-and-bass'],
  [/\bspeed\s*garage\b|\bukg\b|\bgarage\b/i, 'garage'],
  [/\bbreak\s*beat\b|\bbreaks\b/i, 'breaks'],
  [/\bminimal\b/i, 'minimal'],
  [/\bdowntempo\b|\btrip\s*hop\b/i, 'downtempo'],
  [/\bambient\b/i, 'ambient'],
  [/\bhip[\s-]?hop\b|\brap\b/i, 'hip-hop'],
  [/\belectro\b/i, 'electro'],
  [/\btrance\b/i, 'trance'],
  [/\bdisco\b/i, 'disco'],
  [/\bfunk/i, 'funk'],
  [/\btechno\b/i, 'techno'],
  [/\bhouse\b/i, 'house'],
  [/\bpop\b/i, 'pop']
]

/** A generic slug is dropped when a more specific sibling is also present. */
const GENERIC_PARENTS: Record<string, string[]> = {
  house: ['tech-house', 'deep-house', 'melodic-house', 'afro-house', 'nu-disco', 'progressive'],
  techno: ['melodic-techno', 'minimal'],
  disco: ['nu-disco']
}

/** Map a free-text genre string onto up to 2 lexicon slugs. */
export function genreBlendTags(genre?: string): string[] {
  if (!genre) return []
  const matched: string[] = []
  for (const [re, slug] of GENRE_ALIASES) {
    if (re.test(genre) && !matched.includes(slug)) matched.push(slug)
  }
  // Drop a generic parent when a more specific sibling matched too.
  const filtered = matched.filter((slug) => {
    const children = GENERIC_PARENTS[slug]
    return !children || !matched.some((m) => children.includes(m))
  })
  return filtered.slice(0, 2)
}

// ───────── top-level ─────────

/**
 * Infer the full tag set for a track. Deterministic and total — always returns
 * at least the single-value categories.
 */
export function inferTags(input: TagInput): AutoTag[] {
  const tags: AutoTag[] = []
  const push = (category: TagCategory, value: string): void => {
    if (value) tags.push({ category, value })
  }

  push('energy', energyTag(input.energy))
  push('vocals', vocalsTag(input.vocalness))
  push('time', timeTag(input))
  for (const v of vibeTags(input)) push('vibe', v)
  for (const v of bestForTags(input)) push('bestFor', v)
  for (const v of genreBlendTags(input.genre)) push('genreBlend', v)

  return tags
}
