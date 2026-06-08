/**
 * soundMirror.ts — pure compute for the "Sound Mirror" (Frontier 2A).
 *
 * Where identity.ts is a static "Wrapped" snapshot of the whole library, the
 * Sound Mirror is LONGITUDINAL: it buckets the tracks a DJ actually *played*
 * into time windows, computes a sound signature per window, and measures the
 * DRIFT between the earliest and latest — "you've drifted 8 BPM slower and
 * darker; euphoric plays fell from 30% to 9%". It also flags RUTS (the same
 * track opening/closing most recent sets) and a one-line "you're becoming…".
 *
 * Pure: tracks + sessions + now. No DB/electron deps.
 */

import type {
  Track,
  MirrorSession,
  MirrorWindow,
  VibeShift,
  MirrorDrift,
  RutSignal,
  SoundMirrorResult
} from '../../../src/types'

// Re-export so existing importers (tests, main) can keep importing from here.
export type { MirrorSession, MirrorWindow, VibeShift, MirrorDrift, RutSignal, SoundMirrorResult }

export interface SoundMirrorOptions {
  /** How many of the most-recent sessions to scan for ruts. Default 5. */
  recentSessions?: number
}

// ── helpers ──────────────────────────────────────────────────────────────────
function mean(ns: number[]): number {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function quarterLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`
}
function topN(values: string[], n: number): string[] {
  const m = new Map<string, number>()
  for (const v of values) {
    const k = v.trim()
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}
function vibeValues(t: Track): string[] {
  return (t.tags ?? []).filter((tag) => tag.category === 'vibe').map((tag) => tag.value)
}

function buildWindow(
  label: string,
  sessions: MirrorSession[],
  byId: Map<string, Track>
): MirrorWindow {
  const played: Track[] = []
  for (const s of sessions)
    for (const id of s.trackIds) {
      const t = byId.get(id)
      if (t) played.push(t)
    }
  const bpms = played.map((t) => t.bpm).filter((b) => b > 0)
  const energies = played.map((t) => t.energy).filter((e) => e > 0)
  const brights = played
    .map((t) => t.analysisFeatures?.brightness)
    .filter((b): b is number => typeof b === 'number')
  const vibes = played.flatMap(vibeValues)
  const vibeShare: Record<string, number> = {}
  if (vibes.length) {
    for (const v of vibes) vibeShare[v] = (vibeShare[v] ?? 0) + 1
    for (const k of Object.keys(vibeShare)) vibeShare[k] = vibeShare[k] / vibes.length
  }
  return {
    label,
    sessionCount: sessions.length,
    trackCount: played.length,
    avgBpm: round1(mean(bpms)),
    avgEnergy: round1(mean(energies)),
    avgBrightness: brights.length ? round1(mean(brights)) : undefined,
    topGenres: topN(
      played.map((t) => t.genre).filter((g): g is string => !!g),
      3
    ),
    vibeShare
  }
}

function computeDrift(a: MirrorWindow, b: MirrorWindow): MirrorDrift {
  const bpmDelta = round1(b.avgBpm - a.avgBpm)
  const energyDelta = round1(b.avgEnergy - a.avgEnergy)
  const brightnessDelta =
    a.avgBrightness != null && b.avgBrightness != null
      ? round1(b.avgBrightness - a.avgBrightness)
      : undefined

  const vibes = new Set([...Object.keys(a.vibeShare), ...Object.keys(b.vibeShare)])
  const vibeShifts: VibeShift[] = []
  for (const v of vibes) {
    const fromPct = Math.round((a.vibeShare[v] ?? 0) * 100)
    const toPct = Math.round((b.vibeShare[v] ?? 0) * 100)
    if (Math.abs(toPct - fromPct) >= 15) vibeShifts.push({ vibe: v, fromPct, toPct })
  }
  vibeShifts.sort((x, y) => Math.abs(y.toPct - y.fromPct) - Math.abs(x.toPct - x.fromPct))

  const statements: string[] = []
  if (Math.abs(bpmDelta) >= 2)
    statements.push(
      `Your sets drifted ${Math.abs(bpmDelta)} BPM ${bpmDelta < 0 ? 'slower' : 'faster'}.`
    )
  if (Math.abs(energyDelta) >= 0.5)
    statements.push(
      `You're leaning ${energyDelta < 0 ? 'lower' : 'higher'}-energy (${a.avgEnergy} → ${b.avgEnergy}).`
    )
  if (brightnessDelta != null && Math.abs(brightnessDelta) >= 0.08)
    statements.push(`Your sound has gone ${brightnessDelta < 0 ? 'darker' : 'brighter'}.`)
  for (const s of vibeShifts.slice(0, 2))
    statements.push(`${s.vibe} plays went from ${s.fromPct}% to ${s.toPct}%.`)

  return {
    fromLabel: a.label,
    toLabel: b.label,
    bpmDelta,
    energyDelta,
    brightnessDelta,
    vibeShifts,
    statements
  }
}

function detectRuts(
  recent: MirrorSession[],
  byId: Map<string, Track>,
  kind: 'opener' | 'closer'
): RutSignal | null {
  if (recent.length < 3) return null
  const pick = (s: MirrorSession): string | undefined =>
    kind === 'opener' ? s.trackIds[0] : s.trackIds[s.trackIds.length - 1]
  const counts = new Map<string, number>()
  for (const s of recent) {
    const id = pick(s)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const threshold = Math.max(3, Math.ceil(recent.length * 0.6))
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
  if (!top || top[1] < threshold) return null
  const track = byId.get(top[0])
  return {
    kind,
    trackId: top[0],
    title: track?.title ?? top[0],
    occurrences: top[1],
    ofLast: recent.length
  }
}

function becomingLabel(latest: MirrorWindow): string | undefined {
  if (latest.trackCount === 0) return undefined
  const energyWord =
    latest.avgEnergy >= 7 ? 'peak-time' : latest.avgEnergy <= 4 ? 'late-night' : 'mid-energy'
  const topVibe = Object.entries(latest.vibeShare).sort((a, b) => b[1] - a[1])[0]?.[0]
  const vibePart = topVibe ? `, ${topVibe}` : ''
  return `You're becoming a ${energyWord}${vibePart} DJ.`
}

export function computeSoundMirror(
  tracks: Track[],
  sessions: MirrorSession[],
  now: Date,
  opts: SoundMirrorOptions = {}
): SoundMirrorResult {
  const byId = new Map(tracks.filter((t) => t.phantom !== true).map((t) => [t.id, t]))
  const nowMs = now.getTime()
  const past = sessions
    .filter((s) => new Date(s.performedAt).getTime() <= nowMs && s.trackIds.length > 0)
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt))

  if (past.length === 0) {
    return {
      windows: [],
      ruts: [],
      narration: 'No gig history yet — play some sets and your sound will start to show.'
    }
  }

  // Bucket sessions by quarter, in chronological order.
  const groups = new Map<string, MirrorSession[]>()
  for (const s of past) {
    const label = quarterLabel(s.performedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(s)
  }
  const windows = Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, ss]) => buildWindow(label, ss, byId))

  const drift =
    windows.length >= 2 ? computeDrift(windows[0], windows[windows.length - 1]) : undefined

  const recentCount = opts.recentSessions ?? 5
  const recent = past.slice(-recentCount)
  const ruts = [detectRuts(recent, byId, 'opener'), detectRuts(recent, byId, 'closer')].filter(
    (r): r is RutSignal => r != null
  )

  const becoming = becomingLabel(windows[windows.length - 1])

  // ── narration ──────────────────────────────────────────────────────────────
  let narration: string
  if (!drift || drift.statements.length === 0) {
    narration =
      windows.length < 2
        ? `One window of history so far (${windows[0].label}). Keep logging sets to see your sound move.`
        : `Your sound has held steady from ${windows[0].label} to ${windows[windows.length - 1].label}.`
  } else {
    narration = `${drift.fromLabel} → ${drift.toLabel}: ${drift.statements[0]}${becoming ? ` ${becoming}` : ''}`
  }

  return { windows, drift, ruts, becoming, narration }
}
