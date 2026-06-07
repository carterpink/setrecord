/**
 * brief.ts — pure compute for the pre-gig "Brief" (Frontier 1B).
 *
 * Turns a forward-looking BriefHit (src/utils/briefIntent.ts) into a game plan
 * for an upcoming gig, built entirely from the DJ's own logged history:
 *   • a venue/event profile (how many times, BPM band, energy, top genres, length)
 *   • PROVEN tracks — what has landed here before (repeat plays, or, once the
 *     Black Box ships, high measured crowd reaction)
 *   • a BRING list — flagged-for-gig + recent additions that fit the room and
 *     haven't been tried here yet
 *   • honest NOTES (caveats + reaction-derived warnings)
 *
 * Reaction data is OPTIONAL: until the Black Box records gigs, `reactions` is
 * empty and the Brief degrades to repeat-play evidence. No DB/electron deps.
 */

import type { Track, VenueType } from '../../../src/types'
import type { BriefHit } from '../../../src/utils/briefIntent'

export interface BriefSession {
  id: string
  performedAt: string // ISO date
  venue?: string
  city?: string
  eventType?: string
  setSlot?: string
  durationSec?: number
  trackIds: string[]
}

/** A measured reaction row (mirrors a subset of SetReaction). */
export interface BriefReactionRow {
  sessionId: string
  trackId: string
  reactionScore?: number
  confidence?: number
}

export interface BriefProfile {
  bpmLow?: number
  bpmHigh?: number
  avgEnergy?: number
  topGenres: string[]
  typicalSetLength?: string
}

export interface BriefAnswer {
  kind: 'brief'
  venueLabel: string
  /** How many past sessions the brief is built from. 0 = first time here. */
  timesPlayed: number
  lastPlayedAt?: string
  /** True when matched on event type because the named venue had no history. */
  fromEventType: boolean
  profile?: BriefProfile
  /** Tracks that have landed here before. */
  proven: Track[]
  /** Flagged / fresh tracks that fit the room and haven't been tried here. */
  bring: Track[]
  /** Honest caveats and reaction-derived insights. */
  notes: string[]
  /** Whether any matched session carries crowd-reaction data. */
  hasReactionData: boolean
  narration: string
}

const RECENT_DAYS = 60
const PROVEN_REACTION = 0.66 // single play counts as "proven" above this reaction
const DIP_REACTION = 0.34 // below this is an "underperformed here" warning

// ── small stats helpers ──────────────────────────────────────────────────────
function mean(ns: number[]): number {
  return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0
}
function pct(sortedAsc: number[], p: number): number | undefined {
  if (!sortedAsc.length) return undefined
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.round(p * (sortedAsc.length - 1))))
  return sortedAsc[i]
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
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function sessionDuration(s: BriefSession): number {
  return s.durationSec ?? s.trackIds.length * 300
}

/** Flagged-for-gig + recent additions, used as the cold-start bring list. */
function coldBring(tracks: Track[], now: Date): Track[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS)
  const flagged = tracks.filter((t) => t.flaggedForGigAt)
  const fresh = tracks.filter(
    (t) => !t.flaggedForGigAt && t.dateAdded && new Date(t.dateAdded).getTime() >= cutoff.getTime()
  )
  const seen = new Set<string>()
  const out: Track[] = []
  for (const t of [...flagged, ...fresh]) {
    if (seen.has(t.id)) continue
    seen.add(t.id)
    out.push(t)
  }
  return out.slice(0, 8)
}

export function computeBrief(
  hit: BriefHit,
  tracksIn: Track[],
  sessions: BriefSession[],
  now: Date,
  reactions: BriefReactionRow[] = []
): BriefAnswer {
  const tracks = tracksIn.filter((t) => t.phantom !== true)
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const nowMs = now.getTime()
  const past = sessions.filter((s) => new Date(s.performedAt).getTime() <= nowMs)

  const v = hit.venue?.toLowerCase()
  let matched = past.filter((s) =>
    v
      ? (s.venue ?? '').toLowerCase().includes(v)
      : hit.eventType
        ? s.eventType === hit.eventType
        : false
  )
  // Fall back to "your other <eventType> sets" when a named venue has no history.
  let fromEventType = false
  if (matched.length === 0 && v && hit.eventType) {
    matched = past.filter((s) => s.eventType === hit.eventType)
    fromEventType = matched.length > 0
  }

  // Use a real stored venue name only when the user actually named a venue.
  const realName = hit.venue && !fromEventType ? matched.find((s) => s.venue)?.venue : undefined
  const venueLabel =
    realName ??
    (hit.venue ? titleCase(hit.venue) : `your ${(hit.eventType as VenueType) ?? 'next'} sets`)

  // ── Cold start: never played here ──────────────────────────────────────────
  if (matched.length === 0) {
    const bring = coldBring(tracks, now)
    return {
      kind: 'brief',
      venueLabel,
      timesPlayed: 0,
      fromEventType: false,
      proven: [],
      bring,
      notes: [
        'First time here — no history to learn from yet. Record this set with the Black Box and the next brief will know what landed.'
      ],
      hasReactionData: false,
      narration: `You haven't played ${venueLabel} before — no history to brief from yet.${
        bring.length ? ` Here are ${bring.length} fresh/flagged tracks to consider.` : ''
      }`
    }
  }

  // ── Profile from matched sessions ──────────────────────────────────────────
  const playCounts = new Map<string, number>()
  for (const s of matched)
    for (const id of s.trackIds) playCounts.set(id, (playCounts.get(id) ?? 0) + 1)
  const playedTracks = Array.from(playCounts.keys())
    .map((id) => byId.get(id))
    .filter((t): t is Track => !!t)

  const bpms = playedTracks
    .map((t) => t.bpm)
    .filter((b) => b > 0)
    .sort((a, b) => a - b)
  const bpmLow = pct(bpms, 0.15)
  const bpmHigh = pct(bpms, 0.85)
  const energies = playedTracks.map((t) => t.energy).filter((e) => e > 0)
  const avgEnergy = energies.length ? Math.round(mean(energies) * 10) / 10 : undefined
  const topGenres = topN(
    playedTracks.map((t) => t.genre).filter((g): g is string => !!g),
    3
  )
  const durs = matched.map(sessionDuration)
  const typicalSetLength = durs.length
    ? fmtDuration(
        pct(
          durs.slice().sort((a, b) => a - b),
          0.5
        )!
      )
    : undefined

  // ── Reaction index (confidence-weighted), scoped to matched sessions ───────
  const matchedIds = new Set(matched.map((s) => s.id))
  const reAgg = new Map<string, { sum: number; w: number }>()
  for (const r of reactions) {
    if (!matchedIds.has(r.sessionId) || r.reactionScore == null) continue
    const w = r.confidence ?? 0.5
    const cur = reAgg.get(r.trackId) ?? { sum: 0, w: 0 }
    cur.sum += r.reactionScore * w
    cur.w += w
    reAgg.set(r.trackId, cur)
  }
  const reactionOf = (id: string): number | undefined => {
    const c = reAgg.get(id)
    return c && c.w > 0 ? c.sum / c.w : undefined
  }
  const hasReactionData = reAgg.size > 0

  // ── Proven: repeated here, or a single play with strong measured reaction ──
  const proven = playedTracks
    .filter((t) => (playCounts.get(t.id) ?? 0) >= 2 || (reactionOf(t.id) ?? 0) >= PROVEN_REACTION)
    .sort((a, b) => {
      const ra = reactionOf(a.id)
      const rb = reactionOf(b.id)
      if (ra != null && rb != null && ra !== rb) return rb - ra
      const ca = playCounts.get(a.id) ?? 0
      const cb = playCounts.get(b.id) ?? 0
      if (cb !== ca) return cb - ca
      return b.playCount - a.playCount
    })
    .slice(0, 12)

  // ── Bring: flagged (unconditional) + fresh-that-fits, never tried here ──────
  const playedHere = new Set(playCounts.keys())
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS)
  const genreSet = new Set(topGenres.map((g) => g.toLowerCase()))
  const fitsBpm = (t: Track): boolean =>
    bpmLow == null || bpmHigh == null || t.bpm <= 0 || (t.bpm >= bpmLow - 6 && t.bpm <= bpmHigh + 6)

  const flagged = tracks.filter((t) => t.flaggedForGigAt && !playedHere.has(t.id))
  const fresh = tracks.filter(
    (t) =>
      !t.flaggedForGigAt &&
      !playedHere.has(t.id) &&
      t.dateAdded &&
      new Date(t.dateAdded).getTime() >= cutoff.getTime() &&
      fitsBpm(t)
  )
  const bringMap = new Map<string, Track>()
  for (const t of [...flagged, ...fresh]) if (!bringMap.has(t.id)) bringMap.set(t.id, t)
  const bring = Array.from(bringMap.values())
    .sort((a, b) => {
      const fa = a.flaggedForGigAt ? 1 : 0
      const fb = b.flaggedForGigAt ? 1 : 0
      if (fa !== fb) return fb - fa
      const ga = a.genre && genreSet.has(a.genre.toLowerCase()) ? 1 : 0
      const gb = b.genre && genreSet.has(b.genre.toLowerCase()) ? 1 : 0
      if (ga !== gb) return gb - ga
      return (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')
    })
    .slice(0, 8)

  // ── Notes (honest) ─────────────────────────────────────────────────────────
  const notes: string[] = []
  if (fromEventType) {
    notes.push(`First time at ${venueLabel} — briefing from your other ${hit.eventType} sets.`)
  }
  if (!hasReactionData) {
    notes.push(
      'No crowd-reaction data yet — this is based on what you’ve repeated here. Record a set with the Black Box to learn what actually landed.'
    )
  } else {
    const dipped = playedTracks
      .filter((t) => (reactionOf(t.id) ?? 1) < DIP_REACTION)
      .slice(0, 3)
      .map((t) => t.title)
    if (dipped.length) notes.push(`Underperformed here before: ${dipped.join(', ')}.`)
  }

  const last = matched.slice().sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]
  const narration =
    `${venueLabel}: you’ve played here ${matched.length}×` +
    `${last ? `, last on ${fmtDate(last.performedAt)}` : ''}. ` +
    `${proven.length} track${proven.length === 1 ? '' : 's'} have landed here` +
    `${bring.length ? `; ${bring.length} fresh/flagged to try` : ''}.`

  return {
    kind: 'brief',
    venueLabel,
    timesPlayed: matched.length,
    lastPlayedAt: last?.performedAt,
    fromEventType,
    profile: { bpmLow, bpmHigh, avgEnergy, topGenres, typicalSetLength },
    proven,
    bring,
    notes,
    hasReactionData,
    narration
  }
}
