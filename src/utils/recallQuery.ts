/**
 * recallQuery.ts — Deterministic interpreter for SetSense Intelligence chat turns.
 *
 * Each turn is parsed (no model) into either a SEARCH (filter params that refine
 * across the conversation — count, sort, genre, bpm, energy, rating, dormancy)
 * or an ASK (a special intent — forgotten gems, closers, transitions, health,
 * identity, lifecycle — delegated to the existing engine). This is the accuracy
 * lever: common DJ requests resolve instantly and exactly.
 */

import type { LibrarySearchParams, SessionFilter, VenueType } from '../types'

export type ConvTurn =
  | { kind: 'search'; params: LibrarySearchParams; narration: string }
  | { kind: 'sessions'; filter: SessionFilter; narration: string }
  | { kind: 'ask' }

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
}

/** Last day of a month (handles Feb/leap years) for building a performed-date upper bound. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

const EVENT_TYPES: Array<{ re: RegExp; type: VenueType }> = [
  { re: /\bfestivals?\b/, type: 'festival' },
  { re: /\bclubs?\b/, type: 'club' },
  { re: /\bbars?\b/, type: 'bar' },
  { re: /\bprivate( events?| part(y|ies))?\b/, type: 'private' },
  { re: /\b(outdoor|open.?air|beach|pool)\b/, type: 'outdoor' }
]

/** Captured "at <venue>" strings that are clearly not venues. */
const NON_VENUE = new Set(['peak', 'peak time', 'home', 'work', 'night', 'day', 'once', 'least'])

// Longest-first so multi-word genres win over their suffixes.
const GENRES = [
  'progressive house',
  'melodic techno',
  'drum and bass',
  'liquid dnb',
  'tech house',
  'deep house',
  'afro house',
  'hard techno',
  'uk garage',
  'nu disco',
  'hip hop',
  'hip-hop',
  'amapiano',
  'afrobeats',
  'reggaeton',
  'breakbeat',
  'hardstyle',
  'psytrance',
  'dubstep',
  'techno',
  'trance',
  'garage',
  'electro',
  'minimal',
  'disco',
  'house',
  'jungle',
  'grime',
  'ambient',
  'downtempo',
  'hardcore',
  'breaks',
  'trap',
  'funk',
  'soul',
  'dnb',
  'd&b',
  'ukg',
  'acid'
]

const PRETTY: Record<string, string> = {
  ukg: 'UK garage',
  dnb: 'drum & bass',
  'd&b': 'drum & bass',
  'hip-hop': 'hip-hop'
}

function matchGenre(q: string): string | undefined {
  for (const g of GENRES) {
    const re = new RegExp(`(?:^|[^a-z])${g.replace(/[+*&]/g, '\\$&')}(?:$|[^a-z])`)
    if (re.test(q)) return g
  }
  return undefined
}

function prettyGenre(g: string): string {
  return PRETTY[g] ?? g
}

const SPECIAL = [
  /\b(forgotten|forgot|gems?|heaters?|used to (play|spin)|haven'?t (played|spun)|rediscover|gathering dust)\b/,
  /\b(my )?(best )?clos(e|er|ers|ing)\b/,
  /\b(my )?(best |go.?to )?(open(er|ers|ing)|first track)\b/,
  /\b(transitions?|combos?|most (common|used) (transitions|pairs|runs)|my runs|what (do i|i) play after)\b/,
  /\b(library health|missing (files?|keys?|bpm)|duplicates?|clean.?up my library)\b/,
  /\b(my taste|my identity|my signature|my sound|wrapped|taste profile|what genres do i)\b/,
  /\b(lifecycle|peak rotation breakdown|how many.*(peak|forgotten|untested|active))\b/,
  /\bafter\s+.{2,}/
]

/**
 * Open-notation key → Camelot conversion.
 * Used by the NL parser so a user can type "in Am" or "in C# major".
 */
const OPEN_TO_CAMELOT: Record<string, string> = {
  // Minor keys (A side)
  am: '8A',
  'a min': '8A',
  'a minor': '8A',
  'a#m': '3A',
  bbm: '3A',
  'a# min': '3A',
  'bb min': '3A',
  'bb minor': '3A',
  bm: '10A',
  'b min': '10A',
  'b minor': '10A',
  cm: '5A',
  'c min': '5A',
  'c minor': '5A',
  'c#m': '12A',
  dbm: '12A',
  'c# min': '12A',
  'db min': '12A',
  dm: '7A',
  'd min': '7A',
  'd minor': '7A',
  'd#m': '2A',
  ebm: '2A',
  'd# min': '2A',
  'eb min': '2A',
  em: '9A',
  'e min': '9A',
  'e minor': '9A',
  fm: '4A',
  'f min': '4A',
  'f minor': '4A',
  'f#m': '11A',
  gbm: '11A',
  'f# min': '11A',
  'gb min': '11A',
  gm: '6A',
  'g min': '6A',
  'g minor': '6A',
  'g#m': '1A',
  abm: '1A',
  'g# min': '1A',
  'ab min': '1A',
  // Major keys (B side)
  c: '8B',
  'c maj': '8B',
  'c major': '8B',
  'c#': '3B',
  db: '3B',
  'c# maj': '3B',
  'db maj': '3B',
  d: '10B',
  'd maj': '10B',
  'd major': '10B',
  'd#': '5B',
  eb: '5B',
  'd# maj': '5B',
  'eb maj': '5B',
  e: '12B',
  'e maj': '12B',
  'e major': '12B',
  f: '7B',
  'f maj': '7B',
  'f major': '7B',
  'f#': '2B',
  gb: '2B',
  'f# maj': '2B',
  'gb maj': '2B',
  g: '9B',
  'g maj': '9B',
  'g major': '9B',
  'g#': '4B',
  ab: '4B',
  'g# maj': '4B',
  'ab maj': '4B',
  a: '11B',
  'a maj': '11B',
  'a major': '11B',
  'a#': '6B',
  bb: '6B',
  'a# maj': '6B',
  'bb maj': '6B',
  b: '1B',
  'b maj': '1B',
  'b major': '1B'
}

function isSpecial(q: string): boolean {
  return SPECIAL.some((re) => re.test(q))
}

function hasParams(p: LibrarySearchParams): boolean {
  return Object.values(p).some((v) => v !== undefined)
}

/**
 * Strip request verbs, filler and punctuation so a bare text search isn't
 * polluted ("find Burial" → "burial", "give me 10 Fisher songs" → "fisher",
 * "anything by Ricardo Villalobos" → "ricardo villalobos").
 */
function textQuery(q: string): string {
  return q
    .replace(/['"?!.]/g, ' ')
    .replace(/\b\d{1,3}\b/g, ' ') // counts are handled separately
    .replace(
      /\b(give me|show me|find me|gimme|get me|pull up|pull|grab|play me|play|i ?want|i ?need|i'?d like|can you|could you|do i (?:have|own)|have i got|got any|search for|search|look for|find|list|all of my|all my|all|some|any|a few|a couple|me|my|tracks? by|songs? by|tracks?|songs?|tunes?|cuts?|records?|stuff|music|please|by|from|with|in (?:the )?(?:title|name)|called|named|that (?:contain|have)|containing|contains|anything|something)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/** Stripped text that carries no real search target — treat as "no text". */
const STOPWORD_TEXT = new Set(['', 'one', 'track', 'song', 'tune', 'thing', 'good', 'nice'])

export function interpretTurn(raw: string, prev: LibrarySearchParams): ConvTurn {
  const q = raw.toLowerCase().trim()
  if (!q) return { kind: 'search', params: { ...prev }, narration: 'Here you go.' }
  // Cue-label queries look like a free-text intent but should resolve through SEARCH
  // (they need to filter on cue label, not be routed to the LLM ASK fallback).
  const isCueLabelQuery =
    /\bcue(?:[\s-]?points?)?\s+(?:labelled|labeled|called|named|tagged)\b/.test(q)
  if (isSpecial(q) && !isCueLabelQuery) return { kind: 'ask' }

  const tweak =
    /\b(actually|instead|rather|make (it|them|these)|just|only|also|too|as well|change (it|that)|but|narrow|widen|fewer|more of)\b/.test(
      q
    )
  const reshuffle =
    /\b(more|another|others|different ones|something else|next batch|other tracks|again)\b/.test(q)

  // ── Cue label (parse + strip before counts) ──────────────────────────────
  let work = q
  let cueLabel: string | undefined
  const cueMatch = work.match(
    /\bcue(?:[\s-]?points?)?\s+(?:labelled|labeled|called|named|tagged)\s+['"]?([a-z0-9 _\-/]{2,30})['"]?/
  )
  if (cueMatch) {
    cueLabel = cueMatch[1].trim()
    work = work.replace(cueMatch[0], ' ')
  }

  // ── Duration (parse + strip) ─────────────────────────────────────────────
  let durationMinSec: number | undefined
  let durationMaxSec: number | undefined
  const durRange = work.match(/(\d{1,2})\s*(?:-|–|—|to|and)\s*(\d{1,2})\s*min(?:ute)?s?\b/)
  if (durRange) {
    durationMinSec = Math.min(+durRange[1], +durRange[2]) * 60
    durationMaxSec = Math.max(+durRange[1], +durRange[2]) * 60
    work = work.replace(durRange[0], ' ')
  } else {
    const durUnder = work.match(
      /\b(?:under|less than|shorter than|below)\s+(\d{1,2})\s*min(?:ute)?s?\b/
    )
    if (durUnder) {
      durationMaxSec = +durUnder[1] * 60
      work = work.replace(durUnder[0], ' ')
    }
    const durOver = work.match(
      /\b(?:over|more than|longer than|above)\s+(\d{1,2})\s*min(?:ute)?s?\b/
    )
    if (durOver) {
      durationMinSec = +durOver[1] * 60
      work = work.replace(durOver[0], ' ')
    }
  }

  // ── Date-added (parse + strip) ───────────────────────────────────────────
  let addedAfter: string | undefined
  let addedBefore: string | undefined
  const dateLast = work.match(
    /\badded (?:in (?:the )?)?last\s+(\d+)\s*(day|days|week|weeks|month|months|year|years)\b/
  )
  if (dateLast) {
    const n = +dateLast[1]
    const unit = dateLast[2]
    const mult = unit.startsWith('day')
      ? 86400
      : unit.startsWith('week')
        ? 7 * 86400
        : unit.startsWith('month')
          ? 30.44 * 86400
          : 365.25 * 86400
    addedAfter = new Date(Date.now() - n * mult * 1000).toISOString()
    work = work.replace(dateLast[0], ' ')
  }
  const dateYear = work.match(/\badded (?:in )?(\d{4})\b/)
  if (dateYear) {
    const year = +dateYear[1]
    if (year >= 1990 && year <= 2100) {
      addedAfter = `${year}-01-01T00:00:00.000Z`
      addedBefore = `${year}-12-31T23:59:59.999Z`
    }
    work = work.replace(dateYear[0], ' ')
  }

  // ── BPM (parse + strip so its digits don't get read as a count) ───────────
  let bpmMin: number | undefined
  let bpmMax: number | undefined
  const range = work.match(/(\d{2,3})\s*(?:-|–|—|to|and|through)\s*(\d{2,3})\s*bpm/)
  if (range) {
    bpmMin = Math.min(+range[1], +range[2])
    bpmMax = Math.max(+range[1], +range[2])
    work = work.replace(range[0], ' ')
  } else {
    const single =
      work.match(/(\d{2,3})\s*bpm/) || work.match(/\b(?:around|about|near|at|~)\s*(\d{2,3})\b/)
    if (single) {
      const t = +single[1]
      if (t >= 60 && t <= 210) {
        bpmMin = t - 3
        bpmMax = t + 3
        work = work.replace(single[0], ' ')
      }
    }
  }

  // ── Key (Camelot + open notation) ────────────────────────────────────────
  let keyExact: string | undefined
  const camelot = work.match(/\b(?:in\s+(?:key\s+)?|key\s+)?(\d{1,2}[ab])\b/)
  if (camelot) {
    const upper = camelot[1].toUpperCase()
    // Validate range 1A–12B
    const num = parseInt(upper, 10)
    if (num >= 1 && num <= 12) {
      keyExact = upper
      work = work.replace(camelot[0], ' ')
    }
  }
  if (!keyExact) {
    const openKey = work.match(/\bin\s+(?:key\s+)?([a-g][#b]?\s*(?:m|min|minor|maj|major)?)\b/)
    if (openKey) {
      // Normalise "major" → "maj" / "minor" → "min" so the lookup table doesn't
      // need to enumerate every word form.
      const norm = openKey[1]
        .replace(/\bmajor\b/g, 'maj')
        .replace(/\bminor\b/g, 'min')
        .replace(/\s+/g, ' ')
        .trim()
      const mapped = OPEN_TO_CAMELOT[norm] ?? OPEN_TO_CAMELOT[norm.replace(/\s+/g, '')]
      if (mapped) {
        keyExact = mapped
        work = work.replace(openKey[0], ' ')
      }
    }
  }

  // ── Performed when/where (gig metadata) ──────────────────────────────────
  // Only parse performance constraints when the query is clearly about playing
  // — "songs I PLAYED at X", "my festival SETS", "GIGS in July". This gate keeps
  // "tracks at 128 bpm" / "house in 2024" out of the venue/date parsers. BPM and
  // key tokens were already stripped above, so the numeric "at"/"in" forms are gone.
  const perfContext =
    /\b(play|plays|played|playing|spun|spin|gig|gigs|set|sets|night|nights|performed|performance|performances|venue|residency)\b/.test(
      q
    )
  let performedVenue: string | undefined
  let performedAfter: string | undefined
  let performedBefore: string | undefined
  let performedEventType: VenueType | undefined
  let performedMonthLabel: string | undefined

  if (perfContext) {
    // Month + year → a one-month performed range. "in july 2025" / "july 2025".
    const monthYear = work.match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/
    )
    if (monthYear) {
      const m = MONTHS[monthYear[1]]
      const y = +monthYear[2]
      if (m && y >= 1990 && y <= 2100) {
        const mm = String(m).padStart(2, '0')
        const dd = String(lastDayOfMonth(y, m)).padStart(2, '0')
        performedAfter = `${y}-${mm}-01`
        performedBefore = `${y}-${mm}-${dd}`
        performedMonthLabel = `${monthYear[1]} ${y}`
        work = work.replace(monthYear[0], ' ')
      }
    }
    // Bare year with performance context → that whole year. "sets in 2025".
    if (!performedAfter) {
      const perfYear = work.match(/\bin\s+(\d{4})\b/)
      if (perfYear) {
        const y = +perfYear[1]
        if (y >= 1990 && y <= 2100) {
          performedAfter = `${y}-01-01`
          performedBefore = `${y}-12-31`
          work = work.replace(perfYear[0], ' ')
        }
      }
    }
    // Venue: "at <name>" up to a trailing time/stopword or end of string.
    const atVenue = work.match(
      /\bat\s+([a-z0-9][a-z0-9'&.\s]{1,38}?)(?=\s+(?:in|on|during|last|this|back|when|while)\b|[,.]|$)/
    )
    if (atVenue) {
      const cand = atVenue[1].replace(/\s+/g, ' ').trim()
      if (cand && !NON_VENUE.has(cand)) {
        performedVenue = cand
        work = work.replace(atVenue[0], ' ')
      }
    }
    // Event type: festival / club / bar / private / outdoor.
    for (const { re, type } of EVENT_TYPES) {
      if (re.test(q)) {
        performedEventType = type
        break
      }
    }
  }

  // ── Count / limit ─────────────────────────────────────────────────────────
  // Strip rating ("5 star") and dormancy ("6 months") digits first so they're
  // never mistaken for a track count.
  const countWork = work
    .replace(/\b[1-5]\s*stars?\b/g, ' ')
    .replace(/\b\d+\s*(?:months?|years?)\b/g, ' ')

  // Most explicit → least. "N …tracks" handles "15 UKG tracks"; the leading-N
  // fallback only fires for plausible counts (≤100) so a bare BPM/year isn't
  // read as a count.
  const mTracks = countWork.match(
    /\b(\d{1,3})(?=[^\d]{0,40}?\b(?:tracks?|songs?|tunes?|cuts?|records?)\b)/
  )
  const mVerb = countWork.match(
    /\b(?:top|first|best|give me|show me|find me|gimme|get me|i want|i need|pull|grab|just|only|now|make it|another|actually)\s+(\d{1,3})\b/
  )
  const mMore = countWork.match(/\b(\d{1,3})\s*more\b/)
  const mBare = countWork.match(/^\s*(\d{1,3})\s*$/)
  const mLead = countWork.match(/^\s*(\d{1,3})\b/)

  let limit: number | undefined
  if (mTracks) limit = +mTracks[1]
  else if (mVerb) limit = +mVerb[1]
  else if (mMore) limit = +mMore[1]
  else if (mBare) limit = +mBare[1]
  else if (mLead && +mLead[1] <= 100) limit = +mLead[1]
  if (limit != null && (limit < 1 || limit > 500)) limit = undefined

  const genre = matchGenre(q)

  // ── Energy ──────────────────────────────────────────────────────────────
  let energyMin: number | undefined
  let energyMax: number | undefined
  if (
    /\b(peak|banger|bangers|hard|harder|heavy|heavier|high.?energy|festival|big room|rave|dirty)\b/.test(
      q
    )
  ) {
    energyMin = 8
  } else if (
    /\b(chill|chilled|chiller|mellow|low.?energy|warm.?up|sleepy|soft|softer|deep cuts?)\b/.test(q)
  ) {
    energyMax = 4
  } else if (/\b(groovy|mid.?energy|medium energy|rolling|steady)\b/.test(q)) {
    energyMin = 4
    energyMax = 6
  }

  // ── Rating ────────────────────────────────────────────────────────────────
  let minRating: number | undefined
  const ratingMatch = q.match(/\b([1-5])\s*star/)
  if (ratingMatch) minRating = +ratingMatch[1]
  else if (/\b(favou?rites?|top rated|best rated|my best)\b/.test(q)) minRating = 4

  // ── Dormancy / never played ─────────────────────────────────────────────
  let dormantMonths: number | undefined
  const dormant = q.match(
    /\bnot (?:played|spun) in (?:the last )?(\d+)\s*(month|months|year|years)/
  )
  if (dormant) dormantMonths = dormant[2].startsWith('year') ? +dormant[1] * 12 : +dormant[1]
  const neverPlayed = /\b(never (played|tested|spun)|untested|not (played|tested) live)\b/.test(q)
    ? true
    : undefined

  // ── Sort ──────────────────────────────────────────────────────────────────
  let sort: LibrarySearchParams['sort']
  let popularityNote = false
  if (
    /\b(most[- ]?played|play(ed)? (the )?most|most i play|go[- ]?to|heaviest rotation|on repeat|i (play|spin) (the )?most|rinse|favou?rites?)\b/.test(
      q
    )
  )
    sort = 'mostPlayed'
  else if (/\b(least[- ]?played|rarely play|hardly play|barely play)\b/.test(q))
    sort = 'leastPlayed'
  else if (/\b(newest|recently added|latest|new(ly)? (added|downloaded)|freshest|fresh)\b/.test(q))
    sort = 'recent'
  else if (/\b(oldest|first added|longest ago)\b/.test(q)) sort = 'oldest'
  else if (/\b(highest[- ]?rated|best[- ]?rated|top[- ]?rated)\b/.test(q)) sort = 'rating'
  else if (/\b(random|surprise me|shuffle|anything)\b/.test(q)) sort = 'random'
  if (/\b(popular|trending|charting|hot right now|popular now|whats hot|in right now)\b/.test(q)) {
    popularityNote = true
    if (!sort) sort = 'mostPlayed'
  }

  const detected: LibrarySearchParams = {}
  if (genre) detected.genre = genre
  if (bpmMin != null) detected.bpmMin = bpmMin
  if (bpmMax != null) detected.bpmMax = bpmMax
  if (energyMin != null) detected.energyMin = energyMin
  if (energyMax != null) detected.energyMax = energyMax
  if (minRating != null) detected.minRating = minRating
  if (dormantMonths != null) detected.dormantMonths = dormantMonths
  if (neverPlayed) detected.neverPlayed = neverPlayed
  if (keyExact) detected.keyExact = keyExact
  if (durationMinSec != null) detected.durationMinSec = durationMinSec
  if (durationMaxSec != null) detected.durationMaxSec = durationMaxSec
  if (addedAfter) detected.addedAfter = addedAfter
  if (addedBefore) detected.addedBefore = addedBefore
  if (performedVenue) detected.performedVenue = performedVenue
  if (performedAfter) detected.performedAfter = performedAfter
  if (performedBefore) detected.performedBefore = performedBefore
  if (performedEventType) detected.performedEventType = performedEventType
  if (cueLabel) detected.cueLabel = cueLabel
  if (sort) detected.sort = sort
  if (limit != null) detected.limit = limit

  // Sets-vs-songs: when a gig constraint is present and the user asked about
  // SETS/GIGS/NIGHTS (not songs/tracks), return a session-oriented result that
  // the Gigs view renders. Otherwise gig constraints stay on the track search.
  const hasGigFilter = !!(performedVenue || performedAfter || performedEventType)
  if (hasGigFilter) {
    const sessionNoun = /\b(sets?|gigs?|nights?|performances?|residenc(?:y|ies))\b/.test(q)
    const songNoun = /\b(songs?|tracks?|tunes?|cuts?|records?)\b/.test(q)
    if (sessionNoun && !songNoun) {
      const filter: SessionFilter = {}
      if (performedVenue) filter.venue = performedVenue
      if (performedAfter) filter.after = performedAfter
      if (performedBefore) filter.before = performedBefore
      if (performedEventType) filter.eventType = performedEventType
      return {
        kind: 'sessions',
        filter,
        narration: describeSessions(filter, performedMonthLabel)
      }
    }
  }

  const detectedAnything = hasParams(detected)
  // A bare count or sort isn't a "real filter" — keep extracting the artist/title
  // text in that case so "give me 10 Fisher songs" still searches for Fisher.
  const hasRealFilter = !!(
    genre ||
    bpmMin != null ||
    bpmMax != null ||
    energyMin != null ||
    energyMax != null ||
    minRating != null ||
    dormantMonths != null ||
    neverPlayed ||
    keyExact ||
    durationMinSec != null ||
    durationMaxSec != null ||
    addedAfter ||
    addedBefore ||
    performedVenue ||
    performedAfter ||
    performedBefore ||
    performedEventType ||
    cueLabel
  )
  const stripped = !hasRealFilter && !reshuffle ? textQuery(q) : ''
  const text = STOPWORD_TEXT.has(stripped) ? '' : stripped

  // Decide whether this is a fresh search or a refinement of the running filter.
  const first = !hasParams(prev)
  const fresh = first || (!!genre && !tweak) || (!!text && !tweak)

  let params: LibrarySearchParams = fresh ? {} : { ...prev }
  params = { ...params, ...detected }
  if (text) params.text = text
  if (reshuffle && !detectedAnything) {
    params = { ...prev, sort: 'random' }
  }
  if (fresh && !params.sort) params.sort = 'mostPlayed'
  if (params.limit == null) params.limit = 25

  return { kind: 'search', params, narration: describe(params, popularityNote, reshuffle) }
}

function describe(p: LibrarySearchParams, popularityNote: boolean, reshuffle: boolean): string {
  if (reshuffle) return 'Here’s another batch.'
  const parts: string[] = []
  const count = p.limit && p.limit !== 25 ? `${p.limit} ` : ''

  let energyWord = ''
  if (p.energyMin != null && p.energyMin >= 8) energyWord = 'high-energy '
  else if (p.energyMax != null && p.energyMax <= 4) energyWord = 'chilled '
  else if (p.energyMin === 4 && p.energyMax === 6) energyWord = 'groovy '

  const genreWord = p.genre ? `${prettyGenre(p.genre)} ` : ''
  const noun = p.text ? `tracks matching “${p.text}”` : 'tracks'
  parts.push(`${count}${energyWord}${genreWord}${noun}`.trim())

  if (p.bpmMin != null && p.bpmMax != null) {
    parts.push(
      p.bpmMin === p.bpmMax - 6
        ? `around ${(p.bpmMin + p.bpmMax) / 2} BPM`
        : `${p.bpmMin}–${p.bpmMax} BPM`
    )
  }
  if (p.keyExact) parts.push(`in ${p.keyExact}`)
  if (p.minRating != null) parts.push(`rated ${p.minRating}★+`)
  if (p.neverPlayed) parts.push('never played live')
  if (p.dormantMonths != null) parts.push(`untouched for ${p.dormantMonths}+ months`)
  if (p.durationMinSec != null && p.durationMaxSec != null) {
    parts.push(`${Math.round(p.durationMinSec / 60)}–${Math.round(p.durationMaxSec / 60)} min long`)
  } else if (p.durationMaxSec != null) {
    parts.push(`under ${Math.round(p.durationMaxSec / 60)} min`)
  } else if (p.durationMinSec != null) {
    parts.push(`over ${Math.round(p.durationMinSec / 60)} min`)
  }
  if (p.addedAfter && p.addedBefore) {
    const year = new Date(p.addedAfter).getUTCFullYear()
    parts.push(`added in ${year}`)
  } else if (p.addedAfter) {
    parts.push('recently added')
  }
  if (p.cueLabel) parts.push(`cue labelled “${p.cueLabel}”`)
  if (p.performedVenue) parts.push(`you played at ${p.performedVenue}`)
  if (p.performedEventType) parts.push(`from your ${p.performedEventType} sets`)
  if (p.performedAfter) {
    const label = performedRangeLabel(p.performedAfter, p.performedBefore)
    if (label) parts.push(`played ${label}`)
  }

  const sortWord =
    p.sort === 'mostPlayed'
      ? 'sorted by how often you play them'
      : p.sort === 'leastPlayed'
        ? 'rarest-played first'
        : p.sort === 'recent'
          ? 'newest first'
          : p.sort === 'oldest'
            ? 'oldest first'
            : p.sort === 'rating'
              ? 'highest-rated first'
              : p.sort === 'random'
                ? 'in random order'
                : ''

  let s = `Here are your ${parts.join(', ')}`
  if (sortWord) s += ` — ${sortWord}`
  s += '.'
  if (popularityNote)
    s += ' (I can’t see live charts offline, so these are ranked from your own play history.)'
  return s
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Human label for a performed-date range: a single month, a year, or a span. */
function performedRangeLabel(after?: string, before?: string): string {
  if (!after) return ''
  const a = after.slice(0, 10)
  const b = (before ?? '').slice(0, 10)
  const [ay, am] = a.split('-').map(Number)
  // Whole-month range (first → last day of the same month).
  if (b && b.startsWith(`${a.slice(0, 7)}-`)) return `${MONTH_NAMES[am - 1]} ${ay}`
  // Whole-year range.
  if (a.endsWith('-01-01') && b.endsWith('-12-31')) return `in ${ay}`
  return b ? `between ${a} and ${b}` : `since ${a}`
}

/** Narration for a session-oriented result shown in the Gigs view. */
function describeSessions(filter: SessionFilter, monthLabel?: string): string {
  const bits: string[] = []
  if (filter.eventType) bits.push(`${filter.eventType} sets`)
  else bits.push('sets')
  if (filter.venue) bits.push(`at ${filter.venue}`)
  const when = monthLabel ?? performedRangeLabel(filter.after, filter.before)
  if (when) bits.push(monthLabel ? `in ${when}` : when)
  return `Opening your ${bits.join(' ')} in the Gigs view.`
}
