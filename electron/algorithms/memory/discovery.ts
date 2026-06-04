/**
 * discovery.ts — pure similarity & discovery aggregations.
 *
 * Resolves a DiscoveryHit into similar tracks (by BPM/key/genre proximity),
 * creative vibe mappings, never-played discoveries, outliers, low-share-genre
 * picks, or an honest limitation. No DB deps.
 */

import type { Track } from '../../../src/types'
import type { DiscoveryHit } from '../../../src/utils/discoveryIntent'

export interface DiscoverySession {
  performedAt: string
  trackIds: string[]
}

export interface DiscoveryAnswer {
  kind: 'tracks' | 'empty'
  tracks?: Track[]
  sourceTrack?: Track | null
  narration: string
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function findTrack(seed: string, tracks: Track[]): Track | null {
  const tokens = seed
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (tokens.length === 0) return null
  return (
    tracks.find((t) => {
      const h = `${t.title} ${t.artist}`.toLowerCase()
      return tokens.every((tok) => h.includes(tok))
    }) ?? null
  )
}

/** Creative artist/word → attribute mapping (when the seed isn't a library track). */
function creativeMapping(seed: string, tracks: Track[]): DiscoveryAnswer {
  const s = seed.toLowerCase()
  const has =
    (g: string) =>
    (t: Track): boolean =>
      (t.genre ?? '').toLowerCase().includes(g)
  const minorKey = (t: Track): boolean => /A$/.test(t.key)
  const bpmBand =
    (lo: number, hi: number) =>
    (t: Track): boolean =>
      t.bpm >= lo && t.bpm <= hi

  let pool = real(tracks)
  let why = `interpreted "${seed}"`

  if (/daft punk|french house|filter house/.test(s)) {
    pool = pool.filter((t) => has('house')(t) && bpmBand(118, 130)(t))
    why = `mapped "early Daft Punk" to French/filter house around 118–128 BPM`
  } else if (/joy division|post.?punk|new order/.test(s)) {
    pool = pool.filter((t) => minorKey(t) || t.energy <= 5)
    why = `mapped Joy Division to dark, minor-key, post-punk-adjacent tracks (subjective)`
  } else if (/radiohead|art rock|experimental/.test(s)) {
    pool = pool.filter((t) => minorKey(t) || t.energy <= 6)
    why = `mapped Radiohead to melancholic / experimental, minor-key tracks (subjective)`
  } else if (/summer|beach|balearic|tropical|sun/.test(s)) {
    pool = pool.filter((t) => bpmBand(118, 130)(t))
    why = `mapped "summer" to warm, melodic 118–128 BPM tracks`
  } else if (/underwater|deep|atmospher|dream/.test(s)) {
    pool = pool.filter((t) => t.energy <= 5)
    why = `mapped that metaphor to atmospheric, lower-energy tracks (a creative read)`
  } else {
    // generic: mid-energy, by genre overlap if the seed names a genre
    why = `interpreted "${seed}" by mood/genre (a subjective match)`
    pool = pool.filter((t) => t.energy >= 4 && t.energy <= 7)
  }

  const out = pool.slice(0, 15)
  return {
    kind: out.length ? 'tracks' : 'empty',
    tracks: out,
    narration: out.length
      ? `${out.length} candidates — ${why}.`
      : `I ${why}, but found nothing matching in your library.`
  }
}

export function computeDiscovery(
  hit: DiscoveryHit,
  tracksIn: Track[],
  sessions: DiscoverySession[],
  now: Date
): DiscoveryAnswer {
  const tracks = real(tracksIn)

  switch (hit.metric) {
    case 'similar_to': {
      const seed = hit.seed ?? ''
      const src = findTrack(seed, tracks)
      if (!src) return creativeMapping(seed, tracks)
      const scored = tracks
        .filter((t) => t.id !== src.id)
        .map((t) => {
          let score = 0
          if (t.genre && t.genre === src.genre) score += 3
          if (t.key === src.key) score += 2
          if (Math.abs(t.bpm - src.bpm) <= 6) score += 2
          return { t, score }
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.t)
      return {
        kind: scored.length ? 'tracks' : 'empty',
        tracks: scored.slice(0, 15),
        sourceTrack: src,
        narration: scored.length
          ? `Tracks similar to ${src.title} by genre, key and BPM.`
          : `Found ${src.title}, but nothing else sits close on genre/key/BPM.`
      }
    }
    case 'last_gig': {
      const recent = sessions
        .filter((s) => new Date(s.performedAt).getTime() <= now.getTime())
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]
      if (!recent) return { kind: 'empty', narration: 'No past sessions to learn from yet.' }
      const inSet = new Set(recent.trackIds)
      const sessionTracks = recent.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t)
      const genres = new Set(sessionTracks.map((t) => t.genre).filter(Boolean))
      const bpms = sessionTracks.map((t) => t.bpm)
      const lo = Math.min(...bpms) - 4
      const hi = Math.max(...bpms) + 4
      const out = tracks.filter(
        (t) =>
          !inSet.has(t.id) && ((t.genre && genres.has(t.genre)) || (t.bpm >= lo && t.bpm <= hi))
      )
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 20),
        narration: out.length
          ? `Matching the genre/BPM profile of your most recent set (and not already in it).`
          : 'Nothing new matches your last set profile.'
      }
    }
    case 'discovery': {
      const cutoff = now.getTime() - 90 * 86400000
      const out = tracks
        .filter((t) => t.playCount === 0 && !t.lastPlayed)
        .filter((t) => !t.dateAdded || new Date(t.dateAdded).getTime() < cutoff)
        .sort((a, b) => (a.dateAdded ?? '').localeCompare(b.dateAdded ?? ''))
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 20),
        narration: out.length
          ? `${out.length} tracks you imported but have never played — worth rediscovering.`
          : 'Nothing neglected — you play what you own.'
      }
    }
    case 'unique': {
      // Outlier by rarest genre, tie-broken by BPM distance from the library mean.
      const genreCount = new Map<string, number>()
      for (const t of tracks)
        if (t.genre) genreCount.set(t.genre, (genreCount.get(t.genre) ?? 0) + 1)
      const meanBpm = tracks.reduce((s, t) => s + t.bpm, 0) / Math.max(1, tracks.length)
      const ranked = tracks.slice().sort((a, b) => {
        const ga = genreCount.get(a.genre ?? '') ?? 99
        const gb = genreCount.get(b.genre ?? '') ?? 99
        if (ga !== gb) return ga - gb
        return Math.abs(b.bpm - meanBpm) - Math.abs(a.bpm - meanBpm)
      })
      const top = ranked[0]
      return {
        kind: top ? 'tracks' : 'empty',
        tracks: top ? [top] : [],
        narration: top
          ? `${top.title} looks like your most unusual track — an outlier by genre and BPM (it's an approximate metric, not a definitive answer).`
          : 'Library too small to call an outlier.'
      }
    }
    case 'outside_genres': {
      const totalPlays = tracks.reduce((s, t) => s + (t.playCount ?? 0), 0)
      const byGenre = new Map<string, number>()
      for (const t of tracks)
        if (t.genre) byGenre.set(t.genre, (byGenre.get(t.genre) ?? 0) + (t.playCount ?? 0))
      const out = tracks.filter((t) => {
        if (!t.genre) return true
        const share = totalPlays > 0 ? (byGenre.get(t.genre) ?? 0) / totalPlays : 0
        return share < 0.02
      })
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 25),
        narration: out.length
          ? `Tracks in genres that make up under 2% of your plays — outside your usual lane.`
          : 'Your plays are spread evenly across genres.'
      }
    }
    case 'five_years':
      return {
        kind: 'empty',
        narration:
          "I can only see play history since you started using SetSense, so I can't reach back five years. If you have older sessions logged, I can surface long-dormant favourites instead."
      }
    default:
      return { kind: 'empty', narration: 'Nothing to discover for that.' }
  }
}
