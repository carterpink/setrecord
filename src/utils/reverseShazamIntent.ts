/**
 * reverseShazamIntent.ts — pure detector for "Reverse-Shazam of your own past":
 * recall a track by the MOMENT you played it, not its metadata.
 *
 * "what was that track I played last New Year's Eve?", "what did I open with on
 * NYE", "the 3rd track I played at Halloween", "what was playing around 1am".
 * Fires only when there's an occasion / position / clock anchor that plain gig
 * recall (gigIntent) doesn't handle — so it never steals "what did I play last
 * Saturday". Compute lives in electron/algorithms/memory/reverseShazam.ts.
 *
 * Renderer-safe.
 */

export type Occasion = 'nye' | 'halloween' | 'christmas' | 'valentine'

export interface ShazamHit {
  occasion?: Occasion
  /** 'first'|'last'|'middle', or a 1-based track index. */
  position?: 'first' | 'last' | 'middle' | number
  /** 0–23 clock hour the DJ is asking about. */
  clockHour?: number
}

const ORDINAL_WORDS: Record<string, number> = {
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10
}

function detectOccasion(q: string): Occasion | undefined {
  if (/\bnye\b|new ?year'?s?(?: eve)?/.test(q)) return 'nye'
  if (/\bhallowe?en\b/.test(q)) return 'halloween'
  if (/\bchristmas\b|\bxmas\b/.test(q)) return 'christmas'
  if (/\bvalentine'?s?\b/.test(q)) return 'valentine'
  return undefined
}

function detectPosition(q: string): ShazamHit['position'] {
  const numeric = q.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:track|tune|song)\b/)
  if (numeric) return Number(numeric[1])
  const word = q.match(
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:track|tune|song)\b/
  )
  if (word) return ORDINAL_WORDS[word[1]]
  if (/\b(open(?:ed|ing)?(?: with)?|first (?:track|tune|song)|started? with|start of)\b/.test(q))
    return 'first'
  if (
    /\b(clos(?:ed|ing)?(?: with)?|last (?:track|tune|song)|ended? with|final (?:track|tune|song)|end of)\b/.test(
      q
    )
  )
    return 'last'
  if (/\b(the drop|peak|middle|halfway)\b/.test(q)) return 'middle'
  return undefined
}

function detectClockHour(q: string): number | undefined {
  const m = q.match(/\b(?:around|about|at|near)\s+(\d{1,2})\s*(am|pm)\b/)
  if (!m) return undefined
  let h = Number(m[1])
  if (h < 0 || h > 12) return undefined
  const pm = m[2] === 'pm'
  if (pm && h < 12) h += 12
  if (!pm && h === 12) h = 0
  return h
}

export function detectReverseShazam(raw: string): ShazamHit | null {
  const q = raw.toLowerCase().trim()

  const occasion = detectOccasion(q)
  const position = detectPosition(q)
  const clockHour = detectClockHour(q)

  // Needs a moment anchor gigIntent doesn't cover — else let gig recall handle it.
  if (!occasion && position === undefined && clockHour === undefined) return null

  // And it must read like a track-recall question, not a set-building request.
  const isRecall = /\b(track|tune|song|play|played|spun|open|opened|clos|drop|set)\b/.test(q)
  if (!isRecall) return null

  return { occasion, position, clockHour }
}
