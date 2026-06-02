// Camelot wheel compatibility check for the renderer.
// The canonical implementation with full scoring is in electron/utils/camelot.ts.
// This file only exposes what the UI needs: a simple compatible/not check.

function parseCamelot(key: string): { num: number; letter: string } | null {
  if (!key || key.length < 2) return null
  const letter = key.slice(-1).toUpperCase()
  const num = parseInt(key.slice(0, -1), 10)
  if (isNaN(num) || num < 1 || num > 12 || (letter !== 'A' && letter !== 'B')) return null
  return { num, letter }
}

// Returns true when two Camelot keys are NOT a clash (i.e. distance ≤ 3).
// Unknown or missing keys return true so those tracks are never filtered out.
export function camelotCompatible(keyA: string, keyB: string): boolean {
  const a = parseCamelot(keyA)
  const b = parseCamelot(keyB)
  if (!a || !b) return true

  const letterDist = a.letter === b.letter ? 0 : 1
  // Wrap-around distance on the 12-position wheel
  const diff = Math.abs(a.num - b.num)
  const numDist = Math.min(diff, 12 - diff)

  return numDist + letterDist <= 3
}

export type CamelotRelationship =
  | 'perfect'
  | 'energy-shift'
  | 'mood-shift'
  | 'compatible'
  | 'neutral'
  | 'clash'
  | 'unknown'

/**
 * Describes the wheel relationship between two Camelot keys for Learn Mode.
 * Mirrors `getKeyCompatibility` in electron/utils/camelot.ts but returns a
 * richer label suitable for educational copy.
 */
export function camelotRelationship(keyA: string, keyB: string): CamelotRelationship {
  const a = parseCamelot(keyA)
  const b = parseCamelot(keyB)
  if (!a || !b) return 'unknown'

  const diff = Math.abs(a.num - b.num)
  const numDist = Math.min(diff, 12 - diff)
  const letterDist = a.letter === b.letter ? 0 : 1

  if (numDist === 0 && letterDist === 0) return 'perfect'
  if (numDist === 1 && letterDist === 0) return 'energy-shift'
  if (numDist === 0 && letterDist === 1) return 'mood-shift'
  if (numDist === 2 && letterDist === 0) return 'compatible'
  if (numDist + letterDist > 3) return 'clash'
  return 'neutral'
}

/** Maps every Camelot key to its open (standard musical) notation equivalent. */
const CAMELOT_TO_OPEN: Record<string, string> = {
  '1A': 'Abm',
  '1B': 'B',
  '2A': 'Ebm',
  '2B': 'F#',
  '3A': 'Bbm',
  '3B': 'Db',
  '4A': 'Fm',
  '4B': 'Ab',
  '5A': 'Cm',
  '5B': 'Eb',
  '6A': 'Gm',
  '6B': 'Bb',
  '7A': 'Dm',
  '7B': 'F',
  '8A': 'Am',
  '8B': 'C',
  '9A': 'Em',
  '9B': 'G',
  '10A': 'Bm',
  '10B': 'D',
  '11A': 'F#m',
  '11B': 'A',
  '12A': 'Dbm',
  '12B': 'E'
}

/** Returns the open-notation key for a Camelot key, e.g. "9A" → "Am". Returns the input unchanged when unknown. */
export function camelotToOpenKey(key: string): string {
  return CAMELOT_TO_OPEN[key] ?? key
}

/** Suggests two adjacent-on-wheel Camelot keys that mix cleanly with `key`. */
export function compatibleNeighbours(key: string): string[] {
  const a = parseCamelot(key)
  if (!a) return []
  const otherLetter = a.letter === 'A' ? 'B' : 'A'
  const prev = a.num === 1 ? 12 : a.num - 1
  const next = a.num === 12 ? 1 : a.num + 1
  return [`${prev}${a.letter}`, `${next}${a.letter}`, `${a.num}${otherLetter}`]
}
