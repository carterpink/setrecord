/**
 * venueIntent.ts — pure detector for crowd/venue-context recommendations that
 * map to an energy band, plus "what did I play last time at <venue-type>".
 * Compute in electron/algorithms/memory/venue.ts.
 */

export type VenueMetric =
  | 'bar' // 171 — small bar, lower energy
  | 'corporate' // 176 — safe, mid energy
  | 'daytime_outdoor' // 175 — lighter, daytime
  | 'last_at_venue' // 173 — last time at a warehouse/etc.

export interface VenueHit {
  metric: VenueMetric
  venue?: string
}

export function detectVenue(raw: string): VenueHit | null {
  const q = raw.toLowerCase().trim()

  // "what did I play the last time I was at a warehouse party?"
  const m = q.match(
    /last time .*(?:at|in) (?:a |an |the )?([a-z][a-z\s]{2,20}?)(?:\s+(?:party|night|gig|rave))?\??$/
  )
  if (/last time/.test(q) && /\b(play|played|at|warehouse|club|bar|festival|rave)\b/.test(q) && m) {
    return { metric: 'last_at_venue', venue: m[1].trim() }
  }

  if (
    /\bsmall bar|playing a bar|a bar with \d+|bar with \d+ people|tiny (bar|room)|30 people/.test(q)
  )
    return { metric: 'bar' }
  if (/\bcorporate (event|gig|party|do|function)|keep it safe|safe (set|selection)/.test(q))
    return { metric: 'corporate' }
  if (
    /\boutdoors?\b.*\bday(time)?\b|day(time)?\b.*\boutdoors?\b|daytime (festival|crowd|party)|in the sun/.test(
      q
    )
  )
    return { metric: 'daytime_outdoor' }

  return null
}
