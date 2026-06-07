/**
 * SetSense Live engine (main process).
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
import ffmpegPath from 'ffmpeg-static'
import {
  addToIndex,
  fingerprint,
  FP_SAMPLE_RATE,
  type FingerprintIndex,
  type MatchResult
} from './fingerprint'
import { LiveDetector, fingerprintMatcher, type NowPlaying } from './liveSource'
import { getLiveNextUp } from '../../algorithms/liveSuggestions'
import { computeSetHealth } from '../../algorithms/setHealth'
import { matchNowPlaying, type NowPlayingMatch } from '../../algorithms/nowPlayingMatch'
import type { Track, Set as DJSet } from '../../../src/types'

const FFMPEG: string | null = (ffmpegPath as unknown as string | null) ?? null

/** Seconds of each track indexed. Covers the window a track is likely playing. */
const INDEX_SECONDS = 90
/** Parallel ffmpeg decodes while building the index. */
const BUILD_CONCURRENCY = 4
/** BPM half-window for the Set Health candidate pool. */
const HEALTH_BPM_WINDOW = 8
/** Most recent detected tracks kept for energy-smoothness scoring. */
const RECENT_CAP = 8

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
  current: { id: string; title: string; artist: string; bpm: number; key: string; energy: number } | null
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
let detector: LiveDetector | null = null
let library: Track[] = []
let recent: Track[] = []
let lastTrackId: string | null = null
let cachedNextUp: LiveNextUpPayload[] = []
let cachedHealth = 0

export function isIndexReady(): boolean {
  return index !== null
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
      ? { status: 'listening', confidence: 0, positionSec: null, current: null, nextUp: [], setHealth: cachedHealth }
      : null
  }

  const current = library.find((t) => t.id === np.trackId)
  if (!current) return null

  if (np.trackId !== lastTrackId) {
    lastTrackId = np.trackId
    recent = [...recent, current].slice(-RECENT_CAP)
    cachedNextUp = toNextUpPayload(current)
    cachedHealth = healthFor(current)
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
