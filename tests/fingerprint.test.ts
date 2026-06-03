/**
 * Closed-set fingerprint engine — mechanics + robustness on synthetic audio.
 *
 * This proves the ALGORITHM works: that distinct tracks are discriminable, that
 * a mid-track clip identifies its parent, and that the offset-histogram vote
 * survives the distortions a club booth introduces (added noise, EQ colouring,
 * level changes, codec-like quantisation). Real-world music accuracy is proven
 * separately by scripts/fingerprint-spike.mjs against the user's own library —
 * synthetic audio can't stand in for that, but it can prove the math.
 */

import { describe, it, expect } from 'vitest'
import {
  buildIndex,
  identify,
  fingerprint,
  FP_SAMPLE_RATE,
  FP_MIN_CONFIDENCE
} from '../electron/services/live/fingerprint'

// ───────── deterministic synthetic "tracks" ─────────

/** Tiny seeded PRNG so every run is identical (no Math.random flakiness). */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/**
 * Build a "musical" mono buffer: a sequence of chords drawn from a per-track
 * scale, changing a few times a second, each with harmonics and a kick-like
 * amplitude pulse. The time-varying spectrum yields a rich constellation —
 * like real music and unlike a static tone.
 */
function makeTrack(scale: number[], seconds: number, seed: number): Float32Array {
  const sr = FP_SAMPLE_RATE
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  const rand = rng(seed)
  const noteLen = Math.floor(0.4 * sr) // new chord every 0.4s
  const kickHz = 2 // ~120 bpm

  for (let i = 0; i < n; i++) {
    const t = i / sr
    const noteIdx = Math.floor(i / noteLen)
    const r2 = rng(seed + noteIdx * 7919)
    // Pick a 3-note chord from the scale for this slice.
    const roots = [
      scale[Math.floor(r2() * scale.length)],
      scale[Math.floor(r2() * scale.length)],
      scale[Math.floor(r2() * scale.length)]
    ]
    let s = 0
    for (const f of roots) {
      s += Math.sin(2 * Math.PI * f * t)
      s += 0.5 * Math.sin(2 * Math.PI * 2 * f * t) // 2nd harmonic
      s += 0.25 * Math.sin(2 * Math.PI * 3 * f * t) // 3rd harmonic
    }
    // Kick-like amplitude pulse + slight per-track noise floor.
    const env = 0.6 + 0.4 * Math.max(0, Math.sin(2 * Math.PI * kickHz * t))
    out[i] = (s / 6) * env + (rand() - 0.5) * 0.002
  }
  return out
}

/** Five tracks with disjoint-ish fundamental sets → discriminable. */
const TRACKS: Record<string, number[]> = {
  'track-A': [220, 277, 330, 440],
  'track-B': [196, 247, 294, 392],
  'track-C': [262, 330, 392, 523],
  'track-D': [233, 311, 415, 466],
  'track-E': [175, 220, 262, 349]
}

function makeLibrary(): Map<string, Float32Array> {
  const lib = new Map<string, Float32Array>()
  let seed = 1
  for (const [id, scale] of Object.entries(TRACKS)) lib.set(id, makeTrack(scale, 24, seed++))
  return lib
}

/** Slice `seconds` of audio starting `atSec` into a track. */
function clip(samples: Float32Array, atSec: number, seconds: number): Float32Array {
  const start = Math.floor(atSec * FP_SAMPLE_RATE)
  const len = Math.floor(seconds * FP_SAMPLE_RATE)
  return samples.slice(start, start + len)
}

// ── booth distortions ──

function addNoise(x: Float32Array, amp: number, seed = 99): Float32Array {
  const rand = rng(seed)
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] + (rand() - 0.5) * 2 * amp
  return out
}

function changeLevel(x: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = x[i] * gain
  return out
}

/** One-pole EQ colouring — lowpass (a<0 ⇒ highpass-ish via complement). */
function eq(x: Float32Array, alpha: number, highpass = false): Float32Array {
  const out = new Float32Array(x.length)
  let y = 0
  for (let i = 0; i < x.length; i++) {
    y = alpha * y + (1 - alpha) * x[i]
    out[i] = highpass ? x[i] - y : y
  }
  return out
}

/** Crude codec-like amplitude quantisation. */
function quantise(x: Float32Array, levels: number): Float32Array {
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) out[i] = Math.round(x[i] * levels) / levels
  return out
}

// ───────── tests ─────────

describe('fingerprint engine', () => {
  const library = makeLibrary()
  const index = buildIndex(library)
  // Synthetic audio is unrealistically repetitive (few distinct hashes recur
  // constantly), so the query-time bucket skip would discard legitimate votes.
  // This suite tests engine mechanics; the real-music harness exercises the
  // skip against realistic hash distributions. Query uncapped here.
  const NO_SKIP = Number.MAX_SAFE_INTEGER
  const find = (probe: Float32Array): ReturnType<typeof identify> =>
    identify(probe, index, 3, NO_SKIP)

  it('produces a non-trivial constellation per track', () => {
    for (const samples of library.values()) {
      expect(fingerprint(samples).length).toBeGreaterThan(500)
    }
  })

  it('identifies a clean mid-track clip as its own parent', () => {
    for (const [id, samples] of library) {
      const probe = clip(samples, 8, 7)
      const [best] = find(probe)
      expect(best.id).toBe(id)
      expect(best.confidence).toBeGreaterThan(FP_MIN_CONFIDENCE)
    }
  })

  it('does not confuse different tracks (clear margin over runner-up)', () => {
    const [best, second] = find(clip(library.get('track-C')!, 10, 7))
    expect(best.id).toBe('track-C')
    // Winner should dominate the field, not squeak past.
    expect(best.score).toBeGreaterThan((second?.score ?? 0) * 2)
  })

  it('survives added noise', () => {
    for (const [id, samples] of library) {
      const probe = addNoise(clip(samples, 6, 7), 0.05)
      const [best] = find(probe)
      expect(best.id).toBe(id)
      expect(best.confidence).toBeGreaterThan(FP_MIN_CONFIDENCE)
    }
  })

  it('survives EQ colouring (lowpass and highpass)', () => {
    for (const [id, samples] of library) {
      const lp = find(eq(clip(samples, 9, 7), 0.6))[0]
      const hp = find(eq(clip(samples, 9, 7), 0.6, true))[0]
      expect(lp.id).toBe(id)
      expect(hp.id).toBe(id)
    }
  })

  it('survives large level changes', () => {
    for (const [id, samples] of library) {
      expect(find(changeLevel(clip(samples, 5, 7), 0.2))[0].id).toBe(id)
      expect(find(changeLevel(clip(samples, 5, 7), 3.0))[0].id).toBe(id)
    }
  })

  it('survives codec-like quantisation', () => {
    for (const [id, samples] of library) {
      expect(find(quantise(clip(samples, 7, 7), 64))[0].id).toBe(id)
    }
  })

  it('aligns the probe at roughly the right offset into the track', () => {
    const [best] = find(clip(library.get('track-A')!, 12, 7))
    expect(best.id).toBe('track-A')
    // Probe started 12s in; recovered offset should be close.
    expect(Math.abs(best.offsetSec - 12)).toBeLessThan(1.0)
  })

  it('identifies short (3s) clips — the live lock-in budget', () => {
    for (const [id, samples] of library) {
      const [best] = find(clip(samples, 10, 3))
      expect(best.id).toBe(id)
    }
  })
})
