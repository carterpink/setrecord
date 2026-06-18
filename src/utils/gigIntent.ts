/**
 * gigIntent.ts — pure detector for gig-history / play-recall questions.
 *
 * Renderer-safe. Maps "what did I play last Saturday", "my longest set",
 * "how many times have I played X", "what venues have I played" etc. onto a
 * typed intent before the generic search path swallows them. Compute lives in
 * electron/algorithms/memory/gigHistory.ts.
 */

export type GigMetric =
  | 'last_session' // 075
  | 'gigs_list' // 076
  | 'venues_played' // 081
  | 'longest_set' // 080
  | 'avg_set_length' // 086
  | 'last_played_track' // 078
  | 'play_count_track' // 079
  | 'setlist_for' // 083
  | 'most_recent_import' // 085
  | 'played_over_n' // 082
  | 'never_repeated_venue' // 084

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
}
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

export interface GigHit {
  metric: GigMetric
  /** Track name for last_played_track / play_count_track. */
  trackQuery?: string
  /** Threshold for played_over_n. */
  threshold?: number
  /** Month (1-12) for setlist_for. */
  month?: number
  /** Weekday (0-6) for last_session. */
  weekday?: number
}

function cleanTrackName(s: string): string {
  return s
    .replace(/[?."']+\s*$/g, '')
    .replace(/\b(the )?(track|song|tune)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectGig(raw: string): GigHit | null {
  const q = raw.toLowerCase().trim()

  // ── per-track recall ─────────────────────────────────────────────────────
  let m = q.match(/how many times.*\b(?:have i |did i |i )?(?:play|played|spun)\s+(.+)$/)
  if (m && cleanTrackName(m[1]).length >= 2)
    return { metric: 'play_count_track', trackQuery: cleanTrackName(m[1]) }

  m = q.match(
    /\b(?:when did i (?:last )?play|last time i (?:played|spun)|when.*last play(?:ed)?)\s+(.+)$/
  )
  if (m && cleanTrackName(m[1]).length >= 2)
    return { metric: 'last_played_track', trackQuery: cleanTrackName(m[1]) }

  // ── set-level aggregates ─────────────────────────────────────────────────
  if (/\blongest (set|gig|night)\b|biggest set ever/.test(q)) return { metric: 'longest_set' }
  if (/\baverage set (length|duration)|avg set|how long.*(my )?sets?\b|typical set length/.test(q))
    return { metric: 'avg_set_length' }
  if (
    /\bwhat venues|venues (have i|i'?ve) played|where have i (played|gigged)|list.*venues/.test(q)
  )
    return { metric: 'venues_played' }
  if (
    /\bmost recent import|last import|recently imported|latest (import|addition|tracks i added)/.test(
      q
    )
  )
    return { metric: 'most_recent_import' }

  m = q.match(/\bplayed (?:more than|over|at least)\s*(\d+)\s*times/)
  if (m) return { metric: 'played_over_n', threshold: Number(m[1]) }

  if (/never repeated|haven'?t repeated|only (played )?once.*(venue|at each)/.test(q))
    return { metric: 'never_repeated_venue' }

  // ── setlist for a month / occasion ───────────────────────────────────────
  if (/\b(setlist|set list|tracklist)\b/.test(q) || /what (did|was).*\b(set|gig)\b/.test(q)) {
    const mm = Object.keys(MONTHS).find((name) => new RegExp(`\\b${name}\\b`).test(q))
    return { metric: 'setlist_for', month: mm ? MONTHS[mm] : undefined }
  }

  // ── gigs list / last session ─────────────────────────────────────────────
  if (
    /\b(show me |list |see )?(all )?my gigs\b|gigs i'?ve played|what gigs have i|all my gigs/.test(
      q
    )
  )
    return { metric: 'gigs_list' }

  // Recall only ("what did I play …"). "based on last night" / "similar to my
  // last gig" are recommendations → handled by the discovery engine, not recall.
  if (/\bwhat did i play\b/.test(q)) {
    const wd = Object.keys(WEEKDAYS).find((name) => new RegExp(`\\b${name}\\b`).test(q))
    const mm = Object.keys(MONTHS).find((name) => new RegExp(`\\b${name}\\b`).test(q))
    if (mm) return { metric: 'setlist_for', month: MONTHS[mm] }
    return { metric: 'last_session', weekday: wd ? WEEKDAYS[wd] : undefined }
  }

  return null
}
