/** Category 3 · Transitions (039–054). */
import type { EvalCase } from '../types'
import { countOf, everyTrack, ids, isHonestEmpty, nonEmptyTracks, someTrack } from './helpers'

/** Camelot-compatible neighbours of a key (same / ±1 / relative major-minor). */
function camelotCompatible(key: string): string[] {
  const m = /^(\d{1,2})([AB])$/.exec(key)
  if (!m) return [key]
  const n = Number(m[1])
  const ab = m[2]
  const wrap = (x: number): number => ((x - 1 + 12) % 12) + 1
  const other = ab === 'A' ? 'B' : 'A'
  return [`${n}${ab}`, `${wrap(n - 1)}${ab}`, `${wrap(n + 1)}${ab}`, `${n}${other}`]
}

export const cat03: EvalCase[] = [
  {
    id: '039',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'what can I play after Bicep - Glue?',
    passWhen:
      'Finds Bicep - Glue in the library. Returns harmonically and BPM-compatible suggestions from the library. Shows the key and BPM match reasoning for each suggestion.',
    // bicep1: bpm 128, key 8A. Suggestions should be key-compatible (8A/7A/9A/8B)
    // and BPM-close, drawn from the library, and exclude the seed itself.
    check: (r) => {
      const seedFound = r.sourceTrack?.id === 'bicep1' || someTrack(r, (t) => t.id === 'bicep1')
      if (!seedFound && !nonEmptyTracks(r)) return 'should find Bicep - Glue as the seed'
      if (!nonEmptyTracks(r)) return 'should return compatible suggestions'
      const compatKeys = camelotCompatible('8A')
      return (
        (everyTrack(r, (t) => t.id !== 'bicep1') &&
          everyTrack(r, (t) => compatKeys.includes(t.key) && Math.abs(t.bpm - 128) <= 6)) ||
        'suggestions should be key- and BPM-compatible with Bicep - Glue (128/8A)'
      )
    }
  },
  {
    id: '040',
    category: 'Transitions',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'how do I transition from 128 BPM to 140 BPM?',
    passWhen:
      "Explains gradual BPM ramping over multiple tracks, using energy builds and breakdowns. Mentions typical 4–8 bar mixing approach. Does not recommend specific tracks not in the user's library.",
    check: (r) => {
      if (r.kind !== 'knowledge') return 'should answer from the DJ-theory KB (kind=knowledge)'
      const n = r.narration.toLowerCase()
      const ramp = /(ramp|gradual|step|incremental|over (multiple|several) tracks)/.test(n)
      const bars = /(4[\s-]?8|four|eight)\s*bar/.test(n) || /\bbars?\b/.test(n)
      return (ramp && bars) || 'should explain gradual BPM ramping over tracks and 4–8 bar mixing'
    }
  },
  {
    id: '041',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'suggest something to play between these two tracks: track A and track B',
    passWhen:
      'Returns "bridge" tracks from the library compatible with both A and B in key and BPM. Explains the compatibility for each suggestion.',
    // Underspecified seeds ("track A"/"track B") → either clarify, or return
    // genuine bridge candidates from the library (never fabricate).
    check: (r) =>
      r.kind === 'clarify' ||
      nonEmptyTracks(r) ||
      'should clarify which tracks, or return library bridge candidates'
  },
  {
    id: '042',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'what plays well after drum and bass in my collection?',
    passWhen:
      'Understands the genre and BPM context of DnB (~170 BPM). Suggests tracks that bridge DnB to a next genre (half-time technique noted). Returns candidates from library.',
    // DnB seed is body5 (174 BPM). Half-time bridge ≈ 85 BPM, so candidates are
    // either tempo-bridging tracks from the library or the half-time technique
    // is named in narration. Must return library candidates, not fabrications.
    check: (r) => {
      const mentionsHalftime = /half[\s-]?time/i.test(r.narration)
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => t.id !== 'body5')) ||
        mentionsHalftime ||
        'should return library candidates that bridge DnB (half-time technique)'
      )
    }
  },
  {
    id: '043',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'is it ok to mix F# into G?',
    passWhen:
      'Correctly identifies that G major (9B) and F# major (2B) are 5 positions apart on the Camelot wheel and are harmonically incompatible. Advises against a direct mix. Suggests routing via a compatible key instead.',
    check: (r) => {
      if (r.kind !== 'knowledge') return 'should answer from the DJ-theory KB (kind=knowledge)'
      const n = r.narration.toLowerCase()
      const incompatible = /(incompatible|not compatible|clash|avoid|against|don't|do not)/.test(n)
      const camelot = /camelot|9b|2b/.test(n)
      const reroute = /(route|via|through|bridge|compatible key|intermediate)/.test(n)
      return (
        (incompatible && camelot && reroute) ||
        'should call F#→G harmonically incompatible (Camelot 2B vs 9B) and suggest re-routing'
      )
    }
  },
  {
    id: '044',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me tracks that transition well out of a breakdown',
    passWhen:
      'Returns tracks with strong drops or high-energy entries. Notes that structural analysis may be approximate. Returns candidates and is transparent.',
    // High-energy entries → favour high-energy tracks. Transparency about
    // approximate structural analysis should appear in narration.
    check: (r) => {
      const transparent =
        /(approxim|estimate|may not|cannot|structural|rough|best[\s-]?effort)/i.test(r.narration)
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy >= 7) && transparent) ||
        'should return high-energy candidates and note analysis is approximate'
      )
    }
  },
  {
    id: '045',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: "what's the best way to drop from techno to house?",
    passWhen:
      'Explains the BPM difference (techno typically 130–138, house 120–128). Suggests techniques: half-time drop, breakdown swap, filter transition. Does not hallucinate specific track recommendations from the library.',
    check: (r) => {
      if (r.kind !== 'knowledge') return 'should answer from the DJ-theory KB (kind=knowledge)'
      const n = r.narration.toLowerCase()
      const bpm = /13[0-8]/.test(n) && /12[0-8]/.test(n)
      const technique = /(half[\s-]?time|breakdown|filter)/.test(n)
      const noTracks = countOf(r) === 0
      return (
        (bpm && technique && noTracks) ||
        'should explain techno↔house BPM ranges and techniques without recommending tracks'
      )
    }
  },
  {
    id: '046',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'find me an opener track from my collection',
    passWhen:
      'Returns lower-energy, lower-BPM tracks. Favours play_count = 0 (fresh). Shows energy level and BPM for each suggestion.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 6 && t.bpm > 0 && t.bpm <= 126)) ||
      'openers should be lower-energy, lower-BPM tracks'
  },
  {
    id: '047',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'what comes before Orbital - Halcyon in my set history?',
    passWhen:
      'Queries transition history to find what track most frequently preceded Orbital - Halcyon across recorded sessions. If no history exists for that track, states so.',
    // orbital1 is preceded by speedy1 (s-fabric1) and bicep1 (s-fabric2), 1× each.
    check: (r, ctx) => {
      const preceders = new Set<string>()
      for (const seq of ctx.sequences) {
        const i = seq.indexOf('orbital1')
        if (i > 0) preceders.add(seq[i - 1])
      }
      if (preceders.size === 0) return isHonestEmpty(r) || 'expected honest "no history" answer'
      // Answer should surface the actual preceders from history (speedy1, bicep1).
      const got = new Set([...ids(r), r.sourceTrack?.id].filter(Boolean) as string[])
      const overlaps = [...preceders].some((id) => got.has(id))
      return overlaps || 'should surface tracks that preceded Halcyon (speedy1 and/or bicep1)'
    }
  },
  {
    id: '048',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'suggest a closing track from my library',
    passWhen:
      'Returns melodic, emotional, or lower-energy tracks appropriate for a set ending. Does not return peak-time or high-BPM tracks as closers.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 6 && t.bpm <= 128)) ||
      'closers should be lower-energy, not peak-time / high-BPM tracks'
  },
  {
    id: '049',
    category: 'Transitions',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'can I mix 11B into 12B?',
    passWhen:
      'Correctly identifies 11B (A major) and 12B (E major) as adjacent on the Camelot wheel. Confirms yes — they are compatible. Gives a brief explanation.',
    check: (r) => {
      if (r.kind !== 'knowledge') return 'should answer from the DJ-theory KB (kind=knowledge)'
      const n = r.narration.toLowerCase()
      const yes = /(yes|compatible|works|adjacent|safe)/.test(n)
      const adjacency = /(adjacent|next to|one (step|position)|\+1|neighbou?r)/.test(n)
      return (
        (yes && adjacency) || 'should confirm 11B→12B is compatible (adjacent on the Camelot wheel)'
      )
    }
  },
  {
    id: '050',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'what tracks bridge minimal techno and melodic house in my collection?',
    passWhen:
      'Identifies tracks tagged or genre-matched to both styles, or known crossover genres. Returns candidates with genre and energy attributes visible.',
    // Crossover genres present: Minimal (villa1), Progressive House (sasha*, mau5a,
    // left1, body7), House (caribou*, etc.). Candidates should be genre-matched.
    check: (r) => {
      const bridgeGenres = [
        'minimal',
        'progressive house',
        'melodic house',
        'house',
        'techno',
        'tech house'
      ]
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => bridgeGenres.includes((t.genre ?? '').toLowerCase()))) ||
        'should return genre-matched crossover candidates between minimal techno and melodic house'
      )
    }
  },
  {
    id: '051',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me my most-used transition pairs',
    passWhen:
      'Queries transition history. Returns top N [track A → track B] pairs by frequency. If no transition history exists, states so clearly.',
    // Adjacent pairs across all sessions exist (e.g. fisher1→bicep1, plastik1→surgeon1
    // is not adjacent but surgeon1→plastik1 in s-fabric1, etc.), so a non-empty
    // pair answer is expected — kind 'sequences' or stats listing pairs.
    check: (r, ctx) => {
      const pairs = new Set<string>()
      for (const seq of ctx.sequences) {
        for (let i = 0; i + 1 < seq.length; i++) pairs.add(`${seq[i]}->${seq[i + 1]}`)
      }
      if (pairs.size === 0) return isHonestEmpty(r) || 'expected honest "no history" answer'
      const hasPairs =
        r.kind === 'sequences' ||
        (r.kind === 'stats' && (r.stats?.length ?? 0) > 0) ||
        nonEmptyTracks(r)
      return hasPairs || 'should return top track→track transition pairs from history'
    }
  },
  {
    id: '052',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "find tracks I've used as a warm-up in the last 6 months",
    passWhen:
      'Queries play sessions where track appeared early in the set order, within a 6-month window. Returns list. If session position data is unavailable, states the limitation.',
    // Warm-up = first/second track in sessions within the last 6 months.
    check: (r, ctx) => {
      const cutoff = new Date(ctx.now)
      cutoff.setMonth(cutoff.getMonth() - 6)
      const warmups = new Set<string>()
      for (const s of ctx.sessions) {
        if (new Date(s.performedAt).getTime() < cutoff.getTime()) continue
        for (const id of s.trackIds.slice(0, 2)) warmups.add(id)
      }
      if (warmups.size === 0) return isHonestEmpty(r) || 'expected honest limitation/empty'
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => warmups.has(t.id))) ||
        'should return only tracks played early in recent (≤6mo) sessions'
      )
    }
  },
  {
    id: '053',
    category: 'Transitions',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'what tracks in my collection have a good acapella intro?',
    passWhen:
      'Acknowledges it cannot reliably detect acapella intros from audio metadata alone unless they are tagged. Suggests a tagging approach for the user. Does not fabricate a list of tracks with acapellas.',
    // No track has tags/acapella metadata → must be honest, not fabricate a list.
    check: (r) => {
      if (countOf(r) > 0) return 'should not fabricate a list of acapella tracks'
      const limit = /(cannot|can't|unable|not (reliably|able)|metadata|tag|tagging)/i.test(
        r.narration
      )
      return isHonestEmpty(r) || limit || 'should state the acapella-detection limitation'
    }
  },
  {
    id: '054',
    category: 'Transitions',
    complexity: 'Expert',
    type: 'KNOW',
    prompt: 'how do I transition from 4/4 to 3/4 time?',
    passWhen:
      'Explains that time signature mixing is genuinely difficult. Mentions phrase-boundary misalignment, the triplet feel challenge, and breakdown/silence techniques as the most practical solution. Honest about the difficulty.',
    check: (r) => {
      if (r.kind !== 'knowledge') return 'should answer from the DJ-theory KB (kind=knowledge)'
      const n = r.narration.toLowerCase()
      const hard = /(difficult|hard|challeng|tricky|not (easy|trivial))/.test(n)
      const phrase = /(phrase|boundary|misalign|triplet|3\/4|waltz)/.test(n)
      const technique = /(breakdown|silence|drop out|gap)/.test(n)
      return (
        (hard && phrase && technique) ||
        'should explain 4/4→3/4 difficulty (phrase/triplet) and breakdown/silence technique'
      )
    }
  }
]
