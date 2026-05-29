/**
 * identity.ts — Pure engine: "Wrapped for DJs" — aggregate a library of
 * tracks (and optional session history) into a rich IdentitySnapshot that
 * the UI can render as charts and summary stats.
 */

import type { Track } from '../../../src/types'
import type { IdentitySnapshot } from '../../../src/types'

export type { IdentitySnapshot }

function bpmBucket(bpm: number): string {
  if (bpm === 0) return 'unknown'
  const low = Math.floor(bpm / 10) * 10
  return `${low}–${low + 9}`
}

/** Numeric low bound of a bucket label for ordering; 'unknown' sorts last. */
function bucketLow(label: string): number {
  if (label === 'unknown') return Number.MAX_SAFE_INTEGER
  return parseInt(label, 10)
}

function isoToYearQuarter(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'unknown'
  const year = d.getFullYear()
  const quarter = Math.floor(d.getMonth() / 3) + 1
  return `${year} Q${quarter}`
}

function countMap<T extends string | number>(values: T[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of values) {
    const key = String(v)
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

function topN(record: Record<string, number>, n: number): Array<{ label: string; count: number }> {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }))
}

/**
 * Best-effort artist: many DJ-pool files leave Artist blank and embed it in the
 * title as "Artist - Title". Fall back to that prefix so the top-artists chart
 * isn't dominated by a giant "no artist" bucket. Returns '' if still unknown.
 */
function effectiveArtist(track: Track): string {
  const a = (track.artist ?? '').trim()
  if (a && a.toLowerCase() !== 'unknown artist') return a
  const title = (track.title ?? '').trim()
  const dash = title.indexOf(' - ')
  if (dash > 0) return title.slice(0, dash).trim()
  return ''
}

/**
 * Rekordbox's Label field is often polluted with ISRC codes or catalogue
 * numbers (e.g. "GBCPZ2321644"), not real label names. Filter those out so the
 * top-labels chart only shows plausible label names (else it stays empty).
 */
function isRealLabel(raw: string): boolean {
  const l = raw.trim()
  if (l === '') return false
  // ISRC: 2 letters + 3 alphanumerics + 7 digits
  if (/^[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}$/.test(l)) return false
  // Catalogue-code-like: no lowercase, no spaces, contains digits, fairly long
  if (!/[a-z]/.test(l) && /\d/.test(l) && !/\s/.test(l) && l.length >= 8) return false
  return true
}

export function buildIdentity(
  tracks: Track[],
  sessions?: { performedAt?: string; trackIds: string[] }[]
): IdentitySnapshot {
  if (tracks.length === 0) {
    return {
      genreDistribution: [],
      bpmHistogram: [],
      keyDistribution: [],
      energyDistribution: [],
      topArtists: [],
      topLabels: [],
      tasteTimeline: [],
      keyByBpmZone: [],
      totalTracks: 0
    }
  }

  // ── Genre distribution
  const genreMap = countMap(
    tracks.filter((t) => t.genre && t.genre.trim() !== '').map((t) => t.genre!)
  )

  // ── BPM histogram in 10-bpm buckets
  const bpmMap = countMap(tracks.map((t) => bpmBucket(t.bpm)))

  // ── Key distribution (Camelot)
  const keyMap = countMap(tracks.filter((t) => t.key && t.key.trim() !== '').map((t) => t.key))

  // ── Energy distribution (1-10)
  const energyMap = countMap(tracks.map((t) => String(Math.round(t.energy))))

  // ── Top artists (derive from title when blank; drop still-unknowns)
  const artistMap = countMap(tracks.map(effectiveArtist).filter((a) => a !== ''))

  // ── Top labels (filter out ISRC / catalogue codes masquerading as labels)
  const labelMap = countMap(tracks.map((t) => (t.label ?? '').trim()).filter(isRealLabel))

  // ── Taste timeline: bucket tracks by dateAdded year/quarter
  //    Also incorporate session performedAt dates if provided
  const timelineBuckets: Record<string, number> = {}

  for (const track of tracks) {
    const bucket = isoToYearQuarter(track.dateAdded)
    timelineBuckets[bucket] = (timelineBuckets[bucket] ?? 0) + 1
  }

  const performedBuckets: Record<string, number> = {}
  if (sessions) {
    for (const session of sessions) {
      if (!session.performedAt) continue
      const bucket = isoToYearQuarter(session.performedAt)
      performedBuckets[bucket] = (performedBuckets[bucket] ?? 0) + session.trackIds.length
    }
  }

  const tasteTimeline = Object.entries(timelineBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, count]) => ({ period, count, performedCount: performedBuckets[period] ?? 0 }))

  // ── Key composition per 10-BPM zone
  //    Sarah + Marcus asked for this independently: a DJ's harmonic approach
  //    changes by tempo zone. We only count tracks that have a BPM and a key —
  //    a missing-either track has nothing to say about either axis.
  const keyByZone: Record<string, Record<string, number>> = {}
  const keyByZoneTotals: Record<string, number> = {}
  for (const t of tracks) {
    if (!t.key || t.bpm === 0) continue
    const bucket = bpmBucket(t.bpm)
    if (bucket === 'unknown') continue
    if (!keyByZone[bucket]) keyByZone[bucket] = {}
    keyByZone[bucket][t.key] = (keyByZone[bucket][t.key] ?? 0) + 1
    keyByZoneTotals[bucket] = (keyByZoneTotals[bucket] ?? 0) + 1
  }
  const keyByBpmZone = Object.entries(keyByZone)
    .sort((a, b) => bucketLow(a[0]) - bucketLow(b[0]))
    .map(([range, keys]) => ({ range, total: keyByZoneTotals[range], keys }))

  return {
    genreDistribution: topN(genreMap, 20),
    bpmHistogram: Object.entries(bpmMap)
      // Sort numerically by the bucket's low bound so "90–99" precedes
      // "100–109" (lexicographic sort would wrongly put "100–109" first).
      // "unknown" (bpm===0) sorts last.
      .sort((a, b) => bucketLow(a[0]) - bucketLow(b[0]))
      .map(([range, count]) => ({ range, count })),
    keyDistribution: topN(keyMap, 24),
    energyDistribution: Object.entries(energyMap)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([level, count]) => ({ level: Number(level), count })),
    topArtists: topN(artistMap, 20),
    topLabels: topN(labelMap, 20),
    tasteTimeline,
    keyByBpmZone,
    totalTracks: tracks.length
  }
}
