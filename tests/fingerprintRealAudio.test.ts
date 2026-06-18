/**
 * Closed-set fingerprint — REAL-MUSIC accuracy/latency harness (the de-risk).
 *
 * This is the test that actually answers "will SetRecord Live know what's
 * playing?" — run against a folder of your own tracks, no DJ booth required.
 * It builds an index from real audio, then for each track cuts a short clip,
 * degrades it the way a club master-out would (EQ, level, codec, and crucially
 * a PITCH/TEMPO shift to simulate the DJ's pitch fader), and checks whether the
 * engine names the right track — reporting top-1 accuracy, confidence, and
 * match latency per condition.
 *
 * It is SKIPPED unless SETSENSE_SPIKE_DIR is set, so it never runs in CI or a
 * normal `npm test`. To run it:
 *
 *   SETSENSE_SPIKE_DIR="/path/to/your/tracks" npx vitest run tests/fingerprintRealAudio.test.ts
 *
 * Optional env:
 *   SETSENSE_SPIKE_LIMIT   target number of INDEXED tracks (default 40).
 *                          Short files (samples/loops/one-shots) are skipped and
 *                          do not count — the scan continues until this many
 *                          full-length tracks are indexed (or files run out).
 *   SETSENSE_INDEX_SECONDS seconds of each track indexed   (default 180)
 *   SETSENSE_PROBE_SECONDS  probe clip length              (default 6)
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import ffmpegPath from 'ffmpeg-static'
import {
  buildIndex,
  identify,
  FP_SAMPLE_RATE,
  FP_MIN_CONFIDENCE,
  type FingerprintIndex
} from '../electron/services/live/fingerprint'

const DIR = process.env.SETSENSE_SPIKE_DIR
const TARGET = Number(process.env.SETSENSE_SPIKE_LIMIT ?? 40)
/** Upper bound on files scanned while hunting for TARGET full-length tracks. */
const SCAN_CAP = 4000
const INDEX_SECONDS = Number(process.env.SETSENSE_INDEX_SECONDS ?? 180)
const PROBE_SECONDS = Number(process.env.SETSENSE_PROBE_SECONDS ?? 6)
const FFMPEG = ffmpegPath as unknown as string
const AUDIO_EXT = new Set(['.mp3', '.wav', '.aiff', '.aif', '.flac', '.m4a', '.aac', '.ogg'])

// ───────── ffmpeg decode helpers (synchronous — this is a one-off harness) ─────────

/** Decode `[startSec, startSec+durSec)` of a file to mono f32 @ FP_SAMPLE_RATE,
 *  applying an optional ffmpeg `-af` filter chain. Returns null on failure. */
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

// Degradation conditions. `null` filter = clean. Pitch shifts use asetrate to
// move pitch AND tempo together — the worst case (no key-lock), exactly what a
// DJ riding the pitch fader produces.
// Key-lock ON (master tempo): tempo changes, pitch preserved — the common case.
// Key-lock OFF: pitch + tempo together (atrim caps the asetrate output to the
// probe length) — the harder, less common case, expected to fail loud.
const keylock = (f: number): string => `atempo=${f}`
const nokeylock = (f: number): string =>
  `asetrate=${FP_SAMPLE_RATE}*${f},aresample=${FP_SAMPLE_RATE},atrim=0:${PROBE_SECONDS}`
const CONDITIONS: Array<{ name: string; filter: string | null }> = [
  { name: 'clean', filter: null },
  { name: 'eq (club curve)', filter: 'highpass=f=60,lowpass=f=14000,volume=0.7' },
  { name: 'loud + bright', filter: 'volume=2.5,treble=g=6' },
  { name: 'keylock +4% (atempo)', filter: keylock(1.04) },
  { name: 'keylock +6% (atempo)', filter: keylock(1.06) },
  { name: 'keylock -4% (atempo)', filter: keylock(0.96) },
  { name: 'no-keylock +4%', filter: nokeylock(1.04) }
]

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`
}

describe.skipIf(!DIR)('fingerprint — real-music de-risk', () => {
  it('identifies degraded clips of real tracks', () => {
    expect(FFMPEG, 'ffmpeg-static binary').toBeTruthy()

    const files = listAudio(DIR!)
    expect(files.length, `audio files under ${DIR}`).toBeGreaterThan(1)
    console.log(`\n[spike] scanning up to ${files.length} files for ${TARGET} full tracks…`)

    // Build the index from real audio — skip anything too short to be a track
    // (samples, loops, one-shots), stop once TARGET tracks are indexed.
    const MIN_SAMPLES = FP_SAMPLE_RATE * (PROBE_SECONDS + 20)
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
      const id = basename(f)
      samplesById.set(id, pcm)
      fileById.set(id, f)
    }
    console.log(`[spike] indexed ${samplesById.size} tracks, skipped ${skippedShort} short/undecodable`)
    expect(samplesById.size, 'decodable full-length tracks').toBeGreaterThan(1)

    const t0 = performance.now()
    const index: FingerprintIndex = buildIndex(samplesById) // clean rate-1.0 index
    const buildMs = performance.now() - t0
    console.log(
      `[spike] clean index: ${samplesById.size} tracks, ${index.size.toLocaleString()} unique hashes, ` +
        `built in ${(buildMs / 1000).toFixed(1)}s (${(buildMs / samplesById.size).toFixed(0)}ms/track).`
    )

    // For each track + condition, cut a clip ~35% in and try to identify it.
    // idHits  = top-1 id correct (ignoring confidence) — raw recognition.
    // hits    = top-1 correct AND above the fail-loud confidence floor.
    const results = new Map<
      string,
      { hits: number; idHits: number; total: number; conf: number[]; ms: number[] }
    >()
    for (const c of CONDITIONS) results.set(c.name, { hits: 0, idHits: 0, total: 0, conf: [], ms: [] })

    for (const [id, full] of samplesById) {
      const durSec = full.length / FP_SAMPLE_RATE
      const startSec = Math.min(durSec * 0.35, Math.max(0, durSec - PROBE_SECONDS - 1))
      for (const c of CONDITIONS) {
        const probe = decode(fileById.get(id)!, startSec, PROBE_SECONDS, c.filter ?? undefined)
        if (!probe || probe.length < FP_SAMPLE_RATE) continue
        const tm = performance.now()
        const [best] = identify(probe, index)
        const ms = performance.now() - tm
        const bucket = results.get(c.name)!
        bucket.total++
        bucket.ms.push(ms)
        if (best && best.id === id) {
          bucket.idHits++
          if (best.confidence >= FP_MIN_CONFIDENCE) {
            bucket.hits++
            bucket.conf.push(best.confidence)
          }
        }
      }
    }

    // Report.
    const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
    const p95 = (a: number[]): number =>
      a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0 : 0
    console.log('\n[spike] ── accuracy by condition (id = raw top-1, conf = fail-loud gated) ──')
    for (const c of CONDITIONS) {
      const r = results.get(c.name)!
      console.log(
        `  ${c.name.padEnd(22)} id ${pct(r.idHits, r.total).padStart(6)}  ` +
          `conf-gated ${pct(r.hits, r.total).padStart(6)} (${r.hits}/${r.total})  ` +
          `conf≈${mean(r.conf).toFixed(2)}  match ${mean(r.ms).toFixed(1)}ms (p95 ${p95(r.ms).toFixed(0)}ms)`
      )
    }
    console.log('')

    // Hard gate: clean clips must be recognised (id) near-perfectly, or the bet is wrong.
    const clean = results.get('clean')!
    const cleanIdAcc = clean.idHits / Math.max(1, clean.total)
    expect(cleanIdAcc, 'clean-clip raw top-1 id accuracy').toBeGreaterThan(0.95)
  }, 600_000)
})
