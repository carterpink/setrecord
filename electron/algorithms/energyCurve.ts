import type { EnergyCurveType, SetTrack } from '../../src/types'

// ───────── Single-position helper ─────────

export function getTargetAt(type: EnergyCurveType, t: number): number {
  switch (type) {
    case 'rise':
      return Math.round(4 + t * 5)

    case 'peak-sustain':
      if (t <= 0.4) return Math.round(4 + (t / 0.4) * 5)
      if (t <= 0.8) return 9
      return 7

    case 'wave':
      return Math.round(7 + Math.sin(t * Math.PI * 2) * 1)

    case 'drop-in':
      if (t <= 0.2) return 8
      if (t <= 0.7) return Math.round(6 + ((t - 0.2) / 0.5) * 3)
      return 9

    case 'custom':
    default:
      return 5
  }
}

// ───────── Batch exports ─────────

export function getTargetCurve(type: EnergyCurveType, trackCount: number): number[] {
  const count = Math.max(trackCount, 1)
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1)
    return getTargetAt(type, t)
  })
}

export function getActualCurve(tracks: SetTrack[]): number[] {
  return tracks.map((st) => st.energyOverride ?? st.track.energy)
}

export function getCurveDeviation(target: number[], actual: number[]): number {
  const len = Math.min(target.length, actual.length)
  if (len === 0) return 100
  const mad =
    target.slice(0, len).reduce((sum, t, i) => sum + Math.abs(t - actual[i]), 0) / len
  // MAD range is 0–9 (energy scale 1–10). Map to 0-100 score: 0 deviation → 100.
  return Math.max(0, Math.round(100 - (mad / 9) * 100))
}
