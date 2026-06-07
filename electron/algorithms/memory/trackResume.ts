/**
 * trackResume.ts — pure compute for the "Track Résumé" (Frontier 4C).
 *
 * Every track carries its lived reputation in the DJ's world: how many times it
 * has been played live, where it landed and where it died, and when it was last
 * reached for. Built from logged sessions + (optionally) Black Box reactions.
 *
 * Reaction data is OPTIONAL — without it the résumé is a play-history summary;
 * with it, "lands hardest / cools at" context is added. No DB/electron deps.
 *
 * Data plumbing for the app: queries.getSessionsForTrack + getReactionsForTrack
 * feed the two arrays below; the renderer surfaces the result on a track row.
 */

import type { Track } from '../../../src/types'

export interface ResumeSession {
  id: string
  performedAt: string // ISO date
  venue?: string
  eventType?: string
  trackIds: string[]
}

export interface ResumeReaction {
  sessionId: string
  trackId: string
  reactionScore?: number
  confidence?: number
}

export interface ResumeContext {
  label: string
  count: number
  /** 0..1 confidence-weighted mean reaction, when any reaction exists for this context. */
  avgReaction?: number
}

export interface TrackResume {
  trackId: string
  /** Sessions that contain this track. */
  timesPlayedLive: number
  /** The flat CDJ aggregate from the tracks table (a different, coarser stream). */
  totalPlayCount: number
  firstPlayedAt?: string
  lastPlayedAt?: string
  lastVenue?: string
  venues: ResumeContext[]
  byEventType: ResumeContext[]
  /** Highest-reaction context (venue) when reaction data exists. */
  bestContext?: ResumeContext
  /** Lowest-reaction context (venue) when reaction data exists. */
  worstContext?: ResumeContext
  hasReactionData: boolean
  narration: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
/** 0..1 reaction → a friendly 0–10 figure matching the app's energy scale. */
function toTen(score: number): number {
  return Math.round(score * 10)
}

/**
 * Aggregate count + confidence-weighted reaction over a context key (venue /
 * event type) for the sessions a track appeared in.
 */
function aggregateByKey(
  playedSessions: ResumeSession[],
  keyOf: (s: ResumeSession) => string | undefined,
  reactionBySession: Map<string, { score: number; conf: number }>
): ResumeContext[] {
  const counts = new Map<string, number>()
  const reAgg = new Map<string, { sum: number; w: number }>()
  for (const s of playedSessions) {
    const key = keyOf(s)?.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const r = reactionBySession.get(s.id)
    if (r) {
      const cur = reAgg.get(key) ?? { sum: 0, w: 0 }
      cur.sum += r.score * r.conf
      cur.w += r.conf
      reAgg.set(key, cur)
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => {
      const agg = reAgg.get(label)
      return {
        label,
        count,
        avgReaction: agg && agg.w > 0 ? agg.sum / agg.w : undefined
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function computeTrackResume(
  track: Track,
  sessions: ResumeSession[],
  reactions: ResumeReaction[] = []
): TrackResume {
  const played = sessions
    .filter((s) => s.trackIds.includes(track.id))
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt))

  // Index this track's reactions by session for context aggregation.
  const reactionBySession = new Map<string, { score: number; conf: number }>()
  for (const r of reactions) {
    if (r.trackId !== track.id || r.reactionScore == null) continue
    reactionBySession.set(r.sessionId, { score: r.reactionScore, conf: r.confidence ?? 0.5 })
  }
  const hasReactionData = reactionBySession.size > 0

  const venues = aggregateByKey(played, (s) => s.venue, reactionBySession)
  const byEventType = aggregateByKey(played, (s) => s.eventType, reactionBySession)

  const withReaction = venues.filter((v) => v.avgReaction != null)
  const ranked = withReaction.slice().sort((a, b) => (b.avgReaction ?? 0) - (a.avgReaction ?? 0))
  const bestContext = ranked.length ? ranked[0] : undefined
  const worstContext = ranked.length > 1 ? ranked[ranked.length - 1] : undefined

  const first = played[0]
  const last = played[played.length - 1]

  // ── narration ──────────────────────────────────────────────────────────────
  let narration: string
  if (played.length === 0) {
    narration =
      track.playCount > 0
        ? `No logged gigs, but a CDJ play-count of ${track.playCount}.`
        : `You've never played ${track.title} out.`
  } else {
    const parts: string[] = []
    parts.push(
      `Played live ${played.length}×${venues.length ? ` across ${venues.length} venue${venues.length === 1 ? '' : 's'}` : ''}.`
    )
    if (last)
      parts.push(`Last at ${last.venue ?? 'an unnamed gig'} on ${fmtDate(last.performedAt)}.`)
    if (hasReactionData && bestContext?.avgReaction != null) {
      parts.push(`Lands hardest at ${bestContext.label} (${toTen(bestContext.avgReaction)}/10).`)
      if (worstContext?.avgReaction != null && worstContext.label !== bestContext.label) {
        parts.push(`Cools at ${worstContext.label} (${toTen(worstContext.avgReaction)}/10).`)
      }
    }
    narration = parts.join(' ')
  }

  return {
    trackId: track.id,
    timesPlayedLive: played.length,
    totalPlayCount: track.playCount,
    firstPlayedAt: first?.performedAt,
    lastPlayedAt: last?.performedAt,
    lastVenue: last?.venue,
    venues,
    byEventType,
    bestContext,
    worstContext,
    hasReactionData,
    narration
  }
}
