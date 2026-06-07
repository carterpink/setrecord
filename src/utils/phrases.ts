/**
 * Heuristic phrase/section detection from the decoded energy envelope.
 *
 * This is an approximation (energy + bass dynamics), NOT Rekordbox's ML phrase
 * analysis — it's meant as a glanceable structural overlay the user can toggle.
 * It segments the track into intro / build / drop / break / outro by tracking a
 * smoothed energy curve with hysteresis and labelling rising edges as builds.
 */
import type { WaveformPeaks } from '@/utils/waveformPeaksCache'

export type PhraseKind = 'intro' | 'build' | 'drop' | 'break' | 'outro'

export interface PhraseSegment {
  startMs: number
  endMs: number
  kind: PhraseKind
}

export function detectPhrases(peaks: WaveformPeaks): PhraseSegment[] {
  const n = peaks.buckets
  if (n < 8 || peaks.durationSec <= 0) return []
  const msPerBucket = (peaks.durationSec * 1000) / n

  // Perceptual energy per bucket: weight bass + overall amplitude.
  const energy = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const amp = (peaks.max[i] - peaks.min[i]) / 2 // 0..1
    energy[i] = Math.min(1, 0.55 * peaks.low[i] + 0.25 * peaks.mid[i] + 0.2 * amp)
  }

  // Smooth over ~3s to ignore beat-level fluctuation.
  const win = Math.max(2, Math.round(3000 / msPerBucket))
  const smooth = movingAverage(energy, win)

  // Hysteresis threshold around the median.
  const sorted = Array.from(smooth).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] || 0
  const peak = sorted[Math.floor(sorted.length * 0.92)] || 1
  const hi = median + (peak - median) * 0.45
  const lo = median + (peak - median) * 0.25

  const state = new Uint8Array(n) // 1 = high energy
  let cur = 0
  for (let i = 0; i < n; i++) {
    if (cur === 0 && smooth[i] > hi) cur = 1
    else if (cur === 1 && smooth[i] < lo) cur = 0
    state[i] = cur
  }

  // Contiguous runs → segments, merging anything shorter than ~6s.
  const minBuckets = Math.max(2, Math.round(6000 / msPerBucket))
  type Run = { start: number; end: number; high: boolean }
  const runs: Run[] = []
  let runStart = 0
  for (let i = 1; i <= n; i++) {
    if (i === n || state[i] !== state[runStart]) {
      runs.push({ start: runStart, end: i, high: state[runStart] === 1 })
      runStart = i
    }
  }
  // Merge tiny runs into the previous one.
  const merged: Run[] = []
  for (const r of runs) {
    const len = r.end - r.start
    if (merged.length > 0 && len < minBuckets) {
      merged[merged.length - 1].end = r.end
    } else {
      merged.push({ ...r })
    }
  }

  const segments: PhraseSegment[] = []
  const buildBuckets = Math.max(2, Math.round(7000 / msPerBucket)) // ~1-2 bars
  for (let r = 0; r < merged.length; r++) {
    const run = merged[r]
    const startMs = run.start * msPerBucket
    const endMs = run.end * msPerBucket
    if (run.high) {
      segments.push({ startMs, endMs, kind: 'drop' })
    } else {
      const isFirst = r === 0
      const isLast = r === merged.length - 1
      const nextHigh = r < merged.length - 1 && merged[r + 1].high
      if (nextHigh && run.end - run.start > buildBuckets) {
        // Carve a build out of the tail leading into the next drop.
        const buildStart = (run.end - buildBuckets) * msPerBucket
        segments.push({
          startMs,
          endMs: buildStart,
          kind: isFirst ? 'intro' : 'break'
        })
        segments.push({ startMs: buildStart, endMs, kind: 'build' })
      } else {
        segments.push({
          startMs,
          endMs,
          kind: isFirst ? 'intro' : isLast ? 'outro' : 'break'
        })
      }
    }
  }
  return segments
}

function movingAverage(src: Float32Array, win: number): Float32Array {
  const n = src.length
  const out = new Float32Array(n)
  const half = Math.floor(win / 2)
  // Prefix sums for an O(n) windowed average.
  const prefix = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + src[i]
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half)
    const b = Math.min(n - 1, i + half)
    out[i] = (prefix[b + 1] - prefix[a]) / (b - a + 1)
  }
  return out
}
