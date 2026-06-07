/**
 * beatportMatch.ts — pure, node-free helpers that turn a library Track into the
 * match keys Beatport's playlist importer (and tools like Soundiiz /
 * TuneMyMusic) use to resolve a row to a catalog entry: ISRC first, then a
 * parsed Mix name + clean title/artist/label/catalog.
 *
 * Everything here is derived at export time and never written back — the user's
 * library is never modified. Lives in src/utils so the renderer can compute the
 * preview without an IPC round-trip; the backend only writes the resulting CSV.
 */

import type { BeatportConfidence, BeatportRow, Set as DJSet, SetTrack, Track } from '../types'
import { beatportSearchUrl } from './shopLinks'

/** ISRC: 2 letters + 3 alphanumerics + 7 digits (e.g. GBCPZ2321644). */
const ISRC_RE = /\b[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}\b/

/** Strict ISRC (whole string) — used to tell ISRC apart from a catalogue code. */
const ISRC_EXACT_RE = /^[A-Za-z]{2}[A-Za-z0-9]{3}\d{7}$/

/** Trailing "(… Mix/Remix/Edit/…)" or "[… Mix …]" that names a mix variant. */
const MIX_RE =
  /\s*[([]([^()[\]]*\b(?:mix|remix|rmx|edit|dub|version|instrumental|bootleg|rework|vip|extended|radio|club|original|flip)\b[^()[\]]*)[)\]]\s*$/i

/**
 * Pull a valid ISRC out of the (often polluted) label or comment fields.
 * Rekordbox frequently dumps the ISRC into the Label column instead of a real
 * label name — that's a gift here, since ISRC is Beatport's strongest key.
 */
export function extractIsrc(track: Pick<Track, 'label' | 'comment'>): string | undefined {
  for (const field of [track.label, track.comment]) {
    if (!field) continue
    const m = field.match(ISRC_RE)
    if (m) return m[0].toUpperCase()
  }
  return undefined
}

/** True when a label value is really an ISRC or catalogue code, not a name. */
function looksLikeCode(raw: string): boolean {
  const l = raw.trim()
  if (ISRC_EXACT_RE.test(l)) return true
  // Catalogue-code-like: no lowercase, no spaces, has digits, fairly long.
  if (!/[a-z]/.test(l) && /\d/.test(l) && !/\s/.test(l) && l.length >= 8) return true
  return false
}

/** Label name with ISRC/catalogue noise filtered out. */
export function cleanLabel(track: Pick<Track, 'label'>): string | undefined {
  const raw = (track.label ?? '').trim()
  if (!raw || looksLikeCode(raw)) return undefined
  return raw
}

/** Catalogue number when the label field is actually a catalogue code (not ISRC). */
export function extractCatalog(track: Pick<Track, 'label'>): string | undefined {
  const raw = (track.label ?? '').trim()
  if (!raw || ISRC_EXACT_RE.test(raw)) return undefined
  if (!/[a-z]/.test(raw) && /\d/.test(raw) && !/\s/.test(raw) && raw.length >= 6) return raw
  return undefined
}

/**
 * Split a trailing parenthetical mix name off the title, e.g.
 * "Strobe (Extended Mix)" → { title: "Strobe", mix: "Extended Mix" }.
 * Plain titles pass through unchanged.
 */
export function parseMixName(rawTitle: string): { title: string; mix?: string } {
  const t = (rawTitle ?? '').trim()
  const m = MIX_RE.exec(t)
  if (m && m.index > 0) {
    return { title: t.slice(0, m.index).trim(), mix: m[1].trim() }
  }
  return { title: t }
}

/** A remixer name when the mix reads like "Someone Remix". */
function deriveRemixer(mix?: string): string | undefined {
  if (!mix) return undefined
  const m = mix.match(/^(.+?)\s+(?:remix|rmx|edit|bootleg|rework|vip|dub|flip)$/i)
  return m ? m[1].trim() : undefined
}

/**
 * Confidence reflects how reliably Beatport's importer will resolve the row:
 * ISRC → high; clean title + artist → medium; missing either → low (needs a fix).
 */
export function scoreConfidence(row: Pick<BeatportRow, 'isrc' | 'title' | 'artist'>): {
  confidence: BeatportConfidence
  reasons: string[]
} {
  const reasons: string[] = []
  const hasTitle = !!row.title?.trim()
  const hasArtist = !!row.artist?.trim()

  if (row.isrc) {
    reasons.push('Has ISRC — Beatport can match this exactly.')
    return { confidence: 'high', reasons }
  }
  if (!hasTitle) {
    reasons.push('Missing title — add it so Beatport can find the track.')
    return { confidence: 'low', reasons }
  }
  if (!hasArtist) {
    reasons.push('Missing artist — add it for a reliable match.')
    return { confidence: 'low', reasons }
  }
  reasons.push('Matched on title + artist. Add an ISRC for an exact match.')
  return { confidence: 'medium', reasons }
}

/** Build one Beatport row from a set slot. `index` drives the 1-based position. */
export function buildBeatportRow(setTrack: SetTrack, index: number): BeatportRow {
  const track = setTrack.track
  const rawTitle = (track.title ?? '').trim()
  let artist = (track.artist ?? '').trim()
  let baseTitle = rawTitle

  // Many DJ-pool files leave Artist blank and embed it as "Artist - Title".
  if (!artist || artist.toLowerCase() === 'unknown artist') {
    const dash = rawTitle.indexOf(' - ')
    if (dash > 0) {
      artist = rawTitle.slice(0, dash).trim()
      baseTitle = rawTitle.slice(dash + 3).trim()
    }
  }

  const { title: parsedTitle, mix } = parseMixName(baseTitle)
  const title = parsedTitle || rawTitle
  const isrc = extractIsrc(track)
  const { confidence, reasons } = scoreConfidence({ isrc, title, artist })

  return {
    trackId: track.id,
    position: index + 1,
    title,
    mix,
    artist,
    remixers: deriveRemixer(mix),
    label: cleanLabel(track),
    catalog: extractCatalog(track),
    isrc,
    bpm: track.bpm ?? 0,
    key: track.keyOpenNotation || track.key || '',
    genre: track.genre,
    duration: track.duration ?? 0,
    searchUrl: beatportSearchUrl(artist, title),
    confidence,
    reasons
  }
}

/** Build the full ordered set of rows from a DJ set. */
export function buildBeatportRows(set: DJSet): BeatportRow[] {
  return set.tracks.map((st, i) => buildBeatportRow(st, i))
}

/**
 * Re-derive confidence, reasons and search link after the user edits a row's
 * title/artist/mix/ISRC in the manual-fix UI. Pure: returns a new row.
 */
export function rescoreRow(row: BeatportRow): BeatportRow {
  const isrc = row.isrc?.trim() ? row.isrc.trim().toUpperCase() : undefined
  const { confidence, reasons } = scoreConfidence({ isrc, title: row.title, artist: row.artist })
  return {
    ...row,
    isrc,
    confidence,
    reasons,
    searchUrl: beatportSearchUrl(row.artist, row.title)
  }
}
