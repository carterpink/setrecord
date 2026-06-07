/**
 * Set Architect variation-seed helpers.
 *
 * The builder's PRNG (mulberry32) consumes a uint32. Humans need something
 * short and copyable to share or reproduce a set, so we present the seed as a
 * lowercase base36 string at the UI boundary and decode it back on input.
 * Encoding is lossless and round-trips across the full uint32 range.
 */

/** Largest seed value (2^32 − 1) — mulberry32 masks to uint32 anyway. */
const MAX_SEED = 0xffffffff

/** A fresh random uint32 seed for a "vary" build. */
export function freshSeed(): number {
  // Math.random() ∈ [0, 1) → floor(× 2^32) ∈ [0, 2^32 − 1].
  return Math.floor(Math.random() * 0x100000000)
}

/** uint32 → short lowercase base36 string (e.g. 123456 → "2n9c"). */
export function encodeSeed(seed: number): string {
  return (seed >>> 0).toString(36)
}

/**
 * Parse a user-entered seed string back to a uint32.
 * Tolerant of surrounding whitespace and case; returns null for anything that
 * isn't a valid in-range base36 seed so callers can reject bad paste input.
 */
export function decodeSeed(input: string): number | null {
  const cleaned = input.trim().toLowerCase()
  if (cleaned === '' || !/^[0-9a-z]+$/.test(cleaned)) return null
  const n = parseInt(cleaned, 36)
  if (!Number.isInteger(n) || n < 0 || n > MAX_SEED) return null
  return n >>> 0
}
