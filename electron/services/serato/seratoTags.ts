/**
 * Per-file Serato tag extraction: hot cues, loops, track color and beatgrid.
 *
 * Unlike its `database V2`, Serato stores cue/loop/beatgrid data INSIDE each
 * audio file — as `Serato Markers2` / `Serato BeatGrid` blobs carried in
 * container-specific metadata (ID3 GEOB frames in MP3/WAV/AIFF, `----`
 * freeform atoms in MP4/M4A, base64 vorbis comments in FLAC/Ogg). We use
 * `music-metadata` to pull the raw blob bytes uniformly across containers, then
 * decode the Serato-specific binary ourselves.
 *
 * Blob layouts (per Holzhaus/serato-tags, Mixxx):
 *   Markers2: [0x01 0x01][base64…] → decoded payload of entries, each
 *             `<name>\0` + 4-byte BE length + body. CUE/LOOP/COLOR/BPMLOCK.
 *   BeatGrid: [0x01 0x00] + 4-byte BE marker count + markers; first marker's
 *             position (BE float seconds) is the beatgrid anchor.
 *
 * The decoders are pure (Buffer in, structured out) and unit-tested with
 * synthetic fixtures. Extraction is defensive: any failure on a file yields no
 * tags rather than throwing, so one bad file never sinks the batch.
 */

import type { HotCue, Loop } from '../../../src/types'

export interface SeratoFileTags {
  hotCues: HotCue[]
  loops: Loop[]
  /** Track color as a CSS `rgb(...)` string (matches the Rekordbox importer). */
  color?: string
  /** First-downbeat anchor in ms. */
  beatgridOffset?: number
}

const rgb = (r: number, g: number, b: number): string => `rgb(${r},${g},${b})`

/** Read a null-terminated ASCII string from `buf` at `offset`; returns [text, nextOffset]. */
function readCString(buf: Buffer, offset: number): [string, number] {
  const end = buf.indexOf(0x00, offset)
  const stop = end === -1 ? buf.length : end
  return [buf.toString('latin1', offset, stop), stop + 1]
}

const KNOWN_ENTRY_NAMES = ['CUE', 'LOOP', 'COLOR', 'BPMLOCK', 'FLIP']

/**
 * Locate where the Markers2 entry stream begins inside a decoded payload.
 *
 * Works across containers without depending on the exact envelope framing
 * (version bytes / mime+name prefixes differ between MP3 GEOB and FLAC/MP4
 * base64): we scan for the first known entry name (`CUE`, `LOOP`, …) that is
 * immediately null-terminated. Returns -1 when none is found.
 */
export function findEntriesStart(buf: Buffer): number {
  for (let i = 0; i + 4 < buf.length; i++) {
    for (const name of KNOWN_ENTRY_NAMES) {
      if (
        i + name.length < buf.length &&
        buf[i + name.length] === 0x00 &&
        buf.toString('latin1', i, i + name.length) === name
      ) {
        return i
      }
    }
  }
  return -1
}

/**
 * Parse Markers2 entries from a decoded payload starting at `start`
 * (typically {@link findEntriesStart}'s result).
 */
export function parseMarkers2Entries(
  buf: Buffer,
  start: number
): { hotCues: HotCue[]; loops: Loop[]; color?: string } {
  const hotCues: HotCue[] = []
  const loops: Loop[] = []
  let color: string | undefined

  let offset = start
  while (offset + 5 <= buf.length) {
    const [name, afterName] = readCString(buf, offset)
    if (!name) break // empty name marks the end of the entry stream
    const length = buf.readUInt32BE(afterName)
    const bodyStart = afterName + 4
    const bodyEnd = bodyStart + length
    if (length < 0 || bodyEnd > buf.length) break
    const body = buf.subarray(bodyStart, bodyEnd)

    switch (name) {
      case 'CUE': {
        // >cBIc3s2s + name : index@1, position(ms BE u32)@2, color RGB@7, name@12
        if (body.length >= 11) {
          const index = body.readUInt8(1)
          const position = body.readUInt32BE(2)
          const r = body.readUInt8(7)
          const g = body.readUInt8(8)
          const b = body.readUInt8(9)
          const [label] = body.length > 12 ? readCString(body, 12) : ['']
          hotCues.push({
            index,
            position,
            color: rgb(r, g, b),
            label: label || undefined
          })
        }
        break
      }
      case 'LOOP': {
        // >cBII4s4sB? + name : index@1, start(ms)@2, end(ms)@6, name@20
        if (body.length >= 10) {
          const startMs = body.readUInt32BE(2)
          const endMs = body.readUInt32BE(6)
          const [label] = body.length > 20 ? readCString(body, 20) : ['']
          loops.push({ startMs, endMs, name: label || undefined })
        }
        break
      }
      case 'COLOR': {
        // c3s : 1 pad byte + RGB
        if (body.length >= 4) {
          color = rgb(body.readUInt8(1), body.readUInt8(2), body.readUInt8(3))
        }
        break
      }
      // BPMLOCK / FLIP / unknown: skip body.
      default:
        break
    }

    offset = bodyEnd
  }

  // Serato hot cues are 0-based slots; keep order by slot for stable display.
  hotCues.sort((a, b) => a.index - b.index)
  return { hotCues, loops, color }
}

/**
 * Parse a Serato BeatGrid blob. Scans for the `0x01 0x00` version marker
 * (offset 0 for MP3 GEOB; later for base64 FLAC/MP4 envelopes) followed by a
 * plausible marker count, then returns the first marker's position as the
 * beatgrid anchor (ms).
 */
export function parseBeatgrid(buf: Buffer): { offsetMs: number; bpm?: number } | null {
  let pos = -1
  for (let i = 0; i + 6 <= buf.length; i++) {
    if (buf[i] === 0x01 && buf[i + 1] === 0x00) {
      const count = buf.readUInt32BE(i + 2)
      if (count > 0 && count < 100_000) {
        // Each non-terminal marker is 8 bytes; terminal marker is 8 bytes.
        const need = i + 6 + (count - 1) * 8 + 8
        if (need <= buf.length + 1) {
          pos = i
          break
        }
      }
    }
  }
  if (pos < 0) return null

  let o = pos + 2
  const count = buf.readUInt32BE(o)
  o += 4
  if (count === 0 || o + 4 > buf.length) return null

  const firstPosSec = buf.readFloatBE(o)
  let bpm: number | undefined
  if (count === 1 && o + 8 <= buf.length) {
    bpm = buf.readFloatBE(o + 4) // single terminal marker carries the BPM
  }
  if (!Number.isFinite(firstPosSec) || firstPosSec < 0) return null
  return { offsetMs: Math.round(firstPosSec * 1000), bpm }
}

// ───────── Container extraction (music-metadata) ─────────

interface RawBlob {
  /** 'geob' = ID3 GEOB .data (MP3/WAV/AIFF); 'b64' = base64 string (FLAC/MP4). */
  kind: 'geob' | 'b64'
  data: Buffer
}

interface NativeTag {
  id: string
  value: unknown
}

/** Coerce a music-metadata tag value into a Buffer of base64-decoded bytes. */
function coerceBase64(value: unknown): Buffer | null {
  try {
    if (typeof value === 'string') return Buffer.from(value.replace(/\s/g, ''), 'base64')
    if (value instanceof Uint8Array) {
      // MP4 freeform atoms may hand back the ascii base64 as bytes.
      const asAscii = Buffer.from(value).toString('latin1').replace(/\s/g, '')
      if (/^[A-Za-z0-9+/=]+$/.test(asAscii)) return Buffer.from(asAscii, 'base64')
      return Buffer.from(value)
    }
  } catch {
    // fall through
  }
  return null
}

/** Find the Markers2 + BeatGrid raw blobs in a parsed file's native tags. */
function collectSeratoBlobs(native: Record<string, NativeTag[]>): {
  markers2?: RawBlob
  beatgrid?: RawBlob
} {
  let markers2: RawBlob | undefined
  let beatgrid: RawBlob | undefined

  for (const tags of Object.values(native)) {
    if (!Array.isArray(tags)) continue
    for (const tag of tags) {
      const id = String(tag.id ?? '')
      const v = tag.value as { description?: string; data?: Uint8Array } | string | Uint8Array

      // ID3 GEOB (MP3 / WAV / AIFF): value = { description, data }
      if (id === 'GEOB' && v && typeof v === 'object' && 'description' in v && v.data) {
        const desc = (v as { description?: string }).description ?? ''
        const data = Buffer.from((v as { data: Uint8Array }).data)
        if (desc === 'Serato Markers2') markers2 ??= { kind: 'geob', data }
        else if (desc === 'Serato BeatGrid') beatgrid ??= { kind: 'geob', data }
        continue
      }

      // FLAC/Ogg vorbis comments + MP4 `----:com.serato.dj:*` freeform atoms.
      const lid = id.toLowerCase()
      if (lid.includes('serato') || lid.includes('markersv2') || lid.includes('beatgrid')) {
        const data = coerceBase64(v)
        if (!data) continue
        if (lid.includes('markers')) markers2 ??= { kind: 'b64', data }
        else if (lid.includes('beatgrid')) beatgrid ??= { kind: 'b64', data }
      }
    }
  }

  return { markers2, beatgrid }
}

/** Decode the Markers2 blob → entries-ready buffer (base64-decoded for all containers). */
function decodeMarkers2Payload(blob: RawBlob): Buffer | null {
  if (blob.kind === 'b64') return blob.data // already base64-decoded by coerceBase64
  // ID3 GEOB: [0x01 0x01][base64 ascii up to first null]
  const data = blob.data
  if (data.length < 3) return null
  const nullIdx = data.indexOf(0x00, 2)
  const end = nullIdx === -1 ? data.length : nullIdx
  const b64 = data.toString('latin1', 2, end).replace(/\s/g, '')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  try {
    return Buffer.from(padded, 'base64')
  } catch {
    return null
  }
}

/**
 * Read a single audio file's Serato tags. Returns null when the file can't be
 * parsed; returns empty arrays when parsed but no Serato data is present.
 */
export async function extractSeratoTags(filePath: string): Promise<SeratoFileTags | null> {
  let native: Record<string, NativeTag[]>
  try {
    const { parseFile } = await import('music-metadata')
    const meta = await parseFile(filePath, { duration: false })
    native = meta.native as unknown as Record<string, NativeTag[]>
  } catch {
    return null
  }

  const result: SeratoFileTags = { hotCues: [], loops: [] }
  const { markers2, beatgrid } = collectSeratoBlobs(native)

  if (markers2) {
    const payload = decodeMarkers2Payload(markers2)
    if (payload) {
      const start = findEntriesStart(payload)
      if (start >= 0) {
        const parsed = parseMarkers2Entries(payload, start)
        result.hotCues = parsed.hotCues
        result.loops = parsed.loops
        result.color = parsed.color
      }
    }
  }

  if (beatgrid) {
    const grid = parseBeatgrid(beatgrid.data)
    if (grid) result.beatgridOffset = grid.offsetMs
  }

  return result
}
