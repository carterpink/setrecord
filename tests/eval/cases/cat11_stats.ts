/** Category 11 · Stats & Analytics (146–157). */
import type { EvalCase } from '../types'

/** True when a result is a stats/analytics answer with at least one row. */
function hasStats(r: import('../types').EngineResult): boolean {
  return r.kind === 'stats' && (r.stats?.length ?? 0) > 0
}
/** True when a result is a stats answer or a single numeric count. */
function statsOrCount(r: import('../types').EngineResult): boolean {
  return hasStats(r) || r.count != null
}
/** True when any stats label/value (or the narration) mentions a substring. */
function mentions(r: import('../types').EngineResult, re: RegExp): boolean {
  if (re.test(r.narration)) return true
  return (r.stats ?? []).some((s) => re.test(s.label) || re.test(s.value))
}

export const cat11: EvalCase[] = [
  {
    id: '146',
    category: 'Stats & Analytics',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "what's my most played genre?",
    passWhen:
      'Aggregates play events by genre. Returns the top genre with total play count and percentage of all plays.',
    // Tech House dominates plays (topplay1 playCount 99 + fisher1 12 + others) → top genre.
    check: (r) =>
      (hasStats(r) && mentions(r, /tech\s*house/i) && mentions(r, /%|percent/i)) ||
      'should return top genre (Tech House) with play count and percentage'
  },
  {
    id: '147',
    category: 'Stats & Analytics',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me my listening stats for this month',
    passWhen:
      'Returns: total tracks played, total play time, most played track, and most played genre — all scoped to the current calendar month.',
    // Scoped to ctx.now's calendar month; expect a multi-row stats answer.
    check: (r) =>
      (hasStats(r) && (r.stats?.length ?? 0) >= 2) ||
      'should return month-scoped listening stats (tracks/play time/top track/top genre)'
  },
  {
    id: '148',
    category: 'Stats & Analytics',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'which artist do I play the most?',
    passWhen: 'Aggregates play_count by artist. Returns the top artist with total play count.',
    // Fisher leads: topplay1 (99) + fisher1 (12) + fisher2 (7) + fisher3 (3) ≫ any other artist.
    check: (r) =>
      (hasStats(r) && mentions(r, /fisher/i)) ||
      'should return top artist (Fisher) with total play count'
  },
  {
    id: '149',
    category: 'Stats & Analytics',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'how has my BPM range changed over time?',
    passWhen:
      'Groups sets or sessions by month. Shows average BPM per month as a trend. If data doesn’t span long enough, states the available range honestly.',
    // Sessions exist but span < a long range — accept a per-month BPM trend OR an honest limited-range statement.
    check: (r) =>
      hasStats(r) ||
      mentions(r, /bpm|range|month|limited|only|since|available/i) ||
      'should show a per-month BPM trend or honestly state the limited range'
  },
  {
    id: '150',
    category: 'Stats & Analytics',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me my peak hour — what time do I usually play my biggest tracks?',
    passWhen:
      'Analyzes play sessions by time-of-day. Correlates with high-energy tracks. Returns the most common time window for peak-energy plays. Requires session timestamp data — states if unavailable.',
    // Sessions have dates but no time-of-day timestamps — accept a stats answer OR an honest "unavailable" limitation.
    check: (r) =>
      hasStats(r) ||
      r.kind === 'empty' ||
      mentions(r, /hour|time|peak|unavailable|no.*timestamp|don’t|not.*track/i) ||
      'should return a peak-hour window or honestly state timestamp data is unavailable'
  },
  {
    id: '151',
    category: 'Stats & Analytics',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what percentage of my library do I actually play?',
    passWhen:
      'Returns (tracks with play_count > 0) / total track count as a percentage. Shows both raw numbers.',
    check: (r) =>
      (statsOrCount(r) && mentions(r, /%|percent/i)) ||
      'should return percentage of library played with raw numbers'
  },
  {
    id: '152',
    category: 'Stats & Analytics',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'how many tracks have I added to my library in the past 6 months?',
    passWhen: 'Filters date_added >= 6 months ago. Returns count. Optionally breaks down by month.',
    // Ground truth: recent1 (added ~2 days ago) is the only track with dateAdded within 6 months of ctx.now.
    check: (r, ctx) => {
      const cutoff = new Date(ctx.now)
      cutoff.setMonth(cutoff.getMonth() - 6)
      const want = ctx.tracks.filter(
        (t) => t.phantom !== true && new Date(t.dateAdded).getTime() >= cutoff.getTime()
      ).length
      if (r.count != null) return r.count === want || `expected count ${want}, got ${r.count}`
      return hasStats(r) || 'should return a count of tracks added in the past 6 months'
    }
  },
  {
    id: '153',
    category: 'Stats & Analytics',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "what's my most productive importing month?",
    passWhen:
      'Groups date_added by month. Returns the month with the highest import count with the count shown.',
    // Most tracks default dateAdded to 2024-01-01 → January 2024 is the busiest import month.
    check: (r) =>
      (hasStats(r) && mentions(r, /jan|2024|01/i)) ||
      'should return the busiest import month with its count'
  },
  {
    id: '154',
    category: 'Stats & Analytics',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me how my genre preferences have shifted over 2 years',
    passWhen:
      'Groups play events by month and genre. Describes or displays the trend of which genres were most played per period. If data doesn’t go back 2 years, reports what range is available.',
    // Play history doesn't span 2 years — accept a per-period genre trend OR an honest available-range statement.
    check: (r) =>
      hasStats(r) ||
      mentions(r, /genre|month|year|trend|range|available|only|since|don’t|not.*go.*back/i) ||
      'should show a per-period genre trend or honestly report the available range'
  },
  {
    id: '155',
    category: 'Stats & Analytics',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "what's the total duration of my library?",
    passWhen:
      'Sums duration of all tracks. Returns total in hours and minutes. Shows total track count.',
    check: (r) =>
      (statsOrCount(r) && mentions(r, /hour|hr|h\b|min|minute/i)) ||
      'should return total library duration in hours and minutes with track count'
  },
  {
    id: '156',
    category: 'Stats & Analytics',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'how many gigs have I played this year?',
    passWhen: 'Counts distinct play sessions where year = current year. Returns count.',
    // Ground truth: 6 sessions this year (all except s-marathon, which is lastYear-12-31).
    check: (r, ctx) => {
      const year = ctx.now.getFullYear()
      const want = ctx.sessions.filter((s) => new Date(s.performedAt).getFullYear() === year).length
      if (r.count != null)
        return r.count === want || `expected ${want} gigs this year, got ${r.count}`
      return hasStats(r) || 'should count sessions performed this year (6)'
    }
  },
  {
    id: '157',
    category: 'Stats & Analytics',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me a breakdown of keys in my library',
    passWhen:
      'Returns count per key across all 24 major/minor keys. Sorted by count. Presented as a list or described clearly.',
    // 8A is the most common key in the fixture world → a per-key breakdown with multiple rows.
    check: (r) =>
      (hasStats(r) && (r.stats?.length ?? 0) >= 2 && mentions(r, /8A|key/i)) ||
      'should return a per-key breakdown sorted by count'
  }
]
