/**
 * Tracklist extraction from YouTube video descriptions and comments.
 *
 * Pipeline (per the plan):
 *   Phase A: Normalise raw text
 *   Phase B: Pattern matching in priority order
 *   Phase C: Row-level validation + cleanup
 *   Phase D: Confidence scoring
 *   Phase E: Comments fallback
 */

import type { DiscoverTrack } from '../../../src/types'

// ─── Pattern definitions ───────────────────────────────────────────────────

interface MatchedRow {
  position: number
  artist: string
  title: string
  rawText: string
  startSeconds?: number
  durationSeconds?: number
  confidence: number
}

/** Convert a timestamp string like "1:23:45" or "23:45" to seconds. */
function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

const DASH_CHARS = '[-–—‒]'
const TS = '(?:(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)'  // capture group: HH?:MM:SS?

// Ordered from highest to lowest confidence
const PATTERNS: Array<{
  name: string
  regex: RegExp
  confidence: number
  extract: (m: RegExpMatchArray) => { artist: string; title: string; timestamp?: string }
}> = [
  // "00:00 Artist - Track" or "01:23:45 Artist - Track"
  {
    name: 'time-prefix-dash',
    regex: new RegExp(`^${TS}\\s+(.+?)\\s+${DASH_CHARS}\\s+(.+?)\\s*$`),
    confidence: 0.95,
    extract: (m) => ({ artist: m[4], title: m[5], timestamp: `${m[1]}:${m[2]}${m[3] ? ':' + m[3] : ''}` }),
  },
  // "Artist - Track [00:00]" or "Artist - Track [1:23:45]"
  {
    name: 'bracket-time-trailing',
    regex: new RegExp(`^(.+?)\\s+${DASH_CHARS}\\s+(.+?)\\s+\\[${TS}\\]\\s*$`),
    confidence: 0.9,
    extract: (m) => ({ artist: m[1], title: m[2], timestamp: `${m[4]}:${m[5]}${m[6] ? ':' + m[6] : ''}` }),
  },
  // "1. Artist - Track" or "01) Artist - Track"
  {
    name: 'numbered-dash',
    regex: new RegExp(`^(\\d{1,3})[.)\\s]+(.+?)\\s+${DASH_CHARS}\\s+(.+?)\\s*$`),
    confidence: 0.82,
    extract: (m) => ({ artist: m[2], title: m[3] }),
  },
  // "Artist - Track (00:00)" but NOT "(Original Mix)" — requires digits in parens
  {
    name: 'paren-time-trailing',
    regex: new RegExp(`^(.+?)\\s+${DASH_CHARS}\\s+(.+?)\\s+\\(${TS}\\)\\s*$`),
    confidence: 0.85,
    extract: (m) => ({ artist: m[1], title: m[2], timestamp: `${m[4]}:${m[5]}${m[6] ? ':' + m[6] : ''}` }),
  },
  // Plain "Artist - Track" (low confidence, requires neighbors)
  {
    name: 'plain-dash',
    regex: new RegExp(`^(.+?)\\s+${DASH_CHARS}\\s+(.+?)\\s*$`),
    confidence: 0.55,
    extract: (m) => ({ artist: m[1], title: m[2] }),
  },
]

// ─── Phase A: normalise ────────────────────────────────────────────────────

function normalizeText(raw: string): string[] {
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  let pastHeader = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Detect tracklist header keywords and start collecting from here
    if (!pastHeader && /tracklist|track\s*list|set\s*list|playlist/i.test(line)) {
      pastHeader = true
      continue
    }

    // Drop lines that are clearly not tracks
    if (/^(subscribe|follow|like|support|book|merch|http|www\.|@|#)/i.test(line)) continue
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(line)) continue  // date-only lines

    out.push(line)
  }

  // If no header detected, use all lines
  return pastHeader ? out : lines.map((l) => l.trim()).filter(Boolean)
}

// ─── Phase C: row validation + cleanup ────────────────────────────────────

const MIX_SUFFIX = /\s*\((?:original|extended|club|radio|edit|dub|vip|instrumental)(?:\s+mix)?\)\s*$/i
const FEAT_PREFIX = /\s*(?:ft\.|feat\.?|featuring)\s+.+$/i

function cleanArtist(s: string): string {
  return s.replace(FEAT_PREFIX, '').trim()
}

function cleanTitle(s: string): string {
  return s.replace(MIX_SUFFIX, '').trim()
}

function isSpam(artist: string, title: string): boolean {
  if (artist.length > 80 || title.length > 100) return true
  if (/https?:\/\//.test(artist) || /https?:\/\//.test(title)) return true
  // Title looks like a sentence (5+ words, ends with punctuation)
  if (/[.!?]$/.test(title) && title.split(/\s+/).length >= 5) return true
  return false
}

function isIdTrack(artist: string, title: string): boolean {
  return /^\s*id\s*$/i.test(artist) || /^\s*id\s*$/i.test(title)
}

// ─── Phase B + C: parse a block of lines ──────────────────────────────────

export function parseLines(lines: string[]): MatchedRow[] {
  const results: MatchedRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    let matched = false
    for (const pat of PATTERNS) {
      const m = line.match(pat.regex)
      if (!m) continue

      const { artist: rawArtist, title: rawTitle, timestamp } = pat.extract(m)
      const artist = cleanArtist(rawArtist.trim())
      const title = cleanTitle(rawTitle.trim())

      if (isSpam(artist, title)) break

      let confidence = pat.confidence
      const isId = isIdTrack(artist, title)
      if (isId) confidence = 0.3

      // Low-confidence plain-dash: require a confident neighbor to accept
      if (pat.name === 'plain-dash') {
        const prevOk = results[results.length - 1]?.confidence >= 0.8
        const nextLine = lines[i + 1] ?? ''
        const nextOk = PATTERNS.slice(0, -1).some((p) => p.regex.test(nextLine))
        if (!prevOk && !nextOk) break
      }

      results.push({
        position: results.length + 1,
        artist,
        title,
        rawText: line,
        startSeconds: timestamp ? timestampToSeconds(timestamp) : undefined,
        confidence,
      })
      matched = true
      break
    }
    void matched
  }

  return results
}

// ─── Phase D: overall confidence ──────────────────────────────────────────

function overallConfidence(rows: MatchedRow[], totalLines: number): number {
  if (rows.length === 0) return 0
  const coverageScore = Math.min(rows.length / Math.max(totalLines * 0.3, 3), 1)
  const meanRowConf = rows.reduce((s, r) => s + r.confidence, 0) / rows.length

  // Bonus if timestamps are monotonically increasing
  const hasTimestamps = rows.filter((r) => r.startSeconds != null).length >= rows.length * 0.5
  let monotonicBonus = 0
  if (hasTimestamps) {
    const ts = rows.filter((r) => r.startSeconds != null).map((r) => r.startSeconds!)
    const monotonic = ts.every((v, i) => i === 0 || v >= ts[i - 1])
    monotonicBonus = monotonic ? 0.1 : 0
  }

  return Math.min(0.5 * coverageScore + 0.4 * meanRowConf + monotonicBonus, 1)
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface ParseResult {
  tracks: DiscoverTrack[]
  confidence: number
  source: 'description' | 'comments' | 'mixed'
}

function rowsToTracks(rows: MatchedRow[]): DiscoverTrack[] {
  return rows.map((r, i) => ({
    id: `t-${i + 1}`,
    position: i + 1,
    artist: r.artist,
    title: r.title,
    rawText: r.rawText,
    startSeconds: r.startSeconds,
    durationSeconds: r.durationSeconds,
    confidence: r.confidence,
  }))
}

export function parseDescription(description: string): ParseResult {
  const lines = normalizeText(description)
  const rows = parseLines(lines)
  const confidence = overallConfidence(rows, lines.length)
  return { tracks: rowsToTracks(rows), confidence, source: 'description' }
}

export function parseComment(commentText: string): ParseResult {
  const lines = commentText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows = parseLines(lines)
  const confidence = overallConfidence(rows, lines.length)
  return { tracks: rowsToTracks(rows), confidence, source: 'comments' }
}

/**
 * Parse description first; fall back to or merge with top comments if confidence is low.
 */
export function parseDescriptionWithCommentFallback(
  description: string,
  comments: Array<{ text: string; likeCount: number }>,
  threshold = 0.6,
): ParseResult {
  const descResult = parseDescription(description)

  if (descResult.confidence >= threshold || comments.length === 0) {
    return descResult
  }

  // Try each top comment, take the best result
  let bestComment: ParseResult | null = null
  for (const c of comments) {
    if (c.text.length < 50) continue
    const r = parseComment(c.text)
    if (r.tracks.length < 3) continue
    if (!bestComment || r.confidence > bestComment.confidence) {
      bestComment = r
    }
  }

  if (!bestComment) return descResult

  // If comment is clearly better, use it
  if (bestComment.confidence > descResult.confidence + 0.1) {
    return { ...bestComment, source: 'comments' }
  }

  // Merge: use description rows, fill gaps with comment rows (deduplicate by artist+title)
  if (descResult.tracks.length > 0 && bestComment.tracks.length > 0) {
    const seen = new Set(descResult.tracks.map((t) => `${t.artist}|${t.title}`.toLowerCase()))
    const extra = bestComment.tracks.filter((t) => !seen.has(`${t.artist}|${t.title}`.toLowerCase()))
    const merged = [...descResult.tracks, ...extra].sort(
      (a, b) => (a.startSeconds ?? 0) - (b.startSeconds ?? 0)
    ).map((t, i) => ({ ...t, id: `t-${i + 1}`, position: i + 1 }))
    const mergedConf = (descResult.confidence + bestComment.confidence) / 2
    return { tracks: merged, confidence: mergedConf, source: 'mixed' }
  }

  return bestComment
}
