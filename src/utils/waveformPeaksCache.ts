/**
 * Shared decoded-peaks cache for inline waveforms.
 *
 * Decoding a track is expensive, so we do it once per file path and reuse the
 * downsampled peak envelope across every inline waveform that shows that track.
 * Peaks are a fixed-length min/max envelope (a true DJ waveform reads better
 * with top/bottom peaks than a single rectified amplitude).
 *
 * - In-memory LRU, capped so memory stays bounded.
 * - Concurrent requests for the same path share one decode (in-flight de-dupe),
 *   which also neutralises React StrictMode's double-mount.
 * - Failures are negative-cached so we never retry-decode a bad file every frame.
 * - One reused AudioContext (Chromium caps the number of live contexts).
 */

export interface WaveformPeaks {
  /** Per-bucket minimum sample value, range [-1, 0]. */
  min: Float32Array
  /** Per-bucket maximum sample value, range [0, 1]. */
  max: Float32Array
  /** Per-bucket low-band (bass) energy, normalised 0..1 across the track. */
  low: Float32Array
  /** Per-bucket mid-band energy, normalised 0..1. */
  mid: Float32Array
  /** Per-bucket high-band (treble) energy, normalised 0..1. */
  high: Float32Array
  /** Bucket count (== min.length == max.length). */
  buckets: number
  /** Decoded duration in seconds. */
  durationSec: number
}

export type PeaksState =
  | { status: 'loading' }
  | { status: 'ready'; peaks: WaveformPeaks }
  | { status: 'error' }
  | { status: 'missing' }

// Bucket count = waveform resolution. User-tunable via Settings → Playback
// (low/standard/high). Mutated through setWaveformQuality, which also drops the
// cache so existing envelopes re-decode at the new resolution.
let BUCKETS = 1600
const MAX_ENTRIES = 24

const cache = new Map<string, WaveformPeaks>()
const negativeCache = new Map<string, 'error' | 'missing'>()
const inflight = new Map<string, Promise<PeaksState>>()

/** Apply the persisted waveform-quality preference (boot + after Settings save). */
export function setWaveformQuality(q: 'low' | 'standard' | 'high'): void {
  const next = q === 'low' ? 800 : q === 'high' ? 3200 : 1600
  if (next === BUCKETS) return
  BUCKETS = next
  cache.clear()
  negativeCache.clear()
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx
  if (typeof AudioContext === 'undefined') return null
  audioCtx = new AudioContext()
  return audioCtx
}

/** Returns cached peaks synchronously if present (and marks them most-recently-used). */
export function getCachedPeaks(filePath: string): WaveformPeaks | undefined {
  const hit = cache.get(filePath)
  if (hit) {
    // Re-insert to mark MRU (Map preserves insertion order).
    cache.delete(filePath)
    cache.set(filePath, hit)
  }
  return hit
}

/**
 * Resolve peaks for a file, decoding + caching on first call. Never throws —
 * resolves to a typed state. Concurrent calls for the same path share the
 * in-flight promise.
 */
export function loadPeaks(filePath: string): Promise<PeaksState> {
  const cached = getCachedPeaks(filePath)
  if (cached) return Promise.resolve({ status: 'ready', peaks: cached })

  const negative = negativeCache.get(filePath)
  if (negative) return Promise.resolve({ status: negative })

  const existing = inflight.get(filePath)
  if (existing) return existing

  const promise = decodeAndCache(filePath)
  inflight.set(filePath, promise)
  return promise
}

/** Test/teardown hook — clears every cache. */
export function clearPeaksCache(): void {
  cache.clear()
  negativeCache.clear()
  inflight.clear()
}

async function decodeAndCache(filePath: string): Promise<PeaksState> {
  try {
    // Renderer-only preview (no Electron bridge) — degrade gracefully.
    if (!window.setrecord?.readAudioFile) {
      negativeCache.set(filePath, 'missing')
      return { status: 'missing' }
    }

    const buf = await window.setrecord.readAudioFile(filePath)
    if (!buf) {
      negativeCache.set(filePath, 'missing')
      return { status: 'missing' }
    }

    const ctx = getAudioContext()
    if (!ctx) {
      negativeCache.set(filePath, 'error')
      return { status: 'error' }
    }

    // decodeAudioData detaches the ArrayBuffer; slice so the original stays intact.
    const audioBuffer = await ctx.decodeAudioData(buf.slice(0))
    const peaks = computePeaks(audioBuffer, BUCKETS)
    insert(filePath, peaks)
    return { status: 'ready', peaks }
  } catch (err) {
    console.error('[waveformPeaksCache] decode failed', filePath, err)
    negativeCache.set(filePath, 'error')
    return { status: 'error' }
  } finally {
    inflight.delete(filePath)
  }
}

function computePeaks(audioBuffer: AudioBuffer, buckets: number): WaveformPeaks {
  const channel = audioBuffer.getChannelData(0)
  const length = channel.length
  const sampleRate = audioBuffer.sampleRate || 44100
  const min = new Float32Array(buckets)
  const max = new Float32Array(buckets)
  const low = new Float32Array(buckets)
  const mid = new Float32Array(buckets)
  const high = new Float32Array(buckets)
  const samplesPerBucket = Math.max(1, Math.floor(length / buckets))

  // One-pole low-pass coefficients for a cheap 3-band split (bass / mid / treble).
  const a = (fc: number): number => 1 - Math.exp((-2 * Math.PI * fc) / sampleRate)
  const aLow = a(200)
  const aMid = a(2000)
  let lp200 = 0
  let lp2000 = 0

  // Accumulate per-bucket band energy (sum of squares) in a single pass.
  const sumLow = new Float64Array(buckets)
  const sumMid = new Float64Array(buckets)
  const sumHigh = new Float64Array(buckets)
  const counts = new Float64Array(buckets)

  for (let b = 0; b < buckets; b++) {
    const start = Math.min(b * samplesPerBucket, length)
    const end = b === buckets - 1 ? length : Math.min(start + samplesPerBucket, length)
    let lo = 0
    let hi = 0
    for (let i = start; i < end; i++) {
      const x = channel[i]
      if (x < lo) lo = x
      if (x > hi) hi = x
      lp200 += aLow * (x - lp200)
      lp2000 += aMid * (x - lp2000)
      const lowV = lp200
      const midV = lp2000 - lp200
      const highV = x - lp2000
      sumLow[b] += lowV * lowV
      sumMid[b] += midV * midV
      sumHigh[b] += highV * highV
    }
    counts[b] = Math.max(1, end - start)
    min[b] = lo
    max[b] = hi
  }

  // RMS per band, then normalise EACH band by its own max so the spectral
  // balance (hue) varies across the track instead of bass swamping everything.
  let maxLow = 1e-6
  let maxMid = 1e-6
  let maxHigh = 1e-6
  for (let b = 0; b < buckets; b++) {
    const rl = Math.sqrt(sumLow[b] / counts[b])
    const rm = Math.sqrt(sumMid[b] / counts[b])
    const rh = Math.sqrt(sumHigh[b] / counts[b])
    low[b] = rl
    mid[b] = rm
    high[b] = rh
    if (rl > maxLow) maxLow = rl
    if (rm > maxMid) maxMid = rm
    if (rh > maxHigh) maxHigh = rh
  }
  for (let b = 0; b < buckets; b++) {
    low[b] = Math.min(1, low[b] / maxLow)
    mid[b] = Math.min(1, mid[b] / maxMid)
    high[b] = Math.min(1, high[b] / maxHigh)
  }

  return { min, max, low, mid, high, buckets, durationSec: audioBuffer.duration }
}

function insert(filePath: string, peaks: WaveformPeaks): void {
  cache.set(filePath, peaks)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}
