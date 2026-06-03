import type {
  Track,
  TransitionScore,
  TransitionQuality,
  KeyCompatibility,
  TransitionDotKind
} from '../../src/types'
import { getKeyCompatibility } from '../utils/camelot'
import { GENERIC_PROFILE, bpmScale, type MixingProfile } from './genreProfiles'

// ───────── BPM scoring (35 pts) ─────────

// `scale` (generic = 1) stretches/squeezes the ladder by the style's tolerance
// for tempo moves: a genre with a wider maxStep scales deltas down so the same
// absolute gap scores higher, and vice-versa. generic's scale of 1 leaves the
// original ladder untouched.
function bpmPoints(delta: number, scale: number): number {
  const d = delta / scale
  if (d === 0) return 35
  if (d <= 1) return 32
  if (d <= 2) return 28
  if (d <= 4) return 22
  if (d <= 8) return 14
  if (d <= 16) return 8
  return 0
}

// ───────── Key scoring (35 pts max) ─────────

function keyPoints(scoreModifier: number, harmonicWeight: number): number {
  // Camelot modifier max is +30; scale to 35pt max, clamp negatives to 0.
  // harmonicWeight (generic = 1) lets harmony-led styles (trance, melodic) lean
  // on key compatibility and groove-led styles (techno, bass) discount it.
  return Math.max(0, Math.round((scoreModifier / 30) * 35 * harmonicWeight))
}

// ───────── Energy scoring (20 pts) ─────────

function energyPoints(from: Track, to: Track, profile: MixingProfile): number {
  const delta = to.energy - from.energy
  const abs = Math.abs(delta)

  let pts: number
  if (abs === 0) pts = 20
  else if (abs === 1) pts = 18
  else if (abs === 2) pts = 14
  else if (abs === 3) pts = 8
  else pts = 2

  // +1 energy going up = crowd building bonus, amplified for build-led styles.
  if (delta === 1) pts += 2 * profile.energy.buildBias
  // Sharp drop penalty, softened for styles that mix moodier (techno, bass).
  if (delta <= -2) pts -= 5 * profile.energy.dropTolerance

  return Math.max(0, Math.round(pts))
}

// ───────── Technical scoring (10 pts) ─────────

function technicalPoints(from: Track, to: Track): number {
  let pts = 2 // file-exists credit (assumed; no async disk check in algorithm)
  if (from.format !== 'unknown' && from.format === to.format) pts += 5
  const br1 = from.bitrate ?? 0
  const br2 = to.bitrate ?? 0
  // Compatible if within 64kbps, or if either is unknown
  if (br1 === 0 || br2 === 0 || Math.abs(br1 - br2) <= 64) pts += 3
  return pts
}

// ───────── Human-readable reason labels ─────────

function bpmReasonLabel(delta: number): string {
  return delta === 0 ? 'Identical BPM' : `±${Math.round(delta)} BPM`
}

function energyReasonLabel(delta: number): string {
  if (delta === 0) return 'Energy match'
  if (delta === 1) return '+1 energy'
  if (delta > 0) return `+${delta} energy`
  if (delta === -1) return '−1 energy'
  return `−${Math.abs(delta)} energy drop`
}

function makeLabel(
  overall: TransitionQuality,
  keyRel: string,
  bpmDelta: number,
  energyDelta: number
): string {
  if (overall === 'clean') return 'Clean'
  const prefix = overall === 'messy' ? 'Messy' : 'Trainwreck'
  if (keyRel === 'clash') return `${prefix} · key clash`
  if (bpmDelta > 8) return `${prefix} · ±${Math.round(bpmDelta)} BPM`
  if (energyDelta <= -2) return `${prefix} · energy drop`
  return prefix
}

function makeDotKind(overall: TransitionQuality): TransitionDotKind {
  if (overall === 'clean') return 'success'
  if (overall === 'messy') return 'warning'
  return 'trainwreck'
}

// ───────── Main export ─────────

export function scoreTransition(
  from: Track,
  to: Track,
  profile: MixingProfile = GENERIC_PROFILE
): TransitionScore {
  const bpmDelta = Math.abs(from.bpm - to.bpm)
  const camelot = getKeyCompatibility(from.key, to.key)
  const energyDelta = to.energy - from.energy

  const bpmPts = bpmPoints(bpmDelta, bpmScale(profile))
  const keyPts = keyPoints(camelot.scoreModifier, profile.flow.harmonicWeight)
  const ePts = energyPoints(from, to, profile)
  const techPts = technicalPoints(from, to)

  const total = Math.min(100, Math.max(0, bpmPts + keyPts + ePts + techPts))

  const overall: TransitionQuality = total >= 75 ? 'clean' : total >= 45 ? 'messy' : 'trainwreck'

  const keyCompatibility: KeyCompatibility = camelot.relationship

  // Build reasons from top contributors
  const factors = [
    { label: camelot.reason, points: keyPts },
    { label: bpmReasonLabel(bpmDelta), points: bpmPts },
    { label: energyReasonLabel(energyDelta), points: ePts }
  ].sort((a, b) => b.points - a.points)

  const reasons = factors.slice(0, 3).map((f) => f.label)

  return {
    overall,
    score: total,
    bpmDelta,
    keyCompatibility,
    energyDelta,
    reasons,
    dotKind: makeDotKind(overall),
    label: makeLabel(overall, camelot.relationship, bpmDelta, energyDelta)
  }
}
