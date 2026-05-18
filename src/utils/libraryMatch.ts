import { search as fuzzySearch } from 'fast-fuzzy'
import type { DiscoverTrack, DiscoverTrackMatch, Track } from '@/types'

const NOISE_PATTERNS = [
  /\((?:original|extended|club|radio|edit|remix|rework|dub|vip)\s*(?:mix)?\)/gi,
  /\((?:bicep|amelie\s+lens|charlotte\s+de\s+witte)?\s*remix\)/gi,
  /\(\s*[^)]*remix\s*\)/gi,
  /\(\s*[^)]*mix\s*\)/gi,
  /\bft\.?\s+/gi,
  /\bfeat\.?\s+/gi,
  /\bfeaturing\s+/gi,
  /\s+vs\.?\s+/gi,
]

const SEPARATORS = /\s*[&+,]\s*/g

function normalize(s: string): string {
  let out = s
  for (const pat of NOISE_PATTERNS) out = out.replace(pat, ' ')
  out = out.replace(SEPARATORS, ' ')
  return out.replace(/\s+/g, ' ').trim()
}

function makeQuery(artist: string, title: string): string {
  return `${normalize(artist)} ${normalize(title)}`.trim()
}

/** Match a single discover track against the library. Returns null if no match >= threshold. */
export function matchOneToLibrary(
  query: { artist: string; title: string },
  library: Track[],
  threshold = 0.75
): { track: Track; score: number } | null {
  if (library.length === 0) return null
  const q = makeQuery(query.artist, query.title)
  if (!q) return null
  const results = fuzzySearch(q, library, {
    keySelector: (t) => `${normalize(t.artist)} ${normalize(t.title)}`,
    returnMatchData: true,
    threshold,
  }) as Array<{ item: Track; score: number }>
  const top = results[0]
  return top ? { track: top.item, score: top.score } : null
}

/** Match a batch of discover tracks against the library. Builds the searcher once. */
export function matchManyToLibrary(
  discoverTracks: DiscoverTrack[],
  library: Track[],
  threshold = 0.75
): DiscoverTrackMatch[] {
  return discoverTracks.map((dt) => {
    const m = matchOneToLibrary({ artist: dt.artist, title: dt.title }, library, threshold)
    return {
      discoverTrack: dt,
      match: m?.track ?? null,
      score: m?.score ?? 0,
    }
  })
}
