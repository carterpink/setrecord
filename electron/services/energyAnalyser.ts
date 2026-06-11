/**
 * Auto energy analyser.
 *
 * Computes a DJ-calibrated 1–10 energy score per track from genuine spectral
 * features extracted over the first ~60s: per-frame RMS energy, spectral
 * centroid (brightness), and K-weighted loudness (LUFS, per ITU-R BS.1770),
 * blended 40/30/30 — see {@link ./energy/spectralFeatures}. RMS dominates
 * because sustained power is the strongest predictor of dancefloor energy.
 *
 * Results are cached locally per track ({@link ./energy/energyCache}) keyed by
 * file signature, so a track is analysed exactly once and is instant on every
 * future set. Runs as a background worker pool — never blocks import or the UI.
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { cpus } from 'os'
import { app } from 'electron'
import { FFMPEG_BIN } from './ffmpegBinary'
import { getDb } from '../db/schema'
import {
  countPendingEnergyTracks,
  getPendingEnergyTracks,
  updateTrackEnergy,
  updateTrackAnalysisFeatures,
  type PendingEnergyRow
} from '../db/queries'
import { tagTrack } from './tagging/tagger'
import { ANALYSIS_SAMPLE_RATE } from './energy/spectralFeatures'
import { getEnergyCache } from './energy/energyCache'
import {
  analyseTrack as analyseTrackCore,
  type AnalyseResult as CoreAnalyseResult,
  type PcmDecode
} from './energy/analyse'

// ───────── tunables ─────────

/** How much of each track to analyse, in seconds. */
const ANALYSIS_SECONDS = 60

// ───────── ffmpeg PCM decode ─────────

/**
 * Decode the first {@link ANALYSIS_SECONDS} of a file to mono float32 PCM at
 * {@link ANALYSIS_SAMPLE_RATE}, streamed off ffmpeg's stdout. Resolves null on
 * any failure so the caller can fall back gracefully.
 */
export function decodePcm(filePath: string, timeoutMs = 30_000): Promise<PcmDecode | null> {
  return new Promise((resolve) => {
    if (!FFMPEG_BIN) {
      resolve(null)
      return
    }

    const args = [
      '-nostats',
      '-hide_banner',
      '-t',
      String(ANALYSIS_SECONDS),
      '-i',
      filePath,
      '-ac',
      '1',
      '-ar',
      String(ANALYSIS_SAMPLE_RATE),
      '-f',
      'f32le',
      '-'
    ]

    const chunks: Buffer[] = []
    let settled = false
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'pipe', 'ignore'] })

    const finish = (result: PcmDecode | null): void => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGKILL')
      } catch {
        // already exited
      }
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.on('error', () => {
      clearTimeout(timer)
      finish(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      if (chunks.length === 0) {
        finish(null)
        return
      }
      const buf = Buffer.concat(chunks)
      // f32le → Float32Array over the same memory (trim to whole samples).
      const usable = buf.length - (buf.length % 4)
      const samples = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable))
      finish({ samples, sampleRate: ANALYSIS_SAMPLE_RATE })
    })
  })
}

// ───────── single-file API ─────────

export type AnalyseResult = CoreAnalyseResult

function cachePath(): string {
  return join(app.getPath('userData'), 'energy-cache.json')
}

/**
 * Analyse one track via the spectral engine, consulting the shared local cache.
 * Thin wrapper that wires the ffmpeg decoder + cache into the pure core.
 */
export async function analyseTrack(
  trackId: string,
  filePath: string,
  bpm: number,
  missingFile: boolean,
  timeoutMs = 30_000
): Promise<AnalyseResult> {
  return analyseTrackCore(trackId, filePath, bpm, missingFile, {
    decode: (p) => decodePcm(p, timeoutMs),
    cache: getEnergyCache(cachePath()),
    fileExists: existsSync
  })
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
    const cache = getEnergyCache(cachePath())
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
          // Persist features + infer tags off the same analysis pass (no second decode).
          const features = result.components
            ? {
                rms: result.components.rms,
                brightness: result.components.brightness,
                loudness: result.components.loudness,
                vocalness: result.components.vocalness
              }
            : null
          if (features) updateTrackAnalysisFeatures(db, result.trackId, features)
          tagTrack(db, result.trackId, {
            energy: result.energy,
            features,
            bpm: row.bpm,
            key: row.key,
            genre: row.genre,
            durationSec: row.duration
          })
          processed++
          cbs.onItem?.(result, processed, total)
        } catch (err) {
          // analyseTrack already swallows errors, but be defensive — never
          // leave a track as 'pending' forever.
          console.error('[energyAnalyser] unexpected error on', row.id, err)
          updateTrackEnergy(db, row.id, 5, 0.5, 'failed')
          processed++
          cbs.onItem?.(
            { trackId: row.id, energy: 5, energyRaw: 0.5, source: 'failed', cached: false },
            processed,
            total
          )
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)
    // Persist any freshly-computed scores so the next launch starts warm.
    cache.flush()
    cbs.onComplete?.(processed, total)
  } finally {
    _running = false
  }
}
