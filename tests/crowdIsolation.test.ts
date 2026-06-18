import { describe, it, expect } from 'vitest'
import {
  isolateCrowd,
  scoreReaction,
  analyzeReaction,
  roomEnergyDelta
} from '../electron/services/blackbox/crowdIsolation'

/**
 * Black Box DSP spike validation.
 *
 * We can't get real club audio here, but we CAN prove the core claim on
 * synthetic signals: given a known "music" reference pushed through a channel
 * (gain + delay) and summed with a known "crowd" signal, the NLMS filter should
 * cancel the music and leave a residual that tracks the crowd — including a
 * cheer burst. If this holds, the keystone's maths is sound and the open risk is
 * the real-room channel (reverb / time-variation), which the spike flags.
 */

const SR = 8000
const N = 8000
const TWO_PI = Math.PI * 2

/** Deterministic pseudo-noise so the test is reproducible (no Math.random). */
function noise(n: number, seed: number): Float64Array {
  let s = seed >>> 0
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    out[i] = (s / 0xffffffff) * 2 - 1
  }
  return out
}
function corr(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return Math.abs(dot) / Math.sqrt(na * nb + 1e-9)
}

function buildWorld(): { ref: Float64Array; observed: Float64Array; crowd: Float64Array } {
  const ref = new Float64Array(N)
  for (let n = 0; n < N; n++) {
    ref[n] = Math.sin(TWO_PI * 0.05 * n) + 0.5 * Math.sin(TWO_PI * 0.13 * n)
  }
  const nz = noise(N, 7)
  const crowd = new Float64Array(N)
  for (let n = 0; n < N; n++) {
    const amp = n >= 4000 && n < 4600 ? 0.6 : 0.08 // a cheer burst at ~the drop
    crowd[n] = amp * nz[n]
  }
  // Channel: gain 0.8, 3-sample delay. Mic hears music-through-PA + crowd.
  const observed = new Float64Array(N)
  for (let n = 0; n < N; n++) {
    observed[n] = (n >= 3 ? 0.8 * ref[n - 3] : 0) + crowd[n]
  }
  return { ref, observed, crowd }
}

describe('isolateCrowd — NLMS echo cancellation', () => {
  it('suppresses the known music and recovers the crowd residual', () => {
    const { ref, observed, crowd } = buildWorld()
    const { residual, suppressionDb } = isolateCrowd(ref, observed, { filterLength: 64, mu: 0.6 })

    // Music is meaningfully cancelled.
    expect(suppressionDb).toBeGreaterThan(6)
    expect(corr(residual, ref)).toBeLessThan(corr(observed, ref))

    // After convergence, the residual tracks the crowd far better than the raw mic did.
    const back = (s: Float64Array): Float64Array => s.slice(2000)
    expect(corr(back(residual), back(ref))).toBeLessThan(0.25)
    expect(corr(back(residual), back(crowd))).toBeGreaterThan(0.5)
    expect(corr(back(residual), back(crowd))).toBeGreaterThan(corr(back(observed), back(crowd)))
  })
})

describe('scoreReaction / analyzeReaction', () => {
  it('detects the cheer burst as a reaction peak', () => {
    const { ref, observed } = buildWorld()
    const a = analyzeReaction(ref, observed, SR, { filterLength: 64, mu: 0.6, windowSec: 0.05 })

    expect(a.method).toBe('blackbox')
    expect(a.confidence).toBeGreaterThan(0.3)
    expect(a.score).toBeGreaterThan(0)
    expect(a.score).toBeLessThanOrEqual(1)
    expect(a.peaks.length).toBeGreaterThan(0)
    // At least one peak lands in the burst neighbourhood (samples 4000–4600).
    expect(a.peaks.some((p) => p >= 3600 && p <= 5000)).toBe(true)

    const burstWin = a.perWindow.find((w) => w.startSample === 4000)!
    const quietWin = a.perWindow.find((w) => w.startSample === 0)!
    expect(burstWin.crowdPresence).toBeGreaterThan(quietWin.crowdPresence)
  })

  it('scoreReaction yields a normalised score from a residual', () => {
    const { ref, observed } = buildWorld()
    const { residual, suppressionDb } = isolateCrowd(ref, observed, { filterLength: 64, mu: 0.6 })
    const r = scoreReaction(residual, ref, SR, suppressionDb, { windowSec: 0.05 })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(1)
    expect(r.perWindow.length).toBeGreaterThan(0)
  })
})

describe('graceful fallback', () => {
  it('falls back to a derived room-energy signal when music can’t be suppressed', () => {
    const { ref, crowd } = buildWorld()
    // Mic hears only the crowd (no music bleed) → nothing to cancel.
    const a = analyzeReaction(ref, crowd, SR, { windowSec: 0.05 })
    expect(a.method).toBe('derived')
    expect(a.confidence).toBeLessThanOrEqual(0.3)
  })

  it('roomEnergyDelta returns a normalised envelope', () => {
    const { observed } = buildWorld()
    const env = roomEnergyDelta(observed, SR, 0.05)
    expect(env.length).toBeGreaterThan(0)
    expect(Math.max(...env)).toBeCloseTo(1, 5)
  })
})
