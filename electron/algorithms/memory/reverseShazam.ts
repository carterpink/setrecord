/**
 * reverseShazam.ts — pure compute for "Reverse-Shazam of your own past".
 *
 * Resolves a ShazamHit (occasion / position / clock anchor) against logged
 * sessions and answers "what was that track". Position uses play order; clock
 * uses per-track played_at timestamps when present, and degrades honestly to the
 * full tracklist when minute-level timing wasn't logged. No DB/electron deps.
 */

import type { Track, ShazamSession, ShazamAnswer } from '../../../src/types'
import type { Occasion, ShazamHit } from '../../../src/utils/reverseShazamIntent'

// Re-export so existing importers (tests, main) can keep importing from here.
export type { ShazamSession, ShazamAnswer }

const OCCASION_DATE: Record<Occasion, { month: number; day: number; label: string }> = {
  nye: { month: 12, day: 31, label: "New Year's Eve" },
  halloween: { month: 10, day: 31, label: 'Halloween' },
  christmas: { month: 12, day: 25, label: 'Christmas' },
  valentine: { month: 2, day: 14, label: "Valentine's" }
}

/** Parse a YYYY-MM-DD prefix without timezone drift. */
function ymd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
function hourOf(iso?: string): number | undefined {
  if (!iso || iso.length < 13) return undefined
  const h = Number(iso.slice(11, 13))
  return Number.isFinite(h) ? h : undefined
}
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function computeReverseShazam(
  hit: ShazamHit,
  tracks: Track[],
  sessions: ShazamSession[],
  now: Date
): ShazamAnswer {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  const nowMs = now.getTime()
  const past = sessions
    .filter((s) => new Date(s.performedAt).getTime() <= nowMs)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))

  // ── Resolve the session ─────────────────────────────────────────────────────
  let pool = past
  let occasionLabel = ''
  if (hit.occasion) {
    const occ = OCCASION_DATE[hit.occasion]
    occasionLabel = occ.label
    pool = past.filter((s) => {
      const { m, d } = ymd(s.performedAt)
      return m === occ.month && d === occ.day
    })
  }
  const session = pool[0]
  if (!session) {
    return {
      kind: 'empty',
      narration: hit.occasion
        ? `No ${occasionLabel} set in your history.`
        : 'No matching set in your history.'
    }
  }

  const ordered = session.trackIds.map((id) => byId.get(id)).filter((t): t is Track => !!t)
  const where = `${session.venue ?? 'an unnamed gig'} on ${fmtDate(session.performedAt)}`

  // ── Clock-time recall ───────────────────────────────────────────────────────
  if (hit.clockHour !== undefined) {
    const times = session.trackTimes
    if (times && times.some((t) => hourOf(t) !== undefined)) {
      let bestIdx = -1
      let bestDiff = Infinity
      session.trackIds.forEach((_, i) => {
        const h = hourOf(times[i])
        if (h === undefined) return
        const diff = Math.abs(h - hit.clockHour!)
        if (diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      })
      const picked = bestIdx >= 0 ? byId.get(session.trackIds[bestIdx]) : undefined
      if (picked) {
        return {
          kind: 'tracks',
          session,
          tracks: [picked],
          narration: `Around ${hit.clockHour}:00 at ${where} you were playing ${picked.title}.`
        }
      }
    }
    // Honest fallback: we logged the tracklist, not minute-by-minute timing.
    return {
      kind: 'gig',
      session,
      tracks: ordered,
      narration: `I logged the tracklist for ${where}, but not the minute-by-minute timing — here's the full set.`
    }
  }

  // ── Position recall ─────────────────────────────────────────────────────────
  if (hit.position !== undefined) {
    let idx: number
    let label: string
    if (hit.position === 'first') {
      idx = 0
      label = 'opening track'
    } else if (hit.position === 'last') {
      idx = ordered.length - 1
      label = 'closing track'
    } else if (hit.position === 'middle') {
      idx = Math.floor(ordered.length / 2)
      label = 'track around the middle'
    } else {
      idx = hit.position - 1
      label = `${ordinal(hit.position)} track`
    }
    const picked = ordered[idx]
    if (!picked) {
      return {
        kind: 'gig',
        session,
        tracks: ordered,
        narration: `That set at ${where} only had ${ordered.length} tracks — here's the lot.`
      }
    }
    return {
      kind: 'tracks',
      session,
      tracks: [picked],
      narration: `At ${where}, the ${label} was ${picked.title}.`
    }
  }

  // ── Occasion only — return the whole set ────────────────────────────────────
  return {
    kind: 'gig',
    session,
    tracks: ordered,
    narration: `Your ${occasionLabel || ''} set at ${where} — ${ordered.length} tracks.`.replace(
      /\s+/g,
      ' '
    )
  }
}
