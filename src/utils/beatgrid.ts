/**
 * Constant-tempo beatgrid math.
 *
 * A beatgrid is fully described by a BPM and a first-downbeat anchor (ms). Beat
 * n sits at `anchorMs + n * interval`, where interval = 60000 / bpm. Downbeats
 * (bar starts) occur every `beatsPerBar` beats. n may be negative (beats before
 * the anchor), so a grid set mid-track still extends back to the track start.
 */

export interface Beatgrid {
  bpm: number
  /** ms position of beat index 0 (the reference downbeat). */
  anchorMs: number
  beatsPerBar: number
}

export interface BeatLine {
  ms: number
  /** Beat index relative to the anchor (0 = anchor). */
  index: number
  isDownbeat: boolean
}

export const DEFAULT_BEATS_PER_BAR = 4

export function beatIntervalMs(bpm: number): number {
  return bpm > 0 ? 60000 / bpm : 0
}

export function makeBeatgrid(
  bpm: number,
  anchorMs: number | undefined,
  beatsPerBar = DEFAULT_BEATS_PER_BAR
): Beatgrid {
  return { bpm, anchorMs: anchorMs ?? 0, beatsPerBar }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** All beat lines whose ms falls within [startMs, endMs] inclusive. */
export function beatsInRange(grid: Beatgrid, startMs: number, endMs: number): BeatLine[] {
  const interval = beatIntervalMs(grid.bpm)
  if (interval <= 0 || endMs < startMs) return []
  const lines: BeatLine[] = []
  let n = Math.ceil((startMs - grid.anchorMs) / interval)
  // Safety cap so a pathological zoom can't allocate unbounded lines.
  const maxLines = 4096
  for (let count = 0; count < maxLines; count++) {
    const ms = grid.anchorMs + n * interval
    if (ms > endMs) break
    lines.push({ ms, index: n, isDownbeat: mod(n, grid.beatsPerBar) === 0 })
    n++
  }
  return lines
}

/** ms of the nearest beat to `ms`. */
export function nearestBeatMs(grid: Beatgrid, ms: number): number {
  const interval = beatIntervalMs(grid.bpm)
  if (interval <= 0) return ms
  const n = Math.round((ms - grid.anchorMs) / interval)
  return grid.anchorMs + n * interval
}

/** ms of the nearest downbeat (bar start) to `ms`. */
export function nearestDownbeatMs(grid: Beatgrid, ms: number): number {
  const interval = beatIntervalMs(grid.bpm) * grid.beatsPerBar
  if (interval <= 0) return ms
  const n = Math.round((ms - grid.anchorMs) / interval)
  return grid.anchorMs + n * interval
}

/** 1-indexed bar + beat (1..beatsPerBar) for a position. */
export function barBeatAt(grid: Beatgrid, ms: number): { bar: number; beat: number } {
  const interval = beatIntervalMs(grid.bpm)
  if (interval <= 0) return { bar: 1, beat: 1 }
  const n = Math.round((ms - grid.anchorMs) / interval)
  const bar = Math.floor(n / grid.beatsPerBar) + 1
  const beat = mod(n, grid.beatsPerBar) + 1
  return { bar, beat }
}

/** ms length of `beats` beats at the grid tempo (for beat loops). */
export function beatsToMs(grid: Beatgrid, beats: number): number {
  return beatIntervalMs(grid.bpm) * beats
}
