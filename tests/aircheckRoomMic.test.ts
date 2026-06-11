/**
 * Aircheck Phase 0 — ROOM-MIC go/no-go harness.
 *
 * The mobile flight recorder bet ("the phone on the booth shelf writes your
 * tracklist") only works if closed-set matching survives what a PHONE MIC IN A
 * LOUD ROOM does to the signal — not just the clean master-out conditions the
 * shipped engine was validated on (tests/fingerprintRealAudio.test.ts,
 * 90–100%). This harness answers that question offline, no booth required.
 *
 * Simulated room-mic chain, applied to real library audio:
 *   1. phone-mic coloration  — highpass (distance / capsule roll-off)
 *   2. room reflections      — short multi-tap echo
 *   3. crowd noise           — pink noise mixed at three levels
 *   4. phone AGC             — dynaudnorm
 *   5. the recorder codec    — REAL libopus 32 kbps mono webm round-trip,
 *                              byte-identical to the desktop flight recorder
 *                              format ('webm-opus', set_recordings)
 * Pink noise is a stand-in for crowd babble — broadband-correct, spectrally
 * kinder than real shouting. Real-booth validation stays on the checklist.
 *
 * Two parts:
 *   A. single-probe accuracy per condition (mirrors the master-out harness)
 *   B. LiveDetector simulation — consecutive 6s windows at the live 1.5s
 *      cadence through the realistic chain: lock rate, time-to-lock, and the
 *      one unforgivable failure, committing the WRONG track.
 *
 * SKIPPED unless AIRCHECK_SPIKE_DIR is set — never runs in CI. To run:
 *
 *   AIRCHECK_SPIKE_DIR="/path/to/your/tracks" npx vitest run tests/aircheckRoomMic.test.ts
 *
 * Optional env (same semantics as the master-out harness):
 *   AIRCHECK_SPIKE_LIMIT    target number of indexed full-length tracks (40)
 *   AIRCHECK_INDEX_SECONDS  seconds of each track indexed (180)
 *   AIRCHECK_PROBE_SECONDS  probe clip length (6)
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { readdirSync, statSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, extname, basename } from 'path'
import ffmpegPath from 'ffmpeg-static'
import {
  buildIndex,
  identify,
  FP_SAMPLE_RATE,
  FP_MIN_CONFIDENCE,
  type FingerprintIndex
} from '../electron/services/live/fingerprint'
import {
  LiveDetector,
  fingerprintMatcher,
  LIVE_COMMIT_STREAK
} from '../electron/services/live/liveSource'

const DIR = process.env.AIRCHECK_SPIKE_DIR
const TARGET = Number(process.env.AIRCHECK_SPIKE_LIMIT ?? 40)
const SCAN_CAP = 4000
const INDEX_SECONDS = Number(process.env.AIRCHECK_INDEX_SECONDS ?? 180)
const PROBE_SECONDS = Number(process.env.AIRCHECK_PROBE_SECONDS ?? 6)
/** Live capture cadence (ms) — must mirror CAPTURE_HOP_MS in liveEngine. */
const HOP_MS = 1500
/** Seconds of continuous degraded audio fed to the detector sim per track. */
const DETECTOR_SPAN_SEC = 24
const FFMPEG = ffmpegPath as unknown as string
const AUDIO_EXT = new Set(['.mp3', '.wav', '.aiff', '.aif', '.flac', '.m4a', '.aac', '.ogg'])

// ───────── ffmpeg helpers (synchronous — one-off harness) ─────────

/** Decode `[startSec, startSec+durSec)` to mono f32 @ FP_SAMPLE_RATE. */
function decode(
  file: string,
  startSec: number,
  durSec: number | null,
  filter?: string
): Float32Array | null {
  const args = ['-nostats', '-hide_banner', '-ss', String(startSec)]
  if (durSec != null) args.push('-t', String(durSec))
  args.push('-i', file)
  if (filter) args.push('-af', filter)
  args.push('-ac', '1', '-ar', String(FP_SAMPLE_RATE), '-f', 'f32le', '-')
  const res = spawnSync(FFMPEG, args, { maxBuffer: 1 << 30 })
  if (res.status !== 0 || !res.stdout || res.stdout.length < 4) return null
  const buf = res.stdout
  const usable = buf.length - (buf.length % 4)
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable))
}

/**
 * The room-mic chain: source → music filter → optional pink-noise mix → REAL
 * opus 32k mono webm (the flight-recorder codec) → decode back to f32.
 * `musicFilter` runs pre-mix (EQ/echo/AGC and any tempo/pitch shift).
 */
let probeSeq = 0
function roomMic(
  file: string,
  startSec: number,
  durSec: number,
  tmpDir: string,
  musicFilter: string,
  noiseAmp: number | null
): Float32Array | null {
  const out = join(tmpDir, `probe-${probeSeq++}.webm`)
  const args = [
    '-nostats',
    '-hide_banner',
    '-y',
    '-ss',
    String(startSec),
    '-t',
    String(durSec),
    '-i',
    file
  ]
  if (noiseAmp != null) {
    args.push(
      '-filter_complex',
      `[0:a]${musicFilter}[m];` +
        `anoisesrc=c=pink:r=48000:a=${noiseAmp}:d=${durSec}[n];` +
        `[m][n]amix=inputs=2:duration=first:normalize=0[out]`,
      '-map',
      '[out]'
    )
  } else {
    args.push('-af', musicFilter)
  }
  // -vn: embedded cover art would otherwise be muxed as a webm video stream
  // and fail the encode (webm rejects mjpeg/png attachments).
  args.push('-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', out)
  const enc = spawnSync(FFMPEG, args, { maxBuffer: 1 << 30 })
  if (enc.status !== 0) return null
  return decode(out, 0, null)
}

function listAudio(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (acc.length >= SCAN_CAP) break
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) listAudio(full, acc)
    else if (AUDIO_EXT.has(extname(name).toLowerCase())) acc.push(full)
  }
  return acc
}

// ───────── conditions ─────────

/** Shared "phone hears a room" music chain: capsule roll-off, two early
 *  reflections, phone AGC. Resampled to 48k first so pitch math is rate-safe. */
const ROOM = 'aresample=48000,highpass=f=150,aecho=0.8:0.7:37|113:0.25|0.12,dynaudnorm'
const keylock = (f: number): string => `${ROOM},atempo=${f}`
const nokeylock = (f: number): string =>
  `aresample=48000,asetrate=48000*${f},aresample=48000,highpass=f=150,` +
  `aecho=0.8:0.7:37|113:0.25|0.12,dynaudnorm,atrim=0:${PROBE_SECONDS}`

/** Part A conditions. `wrongIsFailure`: a confident WRONG id is the failure
 *  mode that matters (no-keylock is EXPECTED to miss — it must miss QUIETLY). */
const CONDITIONS: Array<{
  name: string
  music: string | null // null = clean control (no room chain, no opus)
  noise: number | null
  wrongIsFailure?: boolean
}> = [
  { name: 'clean (control)', music: null, noise: null },
  { name: 'opus 32k only', music: 'anull', noise: null },
  { name: 'room-mic, quiet floor', music: ROOM, noise: null },
  { name: 'room-mic, moderate crowd', music: ROOM, noise: 0.04 },
  { name: 'room-mic, loud crowd', music: ROOM, noise: 0.1 },
  { name: 'room-mic, very loud crowd', music: ROOM, noise: 0.18 },
  { name: 'room loud + keylock +4%', music: keylock(1.04), noise: 0.1 },
  { name: 'room loud + NO-keylock +4%', music: nokeylock(1.04), noise: 0.1, wrongIsFailure: true }
]

/** The chain the detector sim runs on — the realistic "phone on booth shelf
 *  in a busy room" case the go/no-go gate is judged against. */
const DETECTOR_MUSIC = ROOM
const DETECTOR_NOISE = 0.1

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`
}
const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const p95 = (a: number[]): number =>
  a.length ? ([...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0) : 0

describe.skipIf(!DIR)('aircheck phase 0 — room-mic go/no-go', () => {
  it('matches tracks through a simulated phone-in-the-booth signal path', () => {
    expect(FFMPEG, 'ffmpeg-static binary').toBeTruthy()
    const tmpDir = mkdtempSync(join(tmpdir(), 'aircheck-spike-'))

    try {
      const files = listAudio(DIR!)
      expect(files.length, `audio files under ${DIR}`).toBeGreaterThan(1)
      console.log(`\n[aircheck] scanning up to ${files.length} files for ${TARGET} full tracks…`)

      // Index from real audio, skipping short files (samples/loops/one-shots).
      const MIN_SAMPLES = FP_SAMPLE_RATE * (DETECTOR_SPAN_SEC + 20)
      const samplesById = new Map<string, Float32Array>()
      const fileById = new Map<string, string>()
      let skippedShort = 0
      for (const f of files) {
        if (samplesById.size >= TARGET) break
        const pcm = decode(f, 0, INDEX_SECONDS)
        if (!pcm || pcm.length < MIN_SAMPLES) {
          skippedShort++
          continue
        }
        samplesById.set(basename(f), pcm)
        fileById.set(basename(f), f)
      }
      console.log(
        `[aircheck] indexed ${samplesById.size} tracks, skipped ${skippedShort} short/undecodable`
      )
      expect(samplesById.size, 'decodable full-length tracks').toBeGreaterThan(1)

      const t0 = performance.now()
      const index: FingerprintIndex = buildIndex(samplesById)
      console.log(
        `[aircheck] index: ${index.size.toLocaleString()} unique hashes, ` +
          `built in ${((performance.now() - t0) / 1000).toFixed(1)}s`
      )

      // ── Part A: single-probe accuracy per condition ──
      const results = new Map<
        string,
        {
          hits: number
          idHits: number
          wrongConfident: number
          total: number
          conf: number[]
          ms: number[]
        }
      >()
      for (const c of CONDITIONS)
        results.set(c.name, { hits: 0, idHits: 0, wrongConfident: 0, total: 0, conf: [], ms: [] })

      for (const [id, full] of samplesById) {
        const durSec = full.length / FP_SAMPLE_RATE
        const startSec = Math.min(durSec * 0.35, Math.max(0, durSec - PROBE_SECONDS - 1))
        for (const c of CONDITIONS) {
          const probe =
            c.music === null
              ? decode(fileById.get(id)!, startSec, PROBE_SECONDS)
              : roomMic(fileById.get(id)!, startSec, PROBE_SECONDS, tmpDir, c.music, c.noise)
          if (!probe || probe.length < FP_SAMPLE_RATE) {
            console.log(`[aircheck]   skipped probe (${c.name}): ${id}`)
            continue
          }
          const tm = performance.now()
          const [best] = identify(probe, index)
          const r = results.get(c.name)!
          r.total++
          r.ms.push(performance.now() - tm)
          if (best && best.id === id) {
            r.idHits++
            if (best.confidence >= FP_MIN_CONFIDENCE) {
              r.hits++
              r.conf.push(best.confidence)
            }
          } else if (best && best.confidence >= FP_MIN_CONFIDENCE) {
            r.wrongConfident++ // confident and WRONG — the unforgivable case
          }
        }
      }

      console.log('\n[aircheck] ── Part A: accuracy by condition ──')
      for (const c of CONDITIONS) {
        const r = results.get(c.name)!
        console.log(
          `  ${c.name.padEnd(28)} id ${pct(r.idHits, r.total).padStart(6)}  ` +
            `conf-gated ${pct(r.hits, r.total).padStart(6)} (${r.hits}/${r.total})  ` +
            `WRONG-confident ${pct(r.wrongConfident, r.total).padStart(5)}  ` +
            `conf≈${mean(r.conf).toFixed(2)}  match ${mean(r.ms).toFixed(1)}ms (p95 ${p95(r.ms).toFixed(0)}ms)`
        )
      }

      // ── Part B: LiveDetector sim — continuous windows at live cadence ──
      const hopSec = HOP_MS / 1000
      const windowsPerTrack = Math.floor((DETECTOR_SPAN_SEC - PROBE_SECONDS) / hopSec) + 1
      let simTracks = 0
      let locked = 0
      let falseLocks = 0
      const lockSecs: number[] = []

      for (const [id, full] of samplesById) {
        const durSec = full.length / FP_SAMPLE_RATE
        const startSec = Math.min(durSec * 0.35, Math.max(0, durSec - DETECTOR_SPAN_SEC - 1))
        const span = roomMic(
          fileById.get(id)!,
          startSec,
          DETECTOR_SPAN_SEC,
          tmpDir,
          DETECTOR_MUSIC,
          DETECTOR_NOISE
        )
        if (!span || span.length < FP_SAMPLE_RATE * (PROBE_SECONDS + 1)) continue
        simTracks++

        const detector = new LiveDetector(fingerprintMatcher(index))
        let lockedAt: number | null = null
        let wrong = false
        for (let w = 0; w < windowsPerTrack; w++) {
          const s = Math.floor(w * hopSec * FP_SAMPLE_RATE)
          const e = s + PROBE_SECONDS * FP_SAMPLE_RATE
          if (e > span.length) break
          const np = detector.observe(span.subarray(s, e), w * HOP_MS)
          if (np.trackId === id && lockedAt === null) lockedAt = w
          if (np.trackId !== null && np.trackId !== id) wrong = true
        }
        if (lockedAt !== null) {
          locked++
          lockSecs.push(lockedAt * hopSec + PROBE_SECONDS) // audio elapsed when lock landed
        }
        if (wrong) falseLocks++
      }

      console.log('\n[aircheck] ── Part B: LiveDetector on room-mic loud crowd ──')
      console.log(
        `  tracks ${simTracks} · locked correct ${pct(locked, simTracks)} · ` +
          `FALSE locks ${pct(falseLocks, simTracks)} · ` +
          `time-to-lock mean ${mean(lockSecs).toFixed(1)}s / p95 ${p95(lockSecs).toFixed(1)}s ` +
          `(commit streak ${LIVE_COMMIT_STREAK}, hop ${hopSec}s, window ${PROBE_SECONDS}s)`
      )
      console.log('')

      // ── Go/no-go gates ──
      const clean = results.get('clean (control)')!
      expect(
        clean.idHits / Math.max(1, clean.total),
        'clean control top-1 id accuracy'
      ).toBeGreaterThan(0.95)

      // The matcher must still FIND the track under loud-crowd conditions (raw
      // top-1). Single-probe confidence gating is diagnostic only — the product
      // consumes the streak-debounced detector (Part B), never a lone window.
      const loud = results.get('room-mic, loud crowd')!
      expect(
        loud.idHits / Math.max(1, loud.total),
        'room-mic loud crowd raw top-1 accuracy'
      ).toBeGreaterThanOrEqual(0.8)

      // Fail-loud invariant: no condition may confidently name the WRONG track
      // more than rarely — a wrong tracklist is worse than a hole in it.
      for (const c of CONDITIONS) {
        const r = results.get(c.name)!
        expect(
          r.wrongConfident / Math.max(1, r.total),
          `${c.name}: confident-wrong rate`
        ).toBeLessThanOrEqual(0.05)
      }

      // Detector must lock the right track on ≥80% of tracks and (almost) never
      // commit a wrong one — the streak debounce should eat single-window flukes.
      expect(locked / Math.max(1, simTracks), 'detector correct-lock rate').toBeGreaterThanOrEqual(
        0.8
      )
      expect(falseLocks / Math.max(1, simTracks), 'detector false-lock rate').toBeLessThanOrEqual(
        0.02
      )
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }, 1_800_000)
})
