/**
 * Fingerprint index codec — disk-cache round-trip.
 *
 * The live index is ffmpeg-built (slow) and cached to disk so a later launch
 * restores it instead of rebuilding. These tests prove the binary format is
 * lossless (the restored index identifies exactly like the original) and that a
 * corrupt / wrong-version cache is rejected rather than crashing go-live.
 */
import { describe, it, expect } from 'vitest'
import {
  addToIndex,
  fingerprint,
  identify,
  FP_SAMPLE_RATE,
  type FingerprintIndex
} from '../electron/services/live/fingerprint'
import { encodeIndex, decodeIndex } from '../electron/services/live/fingerprintCodec'

/** Tiny seeded PRNG so every run is identical. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** A "musical" buffer with a time-varying spectrum → a rich constellation. */
function makeTrack(scale: number[], seconds: number, seed: number): Float32Array {
  const sr = FP_SAMPLE_RATE
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  const rand = rng(seed)
  const noteLen = Math.floor(0.4 * sr)
  for (let i = 0; i < n; i++) {
    const note = scale[Math.floor(i / noteLen) % scale.length]
    const f = 110 * Math.pow(2, note / 12)
    const t = i / sr
    out[i] =
      0.5 * Math.sin(2 * Math.PI * f * t) +
      0.25 * Math.sin(2 * Math.PI * 2 * f * t) +
      0.1 * (rand() - 0.5)
  }
  return out
}

function buildSample(): { index: FingerprintIndex; probe: Float32Array } {
  const a = makeTrack([0, 3, 7, 10], 12, 1)
  const b = makeTrack([0, 2, 5, 9], 12, 2)
  const index: FingerprintIndex = new Map()
  addToIndex(index, 'track-a', fingerprint(a))
  addToIndex(index, 'track-b', fingerprint(b))
  // A mid-track clip of A — what a live probe looks like.
  const probe = a.subarray(FP_SAMPLE_RATE * 4, FP_SAMPLE_RATE * 10)
  return { index, probe }
}

describe('fingerprint codec', () => {
  it('round-trips an index losslessly (same buckets, same match)', () => {
    const { index, probe } = buildSample()

    const decoded = decodeIndex(encodeIndex(index, { paramSig: 'x', librarySig: 'y' }))
    expect(decoded).not.toBeNull()
    const restored = decoded!.index

    // Structural equality: same hashes, same bucket contents.
    expect(restored.size).toBe(index.size)
    for (const [hash, bucket] of index) {
      const rb = restored.get(hash)
      expect(rb).toBeDefined()
      expect(rb).toEqual(bucket)
    }

    // Behavioural equality: identifies the same track from the same probe.
    const before = identify(probe, index)[0]
    const after = identify(probe, restored)[0]
    expect(after.id).toBe(before.id)
    expect(after.id).toBe('track-a')
    expect(after.score).toBe(before.score)
    expect(after.confidence).toBeCloseTo(before.confidence, 10)
  })

  it('preserves opaque meta', () => {
    const { index } = buildSample()
    const meta = { paramSig: 'v1,600,22050', librarySig: '2:abc', indexedTracks: 2 }
    const decoded = decodeIndex(encodeIndex(index, meta))
    expect(decoded!.meta).toEqual(meta)
  })

  it('shares one string reference per track id', () => {
    const { index } = buildSample()
    const restored = decodeIndex(encodeIndex(index, {}))!.index
    const ids = new Set<string>()
    const refs = new Map<string, object>()
    for (const bucket of restored.values()) {
      for (const e of bucket) {
        ids.add(e.id)
        // every entry for a given id must be the SAME string object
        const seen = refs.get(e.id)
        if (seen) expect(e.id).toBe(seen as unknown as string)
        else refs.set(e.id, e.id as unknown as object)
      }
    }
    expect(ids).toEqual(new Set(['track-a', 'track-b']))
  })

  it('rejects corrupt, truncated, and wrong-magic buffers (returns null)', () => {
    const { index } = buildSample()
    const good = encodeIndex(index, {})

    expect(decodeIndex(Buffer.alloc(0))).toBeNull()
    expect(decodeIndex(Buffer.from('not an index at all'))).toBeNull()
    expect(decodeIndex(good.subarray(0, good.length - 40))).toBeNull() // truncated body

    const wrongMagic = Buffer.from(good)
    wrongMagic.writeUInt32LE(0xdeadbeef, 0)
    expect(decodeIndex(wrongMagic)).toBeNull()

    const wrongVersion = Buffer.from(good)
    wrongVersion.writeUInt32LE(999, 4)
    expect(decodeIndex(wrongVersion)).toBeNull()
  })
})
