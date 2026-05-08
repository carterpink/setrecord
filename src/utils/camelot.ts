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
