/**
 * SetRecord Live engine (main process).
 *
 * Owns the fingerprint index (built from the user's library by decoding each
 * track) and turns the stream of probe windows captured in the renderer into
 * live decisions: identify the playing track → debounce → consequence-framed
 * Next-3 + Set Health. The result is pushed to the overlay window.
 *
 * Everything here is lazy — nothing runs at app launch. All entry points are
 * wrapped so a bad file or decode can never crash the main process.
 */
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import {
  addToIndex,
  fingerprint,
  FP_SAMPLE_RATE,
  FP_FRAME_SIZE,
  FP_HOP_SIZE,
  FP_MAX_BIN,
  FP_MIN_BIN,
  FP_PEAKS_PER_FRAME,
  FP_PEAK_REL_FLOOR,
  FP_TARGET_DT_MIN,
  FP_TARGET_DT_MAX,
  FP_FANOUT,
  type FingerprintIndex,
  type MatchResult
} from './fingerprint'
import { encodeIndex, decodeIndex, CODEC_VERSION } from './fingerprintCodec'
import { LiveDetector, fingerprintMatcher, LIVE_COMMIT_STREAK, type NowPlaying } from './liveSource'
import { getLiveNextUp } from '../../algorithms/liveSuggestions'
import { computeSetHealth } from '../../algorithms/setHealth'
import { matchNowPlaying, type NowPlayingMatch } from '../../algorithms/nowPlayingMatch'
import type { Track, Set as DJSet } from '../../../src/types'

const FFMPEG: string | null = (ffmpegPath as unknown as string | null) ?? null

/**
 * Seconds of each track fingerprinted into the index. This MUST cover wherever
 * in the track the DJ might actually be playing live: a probe captured from the
 * breakdown, the second drop, or the outro can only be identified if that part
 * of the track is in the index. The old value (90s) only covered intros, so the
 * moment a track played past ~1:30 the audio matcher returned nothing and the
 * HUD sat on "listening…" forever — the core reason live mode "didn't work".
 *
 * 600s covers essentially every club track end-to-end. Longer files (hour-long
 * mix recordings / podcasts that happen to live in the library) are capped here
 * to bound index memory and build time. The validated harness
 * (tests/fingerprintRealAudio.test.ts) indexes 180s and only ever probes from
 * *within* the indexed window — which is exactly why it scored 90–100% while the
 * shipped 90s index failed on real playback.
 */
const INDEX_SECONDS = 600
/** Parallel ffmpeg decodes while building the index. */
const BUILD_CONCURRENCY = 4
/** BPM half-window for the Set Health candidate pool. */
const HEALTH_BPM_WINDOW = 8
/** Most recent detected tracks kept for energy-smoothness scoring. */
const RECENT_CAP = 8
/** Probe cadence (ms): the renderer emits an audio window roughly this often. */
const CAPTURE_HOP_MS = 1500
/**
 * A track is only committed LIVE_COMMIT_STREAK consistent windows after it starts,
 * so the debounced commit lands this many ms late. We subtract it when stamping a
 * recorded track's start time, otherwise every tracklist entry reads systematically
 * late. Good enough for a tracklist (and for second-scale reaction windows later).
 */
const COMMIT_LAG_MS = LIVE_COMMIT_STREAK * CAPTURE_HOP_MS

export interface LiveNextUpPayload {
  id: string
  title: string
  artist: string
  matchScore: number
  bpmDelta: number
  energyDelta: number
  keyCompatibility: 'perfect' | 'compatible' | 'neutral' | 'clash'
  summary: string
  best: boolean
}

export interface LiveDataPayload {
  status: 'listening' | 'locked'
  confidence: number
  positionSec: number | null
  current: {
    id: string
    title: string
    artist: string
    bpm: number
    key: string
    energy: number
  } | null
  nextUp: LiveNextUpPayload[]
  setHealth: number
}

const EMPTY_SET: DJSet = {
  id: 'live',
  name: 'Live',
  createdAt: '',
  updatedAt: '',
  tracks: []
}

// ───────── ffmpeg decode ─────────

function decode(filePath: string, seconds: number): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    if (!FFMPEG) return resolve(null)
    const args = [
      '-nostats',
      '-hide_banner',
      '-t',
      String(seconds),
      '-i',
      filePath,
      '-ac',
      '1',
      '-ar',
      String(FP_SAMPLE_RATE),
      '-f',
      'f32le',
      '-'
    ]
    const chunks: Buffer[] = []
    let settled = false
    const done = (r: Float32Array | null): void => {
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
        done(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable)))
      })
    } catch {
      done(null)
    }
  })
}

// ───────── engine state ─────────

let index: FingerprintIndex | null = null
let indexedTrackCount = 0
/** Library signature the current `index` was built/loaded from (staleness key). */
let indexSignature: string | null = null
let detector: LiveDetector | null = null
let library: Track[] = []
let recent: Track[] = []
let lastTrackId: string | null = null
let cachedNextUp: LiveNextUpPayload[] = []
let cachedHealth = 0

export function isIndexReady(): boolean {
  return index !== null
}

// ───────── index persistence (cache across launches) ─────────

/** Where the cached fingerprint index lives on disk. */
function indexFilePath(): string {
  return join(app.getPath('userData'), 'live-fingerprint-index.bin')
}

/**
 * Identity of the DSP parameters + coverage the index was built with. Any change
 * here changes the landmark hashes (or what's covered), so a cache built with a
 * different signature is incompatible and must be rebuilt.
 */
function fingerprintParamSig(): string {
  return [
    CODEC_VERSION,
    INDEX_SECONDS,
    FP_SAMPLE_RATE,
    FP_FRAME_SIZE,
    FP_HOP_SIZE,
    FP_MAX_BIN,
    FP_MIN_BIN,
    FP_PEAKS_PER_FRAME,
    FP_PEAK_REL_FLOOR,
    FP_TARGET_DT_MIN,
    FP_TARGET_DT_MAX,
    FP_FANOUT
  ].join(',')
}

/**
 * Cheap content signature of the indexable library: which tracks, where, and how
 * big. Changes when a track is added, removed, repathed, or its file replaced —
 * exactly the cases that should invalidate a cached index. Avoids statting files
 * (uses the DB's stored fileSize), so it's fast even on a large library.
 */
function librarySignature(tracks: Track[]): string {
  const usable = tracks
    .filter((t) => !t.missingFile && t.filePath)
    .map((t) => `${t.id}|${t.filePath}|${t.fileSize ?? 0}`)
    .sort()
  const h = createHash('sha1').update(usable.join('\n')).digest('hex')
  return `${usable.length}:${h}`
}

interface IndexMeta {
  paramSig: string
  librarySig: string
  indexedTracks: number
}

/** True when the in-process index exists AND still matches `tracks` (so a
 *  re-import or file change correctly forces a rebuild, not a stale match). */
export function isIndexFresh(tracks: Track[]): boolean {
  return index !== null && indexSignature === librarySignature(tracks)
}

/** Persist the current index to disk (best-effort — a failure just means the
 *  next launch rebuilds). */
function persistIndex(librarySig: string): void {
  if (!index) return
  try {
    const meta: IndexMeta = {
      paramSig: fingerprintParamSig(),
      librarySig,
      indexedTracks: indexedTrackCount
    }
    writeFileSync(indexFilePath(), encodeIndex(index, meta))
  } catch (err) {
    console.error('[live] index persist failed', err)
  }
}

/**
 * Restore the fingerprint index from disk for `tracks`. Returns true (and sets
 * the live index) when a valid cache matching the current library + DSP params
 * exists; false means the caller must rebuild. Never throws.
 */
export function loadPersistedIndex(tracks: Track[]): boolean {
  try {
    const sig = librarySignature(tracks)
    const decoded = decodeIndex(readFileSync(indexFilePath()))
    if (!decoded) return false
    const meta = decoded.meta as Partial<IndexMeta> | null
    if (!meta || meta.paramSig !== fingerprintParamSig() || meta.librarySig !== sig) {
      return false // stale: params or library changed since it was cached
    }
    index = decoded.index
    indexedTrackCount = meta.indexedTracks ?? 0
    indexSignature = sig
    return true
  } catch {
    return false // no cache yet, or unreadable
  }
}

// ───────── flight recorder (auto-tracklist of the live set) ─────────

/** One track as it was committed live, with timing relative to session start. */
export interface RecordedSetEntry {
  trackId: string
  title: string
  artist: string
  /** ms from session start to this track's (lag-corrected) commit. */
  startMs: number
  /** ms from session start to the next track's start (session end for the last). */
  endMs: number
  /** Seconds into the track when first locked — seed for Black Box reference reconstruction. */
  matchOffsetSec: number
}

/** The ordered, timed tracklist returned when a live set is finalized. */
export interface FinalizedSet {
  startedAtMs: number
  venue: string | null
  durationMs: number
  entries: RecordedSetEntry[]
}

interface RecordingState {
  startedAtMs: number
  venue: string | null
  entries: Array<{ trackId: string; startMs: number; matchOffsetSec: number }>
}

/**
 * The in-flight recording accumulator. Deliberately INDEPENDENT of startLive():
 * the index-build re-wire calls startLive() a second time mid-session, and the
 * recorder must survive that without losing the tracks captured so far.
 */
let recording: RecordingState | null = null

/** Arm the flight recorder for a new live session. */
export function beginRecordingSession(startedAtMs: number): void {
  recording = { startedAtMs, venue: null, entries: [] }
}

/** Anchor the in-flight recording to the room the DJ picked. */
export function setLiveVenue(venue: string | null): void {
  if (recording) recording.venue = venue
}

/**
 * Close out the recording and return the ordered, timed tracklist — or null if
 * nothing was armed. Idempotent: a second call returns null, so the two end paths
 * (overlay End button / Go-Live toggle) can both call it without double-saving.
 */
export function finalizeLiveSession(endedAtMs: number): FinalizedSet | null {
  const r = recording
  recording = null
  if (!r) return null
  const durationMs = Math.max(0, endedAtMs - r.startedAtMs)
  const entries: RecordedSetEntry[] = r.entries.map((e, i) => {
    const track = library.find((t) => t.id === e.trackId)
    return {
      trackId: e.trackId,
      title: track?.title ?? 'Unknown track',
      artist: track?.artist ?? 'Unknown artist',
      startMs: e.startMs,
      endMs: i + 1 < r.entries.length ? r.entries[i + 1].startMs : durationMs,
      matchOffsetSec: e.matchOffsetSec
    }
  })
  return { startedAtMs: r.startedAtMs, venue: r.venue, durationMs, entries }
}

/**
 * Build the fingerprint index from the library (decode + fingerprint each
 * track). Heavy + one-time; reports progress. Safe to call again to rebuild.
 */
export async function buildLiveIndex(
  tracks: Track[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const usable = tracks.filter((t) => !t.missingFile && t.filePath)
  const next = new Map() as FingerprintIndex
  let done = 0
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < usable.length) {
      const t = usable[cursor++]
      try {
        const pcm = await decode(t.filePath, INDEX_SECONDS)
        if (pcm && pcm.length > FP_SAMPLE_RATE) addToIndex(next, t.id, fingerprint(pcm))
      } catch {
        // skip unreadable track
      }
      onProgress?.(++done, usable.length)
    }
  }

  await Promise.all(Array.from({ length: BUILD_CONCURRENCY }, () => worker()))
  index = next
  indexedTrackCount = usable.length
  indexSignature = librarySignature(tracks)
  // Cache to disk so the next launch restores instantly instead of rebuilding.
  persistIndex(indexSignature)
}

/**
 * Begin a live session against the current library. The detector works for the
 * screen/metadata sensors immediately (no index needed — those match by name);
 * the audio matcher is only wired once the fingerprint index exists.
 */
export function startLive(lib: Track[]): void {
  library = lib
  recent = []
  lastTrackId = null
  cachedNextUp = []
  cachedHealth = 0
  detector = new LiveDetector(index ? fingerprintMatcher(index) : () => [])
}

export function stopLive(): void {
  detector = null
  recent = []
  lastTrackId = null
}

function toNextUpPayload(currentTrack: Track): LiveNextUpPayload[] {
  return getLiveNextUp(currentTrack, library, EMPTY_SET, 3).map((c) => ({
    id: c.track.id,
    title: c.track.title,
    artist: c.track.artist,
    matchScore: c.matchScore,
    bpmDelta: c.bpmDelta,
    energyDelta: c.energyDelta,
    keyCompatibility: c.keyCompatibility,
    summary: c.summary,
    best: c.best
  }))
}

function healthFor(currentTrack: Track): number {
  const candidates = library.filter(
    (t) => t.id !== currentTrack.id && Math.abs(t.bpm - currentTrack.bpm) <= HEALTH_BPM_WINDOW
  )
  return computeSetHealth({ current: currentTrack, recent, candidates }).score
}

/** Turn a debounced NowPlaying into an overlay payload (shared by all sensors). */
function buildPayload(np: NowPlaying): LiveDataPayload | null {
  if (np.trackId == null) {
    const wasLocked = lastTrackId !== null
    lastTrackId = null
    // Emit a "listening" frame only on the transition into it.
    return wasLocked
      ? {
          status: 'listening',
          confidence: 0,
          positionSec: null,
          current: null,
          nextUp: [],
          setHealth: cachedHealth
        }
      : null
  }

  const current = library.find((t) => t.id === np.trackId)
  if (!current) return null

  if (np.trackId !== lastTrackId) {
    lastTrackId = np.trackId
    recent = [...recent, current].slice(-RECENT_CAP)
    cachedNextUp = toNextUpPayload(current)
    cachedHealth = healthFor(current)

    // Flight recorder: log the newly-committed track. Skip if it's the same as
    // the last logged entry — the index-build re-wire resets lastTrackId, which
    // would otherwise re-log the currently-playing track.
    if (recording) {
      const last = recording.entries[recording.entries.length - 1]
      if (!last || last.trackId !== np.trackId) {
        recording.entries.push({
          trackId: np.trackId,
          startMs: Math.max(0, np.at - recording.startedAtMs - COMMIT_LAG_MS),
          matchOffsetSec: np.positionSec ?? 0
        })
      }
    }
  }

  return {
    status: 'locked',
    confidence: np.confidence,
    positionSec: np.positionSec,
    current: {
      id: current.id,
      title: current.title,
      artist: current.artist,
      bpm: current.bpm,
      key: current.key,
      energy: current.energy
    },
    nextUp: cachedNextUp,
    setHealth: cachedHealth
  }
}

/**
 * Process one captured audio probe window (fingerprint path). Returns the
 * payload to push to the overlay, or null if nothing changed. Never throws.
 */
export function processWindow(samples: Float32Array, atMs: number): LiveDataPayload | null {
  if (!detector) return null
  try {
    return buildPayload(detector.observe(samples, atMs))
  } catch {
    return null
  }
}

/**
 * Feed a track id detected by a non-audio sensor (screen OCR or Now-Playing
 * metadata) into the same fused debounce. `null` = sensor saw nothing it could
 * match. Never throws.
 */
export function processDetectedTrack(
  trackId: string | null,
  confidence: number,
  atMs: number
): LiveDataPayload | null {
  if (!detector) return null
  try {
    const results: MatchResult[] = trackId
      ? [{ id: trackId, score: 100, confidence, offsetSec: 0 }]
      : []
    return buildPayload(detector.observeResult(results, atMs))
  } catch {
    return null
  }
}

/** Match free text (OCR lines / metadata) against the library by name. */
export function matchText(texts: string[]): NowPlayingMatch | null {
  return matchNowPlaying(texts, library)
}

/**
 * Read the current track from the Spotify / Apple Music desktop apps via
 * AppleScript (macOS). Returns "artist — title" or null. Needs the one-time
 * Automation permission; resolves null on any error/timeout.
 */
export function readNowPlaying(): Promise<string | null> {
  if (process.platform !== 'darwin') return Promise.resolve(null)
  const script = `
    on trackOf(appName)
      try
        if application appName is running then
          tell application appName
            if (player state as string) is "playing" then
              return (artist of current track) & " — " & (name of current track)
            end if
          end tell
        end if
      end try
      return ""
    end trackOf
    set s to trackOf("Spotify")
    if s is "" then set s to trackOf("Music")
    return s`
  return new Promise((resolve) => {
    try {
      const child = spawn('osascript', ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] })
      let out = ''
      let settled = false
      const done = (v: string | null): void => {
        if (settled) return
        settled = true
        resolve(v)
      }
      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          /* noop */
        }
        done(null)
      }, 3000)
      child.stdout.on('data', (d: Buffer) => (out += d.toString()))
      child.on('error', () => {
        clearTimeout(timer)
        done(null)
      })
      child.on('close', () => {
        clearTimeout(timer)
        const t = out.trim()
        done(t.length > 0 ? t : null)
      })
    } catch {
      resolve(null)
    }
  })
}

/** For diagnostics / status surfaces. */
export function liveStatus(): { indexReady: boolean; indexedTracks: number } {
  return { indexReady: index !== null, indexedTracks: indexedTrackCount }
}
