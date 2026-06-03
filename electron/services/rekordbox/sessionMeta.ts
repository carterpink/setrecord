/**
 * sessionMeta.ts — derive gig metadata (currently: venue) from a Rekordbox
 * history-session name. Rekordbox auto-names sessions like "HISTORY 2024-07-12",
 * but DJs frequently rename them to the gig ("Hi Ibiza 2025-07-12", "Boiler Room").
 * We strip the boilerplate + date/time tokens and treat the remainder as a
 * candidate venue. Pure + dependency-free so it can be unit-tested in isolation.
 */

/** Generic names that carry no venue signal — never treated as a venue. */
const GENERIC = new Set([
  'history',
  'untitled session',
  'untitled',
  'session',
  'set',
  'mix',
  'recording',
  'rec'
])

/**
 * Date/time fragments to strip: ISO (2025-07-12), dotted/slashed dd.mm.yy(yy),
 * and bare 24h clock times. Order matters — strip the longer date forms first.
 */
const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, // 2025-07-12, 2025/7/12
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, // 12-07-2025, 12.7.25
  /\b\d{1,2}[-/.]\d{1,2}\b/g, // 12-07
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g // 21:30, 21:30:00
]

export interface ParsedSessionMeta {
  /** Candidate venue, or null when nothing meaningful remained. */
  venue: string | null
  /** Always 'auto' here — flags the value as machine-derived, overridable by the user. */
  source: 'auto'
}

/**
 * Extract a candidate venue from a Rekordbox history-session name.
 * Returns `{ venue: null }` when the name is empty, generic ("HISTORY 2024-07-12"),
 * or reduces to nothing but punctuation/numbers after stripping date tokens.
 */
export function parseSessionMeta(rawName: string | null | undefined): ParsedSessionMeta {
  if (!rawName) return { venue: null, source: 'auto' }

  let s = rawName.trim()

  // Drop a leading "HISTORY" label (Rekordbox's default prefix), case-insensitive.
  s = s.replace(/^history\b[\s:_-]*/i, '')

  // Remove date/time fragments.
  for (const re of DATE_PATTERNS) s = s.replace(re, ' ')

  // Collapse leftover separators/whitespace and trim stray punctuation.
  s = s
    .replace(/[\s_]+/g, ' ')
    .replace(/^[\s\-–—.,|/]+|[\s\-–—.,|/]+$/g, '')
    .trim()

  if (s === '') return { venue: null, source: 'auto' }
  // Pure numbers / lone tokens like "1" carry no venue signal.
  if (/^[\d\s]+$/.test(s)) return { venue: null, source: 'auto' }
  if (GENERIC.has(s.toLowerCase())) return { venue: null, source: 'auto' }

  return { venue: s, source: 'auto' }
}
