/**
 * Spectral feature extraction + DJ-calibrated energy scoring.
 *
 * Pure DSP — no ffmpeg, no fs, no Electron. Everything here operates on a mono
 * Float32Array of PCM samples (typically the first ~60s of a track decoded at
 * {@link ANALYSIS_SAMPLE_RATE}) so it can be unit-tested in isolation.
 *
 * Three per-frame features are extracted and blended into a 1–10 energy score:
 *   1. RMS energy        — time-domain power; how hard the track hits.
 *   2. Spectral centroid — "brightness"; bright/open tracks read as higher energy.
 *   3. Loudness (LUFS)   — perceptual K-weighted loudness per ITU-R BS.1770.
 *
 * The blend weights are calibrated for DJ/club music: RMS dominates because
 * sustained power is the strongest driver of a dancefloor's perceived energy,
 * with brightness and perceptual loudness splitting the remainder evenly.
 */

// ───────── public tunables ─────────

/** Sample rate the analyser decodes to. 22.05k → Nyquist ~11k, ample for brightness. */
export const ANALYSIS_SAMPLE_RATE = 22_050

/** FFT window size (power of two) and hop, in samples. */
export const FRAME_SIZE = 2048
export const HOP_SIZE = 1024

/** Blend weights — must sum to 1. Calibrated for DJ music. */
export const W_RMS = 0.4
export const W_BRIGHTNESS = 0.3
export const W_LOUDNESS = 0.3

// Normalisation ranges. Each maps a raw feature onto 0..1 before weighting.
// RMS in dBFS: -36 (sparse intro) → -6 (slammed master).
export const RMS_DB_MIN = -36
export const RMS_DB_MAX = -6
// Spectral centroid in Hz: 400 (dark/sub-heavy) → 4000 (bright/peak-time).
export const CENTROID_MIN_HZ = 400
export const CENTROID_MAX_HZ = 4000
// Integrated loudness in LUFS: -24 (quiet/dynamic) → -8 (loud club master).
export const LUFS_MIN = -24
export const LUFS_MAX = -8

// ───────── small helpers ─────────

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

// ───────── FFT (iterative radix-2 Cooley–Tukey) ─────────

/**
 * In-place complex FFT. `re`/`im` are length N (power of two) and overwritten
 * with the transform. Exported for testing against known signals.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n <= 1) return
  if ((n & (n - 1)) !== 0) throw new Error(`fftInPlace: length ${n} is not a power of two`)

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len >> 1; k++) {
        const aRe = re[i + k]
        const aIm = im[i + k]
        const bRe = re[i + k + (len >> 1)] * curRe - im[i + k + (len >> 1)] * curIm
        const bIm = re[i + k + (len >> 1)] * curIm + im[i + k + (len >> 1)] * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + (len >> 1)] = aRe - bRe
        im[i + k + (len >> 1)] = aIm - bIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

/** Periodic Hann window of length n. */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n))
  return w
}

// ───────── feature extractors ─────────

/**
 * Mean RMS across all hop-spaced frames, returned in dBFS. Silence → -Infinity,
 * which {@link normaliseFeatures} clamps to 0.
 */
export function frameRmsDbfs(
  samples: Float32Array,
  frameSize = FRAME_SIZE,
  hop = HOP_SIZE
): number {
  if (samples.length === 0) return -Infinity
  let sumSquares = 0
  let count = 0
  const end = Math.max(1, samples.length - frameSize + 1)
  for (let start = 0; start < end; start += hop) {
    let frameSum = 0
    for (let i = 0; i < frameSize && start + i < samples.length; i++) {
      const s = samples[start + i]
      frameSum += s * s
    }
    sumSquares += frameSum / frameSize
    count++
  }
  if (count === 0) return -Infinity
  const meanSquare = sumSquares / count
  if (meanSquare <= 0) return -Infinity
  return 10 * Math.log10(meanSquare)
}

/**
 * Mean spectral centroid (Hz) across hop-spaced, Hann-windowed frames. Frames
 * with no spectral energy are skipped. Returns 0 if nothing usable.
 */
export function spectralCentroidHz(
  samples: Float32Array,
  sampleRate = ANALYSIS_SAMPLE_RATE,
  frameSize = FRAME_SIZE,
  hop = HOP_SIZE
): number {
  if (samples.length === 0) return 0
  const n = nextPow2(frameSize)
  const win = hannWindow(frameSize)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const binHz = sampleRate / n

  let centroidSum = 0
  let frames = 0
  const end = Math.max(1, samples.length - frameSize + 1)
  for (let start = 0; start < end; start += hop) {
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < frameSize && start + i < samples.length; i++) {
      re[i] = samples[start + i] * win[i]
    }
    fftInPlace(re, im)

    let weighted = 0
    let total = 0
    for (let k = 1; k < n >> 1; k++) {
      const mag = Math.hypot(re[k], im[k])
      weighted += k * binHz * mag
      total += mag
    }
    if (total > 0) {
      centroidSum += weighted / total
      frames++
    }
  }
  return frames === 0 ? 0 : centroidSum / frames
}

// ── K-weighting (ITU-R BS.1770) ──
// Two cascaded biquads recomputed for the actual sample rate via the bilinear
// transform: a high-shelf "pre-filter" and an RLB high-pass.

interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

function highShelf(fs: number, f0: number, gainDb: number, q: number): Biquad {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha
  const a0 = A + 1 - (A - 1) * cos + twoSqrtAAlpha
  return {
    b0: (A * (A + 1 + (A - 1) * cos + twoSqrtAAlpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - twoSqrtAAlpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - twoSqrtAAlpha) / a0
  }
}

function highPass(fs: number, f0: number, q: number): Biquad {
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const a0 = 1 + alpha
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0
  }
}

function applyBiquad(samples: Float64Array, bq: Biquad): void {
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i]
    const y0 = bq.b0 * x0 + bq.b1 * x1 + bq.b2 * x2 - bq.a1 * y1 - bq.a2 * y2
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    samples[i] = y0
  }
}

/**
 * K-weighted loudness in LUFS over the whole buffer (gating-free — fine for the
 * ~60s analysis window). Standard BS.1770 pre-filter + RLB weighting.
 */
export function kWeightedLufs(samples: Float32Array, sampleRate = ANALYSIS_SAMPLE_RATE): number {
  if (samples.length === 0) return -Infinity
  const buf = Float64Array.from(samples)
  applyBiquad(buf, highShelf(sampleRate, 1681.974450955533, 3.999843853973347, 0.7071752369554196))
  applyBiquad(buf, highPass(sampleRate, 38.13547087602444, 0.5003270373238773))

  let sumSquares = 0
  for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i]
  const meanSquare = sumSquares / buf.length
  if (meanSquare <= 0) return -Infinity
  return -0.691 + 10 * Math.log10(meanSquare)
}

// ───────── scoring ─────────

/** Raw, un-normalised spectral features for a track. */
export interface EnergyFeatures {
  rmsDbfs: number
  centroidHz: number
  lufs: number
}

/** Each feature mapped onto 0..1 via its calibrated range. */
export interface EnergyComponents {
  rms: number
  brightness: number
  loudness: number
}

export interface EnergyScore {
  /** Weighted blend in 0..1. */
  raw: number
  /** Final DJ-facing score, integer 1..10. */
  score: number
  components: EnergyComponents
}

export function normaliseFeatures(f: EnergyFeatures): EnergyComponents {
  return {
    rms: clamp01((f.rmsDbfs - RMS_DB_MIN) / (RMS_DB_MAX - RMS_DB_MIN)),
    brightness: clamp01((f.centroidHz - CENTROID_MIN_HZ) / (CENTROID_MAX_HZ - CENTROID_MIN_HZ)),
    loudness: clamp01((f.lufs - LUFS_MIN) / (LUFS_MAX - LUFS_MIN))
  }
}

/**
 * Blend normalised features into the final 1–10 energy score using the
 * DJ-calibrated 40/30/30 weighting. This is the single source of truth for the
 * weighting math (and what the weighting tests assert against).
 */
export function scoreFromComponents(c: EnergyComponents): EnergyScore {
  const raw = W_RMS * c.rms + W_BRIGHTNESS * c.brightness + W_LOUDNESS * c.loudness
  const score = Math.max(1, Math.min(10, 1 + Math.round(raw * 9)))
  return { raw, score, components: c }
}

export function spectralEnergyScore(f: EnergyFeatures): EnergyScore {
  return scoreFromComponents(normaliseFeatures(f))
}

/**
 * Full pipeline: extract all three features from a PCM buffer and score them.
 * `samples` must already be mono at `sampleRate`.
 */
export function analyseSamples(
  samples: Float32Array,
  sampleRate = ANALYSIS_SAMPLE_RATE
): EnergyScore & { features: EnergyFeatures } {
  const features: EnergyFeatures = {
    rmsDbfs: frameRmsDbfs(samples),
    centroidHz: spectralCentroidHz(samples, sampleRate),
    lufs: kWeightedLufs(samples, sampleRate)
  }
  return { ...spectralEnergyScore(features), features }
}
