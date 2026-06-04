/**
 * statsIntent.ts — pure detector mapping an analytics question to a typed metric.
 *
 * Renderer-safe (no electron/node deps) so both the conversational Home surface
 * and the eval harness can classify a query before the generic search path
 * would otherwise swallow it as a text search. The actual aggregation lives in
 * electron/algorithms/memory/stats.ts (computeStats), keeping detection and
 * compute as separable pure units.
 */

export type StatsMetric =
  | 'library_size' // 005, 126
  | 'total_duration' // 155
  | 'avg_bpm' // 133
  | 'genre_distribution' // 117
  | 'most_played_genre' // 146
  | 'most_played_artist' // 148
  | 'pct_played' // 151
  | 'pct_key_analyzed' // 036
  | 'key_breakdown' // 157
  | 'most_common_key' // 028
  | 'label_distribution' // 019
  | 'niche_genre' // 121
  | 'electronic_split' // 123
  | 'genre_count' // 115 (how much <genre>)
  | 'added_recently_count' // 152
  | 'productive_month' // 153
  | 'gigs_this_year' // 156
  | 'listening_month' // 147
  | 'bpm_over_time' // 149 (honest: limited range)
  | 'peak_hour' // 150 (honest: no timestamps)
  | 'genre_shift' // 154 (honest: limited range)

export interface StatsHit {
  metric: StatsMetric
  /** A genre token captured for genre_count ("how much house"). */
  genre?: string
}

const GENRE_TOKENS = [
  'tech house',
  'deep house',
  'progressive house',
  'afro house',
  'detroit techno',
  'hard techno',
  'acid house',
  'uk garage',
  'drum and bass',
  'house',
  'techno',
  'trance',
  'garage',
  'minimal',
  'disco',
  'dnb',
  'ambient',
  'electro',
  'breakbeat',
  'dubstep'
]

function findGenre(q: string): string | undefined {
  for (const g of GENRE_TOKENS) if (q.includes(g)) return g
  return undefined
}

/**
 * Classify an analytics question. Returns null when the query isn't a stats
 * request (the caller then falls through to search / ask). Ordered most-specific
 * first so e.g. "most played genre" beats a bare "genre" listing.
 */
export function detectStats(raw: string): StatsHit | null {
  const q = raw.toLowerCase().trim()

  // ── play-aggregations ──────────────────────────────────────────────────
  if (/\b(most[- ]?played|top|favou?rite|play.*most).{0,12}\bgenre/.test(q))
    return { metric: 'most_played_genre' }
  if (/\bgenre\b.{0,16}\b(most|top)\b/.test(q)) return { metric: 'most_played_genre' }
  if (
    /\b(most[- ]?played|top|favou?rite).{0,12}\bartist/.test(q) ||
    /\b(which|what) artist do i play/.test(q)
  )
    return { metric: 'most_played_artist' }

  // ── percentages ────────────────────────────────────────────────────────
  if (/\bpercentage|how much\b/.test(q) && /\bkey[- ]?analy/.test(q))
    return { metric: 'pct_key_analyzed' }
  if (
    /\b(what )?percentage of my library do i (actually )?play/.test(q) ||
    /how much of my library do i (actually )?play/.test(q) ||
    (/\bpercentage|what %|what percent/.test(q) && /\bplay/.test(q))
  )
    return { metric: 'pct_played' }
  if (/\b(electronic).{0,12}(vs|versus|non[- ]?electronic)/.test(q))
    return { metric: 'electronic_split' }

  // ── keys / labels / genres breakdowns ────────────────────────────────────
  if (
    /\b(breakdown|distribution|how many).{0,16}\bkeys?\b/.test(q) ||
    /\bkeys?\b.{0,16}\bbreakdown/.test(q)
  )
    return { metric: 'key_breakdown' }
  if (/\b(most common|commonest|top) key/.test(q) || /\bkey.{0,12}most common/.test(q))
    return { metric: 'most_common_key' }
  if (/\bwhat (labels|labels are)|labels (are )?in my (collection|library)|which labels/.test(q))
    return { metric: 'label_distribution' }
  if (/\bwhat genres|genres (are )?in my (collection|library)|which genres/.test(q))
    return { metric: 'genre_distribution' }
  if (/\b(most )?niche genre|rarest genre|smallest genre/.test(q)) return { metric: 'niche_genre' }
  if (/\bhow much\b.{0,16}\b(music|do i have)\b/.test(q)) {
    const genre = findGenre(q)
    if (genre) return { metric: 'genre_count', genre }
  }

  // ── library size / duration / bpm ────────────────────────────────────────
  if (
    /\bhow big is my (library|collection)|library size|how many tracks (do i have|are in)/.test(q)
  )
    return { metric: 'library_size' }
  // "what's in my library?" (summary) — but NOT "...that sounds like X" (similarity).
  if (
    (/\bwhat'?s in my (library|collection)\b/.test(q) &&
      !/\b(sound|like|similar|vibe|remind|that)\b/.test(q)) ||
    /summar(y|ise|ize) my (library|collection)/.test(q)
  )
    return { metric: 'library_size' }
  if (/\btotal (duration|length|playtime|run.?time)|how (long|much music)|total.*hours/.test(q))
    return { metric: 'total_duration' }
  if (/\baverage bpm|avg bpm|mean bpm|typical bpm/.test(q)) return { metric: 'avg_bpm' }

  // ── time-scoped ──────────────────────────────────────────────────────────
  if (/\blistening stats|stats for (this|the) (month|week)|my (month|week).*stats/.test(q))
    return { metric: 'listening_month' }
  if (/how many tracks.*\badded\b|\badded\b.*(past|last)\s*\d*\s*(week|month|months|year)/.test(q))
    return { metric: 'added_recently_count' }
  if (/\b(most productive|busiest).{0,16}(import|month)|productive importing month/.test(q))
    return { metric: 'productive_month' }
  // Only the COUNT form ("how many gigs") — the LIST form ("show me my gigs")
  // is handled by the gig-history detector.
  if (/how many gigs/.test(q)) return { metric: 'gigs_this_year' }

  // ── trends (honest about limited range) ──────────────────────────────────
  if (/\bbpm\b.*(over time|changed|trend|history)/.test(q)) return { metric: 'bpm_over_time' }
  if (/\bmy peak hour|what time.*(play|biggest)|time of day.*play/.test(q))
    return { metric: 'peak_hour' }
  if (/genre (preferences|tastes?).*(shift|chang|over)|how.*genre.*(shift|chang)/.test(q))
    return { metric: 'genre_shift' }

  return null
}
