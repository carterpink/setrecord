/**
 * stats.ts — pure analytics aggregations for the SetRecord Intelligence layer.
 *
 * One function per metric, all deterministic and offline. Detection lives in
 * src/utils/statsIntent.ts; this module turns a detected metric into a
 * normalized {kind, stats?, count?, narration} answer. No DB / electron deps —
 * callers pass plain arrays.
 *
 * STATUS: part of the eval-harness intelligence engine (see
 * electron/algorithms/memory/README.md). Reached only via tests/eval/driver.ts
 * today — the runtime app produces `kind: 'stats'` through homeStore's own path,
 * not through this module. Kept as the canonical target implementation.
 */

import type { Track } from '../../../src/types'
import type { StatsHit, StatsMetric } from '../../../src/utils/statsIntent'

/** Minimal session shape the time-scoped metrics need. */
export interface StatsSession {
  performedAt: string // ISO date
  trackIds: string[]
}

export interface StatsAnswer {
  kind: 'stats' | 'count' | 'tracks' | 'empty'
  stats?: { label: string; value: string }[]
  count?: number
  tracks?: Track[]
  narration: string
}

const NON_ELECTRONIC = [
  'rock',
  'jazz',
  'folk',
  'classical',
  'hip hop',
  'hip-hop',
  'rap',
  'soul',
  'country',
  'pop ',
  'metal',
  'blues',
  'reggae'
]

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${Math.round((n / d) * 100)}%`
}
function topEntries(map: Map<string, number>): [string, number][] {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
}
function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.round((totalSec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function monthKey(iso: string): string {
  return iso.slice(0, 7) // YYYY-MM
}

export function computeStats(
  hit: StatsHit,
  tracksIn: Track[],
  sessions: StatsSession[],
  now: Date
): StatsAnswer {
  const tracks = real(tracksIn)
  const total = tracks.length
  const metric: StatsMetric = hit.metric

  switch (metric) {
    case 'library_size': {
      const genres = new Set(tracks.map((t) => (t.genre ?? '').toLowerCase()).filter(Boolean))
      const bpms = tracks.map((t) => t.bpm).filter((b) => b > 0)
      const lo = bpms.length ? Math.min(...bpms) : 0
      const hi = bpms.length ? Math.max(...bpms) : 0
      return {
        kind: 'stats',
        stats: [
          { label: 'Tracks', value: String(total) },
          { label: 'Genres', value: String(genres.size) },
          { label: 'BPM range', value: bpms.length ? `${lo}–${hi}` : '—' }
        ],
        narration: `${total} tracks across ${genres.size} genres.`
      }
    }
    case 'total_duration': {
      const sec = tracks.reduce((s, t) => s + (t.duration || 0), 0)
      return {
        kind: 'stats',
        stats: [
          { label: 'Total duration', value: fmtDuration(sec) },
          { label: 'Tracks', value: String(total) }
        ],
        narration: `${fmtDuration(sec)} of music across ${total} tracks.`
      }
    }
    case 'avg_bpm': {
      const bpms = tracks.map((t) => t.bpm).filter((b) => b > 0)
      const mean = bpms.length ? Math.round(bpms.reduce((s, b) => s + b, 0) / bpms.length) : 0
      return {
        kind: 'stats',
        stats: [
          { label: 'Average BPM', value: String(mean) },
          { label: 'Analyzed tracks', value: String(bpms.length) }
        ],
        narration: `Average BPM is ${mean} across ${bpms.length} analyzed tracks.`
      }
    }
    case 'genre_distribution': {
      const m = new Map<string, number>()
      for (const t of tracks) {
        const g = t.genre?.trim()
        if (g) m.set(g, (m.get(g) ?? 0) + 1)
      }
      const rows = topEntries(m).map(([g, c]) => ({ label: g, value: String(c) }))
      return { kind: 'stats', stats: rows, narration: `${rows.length} genres in your library.` }
    }
    case 'most_played_genre': {
      const m = new Map<string, number>()
      let totalPlays = 0
      for (const t of tracks) {
        const g = t.genre?.trim()
        if (g) {
          m.set(g, (m.get(g) ?? 0) + (t.playCount || 0))
          totalPlays += t.playCount || 0
        }
      }
      const top = topEntries(m)[0]
      if (!top) return { kind: 'empty', narration: 'No genre play data yet.' }
      return {
        kind: 'stats',
        stats: [
          { label: 'Top genre', value: top[0] },
          { label: 'Plays', value: String(top[1]) },
          { label: 'Share', value: pct(top[1], totalPlays) }
        ],
        narration: `${top[0]} is your most-played genre (${top[1]} plays, ${pct(top[1], totalPlays)} of all plays).`
      }
    }
    case 'most_played_artist': {
      const m = new Map<string, number>()
      for (const t of tracks) m.set(t.artist, (m.get(t.artist) ?? 0) + (t.playCount || 0))
      const top = topEntries(m)[0]
      if (!top) return { kind: 'empty', narration: 'No artist play data yet.' }
      return {
        kind: 'stats',
        stats: [
          { label: 'Top artist', value: top[0] },
          { label: 'Plays', value: String(top[1]) }
        ],
        narration: `${top[0]} is the artist you play most (${top[1]} plays).`
      }
    }
    case 'pct_played': {
      const played = tracks.filter((t) => t.playCount > 0).length
      return {
        kind: 'stats',
        stats: [
          { label: 'Played', value: String(played) },
          { label: 'Total', value: String(total) },
          { label: 'Percentage', value: pct(played, total) }
        ],
        narration: `You've played ${played} of ${total} tracks (${pct(played, total)}).`
      }
    }
    case 'pct_key_analyzed': {
      const keyed = tracks.filter((t) => t.key && t.key.trim() !== '').length
      return {
        kind: 'stats',
        stats: [
          { label: 'Key-analyzed', value: String(keyed) },
          { label: 'Total', value: String(total) },
          { label: 'Percentage', value: pct(keyed, total) }
        ],
        narration: `${pct(keyed, total)} of your library is key-analyzed (${keyed}/${total}).`
      }
    }
    case 'key_breakdown': {
      const m = new Map<string, number>()
      for (const t of tracks) {
        const k = t.key?.trim()
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
      const rows = topEntries(m).map(([k, c]) => ({ label: k, value: String(c) }))
      const top = rows[0]
      return {
        kind: 'stats',
        stats: rows,
        narration: top
          ? `Your most common key is ${top.label} (${top.value} tracks).`
          : 'No keys analyzed.'
      }
    }
    case 'most_common_key': {
      const m = new Map<string, number>()
      for (const t of tracks) {
        const k = t.key?.trim()
        if (k) m.set(k, (m.get(k) ?? 0) + 1)
      }
      const top = topEntries(m)[0]
      if (!top) return { kind: 'empty', narration: 'No keys analyzed yet.' }
      return {
        kind: 'stats',
        stats: [
          { label: 'Most common key', value: top[0] },
          { label: 'Tracks', value: String(top[1]) }
        ],
        narration: `${top[0]} is your most common key (${top[1]} tracks).`
      }
    }
    case 'label_distribution': {
      const m = new Map<string, number>()
      for (const t of tracks) {
        const l = t.label?.trim()
        if (l) m.set(l, (m.get(l) ?? 0) + 1)
      }
      const rows = topEntries(m).map(([l, c]) => ({ label: l, value: String(c) }))
      return { kind: 'stats', stats: rows, narration: `${rows.length} labels in your collection.` }
    }
    case 'niche_genre': {
      const m = new Map<string, number>()
      for (const t of tracks) {
        const g = t.genre?.trim()
        if (g) m.set(g, (m.get(g) ?? 0) + 1)
      }
      const eligible = topEntries(m)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => a[1] - b[1])
      const niche = eligible[0]
      if (!niche) return { kind: 'empty', narration: 'No genre has enough tracks to call niche.' }
      const nicheTracks = tracks.filter((t) => (t.genre ?? '') === niche[0])
      return {
        kind: 'tracks',
        tracks: nicheTracks,
        stats: [{ label: niche[0], value: String(niche[1]) }],
        narration: `${niche[0]} is your most niche genre (${niche[1]} tracks).`
      }
    }
    case 'electronic_split': {
      const isNonElectronic = (t: Track): boolean => {
        const g = (t.genre ?? '').toLowerCase()
        return NON_ELECTRONIC.some((x) => g.includes(x.trim()))
      }
      const non = tracks.filter(isNonElectronic).length
      const elec = total - non
      return {
        kind: 'stats',
        stats: [
          { label: 'Electronic', value: `${elec} (${pct(elec, total)})` },
          { label: 'Non-electronic', value: `${non} (${pct(non, total)})` }
        ],
        narration: `${pct(elec, total)} electronic, ${pct(non, total)} non-electronic (genre-based estimate).`
      }
    }
    case 'genre_count': {
      const g = (hit.genre ?? '').toLowerCase()
      const n = tracks.filter((t) => (t.genre ?? '').toLowerCase().includes(g)).length
      return {
        kind: 'stats',
        stats: [
          { label: `${hit.genre} tracks`, value: String(n) },
          { label: 'Share', value: pct(n, total) }
        ],
        narration: `${n} ${hit.genre} tracks (${pct(n, total)} of your library).`
      }
    }
    case 'added_recently_count': {
      const cutoff = new Date(now)
      cutoff.setMonth(cutoff.getMonth() - 6)
      const n = tracks.filter(
        (t) => t.dateAdded && new Date(t.dateAdded).getTime() >= cutoff.getTime()
      ).length
      return {
        kind: 'count',
        count: n,
        stats: [{ label: 'Added (last 6 months)', value: String(n) }],
        narration: `You've added ${n} tracks in the past 6 months.`
      }
    }
    case 'productive_month': {
      const m = new Map<string, number>()
      for (const t of tracks)
        if (t.dateAdded) m.set(monthKey(t.dateAdded), (m.get(monthKey(t.dateAdded)) ?? 0) + 1)
      const top = topEntries(m)[0]
      if (!top) return { kind: 'empty', narration: 'No import dates recorded.' }
      return {
        kind: 'stats',
        stats: [{ label: top[0], value: `${top[1]} tracks` }],
        narration: `Your busiest import month was ${top[0]} (${top[1]} tracks).`
      }
    }
    case 'gigs_this_year': {
      const year = now.getFullYear()
      const n = sessions.filter((s) => new Date(s.performedAt).getFullYear() === year).length
      return {
        kind: 'count',
        count: n,
        stats: [{ label: `Gigs in ${year}`, value: String(n) }],
        narration: `You've played ${n} gigs this year.`
      }
    }
    case 'listening_month': {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthSessions = sessions.filter((s) => monthKey(s.performedAt) === ym)
      const trackIds = new Set(monthSessions.flatMap((s) => s.trackIds))
      if (monthSessions.length === 0)
        return { kind: 'empty', narration: 'No sessions logged this month yet.' }
      return {
        kind: 'stats',
        stats: [
          { label: 'Sessions this month', value: String(monthSessions.length) },
          { label: 'Distinct tracks played', value: String(trackIds.size) }
        ],
        narration: `This month: ${monthSessions.length} sessions, ${trackIds.size} distinct tracks.`
      }
    }
    case 'bpm_over_time': {
      const byMonth = new Map<string, number[]>()
      for (const s of sessions) {
        const bpms = s.trackIds
          .map((id) => tracks.find((t) => t.id === id)?.bpm ?? 0)
          .filter((b) => b > 0)
        if (bpms.length)
          byMonth.set(monthKey(s.performedAt), [
            ...(byMonth.get(monthKey(s.performedAt)) ?? []),
            ...bpms
          ])
      }
      const rows = Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mth, bpms]) => ({
          label: mth,
          value: `${Math.round(bpms.reduce((s, b) => s + b, 0) / bpms.length)} bpm`
        }))
      return {
        kind: 'stats',
        stats: rows,
        narration: rows.length
          ? `Average BPM per month across your logged sessions (limited range — only as far back as your history goes).`
          : 'Not enough session history to chart a BPM trend yet.'
      }
    }
    case 'genre_shift': {
      const byMonth = new Map<string, Map<string, number>>()
      for (const s of sessions) {
        const k = monthKey(s.performedAt)
        if (!byMonth.has(k)) byMonth.set(k, new Map())
        const gm = byMonth.get(k)!
        for (const id of s.trackIds) {
          const g = tracks.find((t) => t.id === id)?.genre?.trim()
          if (g) gm.set(g, (gm.get(g) ?? 0) + 1)
        }
      }
      const rows = Array.from(byMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mth, gm]) => ({ label: mth, value: topEntries(gm)[0]?.[0] ?? '—' }))
      return {
        kind: 'stats',
        stats: rows,
        narration: rows.length
          ? `Top genre per month (your history doesn't span 2 years — showing the available range).`
          : `Your play history doesn't go back far enough to show a 2-year genre shift yet.`
      }
    }
    case 'peak_hour':
      return {
        kind: 'empty',
        narration:
          "I don't have time-of-day timestamps for your sessions, so I can't pin a peak hour — only session dates are recorded."
      }
    default:
      return { kind: 'empty', narration: 'No stat for that.' }
  }
}
