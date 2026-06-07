/**
 * crowdIsolation.ts — Black Box DSP spike (Frontier 1A keystone).
 *
 * The bet: SetSense already captures the master-out as a KNOWN reference signal,
 * so measuring crowd reaction from a room mic is not blind source separation —
 * it's acoustic echo cancellation. Adaptively filter the known music out of the
 * mic observation; the residual energy is the room (cheers, sing-along, dead air).
 *
 * This module is a de-risking spike, validated against synthetic signals (see
 * tests/crowdIsolation.test.ts). HONEST CAVEATS, to be tested on real booth
 * audio before this ships:
 *   • Assumes a roughly LINEAR, slowly-varying channel (PA + room). A real club
 *     adds long reverb tails and time-variation NLMS only partly tracks.
 *   • Crowd noise is partly CORRELATED with the music (cheers land on the drop),
 *     which the filter will wrongly cancel — so this UNDER-estimates reactions.
 *   • Therefore every result carries a `confidence`, and below a suppression
 *     threshold we fall back to a raw room-energy signal (`method: 'derived'`).
 *
 * Pure numeric DSP — no electron/DB deps, so it unit-tests cleanly.
 */

export type Signal = Float64Array | number[]

export interface NlmsOptions {
  /** FIR filter length (taps). Longer captures more room delay, costs CPU. */
  filterLength?: number
  /** Step size 0<mu<2. Higher = faster adaptation, more misadjustment. */
  mu?: number
  /** Regularisation to avoid divide-by-zero on silent passages. */
  eps?: number
}

export interface IsolateResult {
  /** The crowd estimate: mic observation with the known music cancelled out. */
  residual: Float64Array
  /** How much the music was suppressed, in dB (higher = cleaner isolation). */
  suppressionDb: number
}

const EPS = 1e-9

function rms(sig: Signal, from = 0, to = sig.length): number {
  let s = 0
  for (let i = from; i < to; i++) s += sig[i] * sig[i]
  const n = Math.max(1, to - from)
  return Math.sqrt(s / n)
}

/**
 * NLMS adaptive filter. Estimates the channel from `reference` (master-out) to
 * `observed` (mic), then returns the residual (observed − predicted music) plus
 * a suppression metric. residual[n] is the crowd estimate at sample n.
 */
export function isolateCrowd(
  reference: Signal,
  observed: Signal,
  opts: NlmsOptions = {}
): IsolateResult {
  const L = opts.filterLength ?? 64
  const mu = opts.mu ?? 0.5
  const eps = opts.eps ?? 1e-6
  const N = Math.min(reference.length, observed.length)
  const w = new Float64Array(L)
  const residual = new Float64Array(N)

  // Sliding power of the reference over the last L samples (NLMS normaliser).
  let power = 0
  for (let n = 0; n < N; n++) {
    power += reference[n] * reference[n]
    if (n >= L) power -= reference[n - L] * reference[n - L]

    const kMax = Math.min(L, n + 1)
    let yhat = 0
    for (let k = 0; k < kMax; k++) yhat += w[k] * reference[n - k]

    const e = observed[n] - yhat
    residual[n] = e

    const step = (mu * e) / (eps + power)
    for (let k = 0; k < kMax; k++) w[k] += step * reference[n - k]
  }

  // Suppression = ERLE (echo return loss enhancement) over the post-convergence
  // back half: how much total energy the filter actually removed. This is robust
  // to the case where the mic carried no music at all — then residual ≈ observed,
  // the ratio ≈ 1, and suppression ≈ 0 dB, correctly signalling "can't isolate".
  const from = Math.floor(N / 2)
  let obsE = 0
  let resE = 0
  for (let n = from; n < N; n++) {
    obsE += observed[n] * observed[n]
    resE += residual[n] * residual[n]
  }
  const suppressionDb = 10 * Math.log10((obsE + EPS) / (resE + EPS))
  return { residual, suppressionDb }
}

export interface ReactionWindow {
  /** Sample offset of the window start. */
  startSample: number
  /** Fraction (0..1) of the window's energy attributable to the crowd. */
  crowdPresence: number
}

export interface ReactionResult {
  /** Overall crowd-reaction score for the clip, 0..1. */
  score: number
  /** 0..1 trust in the score (derived from music suppression). */
  confidence: number
  /** Sample offsets of detected cheer/roar transients. */
  peaks: number[]
  perWindow: ReactionWindow[]
}

export interface ReactionOptions {
  /** Window length in seconds for the reaction envelope. Default 0.25s. */
  windowSec?: number
  /** Suppression (dB) at which confidence reaches ~1. Default 12dB. */
  fullConfidenceDb?: number
  /** Std-devs above mean presence to flag a peak. Default 1.5. */
  peakSigma?: number
}

/**
 * Turn a crowd residual into a reaction envelope: per-window crowd presence
 * (residual energy relative to total energy), an overall score, peak offsets,
 * and a confidence derived from how cleanly the music was suppressed.
 */
export function scoreReaction(
  residual: Signal,
  reference: Signal,
  sampleRate: number,
  suppressionDb: number,
  opts: ReactionOptions = {}
): ReactionResult {
  const win = Math.max(1, Math.round((opts.windowSec ?? 0.25) * sampleRate))
  const fullDb = opts.fullConfidenceDb ?? 12
  const sigma = opts.peakSigma ?? 1.5
  const N = Math.min(residual.length, reference.length)

  const perWindow: ReactionWindow[] = []
  for (let start = 0; start < N; start += win) {
    const end = Math.min(N, start + win)
    const crowd = rms(residual, start, end)
    const music = rms(reference, start, end)
    perWindow.push({ startSample: start, crowdPresence: crowd / (crowd + music + EPS) })
  }

  const presences = perWindow.map((w) => w.crowdPresence)
  const mean = presences.reduce((a, b) => a + b, 0) / Math.max(1, presences.length)
  const variance =
    presences.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, presences.length)
  const std = Math.sqrt(variance)

  const peaks = perWindow
    .filter((w) => w.crowdPresence > mean + sigma * std && w.crowdPresence > mean)
    .map((w) => w.startSample)

  const confidence = Math.max(0, Math.min(1, suppressionDb / fullDb))
  // Score: average crowd presence, gently emphasised by peak density.
  const peakBoost = Math.min(0.3, (peaks.length / Math.max(1, perWindow.length)) * 1.5)
  const score = Math.max(0, Math.min(1, mean + peakBoost))

  return { score, confidence, peaks, perWindow }
}

export interface AnalyzeResult extends ReactionResult {
  method: 'blackbox' | 'derived'
  suppressionDb: number
}

/**
 * Per-window room loudness from the mic alone — the graceful fallback when the
 * music can't be cleanly cancelled (enclosed booth, loud monitors). Returns a
 * normalised activity envelope (0..1) with no music model.
 */
export function roomEnergyDelta(observed: Signal, sampleRate: number, windowSec = 0.25): number[] {
  const win = Math.max(1, Math.round(windowSec * sampleRate))
  const env: number[] = []
  for (let start = 0; start < observed.length; start += win) {
    env.push(rms(observed, start, Math.min(observed.length, start + win)))
  }
  const max = Math.max(EPS, ...env)
  return env.map((e) => e / max)
}

/**
 * High-level entry: isolate, score, and choose the method. If the music can't be
 * suppressed by at least `minSuppressionDb`, fall back to the raw room-energy
 * envelope (low confidence) rather than reporting a bogus isolation.
 */
export function analyzeReaction(
  reference: Signal,
  observed: Signal,
  sampleRate: number,
  opts: NlmsOptions & ReactionOptions & { minSuppressionDb?: number } = {}
): AnalyzeResult {
  const minDb = opts.minSuppressionDb ?? 3
  const { residual, suppressionDb } = isolateCrowd(reference, observed, opts)

  if (suppressionDb < minDb) {
    const env = roomEnergyDelta(observed, sampleRate, opts.windowSec)
    const mean = env.reduce((a, b) => a + b, 0) / Math.max(1, env.length)
    const perWindow: ReactionWindow[] = env.map((v, i) => ({
      startSample: i * Math.round((opts.windowSec ?? 0.25) * sampleRate),
      crowdPresence: v
    }))
    return {
      method: 'derived',
      suppressionDb,
      score: Math.max(0, Math.min(1, mean)),
      confidence: 0.2,
      peaks: [],
      perWindow
    }
  }

  const reaction = scoreReaction(residual, reference, sampleRate, suppressionDb, opts)
  return { method: 'blackbox', suppressionDb, ...reaction }
}
