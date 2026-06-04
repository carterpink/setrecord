/**
 * venue.ts — pure crowd/venue-context recommendations.
 */

import type { Track } from '../../../src/types'
import type { VenueHit } from '../../../src/utils/venueIntent'

export interface VenueSession {
  id: string
  performedAt: string
  venue?: string
  trackIds: string[]
}

export interface VenueAnswer {
  kind: 'tracks' | 'gig' | 'empty'
  tracks?: Track[]
  sessionIds?: string[]
  narration: string
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}

export function computeVenue(
  hit: VenueHit,
  tracksIn: Track[],
  sessions: VenueSession[],
  now: Date
): VenueAnswer {
  const tracks = real(tracksIn)

  if (hit.metric === 'last_at_venue') {
    const v = (hit.venue ?? '').toLowerCase()
    const match = sessions
      .filter((s) => new Date(s.performedAt).getTime() <= now.getTime())
      .filter(
        (s) =>
          (s.venue ?? '').toLowerCase().includes(v) ||
          v.includes((s.venue ?? '').toLowerCase().split(' ')[0])
      )
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]
    if (!match)
      return { kind: 'empty', narration: `No session matching "${hit.venue}" in your history.` }
    const byId = new Map(tracks.map((t) => [t.id, t]))
    const out = match.trackIds.map((id) => byId.get(id)).filter((t): t is Track => !!t)
    return {
      kind: 'gig',
      tracks: out,
      sessionIds: [match.id],
      narration: `What you played at ${match.venue} on ${match.performedAt}.`
    }
  }

  const band: Record<string, { max: number; note: string }> = {
    bar: {
      max: 6,
      note: 'Lower-energy, mid-tempo tracks for a small bar — warm the room, don’t blast it.'
    },
    corporate: {
      max: 7,
      note: 'Safe, mid-energy, broadly accessible tracks for a corporate crowd — nothing too heavy.'
    },
    daytime_outdoor: { max: 7, note: 'Lighter, melodic tracks for a daytime outdoor crowd.' }
  }
  const cfg = band[hit.metric]
  const out = tracks
    .filter((t) => t.energy <= cfg.max && t.bpm > 0)
    .sort((a, b) => a.energy - b.energy)
  return {
    kind: out.length ? 'tracks' : 'empty',
    tracks: out.slice(0, 20),
    narration: out.length ? cfg.note : 'No tracks fit that brief.'
  }
}
