/**
 * Formatting helpers.
 */

/** "06:42" from 402 seconds. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** "124.0" — always one decimal, tabular. */
export function formatBpm(bpm: number): string {
  return bpm.toFixed(1)
}

/** "1:23.4" — minutes:seconds.tenths from milliseconds. For precise cue/transport readouts. */
export function formatMs(ms: number): string {
  const safe = isFinite(ms) && ms > 0 ? ms : 0
  const totalSecs = Math.floor(safe / 1000)
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  const tenths = Math.floor((safe % 1000) / 100)
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`
}

/** "01" / "02" — two-digit position label. */
export function formatPosition(position: number): string {
  return String(position + 1).padStart(2, '0')
}

/** "1h 23m" from a total number of seconds. */
export function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * Deterministic gradient placeholder for tracks without artwork.
 * Uses the track ID to pick consistent colors — same ID always yields
 * the same gradient across sessions.
 */
export function gradientForId(id: string): string {
  // Hash the first 8 chars of the ID into two hue values
  const h1 = ((parseInt(id.slice(0, 4).replace(/-/g, '0'), 16) % 360) + 360) % 360
  const h2 = (h1 + 40 + (parseInt(id.slice(4, 8).replace(/-/g, '0'), 16) % 80)) % 360
  return `linear-gradient(135deg, hsl(${h1},40%,25%), hsl(${h2},50%,30%))`
}
