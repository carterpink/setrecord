import type { EnergyCurveType } from '@/types'

// Frontend mirror of electron/algorithms/energyCurve.ts — same formulas, no IPC.
// Used by EnergyCurveGraph to render the dashed target line without a round-trip.

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

export function getTargetCurve(type: EnergyCurveType, trackCount: number): number[] {
  const count = Math.max(trackCount, 1)
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1)
    return getTargetAt(type, t)
  })
}
