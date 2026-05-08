import type { Track, TransitionScore, TransitionQuality, KeyCompatibility, TransitionDotKind } from '../../src/types'
import { getKeyCompatibility } from '../utils/camelot'

// ───────── BPM scoring (35 pts) ─────────

function bpmPoints(delta: number): number {
  if (delta === 0) return 35
  if (delta <= 1) return 32
  if (delta <= 2) return 28
  if (delta <= 4) return 22
  if (delta <= 8) return 14
  if (delta <= 16) return 8
  return 0
}

// ───────── Key scoring (35 pts max) ─────────

function keyPoints(scoreModifier: number): number {
  // Camelot modifier max is +30; scale to 35pt max, clamp negatives to 0
  return Math.max(0, Math.round((scoreModifier / 30) * 35))
}

// ───────── Energy scoring (20 pts) ─────────

function energyPoints(from: Track, to: Track): number {
  const delta = to.energy - from.energy
  const abs = Math.abs(delta)

  let pts: number
  if (abs === 0) pts = 20
  else if (abs === 1) pts = 18
  else if (abs === 2) pts = 14
  else if (abs === 3) pts = 8
  else pts = 2

  if (delta === 1) pts += 2   // +1 energy going up = crowd building bonus
  if (delta <= -2) pts -= 5   // sharp drop penalty

  return Math.max(0, pts)
}

// ───────── Technical scoring (10 pts) ─────────

function technicalPoints(from: Track, to: Track): number {
  let pts = 2  // file-exists credit (assumed; no async disk check in algorithm)
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
  energyDelta: number,
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

export function scoreTransition(from: Track, to: Track): TransitionScore {
  const bpmDelta = Math.abs(from.bpm - to.bpm)
  const camelot = getKeyCompatibility(from.key, to.key)
  const energyDelta = to.energy - from.energy

  const bpmPts = bpmPoints(bpmDelta)
  const keyPts = keyPoints(camelot.scoreModifier)
  const ePts = energyPoints(from, to)
  const techPts = technicalPoints(from, to)

  const total = Math.min(100, Math.max(0, bpmPts + keyPts + ePts + techPts))

  const overall: TransitionQuality =
    total >= 75 ? 'clean' : total >= 45 ? 'messy' : 'trainwreck'

  const keyCompatibility: KeyCompatibility = camelot.relationship

  // Build reasons from top contributors
  const factors = [
    { label: camelot.reason, points: keyPts },
    { label: bpmReasonLabel(bpmDelta), points: bpmPts },
    { label: energyReasonLabel(energyDelta), points: ePts },
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
    label: makeLabel(overall, camelot.relationship, bpmDelta, energyDelta),
  }
}
