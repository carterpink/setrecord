/**
 * Set Health — the single number behind SetSense Live's health pill.
 *
 * Defined up front (not a magic number): a weighted blend of four measurable
 * sub-scores, each 0–100, all computable from data the app already has.
 *
 *   energyFit       35%  how well the current energy tracks the set's arc
 *   harmonicRunway  25%  how many key-safe next moves remain
 *   bpmTrap         20%  BPM headroom in the workable pool (are you boxed in?)
 *   ammunition      20%  how many strong unplayed options are left
 *
 * Higher is healthier. Green ≥80, amber 60–79, red below. Weights and targets
 * are exported so they stay tunable rather than buried.
 */

import type { Track } from '../../src/types'
import { getKeyCompatibility } from '../utils/camelot'

export const SET_HEALTH_WEIGHTS = {
  energyFit: 0.35,
  harmonicRunway: 0.25,
  bpmTrap: 0.2,
  ammunition: 0.2
} as const

/** Sub-score calibration targets — the count/spread at which a sub-score maxes. */
export const SAFE_MOVES_TARGET = 5 // key-safe candidates for full runway
export const BPM_SPREAD_TARGET = 10 // BPM range across the pool for full headroom
export const AMMO_TARGET = 12 // strong candidates for full ammunition

export interface SetHealthInput {
  /** The currently playing track. */
  current: Track
  /** Recently played tracks, oldest→newest (used for energy smoothness). */
  recent: Track[]
  /** Workable next-move candidates (already BPM-filtered to the mixable pool). */
  candidates: Track[]
  /** Target energy for the next moment from the set's energy curve, 1–10. */
  targetEnergy?: number
}

export interface SetHealth {
  /** Composite 0–100. */
  score: number
  energyFit: number
  harmonicRunway: number
  bpmTrap: number
  ammunition: number
}

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n))

/**
 * Energy fit: distance from the target arc when known; otherwise the smoothness
 * of the recent energy trajectory (big jumps read as a less coherent set).
 */
function energyFitScore(input: SetHealthInput): number {
  if (input.targetEnergy != null) {
    return clamp100(100 - Math.abs(input.current.energy - input.targetEnergy) * 20)
  }
  const energies = [...input.recent.map((t) => t.energy), input.current.energy]
  if (energies.length < 2) return 100
  let deltaSum = 0
  for (let i = 1; i < energies.length; i++) deltaSum += Math.abs(energies[i] - energies[i - 1])
  const avgDelta = deltaSum / (energies.length - 1)
  return clamp100(100 - avgDelta * 22)
}

/** Harmonic runway: how many candidates are key-safe (perfect/compatible). */
function harmonicRunwayScore(input: SetHealthInput): number {
  const safe = input.candidates.filter((c) => {
    const rel = getKeyCompatibility(input.current.key, c.key).relationship
    return rel === 'perfect' || rel === 'compatible'
  }).length
  return clamp100((safe / SAFE_MOVES_TARGET) * 100)
}

/** BPM trap: spread of available BPMs — narrow pool ⇒ boxed in ⇒ low. */
function bpmTrapScore(input: SetHealthInput): number {
  if (input.candidates.length < 2) return 0
  const bpms = input.candidates.map((c) => c.bpm)
  const spread = Math.max(...bpms) - Math.min(...bpms)
  return clamp100((spread / BPM_SPREAD_TARGET) * 100)
}

/** Ammunition: strong unplayed options remaining (energy not collapsing). */
function ammunitionScore(input: SetHealthInput): number {
  const strong = input.candidates.filter((c) => c.energy >= input.current.energy - 1).length
  return clamp100((strong / AMMO_TARGET) * 100)
}

export function computeSetHealth(input: SetHealthInput): SetHealth {
  const energyFit = Math.round(energyFitScore(input))
  const harmonicRunway = Math.round(harmonicRunwayScore(input))
  const bpmTrap = Math.round(bpmTrapScore(input))
  const ammunition = Math.round(ammunitionScore(input))

  const score = Math.round(
    energyFit * SET_HEALTH_WEIGHTS.energyFit +
      harmonicRunway * SET_HEALTH_WEIGHTS.harmonicRunway +
      bpmTrap * SET_HEALTH_WEIGHTS.bpmTrap +
      ammunition * SET_HEALTH_WEIGHTS.ammunition
  )

  return { score: clamp100(score), energyFit, harmonicRunway, bpmTrap, ammunition }
}
