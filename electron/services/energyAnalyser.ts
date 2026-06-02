/**
 * Auto energy analyser.
 *
 * Computes a 1–10 energy score per track from a single ffmpeg ebur128 pass
 * (integrated LUFS + loudness range) combined with BPM. Loudness dominates
 * because it's the strongest perceptual predictor of "club energy"; LRA pulls
 * dynamic album mixes down from purely loudness-based scores; BPM is a cheap
 * tiebreaker so two equally-loud tracks at 124 vs. 92 don't tie.
 *
 * Runs as a background worker pool — never blocks the import path or the UI.
 */

import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { cpus } from 'os'
import ffmpegPath from 'ffmpeg-static'
import { getDb } from '../db/schema'
import {
  countPendingEnergyTracks,
  getPendingEnergyTracks,
  updateTrackEnergy,
  type PendingEnergyRow
} from '../db/queries'
import type { EnergySource } from '../../src/types'

// ───────── tunables ─────────

const MIN_LUFS = -24
const MAX_LUFS = -8
const MAX_LRA = 15
const MIN_LRA = 3
const MIN_BPM = 90
const MAX_BPM = 150

const W_LOUDNESS = 0.55
const W_DYNAMICS = 0.25
const W_BPM = 0.2

// ffmpeg-static returns null at typecheck because it's `any`. Cast for safety.
const FFMPEG_BIN: string | null = (ffmpegPath as unknown as string | null) ?? null

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function bpmTerm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0.5
  return clamp01((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM))
}

function compositeScore(
  lufs: number | null,
  lra: number | null,
  bpm: number
): {
  raw: number
  score: number
} {
  const loudnessN = lufs == null ? 0.5 : clamp01((lufs - MIN_LUFS) / (MAX_LUFS - MIN_LUFS))
  const dynamicsN = lra == null ? 0.5 : 1 - clamp01((lra - MIN_LRA) / (MAX_LRA - MIN_LRA))
  const bpmN = bpmTerm(bpm)
  const raw = W_LOUDNESS * loudnessN + W_DYNAMICS * dynamicsN + W_BPM * bpmN
  const score = Math.max(1, Math.min(10, 1 + Math.round(raw * 9)))
  return { raw, score }
}

// ───────── ffmpeg ebur128 single-pass ─────────

export interface EbuR128Result {
  lufs: number | null
  lra: number | null
}

/**
 * Spawn ffmpeg with the ebur128 filter, parse "Integrated loudness:" and
 * "Loudness range:" from stderr. Resolves with nulls if ffmpeg or the parse
 * fails so the caller can fall back to a BPM-only score.
 */
function runEbuR128(filePath: string, timeoutMs: number): Promise<EbuR128Result> {
  return new Promise((resolve) => {
    if (!FFMPEG_BIN) {
      resolve({ lufs: null, lra: null })
      return
    }

    const args = [
      '-nostats',
      '-hide_banner',
      '-i',
      filePath,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-'
    ]

    let stderr = ''
    let settled = false
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })

    const finish = (result: EbuR128Result): void => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGKILL')
      } catch {
        // already exited
      }
      resolve(result)
    }

    const timer = setTimeout(() => finish({ lufs: null, lra: null }), timeoutMs)

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      // Cap memory: ebur128 summary fits in a few KB.
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000)
    })

    child.on('error', () => {
      clearTimeout(timer)
      finish({ lufs: null, lra: null })
    })

    child.on('close', () => {
      clearTimeout(timer)
      finish(parseEbuR128Stderr(stderr))
    })
  })
}

function parseEbuR128Stderr(stderr: string): EbuR128Result {
  // ffmpeg writes a multi-line summary at the end:
  //   Integrated loudness:
  //     I:         -7.6 LUFS
  //   Loudness range:
  //     LRA:        4.3 LU
  const lufsMatch = stderr.match(/I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/)
  const lraMatch = stderr.match(/LRA:\s+(-?\d+(?:\.\d+)?)\s+LU/)
  const lufs = lufsMatch ? parseFloat(lufsMatch[1]) : null
  const lra = lraMatch ? parseFloat(lraMatch[1]) : null
  return {
    lufs: lufs != null && Number.isFinite(lufs) ? lufs : null,
    lra: lra != null && Number.isFinite(lra) ? lra : null
  }
}

// ───────── single-file API ─────────

export interface AnalyseResult {
  trackId: string
  energy: number
  energyRaw: number
  source: EnergySource
  lufs: number | null
  lra: number | null
}

/**
 * Analyse one track. Always resolves (never rejects) so a single bad file
 * can't kill the queue. Sets `source` to indicate provenance:
 * - 'missing'  → file not on disk; falls back to neutral score 5
 * - 'failed'   → ffmpeg failed or no loudness data; falls back to BPM-only score
 * - 'computed' → real LUFS/LRA used
 */
export async function analyseTrack(
  trackId: string,
  filePath: string,
  bpm: number,
  missingFile: boolean,
  timeoutMs = 30_000
): Promise<AnalyseResult> {
  if (missingFile || !existsSync(filePath)) {
    const { raw } = compositeScore(null, null, bpm)
    return { trackId, energy: 5, energyRaw: raw, source: 'missing', lufs: null, lra: null }
  }

  const { lufs, lra } = await runEbuR128(filePath, timeoutMs)
  if (lufs == null) {
    // ffmpeg gave us nothing usable → BPM-only fallback (clamped to 1..10).
    const fallbackScore = Math.max(1, Math.min(10, 1 + Math.round(bpmTerm(bpm) * 9)))
    return {
      trackId,
      energy: fallbackScore,
      energyRaw: bpmTerm(bpm),
      source: 'failed',
      lufs,
      lra
    }
  }

  const { raw, score } = compositeScore(lufs, lra, bpm)
  return { trackId, energy: score, energyRaw: raw, source: 'computed', lufs, lra }
}

// ───────── queue runner ─────────

export interface EnergyQueueCallbacks {
  /** Called once at the start with the total pending count. */
  onStart?: (total: number) => void
  /** Called after every completion (success, failure, or missing). */
  onItem?: (result: AnalyseResult, processed: number, total: number) => void
  /** Called when the queue drains (or aborts). */
  onComplete?: (processed: number, total: number) => void
}

let _running = false

export function isAnalysisRunning(): boolean {
  return _running
}

export function pendingCount(): number {
  return countPendingEnergyTracks(getDb())
}

/**
 * Drain every track whose energy_source is 'pending'. Idempotent — if a queue
 * is already running, this is a no-op so two callers (post-import + on-ready)
 * don't double-spawn ffmpeg.
 *
 * Concurrency = cpuCount - 1, clamped to [1, 8], overridable via
 * SETSENSE_ENERGY_CONCURRENCY for debugging.
 */
export async function runAnalysisQueue(cbs: EnergyQueueCallbacks = {}): Promise<void> {
  if (_running) return
  _running = true

  try {
    const db = getDb()
    const pending = getPendingEnergyTracks(db)
    const total = pending.length
    cbs.onStart?.(total)

    if (total === 0) {
      cbs.onComplete?.(0, 0)
      return
    }

    const envConc = parseInt(process.env.SETSENSE_ENERGY_CONCURRENCY ?? '', 10)
    const defaultConc = Math.max(1, cpus().length - 1)
    const concurrency = Math.min(
      8,
      Math.max(1, Number.isFinite(envConc) && envConc > 0 ? envConc : defaultConc)
    )

    let cursor = 0
    let processed = 0

    const worker = async (): Promise<void> => {
      while (cursor < pending.length) {
        const idx = cursor++
        const row: PendingEnergyRow = pending[idx]
        try {
          const result = await analyseTrack(row.id, row.filePath, row.bpm, row.missingFile === 1)
          updateTrackEnergy(db, result.trackId, result.energy, result.energyRaw, result.source)
          processed++
          cbs.onItem?.(result, processed, total)
        } catch (err) {
          // analyseTrack already swallows errors, but be defensive — never
          // leave a track as 'pending' forever.
          console.error('[energyAnalyser] unexpected error on', row.id, err)
          const fallbackRaw = bpmTerm(row.bpm)
          const fallbackScore = Math.max(1, Math.min(10, 1 + Math.round(fallbackRaw * 9)))
          updateTrackEnergy(db, row.id, fallbackScore, fallbackRaw, 'failed')
          processed++
          cbs.onItem?.(
            {
              trackId: row.id,
              energy: fallbackScore,
              energyRaw: fallbackRaw,
              source: 'failed',
              lufs: null,
              lra: null
            },
            processed,
            total
          )
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)
    cbs.onComplete?.(processed, total)
  } finally {
    _running = false
  }
}
