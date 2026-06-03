/**
 * Closed-set audio fingerprinting for SetSense Live.
 *
 * The job is NOT open-world song recognition (Shazam). It is the much easier,
 * tractable problem: "which of the user's OWN ~N pre-analysed tracks is coming
 * out of the master right now?" That constraint is what makes this feasible
 * offline, on a stage laptop, with high accuracy.
 *
 * Approach: a constellation/landmark fingerprint (the Wang/Shazam method).
 *   1. Spectrogram   — Hann-windowed magnitude STFT (reuses {@link fftInPlace}).
 *   2. Peaks         — robust local maxima per frame → a sparse "constellation".
 *   3. Landmarks     — pair each anchor peak with peaks in a forward target
 *                      zone; pack (f1, f2, Δt) into one integer hash.
 *   4. Index         — hash → list of (trackId, anchorFrame) across the library.
 *   5. Match         — for a live probe, vote by time-offset histogram per
 *                      track. The track whose votes align at a single offset
 *                      wins; alignment strength is the confidence.
 *
 * Why this method: landmarks are pairs of *relative* peaks, so the fingerprint
 * is invariant to where in the track you start listening (you hear mid-track),
 * and the offset-histogram vote is robust to booth EQ, level changes, codec
 * artefacts, and moderate noise — anything that doesn't move the strongest
 * spectral peaks. Its known weakness is large pitch/tempo shift (the DJ's pitch
 * fader), which moves peaks; that's quantified separately and is the main open
 * question this spike exists to answer.
 *
 * Pure DSP — no fs, no ffmpeg, no Electron — so it unit-tests in isolation
 * exactly like {@link ../energy/spectralFeatures}. The ffmpeg decode + DB index
 * wiring live in the caller (and in scripts/fingerprint-spike.mjs).
 */

import { fftInPlace, hannWindow } from '../energy/spectralFeatures'

// ───────── tunables ─────────

/** Sample rate fingerprints are computed at. Matches the energy analyser. */
export const FP_SAMPLE_RATE = 22_050

/** STFT window / hop (samples). 2048 @ 22.05k → ~10.8 Hz/bin, ~21.5 frames/s. */
export const FP_FRAME_SIZE = 2048
export const FP_HOP_SIZE = 1024

/** Frames per second of the spectrogram — handy for converting offsets to time. */
export const FP_FRAMES_PER_SEC = FP_SAMPLE_RATE / FP_HOP_SIZE

/**
 * Only consider peaks below this FFT bin. Bin k ≈ k * (FP_SAMPLE_RATE/FP_FRAME_SIZE)
 * Hz. 512 → ~5.5 kHz, where the discriminating energy of club music lives, and
 * it keeps f1/f2 inside 9 bits for compact hashes.
 */
export const FP_MAX_BIN = 512

/** Lowest bin considered — drops DC / sub-rumble that booth systems distort. */
export const FP_MIN_BIN = 4

/** Strongest peaks kept per frame. Higher = denser constellation, more robust,
 *  more index memory. 5 is a good robustness/size trade for a closed set. */
export const FP_PEAKS_PER_FRAME = 5

/** A bin must reach this fraction of the frame's max magnitude to be a peak. */
export const FP_PEAK_REL_FLOOR = 0.15

/** Landmark target zone: how many frames ahead of an anchor to pair with. */
export const FP_TARGET_DT_MIN = 1
export const FP_TARGET_DT_MAX = 31

/** Max target peaks paired per anchor (fan-out). */
export const FP_FANOUT = 5

/*
 * On pitch/tempo: the fingerprint keys off absolute spectral peaks, so it is
 * naturally robust to TEMPO change with KEY-LOCK on (master tempo) — pitch is
 * preserved, only landmark timing drifts slightly, which the offset histogram
 * tolerates (measured: ±6% tempo still recovers at ~0.7 confidence). The hard
 * case is key-lock OFF (pitch + tempo together), which moves every peak; that
 * is left to fail loud (low confidence → "listening…") rather than guessed at,
 * and is the domain where a Pro DJ Link provider — exact track id, no audio —
 * is the better long-term answer. Peak-space shifting was tried and does NOT
 * recover a real resample (peak SELECTION is nonlinear), so it isn't shipped.
 */

/**
 * At QUERY time, ignore any hash whose bucket exceeds this many entries. Such a
 * hash is shared so widely it carries no discriminating signal, and skipping it
 * bounds per-query work to O(probeLandmarks × limit) — flat in library size.
 *
 * Critically this is a *query*-time skip, not a *build*-time cap: every track
 * stays fully represented in the index (dropping entries during indexing
 * starves whichever tracks were added after a bucket filled). This is the
 * standard Wang/Shazam treatment of over-common landmarks.
 *
 * Set as a safety valve, not a tight latency bound — too low (e.g. 100) starves
 * legitimate matches and collapses the confidence margin. Bounding query
 * latency at large library sizes is a separate task (candidate prefilter /
 * inverted-index), tracked as remaining input-layer engineering.
 */
export const FP_QUERY_BUCKET_LIMIT = 1000

// ───────── types ─────────

/** A spectral peak: frame index in time, FFT bin in frequency. */
export interface Peak {
  t: number
  f: number
}

/** A landmark: packed (f1,f2,Δt) hash + the anchor frame it occurred at. */
export interface Landmark {
  hash: number
  t: number
}

/** hash → every (trackId, anchorFrame) it occurs at across the library. */
export type FingerprintIndex = Map<number, Array<{ id: string; t: number }>>

export interface MatchResult {
  /** Best-matching track id. */
  id: string
  /** Aligned-landmark votes at the winning time offset (raw strength). */
  score: number
  /**
   * Confidence in 0..1: how dominant the winner is vs. the field. Combines
   * vote count against the probe's landmark count with the margin over the
   * runner-up. Below {@link FP_MIN_CONFIDENCE} the caller should show
   * "listening…", never a guess — fail loud, not wrong.
   */
  confidence: number
  /** Seconds into the matched track that the probe's first frame aligns to. */
  offsetSec: number
}

/** Floor below which a match is untrustworthy and must not be surfaced. */
export const FP_MIN_CONFIDENCE = 0.25

// ───────── spectrogram ─────────

/**
 * Magnitude STFT. Returns one Float64Array per frame holding bins
 * [0, FP_MAX_BIN). Hann-windowed, hop-spaced — same framing as the energy path.
 */
export function spectrogram(
  samples: Float32Array,
  frameSize = FP_FRAME_SIZE,
  hop = FP_HOP_SIZE
): Float64Array[] {
  const win = hannWindow(frameSize)
  const re = new Float64Array(frameSize)
  const im = new Float64Array(frameSize)
  const frames: Float64Array[] = []
  const end = Math.max(1, samples.length - frameSize + 1)

  for (let start = 0; start < end; start += hop) {
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < frameSize; i++) re[i] = samples[start + i] * win[i]
    fftInPlace(re, im)
    const mags = new Float64Array(FP_MAX_BIN)
    for (let k = 0; k < FP_MAX_BIN; k++) mags[k] = Math.hypot(re[k], im[k])
    frames.push(mags)
  }
  return frames
}

// ───────── peak picking ─────────

/**
 * Extract a sparse constellation: per frame, the strongest local maxima above
 * a relative floor, capped at {@link FP_PEAKS_PER_FRAME}. Local maxima (rather
 * than raw top-N bins) avoids clustering all peaks on one loud harmonic.
 */
export function extractPeaks(frames: Float64Array[]): Peak[] {
  const peaks: Peak[] = []

  for (let t = 0; t < frames.length; t++) {
    const mags = frames[t]
    let frameMax = 0
    for (let k = FP_MIN_BIN; k < FP_MAX_BIN; k++) if (mags[k] > frameMax) frameMax = mags[k]
    if (frameMax <= 0) continue
    const floor = frameMax * FP_PEAK_REL_FLOOR

    // Collect local maxima above the floor.
    const cands: Array<{ f: number; m: number }> = []
    for (let k = FP_MIN_BIN + 1; k < FP_MAX_BIN - 1; k++) {
      const m = mags[k]
      if (m >= floor && m > mags[k - 1] && m >= mags[k + 1]) cands.push({ f: k, m })
    }
    // Keep the strongest few.
    cands.sort((a, b) => b.m - a.m)
    const keep = Math.min(FP_PEAKS_PER_FRAME, cands.length)
    for (let i = 0; i < keep; i++) peaks.push({ t, f: cands[i].f })
  }
  return peaks
}

// ───────── landmark hashing ─────────

/** Pack (f1, f2, Δt) into one integer. f1/f2 < 512 (9 bits), Δt < 512. */
function packHash(f1: number, f2: number, dt: number): number {
  return (f1 << 18) | (f2 << 9) | dt
}

/**
 * Build landmarks by pairing each anchor peak with up to {@link FP_FANOUT}
 * peaks in its forward target zone. Peaks must be time-sorted (extractPeaks
 * returns them frame-ordered).
 */
export function landmarks(peaks: Peak[]): Landmark[] {
  const out: Landmark[] = []
  for (let i = 0; i < peaks.length; i++) {
    const a = peaks[i]
    let paired = 0
    for (let j = i + 1; j < peaks.length && paired < FP_FANOUT; j++) {
      const b = peaks[j]
      const dt = b.t - a.t
      if (dt < FP_TARGET_DT_MIN) continue
      if (dt > FP_TARGET_DT_MAX) break // peaks are time-sorted → no later peak qualifies
      out.push({ hash: packHash(a.f, b.f, dt), t: a.t })
      paired++
    }
  }
  return out
}

/** Full pipeline: PCM samples → landmarks. */
export function fingerprint(samples: Float32Array): Landmark[] {
  return landmarks(extractPeaks(spectrogram(samples)))
}

// ───────── index ─────────

/**
 * Add one track's landmarks to a shared index. Every entry is kept — bucket
 * growth is handled at query time (see {@link FP_QUERY_BUCKET_LIMIT}), never by
 * dropping during build (which would starve later-indexed tracks).
 */
export function addToIndex(index: FingerprintIndex, id: string, lms: Landmark[]): void {
  for (const lm of lms) {
    let bucket = index.get(lm.hash)
    if (!bucket) {
      bucket = []
      index.set(lm.hash, bucket)
    }
    bucket.push({ id, t: lm.t })
  }
}

/** Build a clean (rate-1.0) index from a map of trackId → PCM samples. */
export function buildIndex(tracks: Map<string, Float32Array>): FingerprintIndex {
  const index: FingerprintIndex = new Map()
  for (const [id, samples] of tracks) addToIndex(index, id, fingerprint(samples))
  return index
}

// ───────── matching ─────────

/**
 * Identify a probe (a few seconds of live audio) against the index.
 *
 * For every probe landmark that hits the index, vote for (trackId, offset)
 * where offset = dbAnchorFrame − probeAnchorFrame. A genuine match piles votes
 * onto a single offset (the alignment of probe-within-track); coincidental hash
 * collisions scatter across offsets. The tallest single-offset bin per track is
 * its score. Returns the ranked top matches.
 */
export function match(
  probe: Landmark[],
  index: FingerprintIndex,
  topN = 3,
  bucketLimit = FP_QUERY_BUCKET_LIMIT
): MatchResult[] {
  // trackId → (offset → vote count)
  const votes = new Map<string, Map<number, number>>()

  for (const lm of probe) {
    const bucket = index.get(lm.hash)
    if (!bucket) continue
    if (bucket.length > bucketLimit) continue // non-discriminative — skip
    for (const entry of bucket) {
      const offset = entry.t - lm.t
      let perTrack = votes.get(entry.id)
      if (!perTrack) {
        perTrack = new Map()
        votes.set(entry.id, perTrack)
      }
      perTrack.set(offset, (perTrack.get(offset) ?? 0) + 1)
    }
  }

  // Best single-offset peak per track.
  const scored: Array<{ id: string; score: number; offset: number }> = []
  for (const [id, perTrack] of votes) {
    let best = 0
    let bestOffset = 0
    for (const [offset, count] of perTrack) {
      if (count > best) {
        best = count
        bestOffset = offset
      }
    }
    scored.push({ id, score: best, offset: bestOffset })
  }
  scored.sort((a, b) => b.score - a.score)

  const probeCount = Math.max(1, probe.length)
  const top = scored.slice(0, topN)
  const runnerUp = scored[1]?.score ?? 0

  return top.map((s, i) => {
    // Confidence: aligned votes as a fraction of probe landmarks, lifted by the
    // margin over the runner-up. Only the #1 result gets the margin bonus.
    const align = s.score / probeCount
    const margin = i === 0 && s.score > 0 ? 1 - runnerUp / s.score : 0
    const confidence = Math.max(0, Math.min(1, align * (1 + margin)))
    return {
      id: s.id,
      score: s.score,
      confidence: i === 0 ? confidence : Math.max(0, Math.min(1, align)),
      offsetSec: s.offset / FP_FRAMES_PER_SEC
    }
  })
}

/** Convenience: fingerprint a probe buffer and match it in one call. */
export function identify(
  probeSamples: Float32Array,
  index: FingerprintIndex,
  topN = 3,
  bucketLimit = FP_QUERY_BUCKET_LIMIT
): MatchResult[] {
  return match(fingerprint(probeSamples), index, topN, bucketLimit)
}
