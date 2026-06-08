/**
 * librarySearch.ts — Pure deterministic library search for SetRecord Intelligence
 * conversations. Turns a LibrarySearchParams object into an ordered track list,
 * instantly and offline. No model is involved: this IS the accuracy lever.
 */

import type { Track, LibrarySearchParams } from '../../../src/types'

/**
 * Genre tags in real libraries are messy ("UK Garage", "Drum & Bass"). Map a
 * parsed genre token to the substrings that should count as a match (any-of,
 * case-insensitive). Unknown tokens fall back to matching themselves.
 */
const GENRE_SYNONYMS: Record<string, string[]> = {
  ukg: ['uk garage', 'ukg', 'garage', 'speed garage', '2-step', '2 step'],
  'uk garage': ['uk garage', 'ukg', 'garage', '2-step', '2 step'],
  garage: ['garage', 'ukg', '2-step'],
  dnb: ['drum and bass', 'drum & bass', 'drum n bass', 'dnb', 'd&b', 'liquid'],
  'd&b': ['drum and bass', 'drum & bass', 'dnb', 'd&b'],
  'drum and bass': ['drum and bass', 'drum & bass', 'drum n bass', 'dnb', 'd&b'],
  'tech house': ['tech house', 'tech-house', 'techhouse'],
  'deep house': ['deep house', 'deep-house'],
  'afro house': ['afro house', 'afro-house', 'afro tech', 'afro'],
  'progressive house': ['progressive house', 'prog house', 'progressive'],
  'melodic techno': ['melodic techno', 'melodic house', 'melodic'],
  'hard techno': ['hard techno', 'hardgroove', 'peak time'],
  'hip hop': ['hip hop', 'hip-hop', 'hiphop', 'rap'],
  'hip-hop': ['hip hop', 'hip-hop', 'hiphop', 'rap'],
  'nu disco': ['nu disco', 'nu-disco', 'disco'],
  amapiano: ['amapiano', 'piano'],
  afrobeats: ['afrobeats', 'afrobeat', 'afro'],
  techno: ['techno'],
  house: ['house'],
  trance: ['trance'],
  dubstep: ['dubstep', 'riddim', 'brostep'],
  jungle: ['jungle']
}

function genreMatchers(token: string): string[] {
  const key = token.toLowerCase().trim()
  return GENRE_SYNONYMS[key] ?? [key]
}

function sortTracks(tracks: Track[], sort: LibrarySearchParams['sort']): Track[] {
  const out = tracks.slice()
  switch (sort) {
    case 'leastPlayed':
      return out.sort((a, b) => a.playCount - b.playCount)
    case 'recent':
      return out.sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
    case 'oldest':
      return out.sort((a, b) => (a.dateAdded ?? '').localeCompare(b.dateAdded ?? ''))
    case 'rating':
      return out.sort((a, b) => b.rating - a.rating || b.playCount - a.playCount)
    case 'bpmAsc':
      return out.sort((a, b) => a.bpm - b.bpm)
    case 'bpmDesc':
      return out.sort((a, b) => b.bpm - a.bpm)
    case 'energyAsc':
      return out.sort((a, b) => a.energy - b.energy)
    case 'energyDesc':
      return out.sort((a, b) => b.energy - a.energy)
    case 'random':
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    case 'mostPlayed':
    default:
      // Personal default: the DJ's most-played first, rating as a tiebreak.
      return out.sort((a, b) => b.playCount - a.playCount || b.rating - a.rating)
  }
}

/**
 * @param allowedTrackIds When provided, only tracks in this set survive — used to
 *   intersect "played at venue X / in month Y" results (resolved from the session
 *   tables upstream) with the in-memory track filters below. Pass null/undefined
 *   when no gig filter is active. An empty set legitimately yields no results.
 */
export function searchLibrary(
  tracks: Track[],
  p: LibrarySearchParams,
  allowedTrackIds?: Set<string> | null
): Track[] {
  // Phantom (Discover-only) tracks aren't real files — never surface them here.
  let out = tracks.filter((t) => t.phantom !== true)

  if (allowedTrackIds) out = out.filter((t) => allowedTrackIds.has(t.id))

  if (p.text) {
    const q = p.text.toLowerCase()
    // Include label so "Drumcode releases" / "Transmat" find label matches too.
    out = out.filter((t) =>
      `${t.title} ${t.artist} ${t.album ?? ''} ${t.label ?? ''}`.toLowerCase().includes(q)
    )
  }
  if (p.genre) {
    const matchers = genreMatchers(p.genre)
    out = out.filter((t) => {
      const g = (t.genre ?? '').toLowerCase()
      return g !== '' && matchers.some((m) => g.includes(m))
    })
  }
  if (p.bpmMin != null) out = out.filter((t) => t.bpm >= p.bpmMin!)
  if (p.bpmMax != null) out = out.filter((t) => t.bpm <= p.bpmMax!)
  if (p.energyMin != null) out = out.filter((t) => t.energy >= p.energyMin!)
  if (p.energyMax != null) out = out.filter((t) => t.energy <= p.energyMax!)
  if (p.keyExact) out = out.filter((t) => t.key === p.keyExact)
  if (p.minRating != null) out = out.filter((t) => t.rating >= p.minRating!)
  if (p.yearMin != null) out = out.filter((t) => t.releaseYear != null && t.releaseYear >= p.yearMin!)
  if (p.yearMax != null) out = out.filter((t) => t.releaseYear != null && t.releaseYear <= p.yearMax!)
  if (p.neverPlayed) out = out.filter((t) => t.playCount === 0 && !t.lastPlayed)
  if (p.dormantMonths != null) {
    const cutoff = Date.now() - p.dormantMonths * 30 * 24 * 3600 * 1000
    out = out.filter((t) => (t.lastPlayed ? new Date(t.lastPlayed).getTime() < cutoff : true))
  }

  if (p.durationMinSec != null) out = out.filter((t) => t.duration >= p.durationMinSec!)
  if (p.durationMaxSec != null) out = out.filter((t) => t.duration <= p.durationMaxSec!)

  if (p.addedAfter) {
    const after = new Date(p.addedAfter).getTime()
    out = out.filter((t) => (t.dateAdded ? new Date(t.dateAdded).getTime() >= after : false))
  }
  if (p.addedBefore) {
    const before = new Date(p.addedBefore).getTime()
    out = out.filter((t) => (t.dateAdded ? new Date(t.dateAdded).getTime() <= before : false))
  }

  if (p.cueLabel) {
    const needle = p.cueLabel.toLowerCase()
    out = out.filter((t) => {
      // Hot cues carry labels; CuePoint (memory/cue) currently has no label field
      // in the SetRecord schema, so we only check hot cues here.
      return t.hotCues.some((hc) => (hc.label ?? '').toLowerCase().includes(needle))
    })
  }

  if (p.tags && p.tags.length > 0) {
    const wanted = p.tags.map((x) => x.toLowerCase())
    out = out.filter((t) => {
      const vals = (t.tags ?? []).map((tag) => tag.value.toLowerCase())
      // Match if the track carries any requested tag (substring-tolerant both ways
      // so "vocal" matches "vocals" and "dark" matches "dark/moody").
      return wanted.some((w) => vals.some((v) => v.includes(w) || w.includes(v)))
    })
  }

  out = sortTracks(out, p.sort)
  if (p.limit && p.limit > 0) out = out.slice(0, p.limit)
  return out
}
