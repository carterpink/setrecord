/** Category 8 · Genre & Style (114–125). */
import type { Track } from '../../../src/types'
import type { EngineResult, EvalCase, EvalCtx } from '../types'
import { countOf, everyTrack, isHonestEmpty, nonEmptyTracks, tracksOf } from './helpers'

/** Case-insensitive genre containment, safe for undefined genres. */
function genreHas(t: Track, needle: string): boolean {
  return (t.genre ?? '').toLowerCase().includes(needle.toLowerCase())
}

/** True when the result is a stats/count answer carrying a usable metric. */
function isStatsLike(r: EngineResult): boolean {
  return (
    (r.kind === 'stats' && (r.stats?.length ?? 0) > 0) || (r.kind === 'count' && r.count != null)
  )
}

/** Concatenated text of a stats result (labels + values) plus narration. */
function statsText(r: EngineResult): string {
  const parts = (r.stats ?? []).flatMap((s) => [s.label, s.value])
  return `${parts.join(' ')} ${r.narration}`.toLowerCase()
}

/** Distinct, non-empty genres present in the (non-phantom) world. */
function genreCounts(ctx: EvalCtx): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of ctx.tracks) {
    if (t.phantom === true) continue
    const g = t.genre
    if (!g) continue
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

export const cat08: EvalCase[] = [
  {
    id: '114',
    category: 'Genre & Style',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me all my techno tracks',
    passWhen: 'Filters genre containing "techno" (case-insensitive). Returns list with count.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => genreHas(t, 'techno'))) ||
      'every track genre should contain "techno"'
  },
  {
    id: '115',
    category: 'Genre & Style',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'how much house music do I have?',
    passWhen:
      'Returns the count of tracks where genre contains "house". Shows percentage of total library.',
    check: (r, ctx) => {
      if (!isStatsLike(r)) return 'should answer with a count/stats metric'
      const houseCount = ctx.tracks.filter((t) => t.phantom !== true && genreHas(t, 'house')).length
      const text = r.kind === 'count' ? `${r.count} ${r.narration}`.toLowerCase() : statsText(r)
      const hasCount = r.count === houseCount || text.includes(String(houseCount))
      const hasPercent = /%|percent/.test(text)
      return (hasCount && hasPercent) || 'should show house count and percentage of total'
    }
  },
  {
    id: '116',
    category: 'Genre & Style',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find tracks that cross between techno and ambient',
    passWhen:
      'Searches for tracks tagged or genre-matched as both, or known crossover genres like "ambient techno" or "industrial ambient". Returns candidates.',
    check: (r) => {
      // Lenient: a crossover candidate list, OR an honest zero. Don't accept an
      // unrelated dump — any returned track should touch techno or ambient.
      if (isHonestEmpty(r)) return true
      // True crossover: each returned track must touch BOTH styles (the fixture
      // has none, so honest-empty is the correct answer). A plain techno dump fails.
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => genreHas(t, 'techno') && genreHas(t, 'ambient'))) ||
        'crossover candidates must touch both techno AND ambient, or honestly return none'
      )
    }
  },
  {
    id: '117',
    category: 'Genre & Style',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'what genres are in my collection?',
    passWhen:
      'Returns distinct genre values with track count per genre. Sorted by count descending. No duplicates.',
    check: (r) => {
      if (r.kind !== 'stats' || (r.stats?.length ?? 0) === 0)
        return 'should list distinct genres with counts (stats)'
      const labels = (r.stats ?? []).map((s) => s.label.toLowerCase().trim())
      const distinct = new Set(labels)
      if (distinct.size !== labels.length) return 'genre list should have no duplicates'
      const hasCounts = (r.stats ?? []).every((s) => /\d/.test(s.value))
      return hasCounts || 'each genre should carry a track count'
    }
  },
  {
    id: '118',
    category: 'Genre & Style',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'I want classic Detroit techno only',
    passWhen:
      'Filters genre = "detroit techno" or tags = "detroit". Considers known Detroit labels (Transmat, KMS, Underground Resistance) if label data is present. Optional year filter 1987–1995. Returns list.',
    check: (r) => {
      const detroitLabels = ['transmat', 'kms', 'underground resistance']
      return (
        (nonEmptyTracks(r) &&
          everyTrack(
            r,
            (t) =>
              genreHas(t, 'detroit techno') ||
              detroitLabels.some((l) => (t.label ?? '').toLowerCase().includes(l))
          )) ||
        'should return only Detroit techno (genre or Detroit-label) tracks'
      )
    }
  },
  {
    id: '119',
    category: 'Genre & Style',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find me some UK garage',
    passWhen:
      'Filters genre containing "UK garage" or "2-step". Returns results. If none found, responds "No UK garage found in your library" — does not substitute another genre.',
    check: (r) => {
      if (isHonestEmpty(r)) return true
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => genreHas(t, 'garage') || genreHas(t, '2-step'))) ||
        'should return only UK garage / 2-step tracks, or an honest zero'
      )
    }
  },
  {
    id: '120',
    category: 'Genre & Style',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me all minimal tracks',
    passWhen:
      'Filters genre or tags containing "minimal". Returns list. If "minimal" is not a genre in the library, checks tags before returning empty.',
    check: (r) => {
      if (isHonestEmpty(r)) return true
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => genreHas(t, 'minimal'))) ||
        'should return only minimal tracks, or an honest zero'
      )
    }
  },
  {
    id: '121',
    category: 'Genre & Style',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "what's the most niche genre in my collection?",
    passWhen:
      'Returns the genre with the lowest track count (minimum 2 tracks to qualify). Shows the genre name and those tracks.',
    check: (r, ctx) => {
      const counts = genreCounts(ctx)
      const qualifying = [...counts.values()].filter((n) => n >= 2)
      if (qualifying.length === 0) return 'fixture has no genre with >=2 tracks'
      const minCount = Math.min(...qualifying)
      // The narration/stats should name a genre whose count is the minimum (>=2),
      // and the returned tracks should all share one such genre.
      const ts = tracksOf(r)
      if (ts.length === 0) return 'should surface the niche genre and its tracks'
      const g = (ts[0].genre ?? '').toLowerCase()
      if (!g) return 'returned tracks should carry a genre'
      const allSame = ts.every((t) => (t.genre ?? '').toLowerCase() === g)
      if (!allSame) return 'all returned tracks should share the niche genre'
      const thatCount = counts.get(ts[0].genre ?? '') ?? 0
      return (
        (thatCount >= 2 && thatCount === minCount) ||
        `niche genre should have the minimum qualifying count (${minCount}), got ${thatCount}`
      )
    }
  },
  {
    id: '122',
    category: 'Genre & Style',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find tracks that blend deep house and jazz',
    passWhen:
      'Searches for tags containing both "deep house" and "jazz", or known sub-genres like "jazz house". Returns candidates.',
    check: (r) => {
      // Lenient crossover: honest zero is acceptable (no jazz-house in fixture),
      // otherwise candidates should relate to deep house and/or jazz.
      if (isHonestEmpty(r)) return true
      // True blend: each track must touch BOTH deep house AND jazz (none in the
      // fixture → honest-empty is correct). A plain house dump fails.
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => genreHas(t, 'house') && genreHas(t, 'jazz'))) ||
        'blend candidates must touch both deep house AND jazz, or honestly return none'
      )
    }
  },
  {
    id: '123',
    category: 'Genre & Style',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'how much of my library is electronic vs non-electronic?',
    passWhen:
      'Attempts a genre-based split. Non-electronic includes folk, rock, classical, hip-hop (non-electronic). Returns a percentage split. Notes the approximation if genre tagging is inconsistent.',
    check: (r) => {
      if (r.kind !== 'stats' || (r.stats?.length ?? 0) === 0)
        return 'should return a genre-based split (stats)'
      const text = statsText(r)
      const hasPercent = /%|percent/.test(text)
      const hasSplit = /electronic/.test(text)
      return (
        (hasPercent && hasSplit) || 'should show an electronic vs non-electronic percentage split'
      )
    }
  },
  {
    id: '124',
    category: 'Genre & Style',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me all my acid tracks',
    passWhen:
      'Filters genre or tags containing "acid", "acid house", or "acid techno". Returns list.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => genreHas(t, 'acid'))) ||
      'every track genre should contain "acid"'
  },
  {
    id: '125',
    category: 'Genre & Style',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find breakbeat tracks in my collection',
    passWhen:
      'Filters genre containing "breakbeat", "breaks", or "UK breaks". Returns list with count.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => genreHas(t, 'breakbeat') || genreHas(t, 'break'))) ||
      'every track genre should contain "breakbeat" / "breaks"'
  }
]

// Silence unused-count helper note: countOf retained for parity with sibling files.
void countOf
