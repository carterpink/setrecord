/** Category 5 · Gig History & Recall (075–086). */
import type { EvalCase } from '../types'
import type { EngineResult, FixtureSession } from '../types'
import { ids, isHonestEmpty } from './helpers'

/** Sessions returned by a gig answer (kind 'gig'). */
function sessionsOf(r: EngineResult): FixtureSession[] {
  return r.sessions ?? []
}
function sessionIds(r: EngineResult): string[] {
  return sessionsOf(r).map((s) => s.id)
}
/** True when narration mentions an ISO-ish or numeric date. */
function mentionsDate(narration: string): boolean {
  return /\d{4}-\d{2}-\d{2}/.test(narration) || /\b\d{1,2}\b/.test(narration)
}

export const cat05: EvalCase[] = [
  {
    id: '075',
    category: 'Gig History & Recall',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'what did I play last Saturday?',
    passWhen:
      'Queries play sessions for the most recent Saturday date. Returns tracks played in that session. If no session was recorded, states so.',
    check: (r) => {
      const expectTracks = ['fisher1', 'bicep1', 'body2', 'dc1']
      if (r.kind === 'gig' && sessionIds(r).includes('s-lastsat')) return true
      const got = ids(r)
      const matches = expectTracks.every((id) => got.includes(id))
      return (
        matches ||
        "should return last Saturday's session (s-lastsat) or its tracklist [fisher1,bicep1,body2,dc1]"
      )
    }
  },
  {
    id: '076',
    category: 'Gig History & Recall',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me all my gigs this year',
    passWhen:
      'Returns play sessions where year = current year. Sorted by date. Venue and date shown for each.',
    check: (r, ctx) => {
      if (r.kind !== 'gig') return "should return gigs (kind 'gig')"
      const sess = sessionsOf(r)
      if (sess.length === 0) return 'should return this-year sessions'
      const year = ctx.now.getFullYear()
      const allThisYear = sess.every((s) => new Date(s.performedAt).getFullYear() === year)
      const excludesMarathon = !sessionIds(r).includes('s-marathon')
      return (
        (allThisYear && excludesMarathon) ||
        'should return only current-year sessions (excluding last-year s-marathon)'
      )
    }
  },
  {
    id: '077',
    category: 'Gig History & Recall',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what songs did I play at Hi Ibiza?',
    passWhen:
      'Queries gig metadata where venue matches "Hi Ibiza" (case-insensitive). Returns all tracks from those sessions grouped by date.',
    check: (r) => {
      const expectTracks = ['fisher1', 'fisher2', 'mau5a', 'dc1', 'body2']
      if (r.kind === 'gig') {
        const sess = sessionsOf(r)
        const venueOk =
          sess.length > 0 && sess.every((s) => (s.venue ?? '').toLowerCase().includes('hi ibiza'))
        if (venueOk && sessionIds(r).includes('s-hi')) return true
      }
      const got = ids(r)
      const matches = expectTracks.every((id) => got.includes(id))
      return (
        matches ||
        'should return the Hi Ibiza session (s-hi) tracks [fisher1,fisher2,mau5a,dc1,body2]'
      )
    }
  },
  {
    id: '078',
    category: 'Gig History & Recall',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'when did I last play Surgeon - Magneze?',
    passWhen:
      'Returns the last_played date for that specific track. If never played, states "No play history found for this track."',
    check: (r) => {
      // surgeon1 was played in s-fabric1, s-warehouse, s-marathon — a date answer is expected.
      if (r.kind === 'gig') return true
      return (
        mentionsDate(r.narration) ||
        'should return a last-played date for Surgeon - Magneze (surgeon1)'
      )
    }
  },
  {
    id: '079',
    category: 'Gig History & Recall',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'how many times have I played Speedy J - De-orbit?',
    passWhen:
      'Returns the play_count for that track. If the track is not in the library, states so.',
    check: (r, ctx) => {
      // speedy1 has playCount 4.
      const want = ctx.byId.get('speedy1')?.playCount ?? 4
      if (r.count === want) return true
      return (
        new RegExp(`\\b${want}\\b`).test(r.narration) ||
        `should report play count ${want} for Speedy J - De-orbit (speedy1)`
      )
    }
  },
  {
    id: '080',
    category: 'Gig History & Recall',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me my longest set ever',
    passWhen:
      'Queries all play sessions. Calculates duration per session. Returns the longest one with date, venue, and duration.',
    check: (r) => {
      if (r.kind !== 'gig') return "should return a gig answer (kind 'gig')"
      const sess = sessionsOf(r)
      const onlyMarathon = sess.length >= 1 && sessionIds(r).includes('s-marathon')
      return onlyMarathon || 'should return the longest set (s-marathon, 6h, 16 tracks)'
    }
  },
  {
    id: '081',
    category: 'Gig History & Recall',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'what venues have I played?',
    passWhen:
      'Returns distinct venue values from play sessions. Shows visit count per venue. Sorted by frequency descending.',
    check: (r) => {
      const expected = ['the cause', 'hi ibiza', 'fabric', 'warehouse project', 'lost village']
      if (r.kind === 'stats') {
        const blob = (r.stats ?? [])
          .map((s) => `${s.label} ${s.value}`)
          .join(' ')
          .toLowerCase()
        const all = expected.every((v) => blob.includes(v))
        return all || 'stats should list all distinct venues'
      }
      const blob = r.narration.toLowerCase()
      const all = expected.every((v) => blob.includes(v))
      return (
        all ||
        'should list distinct venues (The Cause, Hi Ibiza, Fabric, Warehouse Project, Lost Village)'
      )
    }
  },
  {
    id: '082',
    category: 'Gig History & Recall',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me tracks I played more than 3 times in the last year',
    passWhen:
      'Filters play events within the last 12 months. Groups by track. Returns only tracks with count > 3. Shows count per track.',
    check: (r, ctx) => {
      // "last 12 months" = a rolling window (matrix wording), not the calendar year.
      const cutoff = new Date(ctx.now)
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const counts = new Map<string, number>()
      for (const s of ctx.sessions) {
        if (new Date(s.performedAt).getTime() < cutoff.getTime()) continue
        for (const id of s.trackIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      const want = [...counts.entries()].filter(([, c]) => c > 3).map(([id]) => id)
      const got = ids(r)
      if (want.length === 0) {
        // No track is played >3× in-year — an honest empty is the correct answer.
        return isHonestEmpty(r) || got.length === 0 || 'should be empty when nothing qualifies'
      }
      const all = want.every((id) => got.includes(id))
      return all || `should return tracks played >3× in the last year (${want.join(',')})`
    }
  },
  {
    id: '083',
    category: 'Gig History & Recall',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'what was my setlist for my birthday gig in March?',
    passWhen:
      'Queries play sessions in March of the most recent year. Returns the closest matching session. If multiple March sessions exist, lists all of them for the user to choose.',
    check: (r) => {
      const expectTracks = ['surgeon1', 'plastik1', 'dc2', 'speedy1', 'orbital1']
      if (r.kind === 'gig' && sessionIds(r).includes('s-fabric1')) return true
      const got = ids(r)
      const matches = expectTracks.every((id) => got.includes(id))
      return (
        matches ||
        'should return the March birthday gig (s-fabric1) setlist [surgeon1,plastik1,dc2,speedy1,orbital1]'
      )
    }
  },
  {
    id: '084',
    category: 'Gig History & Recall',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'which tracks have I never repeated at the same venue?',
    passWhen:
      'Cross-references track plays with venue. Identifies tracks that appear exactly once per venue across all sessions. If this is too complex to compute exactly, returns an approximation and states that clearly.',
    check: (r, ctx) => {
      // Tracks that never appear twice at the same venue (count <= 1 per venue everywhere).
      const perVenue = new Map<string, Map<string, number>>() // trackId -> venue -> count
      for (const s of ctx.sessions) {
        const venue = (s.venue ?? '').toLowerCase()
        for (const id of s.trackIds) {
          const m = perVenue.get(id) ?? new Map<string, number>()
          m.set(venue, (m.get(venue) ?? 0) + 1)
          perVenue.set(id, m)
        }
      }
      const neverRepeated = [...perVenue.entries()]
        .filter(([, m]) => [...m.values()].every((c) => c <= 1))
        .map(([id]) => id)
      // Approximation is explicitly acceptable per the matrix. Accept a non-empty,
      // correct-direction track list or an honest "approximate/too complex" note.
      const got = ids(r)
      if (got.length > 0) {
        const allValid = got.every((id) => neverRepeated.includes(id))
        return allValid || 'returned tracks that were in fact repeated at a venue'
      }
      return (
        isHonestEmpty(r) ||
        /approximat|complex|estimate/i.test(r.narration) ||
        'should return never-repeated-at-venue tracks or state the approximation'
      )
    }
  },
  {
    id: '085',
    category: 'Gig History & Recall',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me my most recent import',
    passWhen:
      'Returns the most recently added track(s) by date_added. If a batch was imported at the same time, returns all tracks from that batch.',
    check: (r) => {
      // recent1 was added 2 days ago — the newest dateAdded in the world.
      const got = ids(r)
      if (got.length === 0) return 'should return the most recent import (recent1)'
      return got.includes('recent1') || 'should return recent1 (newest dateAdded)'
    }
  },
  {
    id: '086',
    category: 'Gig History & Recall',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "what's my average set length?",
    passWhen:
      'Averages session durations across all recorded play sessions. Returns the mean in hours and minutes. Shows the number of sessions used in the calculation.',
    check: (r, ctx) => {
      const durs = ctx.sessions.map((s) => s.durationSec ?? 0).filter((d) => d > 0)
      const meanSec = durs.reduce((a, b) => a + b, 0) / durs.length
      const meanHours = meanSec / 3600
      if (r.kind === 'stats' || r.count != null) {
        // Mean is ~2.6h. Accept any stats/count answer that reflects a duration figure.
        const blob =
          (r.stats ?? []).map((s) => `${s.label} ${s.value}`).join(' ') +
          ' ' +
          r.narration +
          ' ' +
          (r.count != null ? String(r.count) : '')
        const roundedH = Math.round(meanHours)
        return (
          new RegExp(`\\b${roundedH}\\b`).test(blob) ||
          /\d\s*h(?:rs?|ours?)?\b|\d\s*m(?:in)?\b|hour|min/i.test(blob) ||
          'should report a mean set duration and the session count'
        )
      }
      return "should return an average set length (kind 'stats' or a count)"
    }
  }
]
