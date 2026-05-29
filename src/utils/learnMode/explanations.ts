import type {
  EnergyCurveType,
  MatchReason,
  SetTrack,
  Track,
  TransitionScore,
} from '@/types'
import { camelotRelationship, compatibleNeighbours } from '@/utils/camelot'

export type DiagramKind =
  | { kind: 'harmonic-wheel'; fromKey: string; toKey: string }
  | { kind: 'bpm-ramp'; fromBpm: number; toBpm: number }
  | { kind: 'energy-curve'; target: number[]; actual: number[] }
  | { kind: 'risk-breakdown'; factors: RiskFactor[] }

export interface RiskFactor {
  label: string
  detail: string
  quality: 'good' | 'warning' | 'risk'
}

export interface LearnExplanation {
  summary: string
  detail: string
  diagram?: DiagramKind
}

// ───────── Helpers ─────────

function bpmIntensity(deltaPct: number): string {
  if (deltaPct < 1) return 'barely noticeable'
  if (deltaPct < 2) return 'a gentle shift'
  if (deltaPct < 5) return 'a clear shift'
  return 'a noticeable change'
}

function relationshipLabel(rel: ReturnType<typeof camelotRelationship>): string {
  switch (rel) {
    case 'perfect': return 'Same key family — zero clashing frequencies.'
    case 'energy-shift': return 'Adjacent on the wheel — lifts energy while keeping the mood.'
    case 'mood-shift': return 'Major/minor flip on the same number — same root, fresh feel.'
    case 'compatible': return 'Two semitones apart — still mixable, light tension.'
    case 'clash': return 'Far apart on the wheel — frequencies will fight unless EQ\'d hard.'
    case 'neutral': return 'Mid-distance keys — workable but not flattering.'
    case 'unknown': return 'One of the keys couldn\'t be parsed — proceed by ear.'
  }
}

// ───────── Match reason explanations ─────────

function explainKeyReason(from: Track, to: Track): LearnExplanation {
  const rel = camelotRelationship(from.key, to.key)
  const summary = rel === 'clash'
    ? `Key clash (Camelot: ${from.key} → ${to.key})`
    : `Harmonic match (Camelot: ${from.key} → ${to.key})`
  return {
    summary,
    detail: `${relationshipLabel(rel)} ${rel === 'clash'
      ? `Try a transition track in ${compatibleNeighbours(from.key).slice(0, 2).join(' or ')} first.`
      : 'Listeners stay in the same emotional pocket.'}`,
    diagram: { kind: 'harmonic-wheel', fromKey: from.key, toKey: to.key },
  }
}

function explainBpmReason(from: Track, to: Track): LearnExplanation {
  const delta = to.bpm - from.bpm
  const abs = Math.abs(delta)
  const pct = from.bpm > 0 ? (abs / from.bpm) * 100 : 0
  const dir = delta > 0 ? 'BPM increase' : delta < 0 ? 'BPM decrease' : 'Identical BPM'
  const summary = abs === 0
    ? 'Identical BPM (no tempo shift)'
    : `${dir}: ${from.bpm.toFixed(0)} → ${to.bpm.toFixed(0)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`
  const advice = abs < 1
    ? 'Lock the beatgrid and ride the EQ — listeners won\'t feel a change.'
    : abs < 5
      ? 'Natural momentum builder. A standard 32-bar blend works.'
      : 'Plan an extended mix or filter sweep so the tempo jump doesn\'t feel abrupt.'
  return {
    summary,
    detail: abs === 0
      ? 'Both tracks share the exact same tempo — the easiest possible blend.'
      : `This is ${bpmIntensity(pct)} (${pct.toFixed(1)}%). ${advice}`,
    diagram: { kind: 'bpm-ramp', fromBpm: from.bpm, toBpm: to.bpm },
  }
}

function explainEnergyReason(from: Track, to: Track): LearnExplanation {
  const delta = to.energy - from.energy
  if (delta === 0) {
    return {
      summary: 'Energy match',
      detail: 'Both tracks sit at the same intensity — useful for sustaining a section without drama.',
    }
  }
  const direction = delta > 0 ? 'lift' : 'drop'
  const verb = delta > 0 ? 'Builds anticipation' : 'Releases tension'
  const sign = delta > 0 ? '+' : ''
  return {
    summary: `Energy ${direction} (${sign}${delta})`,
    detail: `Moves listeners from energy ${from.energy} to ${to.energy}. ${verb}. ${
      Math.abs(delta) >= 3
        ? 'A jump this big benefits from a long blend or a break before the drop.'
        : 'Hold for 32–64 bars before pushing further.'
    }`,
  }
}

function explainGenreReason(from: Track, to: Track): LearnExplanation {
  const same = (from.genre ?? '').toLowerCase() === (to.genre ?? '').toLowerCase()
  return {
    summary: same ? `Same genre (${to.genre ?? 'unknown'})` : 'Genre shift',
    detail: same
      ? 'Same genre keeps the textural palette consistent — drums, basslines, and synths share a vocabulary.'
      : `Crossing from ${from.genre ?? '—'} into ${to.genre ?? '—'} works when the BPM and key already line up.`,
  }
}

function explainTextureReason(): LearnExplanation {
  return {
    summary: 'Texture match',
    detail: 'Production density and frequency balance feel similar — the mix won\'t suddenly thin out or pile up.',
  }
}

export function explainMatchReason(
  reason: MatchReason,
  from: Track,
  to: Track,
): LearnExplanation {
  switch (reason.type) {
    case 'key': return explainKeyReason(from, to)
    case 'bpm': return explainBpmReason(from, to)
    case 'energy': return explainEnergyReason(from, to)
    case 'genre': return explainGenreReason(from, to)
    case 'texture': return explainTextureReason()
    case 'combo': return {
      summary: 'You\'ve played this transition before',
      detail: `${reason.label}. Surfaced from your saved sets and performed sessions — muscle-memory transitions outrank algorithmic suggestions of equal score.`,
    }
  }
}

// ───────── Transition (factor breakdown) ─────────

export function explainTransition(
  score: TransitionScore,
  from: Track,
  to: Track,
): LearnExplanation {
  const factors: RiskFactor[] = []

  // BPM factor
  const bpmAbs = score.bpmDelta
  factors.push({
    label: `BPM ${from.bpm.toFixed(0)} → ${to.bpm.toFixed(0)}`,
    detail: bpmAbs === 0 ? 'Identical tempo.' : bpmAbs <= 2 ? 'Tight — no noticeable shift.' : bpmAbs <= 8 ? 'Workable, plan the blend.' : 'Large jump — extended mix needed.',
    quality: bpmAbs <= 2 ? 'good' : bpmAbs <= 8 ? 'warning' : 'risk',
  })

  // Key factor
  const rel = camelotRelationship(from.key, to.key)
  factors.push({
    label: `Key ${from.key} → ${to.key}`,
    detail: relationshipLabel(rel),
    quality: rel === 'clash' ? 'risk' : rel === 'neutral' ? 'warning' : 'good',
  })

  // Energy factor
  const eDelta = to.energy - from.energy
  factors.push({
    label: `Energy ${from.energy} → ${to.energy}`,
    detail: eDelta === 0 ? 'Steady.' : eDelta > 0 ? `Lifts by ${eDelta}.` : `Drops by ${Math.abs(eDelta)} — risk of crowd disengagement.`,
    quality: eDelta <= -2 ? 'risk' : Math.abs(eDelta) >= 3 ? 'warning' : 'good',
  })

  const summary = score.overall === 'clean'
    ? 'Clean transition'
    : score.overall === 'messy'
      ? 'Messy transition — needs care'
      : 'Trainwreck risk'

  const detail = score.overall === 'clean'
    ? 'All three factors (BPM, key, energy) line up. Standard 32-bar blend will sound effortless.'
    : score.overall === 'messy'
      ? 'One factor pulls against the others. Use EQ filtering or an extended mix to mask the rough edge.'
      : 'Multiple factors clash. Slot in a transition track or break the mix with a vocal/breakdown bridge.'

  return {
    summary,
    detail,
    diagram: { kind: 'risk-breakdown', factors },
  }
}

// ───────── Camelot key chip ─────────

export function explainCamelotKey(key: string): LearnExplanation {
  const isA = key.endsWith('A')
  const number = parseInt(key, 10)
  const isMajor = !isA
  return {
    summary: `Camelot key: ${key}`,
    detail: `The Camelot system maps musical keys to a clock-face wheel (1–12, A/B). ${
      isMajor ? 'B = major keys.' : 'A = minor keys.'
    } Adjacent numbers (±1) and the same number in A/B share notes — those transitions sound smooth. ${
      Number.isFinite(number) ? `Tracks in ${(number % 12) + 1}${isA ? 'A' : 'B'} or ${number}${isA ? 'B' : 'A'} blend naturally with this one.` : ''
    } Far-apart keys clash.`,
    diagram: { kind: 'harmonic-wheel', fromKey: key, toKey: key },
  }
}

// ───────── Energy curve (timeline view) ─────────

export function explainEnergyCurveView(): LearnExplanation {
  return {
    summary: 'Energy curve',
    detail:
      'Each point represents one track\'s energy level (1–10). A climbing curve builds crowd energy; a dip gives the room a breath before the next peak. The dashed line (when shown) is your Set Architect target arc.',
    diagram: { kind: 'energy-curve', target: [3, 4, 5, 6, 7, 8, 9, 9], actual: [2, 4, 5, 7, 7, 9, 8, 10] },
  }
}

// ───────── Energy curve (Set Architect) ─────────

const CURVE_COPY: Record<EnergyCurveType, { name: string; story: string }> = {
  rise: {
    name: 'Steady rise',
    story: 'A gradual climb from warm-up energy to peak. Best when you have time to build — the curve rewards patience.',
  },
  'peak-sustain': {
    name: 'Peak & sustain',
    story: 'Hit high energy early, hold it. Right for a peak-time slot where the crowd is already locked in.',
  },
  wave: {
    name: 'Wave',
    story: 'Build, dip, build higher. Lets the room breathe between climbs so the peaks land harder.',
  },
  'drop-in': {
    name: 'Drop-in',
    story: 'Start low, build sharply into peak. Great when you\'re following a hot warm-up DJ — claims the room without overshooting.',
  },
  custom: {
    name: 'Custom curve',
    story: 'You\'re shaping the arc by hand — Learn Mode just tracks your choices.',
  },
}

export function explainEnergyArc(
  curve: EnergyCurveType,
  target: number[],
  tracks: SetTrack[],
): LearnExplanation {
  const actual = tracks.map((st) => st.track.energy)
  const copy = CURVE_COPY[curve]
  return {
    summary: copy.name,
    detail: copy.story,
    diagram: { kind: 'energy-curve', target, actual },
  }
}
