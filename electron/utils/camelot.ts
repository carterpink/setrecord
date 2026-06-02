/**
 * Camelot Wheel — open notation → Camelot key conversion.
 * 24-entry hardcoded lookup per PRD §7.1.
 * Variants (e.g. C# / Db) are listed separately so all spellings resolve.
 */

const OPEN_TO_CAMELOT: Record<string, string> = {
  // Minor keys (A-side)
  Am: '8A',
  'A#m': '9A',
  Bbm: '9A',
  Bm: '10A',
  Cm: '11A',
  'C#m': '12A',
  Dbm: '12A',
  Dm: '1A',
  'D#m': '2A',
  Ebm: '2A',
  Em: '3A',
  Fm: '4A',
  'F#m': '5A',
  Gbm: '5A',
  Gm: '6A',
  'G#m': '7A',
  Abm: '7A',
  // Major keys (B-side)
  C: '8B',
  'C#': '9B',
  Db: '9B',
  D: '10B',
  'D#': '11B',
  Eb: '11B',
  E: '12B',
  F: '1B',
  'F#': '2B',
  Gb: '2B',
  G: '3B',
  'G#': '4B',
  Ab: '4B',
  A: '5B',
  'A#': '6B',
  Bb: '6B',
  B: '7B'
}

/** Convert open notation (e.g. "Am", "C#", "Db") to Camelot (e.g. "8A", "9B"). */
export function openNotationToCamelot(key: string): string | undefined {
  if (!key) return undefined
  const normalised = key.trim()
  return OPEN_TO_CAMELOT[normalised]
}

/** All 24 valid Camelot key strings. Used by the USB validator (Phase 7). */
export const CAMELOT_KEYS: readonly string[] = [
  '1A',
  '2A',
  '3A',
  '4A',
  '5A',
  '6A',
  '7A',
  '8A',
  '9A',
  '10A',
  '11A',
  '12A',
  '1B',
  '2B',
  '3B',
  '4B',
  '5B',
  '6B',
  '7B',
  '8B',
  '9B',
  '10B',
  '11B',
  '12B'
] as const

// ───────── Camelot compatibility ─────────

export interface CamelotResult {
  relationship: 'perfect' | 'compatible' | 'neutral' | 'clash'
  scoreModifier: number // +30, +25, +20, +10, 0, or -20
  reason: string
}

function parseCamelot(key: string): { num: number; letter: 'A' | 'B' } | null {
  const m = /^(\d{1,2})([AB])$/.exec(key.trim())
  if (!m) return null
  return { num: parseInt(m[1], 10), letter: m[2] as 'A' | 'B' }
}

/**
 * Computes Camelot wheel compatibility between two keys.
 * Rules follow PRD §6.1 harmonic mixing conventions.
 */
export function getKeyCompatibility(keyA: string, keyB: string): CamelotResult {
  const a = parseCamelot(keyA)
  const b = parseCamelot(keyB)

  if (!a || !b) {
    return { relationship: 'neutral', scoreModifier: 0, reason: 'Unknown key' }
  }

  const numDist = Math.min(Math.abs(a.num - b.num), 12 - Math.abs(a.num - b.num))
  const letterDist = a.letter === b.letter ? 0 : 1

  if (numDist === 0 && letterDist === 0) {
    return { relationship: 'perfect', scoreModifier: 30, reason: 'Perfect harmony' }
  }
  if (numDist === 1 && letterDist === 0) {
    return { relationship: 'compatible', scoreModifier: 25, reason: 'Energy shift' }
  }
  if (numDist === 0 && letterDist === 1) {
    return { relationship: 'compatible', scoreModifier: 20, reason: 'Mood shift' }
  }
  if (numDist === 2 && letterDist === 0) {
    return { relationship: 'compatible', scoreModifier: 10, reason: 'Compatible' }
  }
  if (numDist + letterDist > 3) {
    return { relationship: 'clash', scoreModifier: -20, reason: 'Key clash' }
  }
  return { relationship: 'neutral', scoreModifier: 0, reason: 'Neutral' }
}
