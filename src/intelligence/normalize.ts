/**
 * normalize.ts — bulletproof query normalization for the intelligence cascade.
 *
 * Turns noisy real-world input — slang ("oi mate give us some fisher"), txt-speak
 * ("wot r my fastst trax"), and misspellings ("tecno", "fihser") — into the clean
 * phrasing the deterministic detectors were proven against. Three stages:
 *
 *   1. rewrite   — txt-speak and dialect phrases mapped to canonical English
 *   2. strip     — vocatives / politeness / filler removed at word boundaries
 *   3. correct   — remaining unknown tokens fuzzy-repaired against an intent
 *                  lexicon + the user's OWN library vocabulary (artists, genres,
 *                  labels, titles), so corrections can only land on words the
 *                  engine actually understands or the library actually contains
 *
 * Pure and renderer-safe. The cascade runs the RAW query first and only retries
 * with the normalized form, so clean input never changes behaviour.
 */

import type { Track } from '@/types'
import { bestMatch } from './fuzzy'

// ── Stage 1: phrase + token rewrites ─────────────────────────────────────────

/** Multi-word dialect phrases → canonical phrasing. Applied longest-first. */
const PHRASE_REWRITES: [RegExp, string][] = [
  [/\bgive us\b/g, 'give me'],
  [/\bshow us\b/g, 'show me'],
  [/\bplay us\b/g, 'play me'],
  [/\bfind us\b/g, 'find me'],
  [/\bchuck (?:us|me)\b/g, 'give me'],
  [/\bsling (?:us|me)\b/g, 'give me'],
  [/\bsort (?:us|me) out with\b/g, 'give me'],
  [/\bhook (?:us|me) up with\b/g, 'give me'],
  [/\bhit (?:us|me) with\b/g, 'give me'],
  [/\bgimme\b/g, 'give me'],
  [/\bgi[sz]\b/g, 'give me'],
  [/\blemme\b/g, 'let me'],
  [/\bwanna\b/g, 'want to'],
  [/\bgonna\b/g, 'going to'],
  [/\bgotta\b/g, 'have to'],
  [/\bhave i got\b/g, 'do i have'],
  [/\bgo on then\b/g, ''],
  [/\bright then\b/g, ''],
  [/\bif you (?:would|could|don't mind)\b/g, ''],
  [/\bbe a (?:legend|star|mate) and\b/g, '']
]

/** Single-token txt-speak → canonical token. Applied per word. */
const TOKEN_REWRITES: Record<string, string> = {
  u: 'you',
  ur: 'your',
  yr: 'your',
  r: 'are',
  wot: 'what',
  wut: 'what',
  wats: 'whats',
  hav: 'have',
  giv: 'give',
  sum: 'some',
  da: 'the',
  dis: 'this',
  dat: 'that',
  dem: 'them',
  tonite: 'tonight',
  '2nite': 'tonight',
  b4: 'before',
  abt: 'about',
  bout: 'about',
  cos: 'because',
  cuz: 'because',
  fav: 'favourite',
  favs: 'favourites',
  trax: 'tracks',
  trk: 'track',
  trks: 'tracks',
  choons: 'tunes',
  choon: 'tune',
  bangerz: 'bangers',
  plz: 'please',
  pls: 'please',
  thx: 'thanks',
  ty: 'thanks'
}

// ── Stage 2: filler stripping ────────────────────────────────────────────────

/** Vocatives, politeness and pure filler — removable without changing intent. */
const FILLER_WORDS = new Set([
  'oi',
  'oy',
  'yo',
  'ey',
  'ay',
  'hey',
  'hi',
  'hiya',
  'howdy',
  'mate',
  'mates',
  'm8',
  'bruv',
  'bro',
  'bruh',
  'fam',
  'pal',
  'dude',
  'lad',
  'lads',
  'geezer',
  'legend',
  'boss',
  'chief',
  'guv',
  'innit',
  'init',
  'cheers',
  'ta',
  'please',
  'kindly',
  'thanks',
  'some',
  'sorta',
  'kinda',
  'like,'
])

/** Leading throat-clearing trimmed only from the very front of the query. */
const LEADING_FILLER =
  /^(?:(?:ok(?:ay)?|so|right|alright|well|umm?|err?|look|listen|now then|quick one)[,\s]+)+/

// ── Stage 3: typo correction lexicon ─────────────────────────────────────────

/**
 * Words the intent detectors actually key on. A misspelled token may be
 * corrected to one of these (or to library vocabulary) — never to anything else.
 */
const INTENT_LEXICON = [
  // objects
  'track',
  'tracks',
  'song',
  'songs',
  'tune',
  'tunes',
  'music',
  'banger',
  'bangers',
  'set',
  'sets',
  'mix',
  'mixes',
  'crate',
  'library',
  'playlist',
  'playlists',
  'artist',
  'artists',
  'genre',
  'genres',
  'label',
  'labels',
  'album',
  'title',
  // verbs
  'play',
  'played',
  'playing',
  'plays',
  'build',
  'make',
  'find',
  'show',
  'give',
  'list',
  'count',
  'search',
  'export',
  'import',
  'delete',
  'remove',
  'clean',
  'sort',
  'rank',
  'compare',
  'suggest',
  'recommend',
  'discover',
  // attributes
  'bpm',
  'tempo',
  'key',
  'keys',
  'energy',
  'rating',
  'rated',
  'duration',
  'long',
  'short',
  'fast',
  'faster',
  'fastest',
  'slow',
  'slower',
  'slowest',
  'minor',
  'major',
  'flat',
  'harmonic',
  'camelot',
  'compatible',
  'vocal',
  'vocals',
  'instrumental',
  'acapella',
  'remix',
  'original',
  // analytics / history
  'most',
  'least',
  'never',
  'forgotten',
  'gems',
  'dormant',
  'neglected',
  'oldest',
  'newest',
  'recent',
  'recently',
  'added',
  'duplicates',
  'duplicate',
  'missing',
  'broken',
  'health',
  'stats',
  'breakdown',
  'average',
  'total',
  'percent',
  'history',
  'gig',
  'gigs',
  'session',
  'sessions',
  'venue',
  'venues',
  'festival',
  'club',
  'warehouse',
  'wedding',
  'setlist',
  'opener',
  'openers',
  'closer',
  'closers',
  'transition',
  'transitions',
  'after',
  'before',
  'similar',
  'longest',
  'shortest',
  // moods / arcs
  'dark',
  'darker',
  'chill',
  'chilled',
  'groovy',
  'rolling',
  'dreamy',
  'hypnotic',
  'euphoric',
  'peak',
  'warmup',
  'warm',
  'opening',
  'closing',
  'steady',
  'burn',
  'mood',
  'vibe',
  'vibes',
  // genres the matrix leans on (library vocab covers the rest)
  'house',
  'techno',
  'trance',
  'minimal',
  'electro',
  'disco',
  'breaks',
  'garage',
  'dubstep',
  'drum',
  'bass',
  'dnb',
  'ambient',
  'acid',
  'deep',
  'tech',
  'progressive',
  'hard',
  'jungle',
  'hardcore',
  'afro',
  'melodic',
  'detroit',
  'industrial',
  // time words
  'today',
  'tonight',
  'yesterday',
  'tomorrow',
  'week',
  'weeks',
  'month',
  'months',
  'year',
  'years',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'summer',
  'winter',
  // question words
  'what',
  'whats',
  'which',
  'when',
  'where',
  'how',
  'many',
  'much',
  'should',
  'have',
  'about'
]

const INTENT_SET = new Set(INTENT_LEXICON)

/** Common short words that must never be "corrected" into vocabulary. */
const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'for',
  'from',
  'into',
  'that',
  'this',
  'them',
  'then',
  'than',
  'more',
  'less',
  'only',
  'just',
  'all',
  'any',
  'are',
  'was',
  'were',
  'will',
  'would',
  'could',
  'can',
  'not',
  'out',
  'off',
  'over',
  'under',
  'between',
  'around',
  'last',
  'next',
  'first',
  'best',
  'top',
  'new',
  'old',
  'one',
  'two',
  'three',
  'four',
  'five',
  'ten',
  'hour',
  'hours',
  'minute',
  'minutes',
  'time',
  'times',
  'every',
  'each',
  'per',
  'but',
  'too',
  'very',
  'really',
  'now',
  'ago',
  'did',
  'does',
  'don',
  'dont',
  'doesnt',
  'didnt',
  'its',
  'his',
  'her',
  'their',
  'our',
  'your',
  'you',
  'me',
  'my',
  'mine',
  'i',
  'we',
  'us',
  'it',
  'in',
  'on',
  'at',
  'to',
  'of',
  'a',
  'an',
  'is',
  'be',
  'by',
  'or',
  'as',
  'up',
  'do',
  'go',
  'no',
  'so',
  'if'
])

// ── Library vocabulary ───────────────────────────────────────────────────────

export interface QueryVocab {
  /** Every known-good word: intent lexicon + words from the user's library. */
  known: Set<string>
  /** Correction candidates (same set, iterable). */
  words: string[]
}

const vocabCache = new WeakMap<readonly Track[], QueryVocab>()

function addWords(into: Set<string>, raw: string | undefined): void {
  if (!raw) return
  for (const w of raw.toLowerCase().split(/[^a-z0-9']+/)) {
    if (w.length >= 3) into.add(w)
  }
}

/** Build (and cache per track-array identity) the correction vocabulary. */
export function buildVocab(tracks: readonly Track[]): QueryVocab {
  const hit = vocabCache.get(tracks)
  if (hit) return hit
  const known = new Set<string>(INTENT_SET)
  for (const t of tracks) {
    addWords(known, t.artist)
    addWords(known, t.title)
    addWords(known, t.genre)
    addWords(known, t.label)
    addWords(known, t.album)
  }
  const vocab: QueryVocab = { known, words: Array.from(known) }
  vocabCache.set(tracks, vocab)
  return vocab
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Lowercase, soften punctuation, collapse whitespace — no semantic changes. */
export function basicClean(query: string): string {
  return query
    .toLowerCase()
    .replace(/[!,;]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ') // keep decimals like "1.5 hours"
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Full normalization: rewrites + filler stripping + typo correction.
 * Returns the cleaned query; compare against `basicClean(query)` to know
 * whether normalization actually changed anything worth a retry.
 */
export function normalizeQuery(query: string, vocab?: QueryVocab): string {
  let q = basicClean(query).replace(LEADING_FILLER, '')

  // Token rewrites FIRST so dialect phrases built from txt-speak ("giv us")
  // canonicalize before the phrase pass sees them ("give us" → "give me").
  q = q
    .split(' ')
    .map((w) => TOKEN_REWRITES[w] ?? w)
    .join(' ')

  for (const [re, to] of PHRASE_REWRITES) q = q.replace(re, to)

  const out: string[] = []
  for (const tok of q.split(' ')) {
    if (!tok || FILLER_WORDS.has(tok)) continue
    out.push(correctToken(tok, vocab))
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

function correctToken(tok: string, vocab?: QueryVocab): string {
  // Numbers, key notations (8a, 12b), short words and known words pass through.
  if (tok.length < 4) return tok
  if (/\d/.test(tok)) return tok
  if (STOP_WORDS.has(tok)) return tok
  if (INTENT_SET.has(tok)) return tok
  if (vocab?.known.has(tok)) return tok
  // Prefer intent-lexicon repairs (small, high-signal), then library vocabulary.
  const intentFix = bestMatch(tok, INTENT_LEXICON)
  if (intentFix) return intentFix
  if (vocab) {
    const libFix = bestMatch(tok, vocab.words)
    if (libFix) return libFix
  }
  return tok
}
