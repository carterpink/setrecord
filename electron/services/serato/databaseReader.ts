/**
 * Parse Serato's `database V2` file into track records, then map them onto the
 * app's internal {@link Track} model.
 *
 * `database V2` holds library-level metadata only — title/artist/BPM/key/etc.
 * Cue points, hot cues, loops and beatgrids are NOT here; Serato stores those
 * inside each audio file (see {@link ./seratoTags}), extracted by a background
 * pass after import. Energy and ratings have no Serato equivalent, so they
 * default to the analyser-pending / zero values, exactly like a Rekordbox DB
 * import.
 */

import { extname } from 'path'
import type { AudioFormat, Track } from '../../../src/types'
import { openNotationToCamelot } from '../../utils/camelot'
import { parseChunks } from './chunks'

/** Raw, decoded values for one Serato `otrk` record (before mapping to Track). */
export interface SeratoTrackRecord {
  /** `pfil` — path as stored by Serato, relative to the drive root. */
  filePath: string
  title?: string
  artist?: string
  album?: string
  genre?: string
  comment?: string
  label?: string
  bpm?: number
  /** Raw key as stored (open notation like "Am" or already Camelot like "8A"). */
  key?: string
  bitrate?: number
  durationSec?: number
  dateAddedIso?: string
}

function parseFormat(filePath: string): AudioFormat {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, AudioFormat> = {
    '.mp3': 'mp3',
    '.aiff': 'aiff',
    '.aif': 'aiff',
    '.wav': 'wav',
    '.flac': 'flac',
    '.m4a': 'm4a'
  }
  return map[ext] ?? 'unknown'
}

/** Parse a numeric prefix out of a Serato text field, e.g. "320.0kbps" → 320. */
function parseLeadingNumber(text: string | undefined): number | undefined {
  if (!text) return undefined
  const m = text.match(/-?\d+(\.\d+)?/)
  if (!m) return undefined
  const n = parseFloat(m[0])
  return Number.isFinite(n) ? n : undefined
}

/**
 * Serato stores length as a display string ("3:45", "1:02:33", or seconds).
 * Returns total seconds, or undefined when unparseable.
 */
export function parseSeratoLength(text: string | undefined): number | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => parseFloat(p))
    if (parts.some((p) => !Number.isFinite(p))) return undefined
    return parts.reduce((acc, p) => acc * 60 + p, 0)
  }
  const n = parseFloat(trimmed)
  return Number.isFinite(n) ? n : undefined
}

/** Map a Serato key string to Camelot, passing through values already in Camelot form. */
export function seratoKeyToCamelot(raw: string | undefined): string {
  if (!raw) return ''
  const key = raw.trim()
  if (/^\d{1,2}[AB]$/i.test(key)) return key.toUpperCase()
  return openNotationToCamelot(key) ?? ''
}

/** Resolve a drive-relative Serato path to an absolute path (macOS: '/' + path). */
export function resolveSeratoPath(driveRelative: string): string {
  return '/' + driveRelative.replace(/^\/+/, '')
}

/** Decode all `otrk` records from a `database V2` buffer. */
export function parseDatabaseV2(buf: Buffer): SeratoTrackRecord[] {
  const records: SeratoTrackRecord[] = []

  for (const chunk of parseChunks(buf)) {
    if (chunk.tag !== 'otrk' || !chunk.children) continue

    const f: Record<string, string | number | undefined> = {}
    for (const field of chunk.children) {
      if (field.text !== undefined) f[field.tag] = field.text
      else if (field.u32 !== undefined) f[field.tag] = field.u32
    }

    const filePath = (f.pfil as string) ?? ''
    if (!filePath) continue // a track with no path is unusable

    // Date added: prefer the numeric epoch (uadd, seconds) then the text field.
    let dateAddedIso: string | undefined
    const uadd = f.uadd as number | undefined
    if (typeof uadd === 'number' && uadd > 1_000_000_000) {
      dateAddedIso = new Date(uadd * 1000).toISOString()
    } else if (typeof f.tadd === 'string') {
      const d = new Date(f.tadd)
      if (!Number.isNaN(d.getTime())) dateAddedIso = d.toISOString()
    }

    records.push({
      filePath,
      title: (f.tsng as string) || undefined,
      artist: (f.tart as string) || undefined,
      album: (f.talb as string) || undefined,
      genre: (f.tgen as string) || undefined,
      comment: (f.tcom as string) || undefined,
      label: (f.tlbl as string) || undefined,
      bpm: parseLeadingNumber(f.tbpm as string),
      key: (f.tkey as string) || undefined,
      bitrate: parseLeadingNumber(f.tbit as string),
      durationSec: parseSeratoLength(f.tlen as string),
      dateAddedIso
    })
  }

  return records
}

/**
 * Map one Serato record onto a {@link Track}. Reuses the existing id when this
 * file_path is already known (so saved-set FKs survive re-import), mirroring the
 * Rekordbox importer.
 */
export function seratoRecordToTrack(
  rec: SeratoTrackRecord,
  existingIdsByPath: Map<string, string>,
  resolvePath: (p: string) => string = resolveSeratoPath
): Track {
  const filePath = resolvePath(rec.filePath)
  return {
    id: existingIdsByPath.get(filePath) ?? crypto.randomUUID(),
    title: rec.title ?? 'Unknown title',
    artist: rec.artist ?? 'Unknown artist',
    album: rec.album,
    genre: rec.genre,
    bpm: rec.bpm ?? 0,
    key: seratoKeyToCamelot(rec.key),
    keyOpenNotation: rec.key || undefined,
    // Serato has no energy field — queue the background analyser, same as a Rekordbox DB import.
    energy: 5,
    energySource: 'pending',
    duration: rec.durationSec ?? 0,
    filePath,
    bitrate: rec.bitrate,
    format: parseFormat(filePath),
    // Cues/hot cues/loops/beatgrid live in the audio file; the background
    // Serato-tag pass fills these in after import.
    cuePoints: [],
    hotCues: [],
    loops: [],
    // Serato has no star rating or play-count in its library.
    playCount: 0,
    rating: 0,
    dateAdded: rec.dateAddedIso ?? new Date().toISOString(),
    comment: rec.comment,
    label: rec.label,
    missingFile: false,
    source: 'serato'
  }
}
