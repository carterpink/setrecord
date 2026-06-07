/**
 * briefIntent.ts — pure detector for the forward-looking pre-gig "Brief".
 *
 * Unlike gigIntent / venueIntent (backward-looking recall: "what did I play at
 * Fabric"), the Brief looks AHEAD and turns the DJ's own history at a venue (or
 * event type) into a game plan: "what should I play at Fabric", "brief for The
 * Cause, peak slot", "I'm playing Hi Ibiza on Saturday", "what should I pack for
 * my festival set". Compute lives in electron/algorithms/memory/brief.ts.
 *
 * Renderer-safe (no electron/DB deps).
 */

import type { VenueType, SetSlot } from '../types'

export interface BriefHit {
  /** Venue name to brief against (case-insensitive substring at compute time). */
  venue?: string
  /** Event type, when stated ("festival set", "bar gig"). */
  eventType?: VenueType
  /** Slot role, when stated ("peak", "warm-up", "closing"). */
  setSlot?: SetSlot
}

/** Trailing time phrases stripped from a captured venue ("Fabric on Saturday" → "Fabric"). */
const TRAILING =
  /\b(tonight|tomorrow|tmrw|this (?:weekend|week|friday|saturday|sunday)|next (?:week|weekend|\w+day)|on \w+day|on the \w+|this evening|soon|later)\b.*$/

const FILLER = new Set([
  'a',
  'an',
  'the',
  'this',
  'that',
  'my',
  'our',
  'your',
  'some',
  'set',
  'sets',
  'gig',
  'gigs',
  'party',
  'night',
  'event',
  'slot',
  'crowd',
  'room',
  'place',
  'venue'
])
const EVENTWORDS = new Set([
  'festival',
  'club',
  'bar',
  'private',
  'wedding',
  'birthday',
  'corporate',
  'outdoor',
  'outdoors'
])
/** Goal phrases that look like a venue after "play for/at …" but aren't one. */
const GOALWORDS = new Set([
  'warm',
  'warmup',
  'up',
  'cool',
  'cooldown',
  'down',
  'dancing',
  'dance',
  'energy',
  'vibe',
  'mood',
  'peak',
  'build',
  'people'
])

function cleanVenue(s: string): string {
  const out = s
    .replace(TRAILING, '')
    .replace(/[,;]/g, ' ') // mid-string separators ("Fabric, peak slot" → "Fabric peak slot")
    .replace(/[?.!'"]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const meaningful = out
    .split(' ')
    .filter(Boolean)
    .filter((t) => !FILLER.has(t) && !EVENTWORDS.has(t) && !GOALWORDS.has(t))
  return meaningful.join(' ')
}

function detectEventType(q: string): VenueType | undefined {
  if (/\bfestival\b/.test(q)) return 'festival'
  if (/\bclub\b/.test(q)) return 'club'
  if (/\bbar\b/.test(q)) return 'bar'
  if (/\b(private|wedding|birthday|corporate)\b/.test(q)) return 'private'
  if (/\b(outdoors?|open[- ]air|outside)\b/.test(q)) return 'outdoor'
  return undefined
}

function detectSlot(q: string): SetSlot | undefined {
  if (/\bb2b\b|back[- ]to[- ]back/.test(q)) return 'b2b'
  if (/\b(peak|prime[- ]?time|headlin|main room)\b/.test(q)) return 'peak'
  if (/\b(open(?:er|ing)?|warm[- ]?up)\b/.test(q)) return 'opener'
  if (/\b(clos(?:er|ing)|last set|final set)\b/.test(q)) return 'closer'
  return undefined
}

export function detectBrief(raw: string): BriefHit | null {
  const q = raw.toLowerCase().trim()

  // Backward-looking recall belongs to gigIntent/venueIntent, not the Brief.
  if (/\b(did i|have i|i've played|last time|what was|i played|when did i)\b/.test(q)) return null

  // A deliberate prep request, or a first-person "I'm playing <somewhere>".
  const hasPrepKeyword =
    /\b(brief|game ?plan|set ?plan|pre[- ]?gig|prep(?:are|aration)?|pack(?:ing)?)\b/.test(q) ||
    /\bwhat (?:should|shall|do|can|would|to) i? ?(?:play|spin|bring|pack)\b/.test(q)
  const hasPlayingPhrase =
    /\b(?:i'?m|i am|i'?ll be|we'?re|we are)\s+(?:playing|gigging|spinning|dj(?:'?ing|ing)?|booked)\b/.test(
      q
    )
  if (!hasPrepKeyword && !hasPlayingPhrase) return null

  // Pull a venue candidate from whichever shape matched.
  const patterns: RegExp[] = [
    /\b(?:brief|game ?plan|set ?plan|prep(?:are|aration)?|pre[- ]?gig)\b[^.]*?\b(?:for|at)\s+(.+)$/,
    /\bwhat (?:should|shall|do|can|would|to) i? ?(?:play|spin|bring|pack)\b[^.]*?\b(?:at|in|for)\s+(.+)$/,
    /\b(?:i'?m|i am|i'?ll be|we'?re|we are)\s+(?:playing|gigging|spinning|dj(?:'?ing|ing)?|booked)\s+(?:at\s+)?(.+)$/,
    /\b(?:pack|packing|bring|prep)\b[^.]*?\b(?:for|to)\s+(.+)$/
  ]
  let venue: string | undefined
  for (const re of patterns) {
    const m = q.match(re)
    if (m) {
      const cleaned = cleanVenue(m[1])
      if (cleaned.length >= 2) venue = cleaned
      break
    }
  }

  const eventType = detectEventType(q)
  const setSlot = detectSlot(q)

  // Need at least a venue or an event type to brief against.
  if (!venue && !eventType) return null
  return { venue, eventType, setSlot }
}
