/**
 * Binary (de)serialisation for the live fingerprint index.
 *
 * Building the index ffmpeg-decodes and fingerprints the whole library — the
 * slowest part of going live, and (before this) thrown away on every app quit.
 * Caching it to disk lets a later launch restore it instantly instead of
 * rebuilding from scratch. This module is the on-disk format; the freshness
 * policy (when a cache is still valid) lives in the caller via the opaque `meta`.
 *
 * Format (little-endian):
 *   magic    "SRFP"  (uint32)
 *   version  uint32
 *   metaLen  uint32                       byte length of the meta JSON
 *   meta     utf8 JSON                     opaque to the codec — the caller puts
 *                                          its signature/params here and validates
 *   ids      uint32 count, then each:      track-id table (the body references ids
 *              uint32 len, utf8 bytes      by integer index, so each id is stored
 *                                          once however many landmarks it has)
 *   body     uint32 hashCount, then per hash:
 *              uint32 hash
 *              uint32 bucketLen
 *              bucketLen × (uint32 idIndex, uint32 frame)
 *
 * Pure — no fs, no electron — so it unit-tests in isolation like the DSP layer.
 */
import type { FingerprintIndex } from './fingerprint'

/** "SRFP" — SetRecord FingerPrint. */
const MAGIC = 0x53524650
/** Bump on any incompatible format change (forces a rebuild of old caches). */
export const CODEC_VERSION = 1

/** Encode an index + opaque metadata into one contiguous buffer. */
export function encodeIndex(index: FingerprintIndex, meta: unknown): Buffer {
  // Intern unique track ids into an integer table the body references.
  const idToIndex = new Map<string, number>()
  const ids: string[] = []
  let entryCount = 0
  for (const bucket of index.values()) {
    entryCount += bucket.length
    for (const e of bucket) {
      if (!idToIndex.has(e.id)) {
        idToIndex.set(e.id, ids.length)
        ids.push(e.id)
      }
    }
  }

  const metaBuf = Buffer.from(JSON.stringify(meta ?? {}), 'utf8')
  const idBufs = ids.map((s) => Buffer.from(s, 'utf8'))
  const idTableSize = 4 + idBufs.reduce((n, b) => n + 4 + b.length, 0)
  const bodySize = 4 + index.size * 8 + entryCount * 8
  const total = 12 + metaBuf.length + idTableSize + bodySize

  const buf = Buffer.allocUnsafe(total)
  let o = 0
  o = buf.writeUInt32LE(MAGIC, o)
  o = buf.writeUInt32LE(CODEC_VERSION, o)
  o = buf.writeUInt32LE(metaBuf.length, o)
  o += metaBuf.copy(buf, o)

  o = buf.writeUInt32LE(ids.length, o)
  for (const b of idBufs) {
    o = buf.writeUInt32LE(b.length, o)
    o += b.copy(buf, o)
  }

  o = buf.writeUInt32LE(index.size, o)
  for (const [hash, bucket] of index) {
    o = buf.writeUInt32LE(hash >>> 0, o)
    o = buf.writeUInt32LE(bucket.length, o)
    for (const e of bucket) {
      o = buf.writeUInt32LE(idToIndex.get(e.id) as number, o)
      o = buf.writeUInt32LE(e.t, o)
    }
  }
  return buf
}

/** Decode a buffer produced by {@link encodeIndex}. Returns null on any
 *  malformed / wrong-version / truncated input — never throws. */
export function decodeIndex(buf: Buffer): { index: FingerprintIndex; meta: unknown } | null {
  try {
    if (buf.length < 12) return null
    let o = 0
    if (buf.readUInt32LE(o) !== MAGIC) return null
    o += 4
    if (buf.readUInt32LE(o) !== CODEC_VERSION) return null
    o += 4
    const metaLen = buf.readUInt32LE(o)
    o += 4
    const meta = JSON.parse(buf.toString('utf8', o, o + metaLen))
    o += metaLen

    const idCount = buf.readUInt32LE(o)
    o += 4
    const ids: string[] = new Array(idCount)
    for (let i = 0; i < idCount; i++) {
      const len = buf.readUInt32LE(o)
      o += 4
      ids[i] = buf.toString('utf8', o, o + len)
      o += len
    }

    const index: FingerprintIndex = new Map()
    const hashCount = buf.readUInt32LE(o)
    o += 4
    for (let h = 0; h < hashCount; h++) {
      const hash = buf.readUInt32LE(o)
      o += 4
      const bucketLen = buf.readUInt32LE(o)
      o += 4
      const bucket: Array<{ id: string; t: number }> = new Array(bucketLen)
      for (let i = 0; i < bucketLen; i++) {
        const idIndex = buf.readUInt32LE(o)
        o += 4
        const t = buf.readUInt32LE(o)
        o += 4
        // Reuse the one interned string per track (matches addToIndex's sharing).
        bucket[i] = { id: ids[idIndex], t }
      }
      index.set(hash, bucket)
    }
    return { index, meta }
  } catch {
    return null
  }
}
