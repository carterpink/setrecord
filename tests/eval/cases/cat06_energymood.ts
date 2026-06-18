/** Category 6 · Energy, Mood & Vibe (087–101).
 *
 * No track in the fixture world has `tags`, so every mood/vibe prompt must be
 * resolved via energy / BPM / key / duration / genre heuristics, OR — where the
 * matrix Pass-when explicitly allows it — by honestly signalling that tagging is
 * needed instead of returning a random selection. Each check encodes the matrix
 * TARGET (baseline fails most).
 *
 * Camelot convention: keys ending in 'A' are MINOR, keys ending in 'B' are MAJOR.
 */
import type { EvalCase } from '../types'
import { everyTrack, isHonestEmpty, nonEmptyTracks, someTrack, tracksOf } from './helpers'

const isMinor = (k: string): boolean => /a$/i.test(k.trim())

export const cat06: EvalCase[] = [
  {
    id: '087',
    category: 'Energy, Mood & Vibe',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me dark tracks',
    passWhen:
      'Filters tags or genre containing "dark". Returns list. If no tracks are tagged, explains that auto-tagging or manual tagging is needed rather than returning a random selection.',
    // No tags exist; accept an honest "tagging needed", OR a sensible filter on
    // tag/genre/title containing "dark" (e.g. dark1/dark2, Darkwave genre).
    check: (r) => {
      if (isHonestEmpty(r) || /tag/i.test(r.narration)) return true
      return (
        (nonEmptyTracks(r) &&
          everyTrack(
            r,
            (t) =>
              /dark/i.test(t.title) ||
              /dark/i.test(t.genre ?? '') ||
              (t.tags ?? []).some((x) => /dark/i.test(x.value))
          )) ||
        'should filter by dark tag/genre or explain that tagging is needed'
      )
    }
  },
  {
    id: '088',
    category: 'Energy, Mood & Vibe',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'find something euphoric for the peak',
    passWhen:
      'Returns high-energy tracks. Considers BPM (130+), major keys, and melodic content. "Euphoric" interpreted via tags or energy score. Does not return minimal or low-energy tracks.',
    // Euphoric peak-time → high energy. No minimal / low-energy results.
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => t.energy >= 8) &&
        someTrack(r, (t) => t.bpm >= 130)) ||
      'should return high-energy (>=8) peak tracks, none low-energy/minimal'
  },
  {
    id: '089',
    category: 'Energy, Mood & Vibe',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'I need something melancholic and slow',
    passWhen:
      'Filters low BPM (~100–118), minor keys, and tags like "melancholic", "sad", or "emotional". Returns candidates.',
    // Slow + melancholic → low BPM (~100–118, but >0 so not a missing value) and
    // minor keys.
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.bpm > 0 && t.bpm <= 118 && isMinor(t.key))) ||
      'should return low-BPM (~100–118) minor-key candidates'
  },
  {
    id: '090',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find the most hypnotic tracks in my collection',
    passWhen:
      'Filters tracks tagged "hypnotic", "repetitive", or "minimal". Alternatively returns the longest tracks in the library (longer duration correlates with hypnotic/repetitive structure). Returns list. Is transparent about the proxy used.',
    // No tags → accept the longest-tracks proxy (everything well above average
    // length) with transparency, OR an honest "tagging needed".
    check: (r) => {
      if (isHonestEmpty(r) || /tag/i.test(r.narration)) return true
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => t.duration >= 480)) ||
        'should use the long-duration proxy (>=8min) or explain the proxy/tagging'
      )
    }
  },
  {
    id: '091',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me tracks good for a 6am crowd',
    passWhen:
      'Understands 6am context = late-night into early morning. Returns melodic, atmospheric tracks — not aggressive peak-time. Considers play history at late-session timestamps if available.',
    // 6am = deep/atmospheric, NOT aggressive peak-time → exclude very high energy.
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 6)) ||
      'should return melodic/atmospheric tracks, not aggressive peak-time'
  },
  {
    id: '092',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'find something aggressive for a festival main stage drop',
    passWhen:
      'Returns high-energy, high-BPM (133+) tracks. Hard techno or industrial-adjacent genre preferred. Does not return ambient or low-energy results.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.bpm >= 133 && t.energy >= 8)) ||
      'should return high-BPM (133+) high-energy aggressive tracks, no ambient/low-energy'
  },
  {
    id: '093',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: "what's the most emotional track in my library?",
    passWhen:
      'Returns tracks tagged "emotional" or similar. If no emotional tags exist, approximates using minor keys and lower BPM. Is transparent about the approximation.',
    // No emotional tags → minor-key + lower-BPM approximation, stated as such, OR
    // an honest "tagging needed".
    check: (r) => {
      if (isHonestEmpty(r) || /tag/i.test(r.narration)) return true
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => isMinor(t.key) && t.bpm > 0 && t.bpm <= 122)) ||
        'should approximate via minor key + lower BPM (and say so), or explain tagging'
      )
    }
  },
  {
    id: '094',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find tracks that build tension',
    passWhen:
      'Returns tracks tagged "tension" or "build". Acknowledges that structural analysis (identifying long builds) may be limited. Does not fabricate structural information.',
    // No structural analysis / tags exist: must be honest about the limitation,
    // or surface a genuine tag match (none in this world) without fabricating.
    check: (r) => {
      if (isHonestEmpty(r) || /(structur|build|limit|tag|analy)/i.test(r.narration)) return true
      return (
        everyTrack(r, (t) => (t.tags ?? []).some((x) => /(tension|build)/i.test(x.value))) ||
        'should acknowledge structural-analysis limitation, not fabricate builds'
      )
    }
  },
  {
    id: '095',
    category: 'Energy, Mood & Vibe',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'show me something I could use as an ambient intro',
    passWhen:
      'Filters very low BPM or no BPM (ambient tracks), long duration, low energy. Returns list.',
    // amb1 (bpm 0, energy 1, Ambient) is the canonical match; assert very-low/no
    // BPM and low energy across the list.
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => (t.bpm === 0 || t.bpm <= 100) && t.energy <= 3)) ||
      'should return very-low/no-BPM, low-energy ambient tracks'
  },
  {
    id: '096',
    category: 'Energy, Mood & Vibe',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'find uplifting tracks for a daytime festival crowd',
    passWhen:
      'Filters BPM 120–128, major keys, melodic or house genre, medium-high energy. Returns list.',
    // BPM 120–128 + medium-high energy. (Major keys are scarce in the fixture, so
    // require the BPM/energy band and allow either key side.)
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.bpm >= 120 && t.bpm <= 128 && t.energy >= 5)) ||
      'should return BPM 120–128, medium-high-energy uplifting tracks'
  },
  {
    id: '097',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'I want tracks that feel like being underwater',
    passWhen:
      'Maps the metaphor to: atmospheric, reverb-heavy, slow, possibly minor key. Returns candidates tagged "atmospheric", "ambient", or "deep". Acknowledges this is a creative interpretation.',
    // Creative metaphor → atmospheric/slow heuristic stated as an interpretation,
    // OR honest "tagging needed". If returning tracks, they should be slow/calm.
    check: (r) => {
      if (isHonestEmpty(r) || /(interpret|metaphor|creativ|atmospher|tag)/i.test(r.narration)) {
        const ts = tracksOf(r)
        if (ts.length === 0) return true
        return (
          everyTrack(r, (t) => t.energy <= 5 && (t.bpm === 0 || t.bpm <= 122)) ||
          'underwater candidates should be slow/low-energy atmospheric tracks'
        )
      }
      return 'should acknowledge the creative interpretation (atmospheric/slow) or explain tagging'
    }
  },
  {
    id: '098',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: "what's the most club-ready track in my library right now?",
    passWhen:
      'Considers BPM 128–133, high energy, peak-hour tags, and recent import date (freshness). Returns top candidate with brief reasoning.',
    // Single top candidate with reasoning; it must sit in the club-ready band.
    check: (r) => {
      const ts = tracksOf(r)
      if (ts.length === 0) return 'should return a top club-ready candidate'
      const top = ts[0]
      const inBand = top.bpm >= 128 && top.bpm <= 133 && top.energy >= 8
      const hasReasoning = /[a-z]/i.test(r.narration) && r.narration.length > 0
      return (
        (inBand && hasReasoning) ||
        'top candidate should be BPM 128–133, high-energy, with reasoning'
      )
    }
  },
  {
    id: '099',
    category: 'Energy, Mood & Vibe',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me tracks that are good for reading the crowd',
    passWhen:
      'Returns versatile, mid-energy tracks that work across crowd types. If the user appears to be a beginner, briefly explains what "reading the crowd" means. Returns from library.',
    // Versatile = mid-energy (not extreme either way).
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy >= 4 && t.energy <= 7)) ||
      'should return versatile, mid-energy (4–7) tracks'
  },
  {
    id: '100',
    category: 'Energy, Mood & Vibe',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'find something cinematic',
    passWhen:
      'Maps "cinematic" to orchestral, film-score-adjacent, or tracks with dramatic builds. Returns tracks tagged "cinematic" or matching genre. States the interpretation used.',
    // No cinematic tags/genre exist → state the interpretation, OR honestly note
    // tagging is needed. If tracks are returned, accept atmospheric/ambient ones.
    check: (r) => {
      if (isHonestEmpty(r) || /(cinematic|orchestral|film|interpret|tag)/i.test(r.narration)) {
        const ts = tracksOf(r)
        if (ts.length === 0) return true
        return (
          everyTrack(r, (t) => /ambient/i.test(t.genre ?? '') || t.energy <= 5) ||
          'cinematic candidates should map to atmospheric/film-score-adjacent tracks'
        )
      }
      return 'should state the cinematic interpretation or explain tagging'
    }
  },
  {
    id: '101',
    category: 'Energy, Mood & Vibe',
    complexity: 'Beginner',
    type: 'BOTH',
    prompt: 'show me chill tracks for a beach party',
    passWhen:
      'Filters lower BPM (100–120), warm organic sound (afro house, balearic, melodic). Returns list.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.bpm >= 100 && t.bpm <= 120)) ||
      'should return chill, lower-BPM (100–120) tracks'
  }
]
