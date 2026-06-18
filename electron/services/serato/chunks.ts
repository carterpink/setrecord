/**
 * Generic reader/writer for Serato's tagged binary container format.
 *
 * Serato's `database V2` and `Subcrates/*.crate` files share one encoding: a
 * flat stream of chunks, each
 *
 *   [4-byte ASCII tag][4-byte big-endian uint32 length][`length` bytes payload]
 *
 * The tag's first letter determines how the payload is interpreted (documented
 * by the Mixxx project + Holzhaus/serato-tags):
 *
 *   o*, r*  → nested sequence of chunks
 *   t*, p*  → UTF-16 big-endian text (p* values are paths, relative to drive root)
 *   u*      → unsigned 32-bit big-endian integer
 *   s*      → signed 32-bit big-endian integer
 *   b*      → single byte boolean
 *   vrsn    → UTF-16 big-endian text (version header; special-cased)
 *
 * The reader is intentionally defensive: a truncated/garbage chunk stops
 * parsing rather than throwing, so one corrupt record can't sink an import.
 *
 * The encoder is the inverse and exists primarily so tests can build fixtures
 * without shipping real Serato files in the repo.
 */

export interface SeratoChunk {
  tag: string
  /** Set for text chunks (tags starting t, p, or `vrsn`). */
  text?: string
  /** Set for u-prefixed unsigned-int chunks. */
  u32?: number
  /** Set for s-prefixed signed-int chunks. */
  s32?: number
  /** Set for b-prefixed boolean chunks. */
  bool?: boolean
  /** Set for nested chunks (tags starting o or r). */
  children?: SeratoChunk[]
  /** Raw payload for unrecognised tags (kept so re-encoding round-trips). */
  raw?: Buffer
}

type ChunkKind = 'nested' | 'text' | 'u32' | 's32' | 'bool' | 'raw'

/** Classify a chunk by its tag (first letter, with `vrsn` special-cased). */
export function chunkKind(tag: string): ChunkKind {
  if (tag === 'vrsn') return 'text'
  switch (tag[0]) {
    case 'o':
    case 'r':
      return 'nested'
    case 't':
    case 'p':
      return 'text'
    case 'u':
      return 'u32'
    case 's':
      return 's32'
    case 'b':
      return 'bool'
    default:
      return 'raw'
  }
}

/** Decode a UTF-16 big-endian buffer to a JS string. */
export function decodeUtf16BE(buf: Buffer): string {
  if (buf.length < 2) return ''
  // Buffer only decodes utf16le, so byte-swap a copy first.
  const swapped = Buffer.from(buf)
  // swap16 requires even length; trim a trailing odd byte defensively.
  const even = swapped.length - (swapped.length % 2)
  return swapped.subarray(0, even).swap16().toString('utf16le')
}

/** Encode a JS string as UTF-16 big-endian. */
export function encodeUtf16BE(text: string): Buffer {
  const le = Buffer.from(text, 'utf16le')
  return Buffer.from(le).swap16()
}

/**
 * Parse a flat chunk stream from `buf`. Used at the top level of `database V2`
 * and `.crate` files, and recursively for nested chunks.
 */
export function parseChunks(buf: Buffer): SeratoChunk[] {
  const out: SeratoChunk[] = []
  let offset = 0

  while (offset + 8 <= buf.length) {
    const tag = buf.toString('ascii', offset, offset + 4)
    const length = buf.readUInt32BE(offset + 4)
    const start = offset + 8
    const end = start + length

    // Truncated/garbage length — stop rather than read past the buffer.
    if (length < 0 || end > buf.length) break

    const payload = buf.subarray(start, end)
    const chunk: SeratoChunk = { tag }

    switch (chunkKind(tag)) {
      case 'nested':
        chunk.children = parseChunks(payload)
        break
      case 'text':
        chunk.text = decodeUtf16BE(payload)
        break
      case 'u32':
        chunk.u32 = payload.length >= 4 ? payload.readUInt32BE(0) : 0
        break
      case 's32':
        chunk.s32 = payload.length >= 4 ? payload.readInt32BE(0) : 0
        break
      case 'bool':
        chunk.bool = payload.length >= 1 ? payload.readUInt8(0) !== 0 : false
        break
      default:
        chunk.raw = Buffer.from(payload)
    }

    out.push(chunk)
    offset = end
  }

  return out
}

/** Encode a single chunk back to its `[tag][len][payload]` byte form. */
export function encodeChunk(chunk: SeratoChunk): Buffer {
  let payload: Buffer
  switch (chunkKind(chunk.tag)) {
    case 'nested':
      payload = encodeChunks(chunk.children ?? [])
      break
    case 'text':
      payload = encodeUtf16BE(chunk.text ?? '')
      break
    case 'u32': {
      payload = Buffer.alloc(4)
      payload.writeUInt32BE(chunk.u32 ?? 0, 0)
      break
    }
    case 's32': {
      payload = Buffer.alloc(4)
      payload.writeInt32BE(chunk.s32 ?? 0, 0)
      break
    }
    case 'bool':
      payload = Buffer.from([chunk.bool ? 1 : 0])
      break
    default:
      payload = chunk.raw ?? Buffer.alloc(0)
  }

  const header = Buffer.alloc(8)
  header.write(chunk.tag.padEnd(4, '\0').slice(0, 4), 0, 'ascii')
  header.writeUInt32BE(payload.length, 4)
  return Buffer.concat([header, payload])
}

/** Encode a chunk sequence. Inverse of {@link parseChunks}. */
export function encodeChunks(chunks: SeratoChunk[]): Buffer {
  return Buffer.concat(chunks.map(encodeChunk))
}

/** First child (or top-level chunk) matching `tag`, or undefined. */
export function findChunk(chunks: SeratoChunk[], tag: string): SeratoChunk | undefined {
  return chunks.find((c) => c.tag === tag)
}
