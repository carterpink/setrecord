/** Category 7 · Similarity & Discovery (102–113). */
import type { Track } from '../../../src/types'
import type { EvalCase, EngineResult, EvalCtx, FixtureSession } from '../types'
import { countOf, everyTrack, nonEmptyTracks, isHonestEmpty, hasId, tracksOf } from './helpers'

/** Narration mentions how/why these tracks were chosen (a mapping/metric). */
function explainsMapping(r: EngineResult): boolean {
  return /\b(similar|sound|vibe|map|because|matching|profile|genre|key|bpm|era|mood|outlier|unusual|interpret|approx|subjective)\w*/i.test(
    r.narration
  )
}

/** The most recent past session by performedAt date. */
function mostRecentSession(ctx: EvalCtx): FixtureSession {
  return [...ctx.sessions]
    .filter((s) => new Date(s.performedAt).getTime() <= ctx.now.getTime())
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())[0]
}

export const cat07: EvalCase[] = [
  {
    id: '102',
    category: 'Similarity & Discovery',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: "find tracks similar to Caribou - Can't Do Without You",
    passWhen:
      "Locates Caribou - Can't Do Without You in the library. Returns tracks with similar BPM, key, and genre. If the track is not in the library, states so and does not fabricate alternatives.",
    check: (r, ctx) => {
      const src = ctx.byId.get('caribou1')!
      if (r.sourceTrack?.id !== 'caribou1') return 'sourceTrack should be caribou1'
      if (!nonEmptyTracks(r)) return 'should return similar tracks'
      // Returned tracks should share BPM/key/genre proximity with the seed and
      // never echo the seed itself. caribou2 (House, 120, 10A) is the obvious match.
      const proximate = everyTrack(
        r,
        (t) =>
          t.id !== 'caribou1' &&
          (t.genre === src.genre || t.key === src.key || Math.abs(t.bpm - src.bpm) <= 6)
      )
      return (
        (proximate && hasId(r, 'caribou2')) ||
        'tracks should be BPM/key/genre-proximate (e.g. caribou2)'
      )
    }
  },
  {
    id: '103',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: "what's in my library that sounds like early Daft Punk?",
    passWhen:
      'Maps "early Daft Punk" to: French house, 120–128 BPM, filtered bass, vocoders, 1997–2001 era. Returns candidates matching genre, tag, or year. Explains the mapping used.',
    check: (r) => {
      if (!nonEmptyTracks(r)) return 'should return candidate tracks'
      const housey = everyTrack(r, (t) => t.bpm >= 118 && t.bpm <= 130)
      return (
        (housey && explainsMapping(r)) || 'should map to house ~120-128 BPM and explain the mapping'
      )
    }
  },
  {
    id: '104',
    category: 'Similarity & Discovery',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "show me something I haven't discovered yet in my own library",
    passWhen:
      'Returns tracks with play_count = 0 sorted by date_added descending (recently imported, never played). Frames the result as a discovery moment.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.playCount === 0)) ||
      'every track should be never-played (playCount 0)'
  },
  {
    id: '105',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "what do I have that's similar to what I played at my last gig?",
    passWhen:
      'Queries the most recent play session. Extracts the genre, BPM, and key profile. Returns library tracks matching that profile that were NOT in the last session.',
    check: (r, ctx) => {
      const last = mostRecentSession(ctx)
      const inLast = new Set(last.trackIds)
      const profileGenres = new Set(
        last.trackIds.map((id) => ctx.byId.get(id)?.genre).filter(Boolean) as string[]
      )
      const bpms = last.trackIds
        .map((id) => ctx.byId.get(id)?.bpm)
        .filter((b): b is number => typeof b === 'number' && b > 0)
      const loBpm = Math.min(...bpms) - 6
      const hiBpm = Math.max(...bpms) + 6
      if (!nonEmptyTracks(r)) return 'should return tracks matching the last gig profile'
      const ok = everyTrack(
        r,
        (t) =>
          !inLast.has(t.id) &&
          ((t.genre != null && profileGenres.has(t.genre)) || (t.bpm >= loBpm && t.bpm <= hiBpm))
      )
      return ok || 'tracks should match the most-recent session profile and exclude its tracks'
    }
  },
  {
    id: '106',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find tracks that share a vibe with Joy Division',
    passWhen:
      'Maps Joy Division to: post-punk, dark, minor keys, cold wave adjacent. Searches tags and genre. Returns closest matches. Acknowledges the approximation is subjective.',
    check: (r) => {
      if (isHonestEmpty(r) && explainsMapping(r)) return true
      return (
        (nonEmptyTracks(r) && explainsMapping(r)) ||
        'should return vibe matches and acknowledge the subjective mapping'
      )
    }
  },
  {
    id: '107',
    category: 'Similarity & Discovery',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "recommend me something from my collection I've been ignoring",
    passWhen:
      'Returns tracks with play_count = 0 AND date_added more than 90 days ago. Surfaces neglected imports. Count shown.',
    check: (r, ctx) => {
      const cutoff = ctx.now.getTime() - 90 * 86400000
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => t.playCount === 0 && new Date(t.dateAdded).getTime() < cutoff)) ||
        'every track should be never-played and imported >90 days ago'
      )
    }
  },
  {
    id: '108',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "what's the most unique track in my library?",
    passWhen:
      'Returns tracks with an unusual BPM, key, or genre combination relative to the rest of the library — outliers. Alternatively, tracks that have never appeared in any transition. Explains the uniqueness metric used. Does not claim a definitive answer.',
    check: (r) =>
      (nonEmptyTracks(r) && explainsMapping(r)) ||
      'should surface an outlier and explain the uniqueness metric'
  },
  {
    id: '109',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: "find tracks in my library that don't fit any of my usual genres",
    passWhen:
      'Identifies genres with fewer than 2% of total play count as "unusual for you". Returns tracks in those genres. Framing makes the selection logic clear.',
    check: (r, ctx) => {
      if (!nonEmptyTracks(r)) return 'should return tracks in low-share genres'
      // Compute each genre's share of total play count; "usual" genres are the
      // high-share ones, so returned tracks must sit in low-share genres.
      const totalPlays = ctx.tracks.reduce((s, t) => s + (t.playCount ?? 0), 0)
      const byGenre = new Map<string, number>()
      for (const t of ctx.tracks) {
        if (!t.genre) continue
        byGenre.set(t.genre, (byGenre.get(t.genre) ?? 0) + (t.playCount ?? 0))
      }
      const isLowShare = (t: Track): boolean => {
        if (!t.genre) return true
        const share = totalPlays > 0 ? (byGenre.get(t.genre) ?? 0) / totalPlays : 0
        return share < 0.02
      }
      return (
        (everyTrack(r, isLowShare) && explainsMapping(r)) ||
        'tracks should be in low-play-share genres with clear framing'
      )
    }
  },
  {
    id: '110',
    category: 'Similarity & Discovery',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "show me tracks I haven't touched since I imported them",
    passWhen:
      'Filters play_count = 0 AND date_added older than some threshold (e.g., 60 days). Sorts by date_added ascending (oldest untouched first).',
    check: (r, ctx) => {
      const cutoff = ctx.now.getTime() - 60 * 86400000
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => t.playCount === 0 && new Date(t.dateAdded).getTime() < cutoff)) ||
        'every track should be never-played and imported >60 days ago'
      )
    }
  },
  {
    id: '111',
    category: 'Similarity & Discovery',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'what tracks remind me of summer?',
    passWhen:
      'Maps "summer" to balearic, tropical, afro house, or melodic — major keys, BPM 120–128. Returns tagged or genre-matched tracks. States the interpretation.',
    check: (r) => {
      if (!nonEmptyTracks(r)) return 'should return summer-vibe tracks'
      const summery = everyTrack(r, (t) => t.bpm >= 118 && t.bpm <= 130)
      return (
        (summery && explainsMapping(r)) || 'should map to ~120-128 BPM and state the interpretation'
      )
    }
  },
  {
    id: '112',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "find something I would have played 5 years ago but don't play anymore",
    passWhen:
      'Is honest about the limitation — play history only goes back to first use of SetSense. If data is available, returns high-play-count tracks from the oldest sessions with zero recent plays.',
    check: (r, ctx) => {
      // Play history only spans the logged sessions; "5 years ago" predates them.
      // Honest answer: state the limitation, or return dormant high-play tracks.
      if (isHonestEmpty(r)) return true
      if (/\b(limit|history|since|only|don'?t track|no data|first use)\w*/i.test(r.narration))
        return true
      const oldestSession = [...ctx.sessions].sort(
        (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
      )[0]
      const recentCutoff = ctx.now.getTime() - 180 * 86400000
      return (
        (nonEmptyTracks(r) &&
          everyTrack(
            r,
            (t) =>
              oldestSession.trackIds.includes(t.id) &&
              t.playCount > 0 &&
              (!t.lastPlayed || new Date(t.lastPlayed).getTime() < recentCutoff)
          )) ||
        'should honestly state the history limitation, or return dormant old-session favourites'
      )
    }
  },
  {
    id: '113',
    category: 'Similarity & Discovery',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me tracks from my collection that Radiohead fans would love',
    passWhen:
      'Maps Radiohead fans to: art rock, melancholic, experimental, odd time signatures. Returns tracks with compatible tags or genre. Acknowledges the interpretation is subjective.',
    check: (r) => {
      if (isHonestEmpty(r) && explainsMapping(r)) return true
      if (!nonEmptyTracks(r)) return 'should return experimental/melancholic matches'
      // Plausible mapping: experimental / IDM / ambient / electronica leanings.
      const plausible =
        countOf(tracksOf(r) ? r : r) > 0 &&
        explainsMapping(r) &&
        everyTrack(
          r,
          (t) =>
            /idm|ambient|electronica|experimental|electro|art|down|tempo/i.test(t.genre ?? '') ||
            t.energy <= 6
        )
      return (
        plausible || 'should map to experimental/melancholic tracks and acknowledge subjectivity'
      )
    }
  }
]
