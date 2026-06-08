/**
 * reactionPipeline.ts — turns a saved set recording into per-track crowd-reaction
 * rows (Black Box, Phase 3). EXPERIMENTAL + gated behind reactionCaptureEnabled;
 * the DSP it composes ([[crowdIsolation]]) is validated only on synthetic signals,
 * so until a real-booth validation pass it must never present a confident "what
 * landed" claim — every row carries an honest `source` and `confidence`.
 *
 * The room-mic-only unlock: NLMS echo-cancellation needs the clean music as a
 * REFERENCE, which a room mic doesn't give us. But the live fingerprinter recorded
 * each track's id and the offset it was identified at (`match_offset_sec`), so we
 * RECONSTRUCT the reference by decoding the library track at that offset and
 * aligning it to the recorded room segment. When that fails (missing file, bad
 * alignment), analyzeReaction falls back to the room-energy envelope (low confidence).
 */
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import type Database from 'better-sqlite3'
import { analyzeReaction } from './crowdIsolation'
import { getRecordingForSession, getSessionTracks, upsertReaction } from '../../db/queries'

const FFMPEG: string | null = (ffmpegPath as unknown as string | null) ?? null

/** Analysis sample rate — low enough to keep the (one-shot, background) NLMS cheap. */
const ANALYSIS_RATE = 16_000
/** Cap per-track analysis to bound CPU on marathon tracks. */
const MAX_WINDOW_SEC = 420
/** Decode the reference with this much padding each side to search for alignment. */
const ALIGN_PAD_SEC = 5
/** RMS-envelope window used for cross-correlation alignment. */
const ENV_WIN_SEC = 0.05
/** Longer FIR than the default to model more room delay (still a spike). */
const NLMS_FILTER_LENGTH = 256

/** Per-window RMS envelope of a signal — the cheap feature we align on. */
function rmsEnvelope(sig: Float64Array, win: number): Float64Array {
  const n = Math.ceil(sig.length / win)
  const env = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const from = i * win
    const to = Math.min(sig.length, from + win)
    let s = 0
    for (let j = from; j < to; j++) s += sig[j] * sig[j]
    env[i] = Math.sqrt(s / Math.max(1, to - from))
  }
  return env
}

/** Normalised cross-correlation of `a` against `b[off..off+a.length]` at one offset. */
function corrAt(a: Float64Array, b: Float64Array, off: number): number {
  const n = a.length
  let ma = 0
  let mb = 0
  for (let i = 0; i < n; i++) {
    ma += a[i]
    mb += b[off + i]
  }
  ma /= n
  mb /= n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma
    const xb = b[off + i] - mb
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den < 1e-12 ? 0 : num / den
}

/**
 * Find the sample lag within `reference` (which is decoded with padding) that best
 * aligns it to `observed`, by cross-correlating their RMS envelopes. Returns the
 * offset in samples to trim from the front of `reference`. Pure + unit-tested.
 */
export function bestLagSamples(
  observed: Float64Array,
  reference: Float64Array,
  sampleRate: number,
  envWinSec = ENV_WIN_SEC
): number {
  const win = Math.max(1, Math.round(envWinSec * sampleRate))
  const eo = rmsEnvelope(observed, win)
  const er = rmsEnvelope(reference, win)
  const maxLag = er.length - eo.length
  if (maxLag <= 0) return 0
  let bestLag = 0
  let bestScore = -Infinity
  for (let lag = 0; lag <= maxLag; lag++) {
    const c = corrAt(eo, er, lag)
    if (c > bestScore) {
      bestScore = c
      bestLag = lag
    }
  }
  return bestLag * win
}

/** Decode mono f32 PCM from `filePath`, optionally seeking + bounded by duration. */
function decodePcm(
  filePath: string,
  startSec: number,
  durationSec: number,
  rate: number
): Promise<Float64Array | null> {
  return new Promise((resolve) => {
    if (!FFMPEG || durationSec <= 0) return resolve(null)
    const args = ['-nostats', '-hide_banner']
    if (startSec > 0) args.push('-ss', String(startSec))
    args.push(
      '-t',
      String(durationSec),
      '-i',
      filePath,
      '-ac',
      '1',
      '-ar',
      String(rate),
      '-f',
      'f32le',
      '-'
    )
    const chunks: Buffer[] = []
    let settled = false
    const done = (r: Float64Array | null): void => {
      if (settled) return
      settled = true
      resolve(r)
    }
    try {
      const child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'ignore'] })
      child.stdout.on('data', (c: Buffer) => chunks.push(c))
      child.on('error', () => done(null))
      child.on('close', () => {
        if (!chunks.length) return done(null)
        const buf = Buffer.concat(chunks)
        const usable = buf.length - (buf.length % 4)
        const f32 = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable))
        done(Float64Array.from(f32))
      })
    } catch {
      done(null)
    }
  })
}

/** Sample offsets of windows whose crowd presence dipped well below the mean. */
function dipOffsetsMs(
  perWindow: { startSample: number; crowdPresence: number }[],
  rate: number
): number[] {
  if (perWindow.length === 0) return []
  const ps = perWindow.map((w) => w.crowdPresence)
  const mean = ps.reduce((a, b) => a + b, 0) / ps.length
  const std = Math.sqrt(ps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ps.length)
  return perWindow
    .filter((w) => w.crowdPresence < mean - std)
    .map((w) => Math.round((w.startSample / rate) * 1000))
}

/**
 * Analyse every track of a saved set and write its crowd reaction. Runs as a
 * background job after a set is saved; never throws (per-track failures are
 * skipped). Scores are normalised against the loudest moment of the night, so
 * reaction_score is "where it landed relative to the rest of this set".
 */
export async function analyzeSessionReactions(
  db: Database.Database,
  sessionId: string
): Promise<void> {
  const recording = getRecordingForSession(db, sessionId)
  if (!recording) return
  const tracks = getSessionTracks(db, sessionId)

  interface Raw {
    trackId: string
    score: number
    confidence: number
    method: 'blackbox' | 'derived'
    peakMs: number[]
    dipMs: number[]
  }
  const raws: Raw[] = []

  for (const st of tracks) {
    if (st.startMs == null || st.endMs == null || st.endMs <= st.startMs) continue
    const startSec = st.startMs / 1000
    const durationSec = Math.min(MAX_WINDOW_SEC, (st.endMs - st.startMs) / 1000)
    try {
      const observed = await decodePcm(
        recording.audioFilePath,
        startSec,
        durationSec,
        ANALYSIS_RATE
      )
      if (!observed || observed.length < ANALYSIS_RATE) continue

      // Reconstruct the reference from the library track at its identified offset,
      // padded so the alignment search has room. Falls back to silence (→ derived).
      let reference: Float64Array
      const refOffset = Math.max(0, (st.matchOffsetSec ?? 0) - ALIGN_PAD_SEC)
      const refDuration = durationSec + 2 * ALIGN_PAD_SEC
      const decodedRef =
        st.track.missingFile || !st.track.filePath
          ? null
          : await decodePcm(st.track.filePath, refOffset, refDuration, ANALYSIS_RATE)

      if (decodedRef && decodedRef.length > observed.length) {
        const lag = bestLagSamples(observed, decodedRef, ANALYSIS_RATE)
        reference = decodedRef.subarray(lag, lag + observed.length)
      } else {
        reference = new Float64Array(observed.length) // silence → analyzeReaction → derived
      }

      const result = analyzeReaction(reference, observed, ANALYSIS_RATE, {
        filterLength: NLMS_FILTER_LENGTH
      })
      raws.push({
        trackId: st.trackId,
        score: result.score,
        confidence: result.confidence,
        method: result.method,
        peakMs: result.peaks.map((s) => Math.round((s / ANALYSIS_RATE) * 1000)),
        dipMs: dipOffsetsMs(result.perWindow, ANALYSIS_RATE)
      })
    } catch {
      // skip a track that won't decode/analyse; never abort the whole set
    }
  }

  // Normalise reaction_score against the loudest moment of the night.
  const maxScore = raws.reduce((m, r) => Math.max(m, r.score), 0)
  for (const r of raws) {
    upsertReaction(db, {
      sessionId,
      trackId: r.trackId,
      reactionScore: maxScore > 0 ? r.score / maxScore : r.score,
      confidence: r.confidence,
      peakMs: r.peakMs,
      dipMs: r.dipMs,
      source: r.method
    })
  }
}
