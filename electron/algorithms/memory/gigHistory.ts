/**
 * gigHistory.ts — pure gig-history / play-recall aggregations.
 *
 * Turns a detected GigHit (src/utils/gigIntent.ts) into a normalized answer over
 * the user's logged sessions + tracks. No DB/electron deps. Also the data layer
 * the richer Gigs play-history timeline (P6) will build on.
 */

import type { Track } from '../../../src/types'
import type { GigHit } from '../../../src/utils/gigIntent'

export interface GigSession {
  id: string
  name?: string
  performedAt: string // ISO date
  venue?: string
  city?: string
  eventType?: string
  durationSec?: number
  trackIds: string[]
}

export interface GigAnswer {
  kind: 'gig' | 'tracks' | 'stats' | 'count' | 'empty'
  sessions?: GigSession[]
  tracks?: Track[]
  stats?: { label: string; value: string }[]
  count?: number
  narration: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function resolveTracks(ids: string[], tracks: Track[]): Track[] {
  const byId = new Map(tracks.map((t) => [t.id, t]))
  return ids.map((id) => byId.get(id)).filter((t): t is Track => !!t)
}
function findTrack(query: string, tracks: Track[]): Track | null {
  const q = query
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()
  // try "title artist" / "artist title" contains all tokens
  const tokens = q.split(' ').filter(Boolean)
  return (
    tracks.find((t) => {
      const hay = norm(`${t.title} ${t.artist}`)
      return tokens.every((tok) => hay.includes(tok))
    }) ?? null
  )
}
function sessionDuration(s: GigSession): number {
  return s.durationSec ?? s.trackIds.length * 300 // ~5 min/track fallback
}

export function computeGig(
  hit: GigHit,
  tracks: Track[],
  sessions: GigSession[],
  now: Date
): GigAnswer {
  const nowMs = now.getTime()
  const past = sessions
    .filter((s) => new Date(s.performedAt).getTime() <= nowMs)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))

  switch (hit.metric) {
    case 'last_session': {
      let target: GigSession | undefined
      if (hit.weekday != null) {
        target = past.find((s) => new Date(s.performedAt).getDay() === hit.weekday)
      }
      target = target ?? past[0]
      if (!target) return { kind: 'empty', narration: 'No sessions recorded yet.' }
      return {
        kind: 'gig',
        sessions: [target],
        tracks: resolveTracks(target.trackIds, tracks),
        narration: `On ${fmtDate(target.performedAt)}${target.venue ? ` at ${target.venue}` : ''} you played ${target.trackIds.length} tracks.`
      }
    }
    case 'gigs_list': {
      const year = now.getFullYear()
      const thisYear = sessions
        .filter((s) => new Date(s.performedAt).getFullYear() === year)
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      if (thisYear.length === 0) return { kind: 'empty', narration: 'No gigs recorded this year.' }
      return {
        kind: 'gig',
        sessions: thisYear,
        narration: `${thisYear.length} gigs this year.`
      }
    }
    case 'venues_played': {
      const m = new Map<string, number>()
      for (const s of sessions) {
        const v = s.venue?.trim()
        if (v) m.set(v, (m.get(v) ?? 0) + 1)
      }
      const rows = Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([v, c]) => ({ label: v, value: `${c}×` }))
      return {
        kind: 'stats',
        stats: rows,
        narration: `You've played ${rows.length} venues.`
      }
    }
    case 'longest_set': {
      if (sessions.length === 0) return { kind: 'empty', narration: 'No sessions recorded yet.' }
      const longest = sessions.slice().sort((a, b) => sessionDuration(b) - sessionDuration(a))[0]
      return {
        kind: 'gig',
        sessions: [longest],
        tracks: resolveTracks(longest.trackIds, tracks),
        narration: `Your longest set was ${fmtDate(longest.performedAt)}${longest.venue ? ` at ${longest.venue}` : ''} — ${fmtDuration(sessionDuration(longest))}, ${longest.trackIds.length} tracks.`
      }
    }
    case 'avg_set_length': {
      if (sessions.length === 0) return { kind: 'empty', narration: 'No sessions recorded yet.' }
      const mean = sessions.reduce((s, x) => s + sessionDuration(x), 0) / sessions.length
      return {
        kind: 'stats',
        stats: [
          { label: 'Average set length', value: fmtDuration(mean) },
          { label: 'Sessions', value: String(sessions.length) }
        ],
        narration: `Your average set is ${fmtDuration(mean)} across ${sessions.length} sessions.`
      }
    }
    case 'last_played_track': {
      if (!hit.trackQuery) return { kind: 'empty', narration: 'Which track?' }
      const track = findTrack(hit.trackQuery, tracks)
      if (!track) return { kind: 'empty', narration: `"${hit.trackQuery}" isn't in your library.` }
      const inSessions = sessions
        .filter((s) => s.trackIds.includes(track.id))
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      const last = inSessions[0]?.performedAt ?? track.lastPlayed
      if (!last)
        return {
          kind: 'gig',
          tracks: [track],
          narration: `No play history found for ${track.title}.`
        }
      return {
        kind: 'gig',
        tracks: [track],
        narration: `You last played ${track.title} on ${fmtDate(last)}.`
      }
    }
    case 'play_count_track': {
      if (!hit.trackQuery) return { kind: 'empty', narration: 'Which track?' }
      const track = findTrack(hit.trackQuery, tracks)
      if (!track) return { kind: 'empty', narration: `"${hit.trackQuery}" isn't in your library.` }
      return {
        kind: 'count',
        count: track.playCount,
        tracks: [track],
        narration: `You've played ${track.title} ${track.playCount} times.`
      }
    }
    case 'setlist_for': {
      const matches = sessions.filter((s) => {
        if (hit.month == null) return false
        return new Date(s.performedAt).getMonth() + 1 === hit.month
      })
      if (matches.length === 0)
        return { kind: 'empty', narration: 'No sessions match that period.' }
      const pick = matches.sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]
      return {
        kind: 'gig',
        sessions: matches,
        tracks: resolveTracks(pick.trackIds, tracks),
        narration:
          matches.length === 1
            ? `Your set on ${fmtDate(pick.performedAt)}${pick.venue ? ` at ${pick.venue}` : ''}.`
            : `${matches.length} sessions that month — showing ${fmtDate(pick.performedAt)}.`
      }
    }
    case 'most_recent_import': {
      const real = tracks.filter((t) => t.phantom !== true && t.dateAdded)
      if (real.length === 0) return { kind: 'empty', narration: 'No tracks imported yet.' }
      const newest = real.slice().sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))[0]
      const batch = real.filter((t) => t.dateAdded.slice(0, 10) === newest.dateAdded.slice(0, 10))
      return {
        kind: 'tracks',
        tracks: batch,
        narration: `Your most recent import: ${batch.length} track${batch.length > 1 ? 's' : ''} on ${fmtDate(newest.dateAdded)}.`
      }
    }
    case 'played_over_n': {
      const threshold = hit.threshold ?? 3
      const yearAgo = new Date(now)
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      const counts = new Map<string, number>()
      for (const s of sessions) {
        if (new Date(s.performedAt).getTime() < yearAgo.getTime()) continue
        for (const id of s.trackIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const ids = Array.from(counts.entries())
        .filter(([, c]) => c > threshold)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
      const out = resolveTracks(ids, tracks)
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out,
        narration: out.length
          ? `${out.length} tracks played more than ${threshold} times in the last year.`
          : `No track was played more than ${threshold} times in the last year.`
      }
    }
    case 'never_repeated_venue': {
      // Approximation: tracks that appear exactly once per venue across all sessions.
      const perVenue = new Map<string, Map<string, number>>()
      for (const s of sessions) {
        const v = s.venue ?? 'unknown'
        if (!perVenue.has(v)) perVenue.set(v, new Map())
        const vm = perVenue.get(v)!
        for (const id of s.trackIds) vm.set(id, (vm.get(id) ?? 0) + 1)
      }
      const repeated = new Set<string>()
      const seen = new Set<string>()
      for (const vm of perVenue.values())
        for (const [id, c] of vm) {
          seen.add(id)
          if (c > 1) repeated.add(id)
        }
      const ids = Array.from(seen).filter((id) => !repeated.has(id))
      return {
        kind: 'tracks',
        tracks: resolveTracks(ids, tracks),
        narration: `Tracks you've never repeated at the same venue (approximate).`
      }
    }
    default:
      return { kind: 'empty', narration: 'No gig data for that.' }
  }
}
