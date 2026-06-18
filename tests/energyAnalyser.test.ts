import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import {
  W_RMS,
  W_BRIGHTNESS,
  W_LOUDNESS,
  RMS_DB_MIN,
  RMS_DB_MAX,
  CENTROID_MAX_HZ,
  LUFS_MIN,
  LUFS_MAX,
  ANALYSIS_SAMPLE_RATE,
  scoreFromComponents,
  spectralEnergyScore,
  normaliseFeatures,
  frameRmsDbfs,
  spectralCentroidHz,
  kWeightedLufs,
  fftInPlace,
  analyseSamples
} from '../electron/services/energy/spectralFeatures'
import {
  EnergyCache,
  signature,
  CACHE_VERSION,
  type CachedEnergy
} from '../electron/services/energy/energyCache'
import { analyseTrack, type PcmDecode } from '../electron/services/energy/analyse'

// ───────── helpers ─────────

function sine(
  freqHz: number,
  seconds: number,
  amplitude = 1,
  sr = ANALYSIS_SAMPLE_RATE
): Float32Array {
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sr)
  return out
}

// ───────── weighting math ─────────

describe('spectral energy weighting (40/30/30)', () => {
  it('weights sum to 1', () => {
    expect(W_RMS + W_BRIGHTNESS + W_LOUDNESS).toBeCloseTo(1, 12)
  })

  it('all components maxed → raw 1, score 10', () => {
    const { raw, score } = scoreFromComponents({ rms: 1, brightness: 1, loudness: 1 })
    expect(raw).toBeCloseTo(1, 12)
    expect(score).toBe(10)
  })

  it('all components zero → raw 0, score 1', () => {
    const { raw, score } = scoreFromComponents({ rms: 0, brightness: 0, loudness: 0 })
    expect(raw).toBe(0)
    expect(score).toBe(1)
  })

  it('each component contributes exactly its weight to the raw blend', () => {
    expect(scoreFromComponents({ rms: 1, brightness: 0, loudness: 0 }).raw).toBeCloseTo(W_RMS, 12)
    expect(scoreFromComponents({ rms: 0, brightness: 1, loudness: 0 }).raw).toBeCloseTo(
      W_BRIGHTNESS,
      12
    )
    expect(scoreFromComponents({ rms: 0, brightness: 0, loudness: 1 }).raw).toBeCloseTo(
      W_LOUDNESS,
      12
    )
  })

  it('RMS (0.4) outweighs brightness or loudness (0.3) alone', () => {
    const rmsOnly = scoreFromComponents({ rms: 1, brightness: 0, loudness: 0 })
    const brightOnly = scoreFromComponents({ rms: 0, brightness: 1, loudness: 0 })
    const loudOnly = scoreFromComponents({ rms: 0, brightness: 0, loudness: 1 })
    expect(rmsOnly.raw).toBeGreaterThan(brightOnly.raw)
    expect(rmsOnly.raw).toBeGreaterThan(loudOnly.raw)
    // 0.4 → 1 + round(3.6) = 5 ; 0.3 → 1 + round(2.7) = 4
    expect(rmsOnly.score).toBe(5)
    expect(brightOnly.score).toBe(4)
    expect(loudOnly.score).toBe(4)
  })

  it('a known mixed blend resolves to the documented arithmetic', () => {
    // 0.4*0.5 + 0.3*1 + 0.3*0 = 0.5 → 1 + round(4.5) = 6 (banker-free round → 5? Math.round(4.5)=5)
    const { raw, score } = spectralEnergyScore({
      rmsDbfs: (RMS_DB_MIN + RMS_DB_MAX) / 2, // → rms 0.5
      centroidHz: CENTROID_MAX_HZ, // → brightness 1
      lufs: LUFS_MIN // → loudness 0
    })
    expect(raw).toBeCloseTo(0.5, 12)
    expect(score).toBe(1 + Math.round(0.5 * 9)) // 1 + round(4.5) = 6
    expect(score).toBe(6)
  })
})

describe('normaliseFeatures', () => {
  it('maps each feature onto 0..1 across its calibrated range', () => {
    expect(normaliseFeatures({ rmsDbfs: RMS_DB_MIN, centroidHz: 0, lufs: -1000 })).toEqual({
      rms: 0,
      brightness: 0,
      loudness: 0
    })
    expect(
      normaliseFeatures({ rmsDbfs: RMS_DB_MAX, centroidHz: CENTROID_MAX_HZ, lufs: LUFS_MAX })
    ).toEqual({ rms: 1, brightness: 1, loudness: 1 })
  })

  it('clamps out-of-range values', () => {
    const c = normaliseFeatures({ rmsDbfs: 50, centroidHz: 99_999, lufs: 50 })
    expect(c.rms).toBe(1)
    expect(c.brightness).toBe(1)
    expect(c.loudness).toBe(1)
  })

  it('midpoint dBFS → ~0.5 RMS', () => {
    const mid = (RMS_DB_MIN + RMS_DB_MAX) / 2
    expect(normaliseFeatures({ rmsDbfs: mid, centroidHz: 0, lufs: 0 }).rms).toBeCloseTo(0.5, 6)
  })
})

// ───────── DSP correctness ─────────

describe('fftInPlace', () => {
  it('throws on non-power-of-two length', () => {
    expect(() => fftInPlace(new Float64Array(3), new Float64Array(3))).toThrow()
  })

  it('transforms a unit impulse to a flat spectrum', () => {
    const re = new Float64Array(8)
    const im = new Float64Array(8)
    re[0] = 1
    fftInPlace(re, im)
    for (let k = 0; k < 8; k++) {
      expect(Math.hypot(re[k], im[k])).toBeCloseTo(1, 9)
    }
  })
})

describe('frameRmsDbfs', () => {
  it('full-scale sine measures ~ -3 dBFS', () => {
    // RMS of a unit-amplitude sine is 1/√2 → meanSquare 0.5 → 10·log10(0.5) ≈ -3.01
    expect(frameRmsDbfs(sine(1000, 2, 1))).toBeCloseTo(-3.01, 1)
  })

  it('a quieter sine reads lower than a louder one', () => {
    expect(frameRmsDbfs(sine(1000, 2, 0.1))).toBeLessThan(frameRmsDbfs(sine(1000, 2, 1)))
  })

  it('silence → -Infinity', () => {
    expect(frameRmsDbfs(new Float32Array(8192))).toBe(-Infinity)
  })
})

describe('spectralCentroidHz', () => {
  it('locates a pure tone near its frequency', () => {
    expect(spectralCentroidHz(sine(1000, 2))).toBeGreaterThan(700)
    expect(spectralCentroidHz(sine(1000, 2))).toBeLessThan(1400)
  })

  it('a brighter (higher) tone yields a higher centroid', () => {
    expect(spectralCentroidHz(sine(4000, 2))).toBeGreaterThan(spectralCentroidHz(sine(800, 2)))
  })
})

describe('kWeightedLufs', () => {
  it('returns a finite LUFS for a real signal and -Infinity for silence', () => {
    expect(Number.isFinite(kWeightedLufs(sine(1000, 2)))).toBe(true)
    expect(kWeightedLufs(new Float32Array(4096))).toBe(-Infinity)
  })

  it('louder input is louder in LUFS', () => {
    expect(kWeightedLufs(sine(1000, 2, 1))).toBeGreaterThan(kWeightedLufs(sine(1000, 2, 0.1)))
  })
})

describe('analyseSamples end-to-end', () => {
  it('a loud bright signal outscores a quiet dark one', () => {
    const hot = analyseSamples(sine(3000, 2, 0.9))
    const cold = analyseSamples(sine(300, 2, 0.05))
    expect(hot.score).toBeGreaterThan(cold.score)
    expect(hot.score).toBeGreaterThanOrEqual(1)
    expect(hot.score).toBeLessThanOrEqual(10)
  })
})

// ───────── cache behaviour ─────────

describe('EnergyCache', () => {
  const entry: CachedEnergy = {
    energy: 7,
    energyRaw: 0.66,
    source: 'computed',
    rms: 0.6,
    brightness: 0.5,
    loudness: 0.7,
    vocalness: 0.3,
    v: CACHE_VERSION
  }

  it('signature changes with size and mtime', () => {
    const a = signature('/a.mp3', 100, 1000)
    expect(signature('/a.mp3', 100, 1000)).toBe(a)
    expect(signature('/a.mp3', 101, 1000)).not.toBe(a)
    expect(signature('/a.mp3', 100, 2000)).not.toBe(a)
    expect(signature('/b.mp3', 100, 1000)).not.toBe(a)
  })

  it('round-trips a stored entry', () => {
    const cache = new EnergyCache()
    cache.set('k', entry)
    expect(cache.get('k')).toEqual(entry)
    expect(cache.size()).toBe(1)
  })

  it('ignores entries from a stale schema version', () => {
    const cache = new EnergyCache({ k: { ...entry, v: CACHE_VERSION + 1 } })
    expect(cache.get('k')).toBeUndefined()
  })

  it('flushes to the backing store only when dirty', () => {
    let writes = 0
    let saved: Record<string, CachedEnergy> = {}
    const cache = new EnergyCache({}, (s) => {
      writes++
      saved = { ...s }
    })
    cache.flush() // nothing dirty → no write
    expect(writes).toBe(0)
    cache.set('k', entry)
    cache.flush()
    expect(writes).toBe(1)
    expect(saved.k).toEqual(entry)
    cache.flush() // dirty flag cleared → no second write
    expect(writes).toBe(1)
  })
})

describe('analyseTrack caching', () => {
  let dir: string
  let file: string
  let decodeCalls: number
  const pcm: PcmDecode = { samples: sine(2000, 2, 0.8), sampleRate: ANALYSIS_SAMPLE_RATE }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'setrecord-energy-'))
    file = join(dir, 'track.wav')
    writeFileSync(file, Buffer.from('not-real-audio-decode-is-injected'))
    decodeCalls = 0
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  const decode = async (): Promise<PcmDecode> => {
    decodeCalls++
    return pcm
  }

  it('computes once then serves the cache (no second decode)', async () => {
    const cache = new EnergyCache()
    const first = await analyseTrack('t1', file, 124, false, { decode, cache })
    expect(first.source).toBe('computed')
    expect(first.cached).toBe(false)
    expect(decodeCalls).toBe(1)

    const second = await analyseTrack('t1', file, 124, false, { decode, cache })
    expect(second.cached).toBe(true)
    expect(decodeCalls).toBe(1) // still 1 — decode skipped
    expect(second.energy).toBe(first.energy)
    expect(second.energyRaw).toBeCloseTo(first.energyRaw, 12)
  })

  it('re-analyses when the file changes (signature invalidates)', async () => {
    const cache = new EnergyCache()
    await analyseTrack('t1', file, 124, false, { decode, cache })
    expect(decodeCalls).toBe(1)
    // Rewrite with different size → new signature → cache miss.
    writeFileSync(file, Buffer.from('a-different-and-longer-payload-than-before'))
    await analyseTrack('t1', file, 124, false, { decode, cache })
    expect(decodeCalls).toBe(2)
  })

  it('missing file → neutral 5, no decode', async () => {
    const cache = new EnergyCache()
    const r = await analyseTrack('t1', file, 124, true, { decode, cache })
    expect(r.source).toBe('missing')
    expect(r.energy).toBe(5)
    expect(decodeCalls).toBe(0)
  })

  it('decode failure → BPM fallback marked failed', async () => {
    const cache = new EnergyCache()
    const r = await analyseTrack('t1', file, 150, false, {
      decode: async () => null,
      cache
    })
    expect(r.source).toBe('failed')
    expect(r.cached).toBe(false)
    expect(r.energy).toBeGreaterThanOrEqual(1)
    expect(r.energy).toBeLessThanOrEqual(10)
  })
})
