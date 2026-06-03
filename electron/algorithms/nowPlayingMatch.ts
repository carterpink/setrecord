/**
 * Match "what's on screen / what's playing" text to a library track.
 *
 * Fed by any sensor that yields text — OCR lines off the screen (Rekordbox /
 * Serato / Spotify / a browser), or a "Now Playing" metadata string. The job:
 * find the library track whose title (and ideally artist) appears in that text,
 * robustly enough to survive OCR noise, extra UI chrome, and "(Extended Mix)"
 * style suffixes. Pure + deterministic so it's unit-testable.
 */
import type { Track } from '../../src/types'

export interface NowPlayingMatch {
  trackId: string
  /** 0–1 confidence (title coverage, lifted when the artist also appears). */
  score: number
}

/** Confidence floor below which we don't claim a match (fail loud). */
export const NOW_PLAYING_MIN_SCORE = 0.6

const NOISE = new Set([
  'official',
  'video',
  'audio',
  'lyrics',
  'remaster',
  'remastered',
  'extended',
  'mix',
  'edit',
  'feat',
  'ft',
  'original',
  'radio',
  'version'
])

/** Lowercase, strip punctuation, drop noise + 1-char tokens → token set. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2 && !NOISE.has(t))
}

/** Fraction of `needle` tokens present in `haystack` token set (0–1). */
function coverage(needle: string[], haystack: Set<string>): number {
  if (needle.length === 0) return 0
  let hit = 0
  for (const t of needle) if (haystack.has(t)) hit++
  return hit / needle.length
}

/**
 * Best library match across all provided text lines. Each line is scored
 * independently (a title lives on one line); the artist may appear anywhere, so
 * its presence across the full text lifts confidence and breaks ties between
 * two loaded tracks.
 */
export function matchNowPlaying(
  texts: string[],
  library: Pick<Track, 'id' | 'title' | 'artist'>[]
): NowPlayingMatch | null {
  const lineTokenSets = texts.map((t) => new Set(tokenize(t)))
  const allTokens = new Set<string>()
  for (const set of lineTokenSets) for (const t of set) allTokens.add(t)
  if (allTokens.size === 0) return null

  let best: NowPlayingMatch | null = null

  for (const track of library) {
    const titleTokens = tokenize(track.title)
    if (titleTokens.length === 0) continue

    // Best title coverage on any single line.
    let titleCov = 0
    for (const set of lineTokenSets) titleCov = Math.max(titleCov, coverage(titleTokens, set))
    if (titleCov === 0) continue

    // Artist presence anywhere in the text lifts confidence.
    const artistTokens = tokenize(track.artist)
    const artistCov = coverage(artistTokens, allTokens)

    // A one-word title is risky on its own (common words) — require the artist
    // to corroborate it.
    if (titleTokens.length === 1 && artistCov < 0.5) continue

    // Title dominates (0.8); a present artist adds up to 0.2 — enough to lift a
    // confident title above the floor and to break ties between loaded tracks.
    const score = titleCov * 0.8 + artistCov * 0.2
    if (!best || score > best.score) best = { trackId: track.id, score }
  }

  return best && best.score >= NOW_PLAYING_MIN_SCORE ? best : null
}
