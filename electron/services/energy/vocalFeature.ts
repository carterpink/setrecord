/**
 * Vocal-presence proxy.
 *
 * Honest heuristic — NOT source separation. Vocals concentrate energy in the
 * mid band (~200 Hz–3.4 kHz, the speech/formant range) AND modulate that band
 * rapidly (consonants, vibrato, phrasing) far more than sustained pads or
 * basslines do. We combine two cheap, framed measures:
 *
 *   1. Mid-band energy ratio  — how much of the spectrum sits in the vocal band.
 *   2. Mid-band spectral flux — how much that band changes frame-to-frame.
 *
 * The blend lands in 0..1. The tagger buckets it into Instrumental / Vocal
 * touches / Vocal-led — three coarse levels, never a precise figure — so the
 * proxy never has to be more accurate than "rough but useful".
 *
 * Pure DSP — operates on a mono Float32Array so it can be unit-tested against
 * synthetic signals. Reuses the FFT primitives from spectralFeatures.ts.
 */

import {
  fftInPlace,
  hannWindow,
  clamp01,
  FRAME_SIZE,
  HOP_SIZE,
  ANALYSIS_SAMPLE_RATE
} from './spectralFeatures'

// ───────── tunables ─────────

/** Vocal / speech formant band, in Hz. */
export const VOCAL_BAND_LOW_HZ = 200
export const VOCAL_BAND_HIGH_HZ = 3400

// Normalisation ranges, calibrated so instrumental beds read low and vocal-led
// tracks read high. Deliberately gentle — the output is bucketed into 3 levels.
export const MID_RATIO_MIN = 0.3
export const MID_RATIO_MAX = 0.72
export const FLUX_MIN = 0.015
export const FLUX_MAX = 0.12

/** Ratio vs flux blend. Flux is the better vocal discriminator, so it leads. */
export const W_MID_RATIO = 0.4
export const W_FLUX = 0.6

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/**
 * Compute the vocal-presence proxy in 0..1 for a mono PCM buffer. Returns 0 for
 * empty/silent input.
 */
export function vocalPresence(
  samples: Float32Array,
  sampleRate = ANALYSIS_SAMPLE_RATE,
  frameSize = FRAME_SIZE,
  hop = HOP_SIZE
): number {
  if (samples.length < frameSize) return 0

  const n = nextPow2(frameSize)
  const win = hannWindow(frameSize)
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const binHz = sampleRate / n

  const loBin = Math.max(1, Math.floor(VOCAL_BAND_LOW_HZ / binHz))
  const hiBin = Math.min(n >> 1, Math.ceil(VOCAL_BAND_HIGH_HZ / binHz))

  let ratioSum = 0
  let fluxSum = 0
  let frames = 0
  let prevMid: Float64Array | null = null
  let prevMidNorm = 0

  const end = Math.max(1, samples.length - frameSize + 1)
  for (let start = 0; start < end; start += hop) {
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < frameSize && start + i < samples.length; i++) {
      re[i] = samples[start + i] * win[i]
    }
    fftInPlace(re, im)

    // Per-bin magnitudes over the half-spectrum.
    let total = 0
    let mid = 0
    const midMags = new Float64Array(hiBin - loBin)
    let midNorm = 0
    for (let k = 1; k < n >> 1; k++) {
      const mag = Math.hypot(re[k], im[k])
      total += mag
      if (k >= loBin && k < hiBin) {
        mid += mag
        const idx = k - loBin
        midMags[idx] = mag
        midNorm += mag * mag
      }
    }
    if (total <= 0) continue

    ratioSum += mid / total

    // Spectral flux: L2 distance between consecutive L2-normalised mid spectra.
    // Normalising removes loudness so flux reflects spectral *change*, not level.
    midNorm = Math.sqrt(midNorm)
    if (prevMid && midNorm > 0 && prevMidNorm > 0) {
      let diff = 0
      for (let i = 0; i < midMags.length; i++) {
        const a = midMags[i] / midNorm
        const b = prevMid[i] / prevMidNorm
        const d = a - b
        if (d > 0) diff += d * d // half-wave rectified: onsets only
      }
      fluxSum += Math.sqrt(diff)
    }
    prevMid = midMags
    prevMidNorm = midNorm
    frames++
  }

  if (frames === 0) return 0

  const midRatio = ratioSum / frames
  const flux = fluxSum / frames

  const ratioTerm = clamp01((midRatio - MID_RATIO_MIN) / (MID_RATIO_MAX - MID_RATIO_MIN))
  const fluxTerm = clamp01((flux - FLUX_MIN) / (FLUX_MAX - FLUX_MIN))

  return clamp01(W_MID_RATIO * ratioTerm + W_FLUX * fluxTerm)
}
