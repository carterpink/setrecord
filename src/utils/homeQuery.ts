/**
 * homeQuery.ts — classifier for the conversational Home surface.
 *
 * Turns a plain-English request into a KIND, an editable FILTER MODEL, and a
 * set of gentle follow-ups. It composes the existing deterministic interpreter
 * (`interpretTurn` in recallQuery.ts) for the generic path and adds light
 * extraction for the four bespoke kinds (forgotten / warmup / after /
 * duplicates). The actual data fetching lives in homeStore — this module is
 * pure and side-effect-free so it can be unit-tested in isolation.
 */

import type { LibrarySearchParams } from '@/types'
import { interpretTurn } from '@/utils/recallQuery'
import { detectReverseShazam, type ShazamHit } from '@/utils/reverseShazamIntent'

export type HomeKind = 'forgotten' | 'warmup' | 'after' | 'duplicates' | 'shazam' | 'generic'

export interface ForgottenFilters {
  kind: 'forgotten'
  /** One of the fixed dormancy windows offered in the refine panel. */
  window: '3 months' | '6 months' | '12 months'
  neverLive: boolean
  count: number
}
export interface WarmupFilters {
  kind: 'warmup'
  /** Target (peak) BPM the ramp climbs toward. */
  bpm: number
  /** Set length in minutes. */
  length: number
  shape: 'Slow burn' | 'Steady'
}
export interface AfterFilters {
  kind: 'after'
  /** Raw track query the user named (resolved to a real track at run time). */
  source: string
  inKey: boolean
  energy: 'Hold' | 'Lift'
}
export interface DuplicatesFilters {
  kind: 'duplicates'
  match: 'Audio' | 'Tags'
  keep: 'Highest quality' | 'Newest'
}
export interface ShazamFilters {
  kind: 'shazam'
  /** The detected moment anchor (occasion / position / clock hour). */
  hit: ShazamHit
  /** The raw query, for the "I read that as" line + re-runs. */
  query: string
}
export interface GenericFilters {
  kind: 'generic'
  params: LibrarySearchParams
  /** True when the deterministic parser couldn't pin it down → use the model. */
  ask: boolean
  /** The raw query, needed for the model ask path + re-runs. */
  query: string
  /** Human narration from the deterministic parser (for the interpret line). */
  narration: string
}

export type HomeFilters =
  | ForgottenFilters
  | WarmupFilters
  | AfterFilters
  | DuplicatesFilters
  | ShazamFilters
  | GenericFilters

export interface HomeInterpretation {
  kind: HomeKind
  filters: HomeFilters
  followups: string[]
}

/** Snap an arbitrary month count to the nearest offered dormancy window. */
function snapWindow(months: number): ForgottenFilters['window'] {
  if (months <= 4) return '3 months'
  if (months <= 9) return '6 months'
  return '12 months'
}

function parseTargetBpm(q: string): number | undefined {
  const range = q.match(/(\d{2,3})\s*(?:-|–|—|to|and)\s*(\d{2,3})\s*bpm/)
  if (range) return Math.max(+range[1], +range[2])
  const single = q.match(/(\d{2,3})\s*bpm/) || q.match(/\b(?:around|about|near|at|~)\s*(\d{2,3})\b/)
  if (single) {
    const t = +single[1]
    if (t >= 60 && t <= 210) return t
  }
  return undefined
}

function parseMinutes(q: string): number | undefined {
  const hour = q.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)s?\b/)
  if (hour) return Math.round(parseFloat(hour[1]) * 60)
  const min = q.match(/(\d{1,3})\s*(?:-|–|—|to)?\s*min(?:ute)?s?\b/)
  if (min) {
    const m = +min[1]
    if (m >= 5 && m <= 600) return m
  }
  return undefined
}

function parseCount(q: string): number | undefined {
  const m =
    q.match(/\b(\d{1,3})\s*(?:tracks?|songs?|tunes?|gems?|cuts?)\b/) ||
    q.match(/\b(?:top|first|give me|show me|find me|me)\s+(\d{1,3})\b/) ||
    q.match(/^\s*(\d{1,3})\b/)
  if (m) {
    const n = +m[1]
    if (n >= 1 && n <= 100) return n
  }
  return undefined
}

const NEVER_LIVE_RE =
  /\bnever (?:played|tested|spun)(?:\s+live)?\b|\bnever played live\b|\buntested\b/

/**
 * Pull the named track out of an "after X" / "play after X" / "mix out of X"
 * request. Returns the trimmed remainder, which homeStore resolves to a track.
 */
function parseAfterSource(q: string): string {
  const m = q.match(
    /\b(?:what (?:do i|to|should i) play after|play after|after|follows?|mix(?:ing)? out of|out of)\s+(.+)$/i
  )
  let s = (m?.[1] ?? '').trim()
  // Drop a trailing question mark and a leading "the track/song".
  s = s.replace(/\?+\s*$/, '').replace(/^(?:the\s+)?(?:track|song|tune)\s+/i, '')
  return s.trim()
}

const DUP_RE = /\b(dupl|duplicates?|dedupe|de-?dupe|clean ?up(?:\s+my)?(?:\s+library)?)\b/
// The bare "after X" form must not fire on "released after 2019" (a year filter)
// or "after 2019" — require a non-digit, non-"released" context.
const AFTER_RE =
  /\b(?:what (?:do i|to|should i) play after|play after|mix(?:ing)? out of)\b|(?<!released\s)(?<!reissued\s)\bafter\s+(?!\d)\S/i
const FORGOTTEN_RE =
  /\b(forgotten|forgot|gems?|haven'?t (?:played|spun)|used to (?:play|spin)|rediscover|gathering dust|left to rest|in ages|in a while|neglected|dust(?:y|ing)?)\b/
const WARMUP_RE = /\bwarm[- ]?up\b/

/** A set-building request: "build me a 90-minute set", "make a 2-hour mix at 124 bpm". */
function isBuildRequest(q: string): boolean {
  if (WARMUP_RE.test(q)) return true
  const hasBuildVerb = /\b(build|make|put together|create|craft|assemble)\b/.test(q)
  const hasSetNoun = /\b(set|mix|warm[- ]?up|journey)\b/.test(q)
  const hasDuration = /\b\d+\s*(?:-|–|—|to)?\s*(?:min(?:ute)?s?|hours?|hrs?)\b/.test(q)
  if (hasBuildVerb && (hasSetNoun || hasDuration)) return true
  // "a 90 minute set at 124" without an explicit verb
  if (hasSetNoun && hasDuration) return true
  return false
}

export function interpretHome(raw: string): HomeInterpretation {
  const q = raw.toLowerCase().trim()

  // 1) Duplicates / clean-up
  if (DUP_RE.test(q)) {
    return {
      kind: 'duplicates',
      filters: { kind: 'duplicates', match: 'Audio', keep: 'Highest quality' },
      followups: ['Show my library health', 'Find my forgotten gems', 'What’s my sound?']
    }
  }

  // 2) Reverse-Shazam: recall a track by the MOMENT it was played (occasion /
  //    position / clock anchor). Fires before the generic path; the detector
  //    self-guards so plain gig recall ("what did I play last Saturday") falls
  //    through to the deterministic interpreter below.
  const shazamHit = detectReverseShazam(raw)
  if (shazamHit) {
    return {
      kind: 'shazam',
      filters: { kind: 'shazam', hit: shazamHit, query: raw },
      followups: ['Show the whole set', 'What did I open with', 'What did I close with']
    }
  }

  // 3) Build a set (warm-up or any timed set)
  if (isBuildRequest(q)) {
    const bpm = parseTargetBpm(q) ?? 124
    const length = parseMinutes(q) ?? 90
    const shape: WarmupFilters['shape'] = /\bsteady|consistent|flat|even\b/.test(q)
      ? 'Steady'
      : 'Slow burn'
    return {
      kind: 'warmup',
      filters: { kind: 'warmup', bpm, length, shape },
      followups: ['A touch slower to start', 'Open it in Build', 'What do I play after the opener']
    }
  }

  // 3) What do I play after <track>
  if (AFTER_RE.test(q)) {
    const source = parseAfterSource(q)
    if (source) {
      return {
        kind: 'after',
        filters: {
          kind: 'after',
          source,
          inKey: !/\b(any key|out of key)\b/.test(q),
          energy: /\b(lift|raise|build|up|harder|peak)\b/.test(q) ? 'Lift' : 'Hold'
        },
        followups: [
          'Take the energy up instead',
          'Keep it strictly in key',
          'Build the rest of the hour'
        ]
      }
    }
  }

  // 4) Forgotten gems
  if (FORGOTTEN_RE.test(q)) {
    const monthsMatch = q.match(/(\d+)\s*(month|months|year|years)/)
    const months = monthsMatch
      ? monthsMatch[2].startsWith('year')
        ? +monthsMatch[1] * 12
        : +monthsMatch[1]
      : 6
    return {
      kind: 'forgotten',
      filters: {
        kind: 'forgotten',
        window: snapWindow(months),
        neverLive: NEVER_LIVE_RE.test(q),
        count: parseCount(q) ?? 10
      },
      followups: ['Only the ones under 124 bpm', 'Build a set from these', 'Surprise me with one']
    }
  }

  // 5) Everything else → the deterministic interpreter (search) or the model (ask)
  const turn = interpretTurn(q, {})
  if (turn.kind === 'search') {
    return {
      kind: 'generic',
      filters: {
        kind: 'generic',
        params: turn.params,
        ask: false,
        query: raw,
        narration: turn.narration
      },
      followups: ['Surprise me', 'My most played', 'Find my forgotten gems']
    }
  }
  return {
    kind: 'generic',
    filters: { kind: 'generic', params: {}, ask: true, query: raw, narration: '' },
    followups: ['Find my forgotten gems', 'Build a warm-up set', 'What’s my sound?']
  }
}

// ─── Editable filters → real query params ────────────────────────────────────

/** Months for each dormancy window (used to build search params). */
export function windowMonths(window: ForgottenFilters['window']): number {
  return window === '3 months' ? 3 : window === '6 months' ? 6 : 12
}

/** Map the forgotten filter model to deterministic search params. */
export function forgottenParams(f: ForgottenFilters): LibrarySearchParams {
  return {
    dormantMonths: windowMonths(f.window),
    neverPlayed: f.neverLive || undefined,
    sort: 'oldest',
    limit: f.count
  }
}

/**
 * Plain-language summary for the "I read that as …" line. Kept here (pure) so
 * it stays in lock-step with the filter model and is unit-testable.
 */
export function readSummary(f: HomeFilters): string {
  switch (f.kind) {
    case 'forgotten': {
      const parts = [`not played in ${f.window}+`]
      if (f.neverLive) parts.push('never played live')
      parts.push(`top ${f.count}`)
      return parts.join(', ')
    }
    case 'warmup':
      return `${f.bpm} bpm · ${f.length} min · ${f.shape.toLowerCase()}`
    case 'after':
      return `mixing out of ${f.source}, ${f.inKey ? 'harmonic' : 'any key'}, energy ${f.energy.toLowerCase()}`
    case 'duplicates':
      return `matched on ${f.match.toLowerCase()}, keeping the ${f.keep.toLowerCase()}`
    case 'shazam': {
      const parts: string[] = []
      if (f.hit.occasion) parts.push(f.hit.occasion.toUpperCase())
      if (typeof f.hit.position === 'number') parts.push(`track #${f.hit.position}`)
      else if (f.hit.position) parts.push(`the ${f.hit.position} track`)
      if (f.hit.clockHour !== undefined) parts.push(`around ${f.hit.clockHour}:00`)
      return `recalling ${parts.join(', ') || 'a moment'} from your sets`
    }
    case 'generic':
      return f.ask ? 'reading your whole library' : f.narration.replace(/^Here(?:’s| are)\s*/i, '')
  }
}
