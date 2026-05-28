/**
 * Embedded album-artwork extractor.
 *
 * Pulls the cover art embedded in each local audio file (ID3 APIC, FLAC
 * PICTURE, MP4 'covr', AIFF) using a single ffmpeg pass that also downscales
 * to a small square JPEG. No network, no API keys — the art the DJ already
 * tagged in their library. Files with no embedded art fall back to the
 * deterministic gradient in the renderer.
 *
 * Runs as a background worker pool — never blocks the import path or the UI.
 * Mirrors the energy analyser (energyAnalyser.ts) in structure and lifecycle.
 */

import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { cpus } from 'os'
import { join } from 'path'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { getDb } from '../db/schema'
import {
  countPendingArtworkTracks,
  getPendingArtworkTracks,
  updateTrackArtwork,
  type PendingArtworkRow,
} from '../db/queries'
import type { ArtworkSource } from '../../src/types'

// ───────── tunables ─────────

/**
 * Cached art is a square JPEG. 128px covers the 36px library thumbnail at 2–3×
 * retina plus the ~56px cue-editor thumbnail with headroom, while keeping each
 * file ~5–10 KB (a 4k-track library ≈ 30 MB cache).
 */
const ARTWORK_SIZE = 128
const EXTRACT_TIMEOUT_MS = 15_000

// ffmpeg-static returns null at typecheck because it's `any`. Cast for safety.
const FFMPEG_BIN: string | null = (ffmpegPath as unknown as string | null) ?? null

let _cacheDir: string | null = null

/** Absolute path to the artwork cache dir, created on first use. */
export function getArtworkCacheDir(): string {
  if (!_cacheDir) {
    _cacheDir = join(app.getPath('userData'), 'artwork')
    mkdirSync(_cacheDir, { recursive: true })
  }
  return _cacheDir
}

// ───────── single-file extraction ─────────

export interface ArtworkResult {
  trackId: string
  albumArtPath: string | null
  source: ArtworkSource
}

/**
 * Extract + downscale embedded cover art for one track. Always resolves (never
 * rejects) so a single bad file can't kill the queue. `source`:
 * - 'none'     → file missing, no embedded art, or empty output
 * - 'failed'   → ffmpeg binary unavailable, spawn error, or timeout (transient)
 * - 'embedded' → a non-empty JPEG was written to the cache
 */
export function extractArtwork(
  trackId: string,
  filePath: string,
  missingFile: boolean,
  timeoutMs = EXTRACT_TIMEOUT_MS
): Promise<ArtworkResult> {
  return new Promise((resolve) => {
    if (!FFMPEG_BIN) {
      resolve({ trackId, albumArtPath: null, source: 'failed' })
      return
    }
    if (missingFile || !existsSync(filePath)) {
      resolve({ trackId, albumArtPath: null, source: 'none' })
      return
    }

    const outPath = join(getArtworkCacheDir(), `${trackId}.jpg`)

    const cleanupPartial = (): void => {
      try {
        if (existsSync(outPath)) unlinkSync(outPath)
      } catch {
        // best effort — a stale partial just gets overwritten next run
      }
    }

    const args = [
      '-y',
      '-nostats',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-an', // drop audio — we only want the attached cover stream
      '-map',
      '0:v:0', // first video stream = the embedded cover (attached_pic)
      '-vf',
      `scale=${ARTWORK_SIZE}:${ARTWORK_SIZE}:force_original_aspect_ratio=increase,crop=${ARTWORK_SIZE}:${ARTWORK_SIZE}`,
      '-frames:v',
      '1',
      outPath,
    ]

    let settled = false
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'ignore'] })

    const finish = (result: ArtworkResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill('SIGKILL')
      } catch {
        // already exited
      }
      resolve(result)
    }

    const timer = setTimeout(() => {
      cleanupPartial()
      finish({ trackId, albumArtPath: null, source: 'failed' })
    }, timeoutMs)

    child.on('error', () => {
      cleanupPartial()
      finish({ trackId, albumArtPath: null, source: 'failed' })
    })

    child.on('close', (code) => {
      // Non-zero exit usually means "no video/cover stream" → treat as no art.
      const ok =
        code === 0 && existsSync(outPath) && (() => {
          try {
            return statSync(outPath).size > 0
          } catch {
            return false
          }
        })()
      if (ok) {
        finish({ trackId, albumArtPath: outPath, source: 'embedded' })
      } else {
        cleanupPartial()
        finish({ trackId, albumArtPath: null, source: 'none' })
      }
    })
  })
}

// ───────── queue runner ─────────

export interface ArtworkQueueCallbacks {
  /** Called once at the start with the total pending count. */
  onStart?: (total: number) => void
  /** Called after every completion (success, no-art, or failure). */
  onItem?: (result: ArtworkResult, processed: number, total: number) => void
  /** Called when the queue drains (or aborts). */
  onComplete?: (processed: number, total: number) => void
}

let _running = false

export function isArtworkRunning(): boolean {
  return _running
}

export function pendingArtworkCount(): number {
  return countPendingArtworkTracks(getDb())
}

/**
 * Drain every track whose album_art_source is 'pending'. Idempotent — if a
 * queue is already running, this is a no-op so two callers (post-import +
 * on-ready) don't double-spawn ffmpeg.
 *
 * Concurrency = cpuCount - 1, clamped to [1, 8], overridable via
 * SETSENSE_ARTWORK_CONCURRENCY for debugging.
 */
export async function runArtworkQueue(cbs: ArtworkQueueCallbacks = {}): Promise<void> {
  if (_running) return
  _running = true

  try {
    const db = getDb()
    const pending = getPendingArtworkTracks(db)
    const total = pending.length
    cbs.onStart?.(total)

    if (total === 0) {
      cbs.onComplete?.(0, 0)
      return
    }

    const envConc = parseInt(process.env.SETSENSE_ARTWORK_CONCURRENCY ?? '', 10)
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
        const row: PendingArtworkRow = pending[idx]
        try {
          const result = await extractArtwork(row.id, row.filePath, row.missingFile === 1)
          updateTrackArtwork(db, result.trackId, result.albumArtPath, result.source)
          processed++
          cbs.onItem?.(result, processed, total)
        } catch (err) {
          // extractArtwork already swallows errors, but be defensive — never
          // leave a track as 'pending' forever.
          console.error('[artworkExtractor] unexpected error on', row.id, err)
          updateTrackArtwork(db, row.id, null, 'failed')
          processed++
          cbs.onItem?.(
            { trackId: row.id, albumArtPath: null, source: 'failed' },
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
