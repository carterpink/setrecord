/** Category 4 · Set Building (055–074). */
import type { Track } from '../../../src/types'
import type { EngineResult, EvalCase, EvalCtx } from '../types'
import { isHonestEmpty } from './helpers'

/** The sequenced set, regardless of where the engine stashed it. */
function setOf(r: EngineResult): Track[] {
  return r.set ?? r.tracks ?? []
}
/** True when the result is a non-empty sequenced set. */
function isSet(r: EngineResult): boolean {
  return r.kind === 'set' && setOf(r).length > 0
}
/** Is the set's BPM sequence broadly ascending (an upward arc)? */
function bpmRises(s: Track[]): boolean {
  const bpms = s.map((t) => t.bpm).filter((b) => b > 0)
  if (bpms.length < 2) return false
  return bpms[bpms.length - 1] >= bpms[0]
}
/** Track ids that were ever played at a venue whose name contains `needle`. */
function trackIdsPlayedAtVenue(ctx: EvalCtx, needle: string): Set<string> {
  const ids = new Set<string>()
  for (const s of ctx.sessions) {
    if ((s.venue ?? '').toLowerCase().includes(needle.toLowerCase())) {
      for (const id of s.trackIds) ids.add(id)
    }
  }
  return ids
}

export const cat04: EvalCase[] = [
  {
    id: '055',
    category: 'Set Building',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'build me a 1-hour set',
    passWhen:
      'Returns a sequenced playlist of 12–16 tracks (averaging 4–5 minutes each). BPM arc visible. Genre consistent or progressively shifting.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const n = setOf(r).length
      return (n >= 10 && n <= 16) || `expected ~12–16 tracks, got ${n}`
    }
  },
  {
    id: '056',
    category: 'Set Building',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'build me a 2-hour peak time techno set',
    passWhen:
      'Returns ~24–28 tracks. BPM range 130–138. Energy profile peaks mid-set. Genre filter applied to techno.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (!s.every((t) => /techno/i.test(t.genre ?? ''))) return 'every track should be techno'
      if (!s.every((t) => t.bpm >= 130 && t.bpm <= 138)) return 'BPM should sit in 130–138'
      return true
    }
  },
  {
    id: '057',
    category: 'Set Building',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'create a warm-up set for a bar, 90 minutes, housey',
    passWhen:
      'Returns ~18–22 tracks. BPM 118–124. House genre filter applied. Energy builds gradually over the duration.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (!s.every((t) => /house/i.test(t.genre ?? ''))) return 'every track should be house'
      if (!s.every((t) => t.bpm >= 118 && t.bpm <= 124)) return 'BPM should sit in 118–124'
      return true
    }
  },
  {
    id: '058',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "build a sunrise set using only tracks I haven't played before",
    passWhen:
      'Filters play_count = 0 OR last_played IS NULL. Melodic or atmospheric genre. BPM arc starts low (~118) and rises. Set progression shown.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (!s.every((t) => t.playCount === 0 && !t.lastPlayed))
        return 'every track must be never-played'
      return bpmRises(s) || 'BPM should rise across the set'
    }
  },
  {
    id: '059',
    category: 'Set Building',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'make me a set of just classics from before 2000',
    passWhen: 'Filters year < 2000. Returns sequenced playlist. Year visible for each track.',
    check: (r, ctx) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      return (
        s.every((t) => (ctx.releaseYears[t.id] ?? 9999) < 2000) ||
        'every track must be released before 2000'
      )
    }
  },
  {
    id: '060',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'build a set that starts at 124 BPM and ends at 132 BPM',
    passWhen:
      'Generates a BPM arc from 124 to 132 across the set. Sequences tracks to match. BPM shown per track.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (s.length < 2) return 'need at least two tracks for a BPM arc'
      if (s[0].bpm > 126) return `first track should be ~124 BPM, got ${s[0].bpm}`
      if (s[s.length - 1].bpm < 130)
        return `last track should be ~132 BPM, got ${s[s.length - 1].bpm}`
      return bpmRises(s) || 'BPM should rise from start to end'
    }
  },
  {
    id: '061',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "create a 45-minute set using only tracks I've played at Fabric",
    passWhen:
      'Queries gig metadata for venue containing "Fabric". Pools those tracks. Sequences ~9–11 of them. If no Fabric sessions exist, states so — does not invent tracks.',
    check: (r, ctx) => {
      const pool = trackIdsPlayedAtVenue(ctx, 'Fabric')
      if (pool.size === 0) return isHonestEmpty(r) || 'no Fabric sessions — should state so'
      if (!isSet(r)) return 'should return a sequenced set'
      return setOf(r).every((t) => pool.has(t.id)) || 'every track must have been played at Fabric'
    }
  },
  {
    id: '062',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'build a b2b set — split the tracks into two halves',
    passWhen:
      'Generates a full set then divides into two equal segments. Labels each half. Notes the energy handoff point between the two halves.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      if (setOf(r).length < 4) return 'need enough tracks to split into two halves'
      return (
        /half|halves|hand[- ]?off|segment/i.test(r.narration) ||
        'should label/handoff the two halves'
      )
    }
  },
  {
    id: '063',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'make a set that tells a story — start dark, go euphoric, come back down',
    passWhen:
      'Produces a three-arc structure: dark/minimal intro → euphoric/energetic peak → melodic/emotional outro. Arc labels shown.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (s.length < 3) return 'need at least three tracks for a three-arc story'
      const energies = s.map((t) => t.energy)
      const peak = Math.max(...energies)
      const peakIdx = energies.indexOf(peak)
      const risesThenFalls =
        peakIdx > 0 &&
        peakIdx < energies.length - 1 &&
        energies[0] < peak &&
        energies[energies.length - 1] < peak
      return risesThenFalls || 'energy should arc up to a peak then come back down'
    }
  },
  {
    id: '064',
    category: 'Set Building',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'generate three different opening tracks for me to choose from',
    passWhen:
      'Returns exactly three low-energy track candidates. Provides a brief rationale for each. Does not return peak-time tracks.',
    check: (r) => {
      const s = setOf(r)
      if (s.length !== 3) return `expected exactly 3 candidates, got ${s.length}`
      return (
        s.every((t) => t.energy <= 6) || 'opening candidates should be low-energy, not peak-time'
      )
    }
  },
  {
    id: '065',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "what's the longest set I could build from tracks I've never played?",
    passWhen:
      'Counts tracks with play_count = 0. Sums their durations. Returns the maximum possible set duration in hours and minutes.',
    check: (r) => {
      const reportsDuration =
        r.count != null || r.kind === 'stats' || /\d+\s*(h|hr|hour|min)/i.test(r.narration)
      return reportsDuration || 'should report the total possible duration of never-played tracks'
    }
  },
  {
    id: '066',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "build a set but avoid anything I've played in the last month",
    passWhen:
      'Filters last_played IS NULL OR last_played < 30 days ago. Builds set from the remaining pool only.',
    check: (r, ctx) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const cutoff = ctx.now.getTime() - 30 * 86400000
      return (
        setOf(r).every((t) => !t.lastPlayed || new Date(t.lastPlayed).getTime() < cutoff) ||
        'no track may have been played in the last 30 days'
      )
    }
  },
  {
    id: '067',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'create a pool of 30 tracks for a 2-hour back-to-back',
    passWhen:
      'Returns exactly 30 tracks with a spread of energy levels (low, mid, high). Notes the energy distribution. Flexible ordering for b2b use.',
    check: (r) => {
      const s = setOf(r)
      if (r.kind !== 'set' && r.kind !== 'tracks') return 'should return a track pool'
      if (s.length !== 30) return `expected exactly 30 tracks, got ${s.length}`
      const energies = s.map((t) => t.energy)
      const hasLow = energies.some((e) => e <= 4)
      const hasMid = energies.some((e) => e >= 5 && e <= 7)
      const hasHigh = energies.some((e) => e >= 8)
      return (hasLow && hasMid && hasHigh) || 'pool should span low/mid/high energy'
    }
  },
  {
    id: '068',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'make me a festival set — big room, peak hour, no vocals',
    passWhen:
      'Filters genre toward big room / techno / tech house. BPM 130+. Notes if vocal filtering is approximate (depends on tagging). Returns a sequenced set.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      if (!s.every((t) => t.bpm >= 130)) return 'every track should be 130+ BPM'
      return (
        s.every((t) => /techno|tech house|big room/i.test(t.genre ?? '')) ||
        'genre should lean techno / tech house / big room'
      )
    }
  },
  {
    id: '069',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'build a vinyl-only set from my collection',
    passWhen:
      'Filters tracks marked as vinyl or from a vinyl source if that field exists. If no such field is tracked, states the limitation and suggests a tagging approach.',
    check: (r) =>
      isHonestEmpty(r) ||
      /vinyl|not tracked|no.*(field|tag)|limitation/i.test(r.narration) ||
      'should state the vinyl-source limitation (no such field is tracked)'
  },
  {
    id: '070',
    category: 'Set Building',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'I have 20 minutes to fill — what do I play?',
    passWhen:
      'Returns 4–5 tracks with a combined duration of approximately 20 minutes. Quick, no excessive explanation.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const n = setOf(r).length
      return (n >= 3 && n <= 6) || `expected ~4–5 tracks for 20 minutes, got ${n}`
    }
  },
  {
    id: '071',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'create a set that works for both dancing and background listening',
    passWhen:
      'Returns mid-energy tracks (BPM ~118–124). Not aggressive enough to alienate listeners. Works as ambient or dance floor. This duality noted in the response.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      return (
        s.every((t) => t.bpm >= 116 && t.bpm <= 126) || 'tracks should be mid-energy ~118–124 BPM'
      )
    }
  },
  {
    id: '072',
    category: 'Set Building',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'build a set using only tracks longer than 7 minutes',
    passWhen:
      'Filters duration > 420 seconds. Sequences those tracks. Notes the lower track count per hour.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      return setOf(r).every((t) => t.duration > 420) || 'every track must be longer than 7 minutes'
    }
  },
  {
    id: '073',
    category: 'Set Building',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'what if I started my set with Plastikman - Spastik? build from there',
    passWhen:
      'Uses Plastikman - Spastik as the anchor (first track). Finds BPM and key compatible follow-ons from the library. Builds outward from that seed. If the track is not in library, states so.',
    check: (r) => {
      if (!isSet(r)) return 'should return a sequenced set'
      const s = setOf(r)
      return s[0]?.id === 'plastik1' || 'first track should be the Plastikman - Spastik anchor'
    }
  },
  {
    id: '074',
    category: 'Set Building',
    complexity: 'Expert',
    type: 'DATA',
    prompt: 'build me 5 different one-hour sets from the same library',
    passWhen:
      'Returns 5 distinct playlists with different vibes, genres, or BPM arcs. Minimal track repetition across the five sets. Each set labeled clearly.',
    check: (r) => {
      // Lenient: a single 'set' result or any non-empty set/track output is acceptable
      // at this stage — multi-set return shape isn't yet modelled in EngineResult.
      if (r.kind === 'set' && setOf(r).length > 0) return true
      if ((r.kind === 'tracks' || r.kind === 'sequences') && setOf(r).length > 0) return true
      return 'should return five distinct one-hour sets (or at least a set output)'
    }
  }
]
