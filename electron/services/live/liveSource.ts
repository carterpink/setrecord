/**
 * Live deck-state input for SetSense Live.
 *
 * A `LiveSource` is a provider that tells the app what's playing right now. The
 * UI and recommendation engine depend only on this interface and the
 * {@link NowPlaying} it emits — never on how the signal is obtained — so a
 * Pro DJ Link provider can later drop in behind the same contract without the
 * HUD knowing (mirrors the importer-provider pattern used for Serato/Engine).
 *
 * The v1 provider is {@link AudioFingerprintSource}: it identifies the playing
 * track by matching captured master-out audio against a {@link FingerprintIndex}
 * of the user's own library (see ./fingerprint).
 *
 * Detection is debounced by {@link LiveDetector} so a single bad window can't
 * flip the displayed track, and low-confidence windows resolve to
 * `trackId: null` ("listening…") rather than a guess — fail loud, not wrong.
 */

import {
  type FingerprintIndex,
  type MatchResult,
  identify,
  FP_MIN_CONFIDENCE
} from './fingerprint'

// ───────── what a source emits ─────────

export interface NowPlaying {
  /** Identified track id, or null when nothing is confidently recognised. */
  trackId: string | null
  /** Confidence of the committed identification, 0..1. */
  confidence: number
  /** Seconds into the track the live audio is currently at, if known. */
  positionSec: number | null
  /** Event timestamp (ms epoch). Passed in by the caller — kept out of the
   *  detector so it stays pure/testable. */
  at: number
}

export interface LiveSource {
  readonly kind: string
  start(): Promise<void>
  stop(): Promise<void>
  /** Subscribe to now-playing updates. Returns an unsubscribe function. */
  onUpdate(cb: (np: NowPlaying) => void): () => void
}

// ───────── detection debounce ─────────

/** Consecutive consistent detections of a NEW track required to commit to it. */
export const LIVE_COMMIT_STREAK = 2
/** Consecutive low-confidence windows required before dropping to "listening". */
export const LIVE_DROP_STREAK = 3

/** A function that identifies a probe window. Injected so the debounce logic is
 *  testable without real audio. {@link fingerprintMatcher} is the real one. */
export type Matcher = (probe: Float32Array) => MatchResult[]

/** The production matcher: identify against a fingerprint index. */
export function fingerprintMatcher(index: FingerprintIndex): Matcher {
  return (probe) => identify(probe, index)
}

/**
 * Turns a stream of per-window match results into a stable {@link NowPlaying}.
 *
 * - A different track must be detected {@link LIVE_COMMIT_STREAK} windows in a
 *   row before it replaces the committed track (rejects one-window flukes and
 *   the brief overlap during a blend).
 * - The committed track is dropped to null only after {@link LIVE_DROP_STREAK}
 *   consecutive low-confidence windows (rides out a transient bad read).
 * - Re-detecting the committed track just refreshes its confidence/position.
 */
export class LiveDetector {
  private committedId: string | null = null
  private committedConfidence = 0
  private committedPositionSec: number | null = null
  private pendingId: string | null = null
  private pendingStreak = 0
  private lowConfStreak = 0

  constructor(
    private readonly matcher: Matcher,
    private readonly minConfidence = FP_MIN_CONFIDENCE
  ) {}

  observe(probe: Float32Array, atMs: number): NowPlaying {
    return this.observeResult(this.matcher(probe), atMs)
  }

  /**
   * Debounce a pre-computed match (from ANY sensor — audio fingerprint, screen
   * OCR, or Now-Playing metadata) into a stable {@link NowPlaying}. Lets all
   * sensors share one fused now-playing state.
   */
  observeResult(results: MatchResult[], atMs: number): NowPlaying {
    const top = results[0]
    const detectedId = top && top.confidence >= this.minConfidence ? top.id : null

    if (detectedId === null) {
      this.pendingId = null
      this.pendingStreak = 0
      this.lowConfStreak++
      if (this.lowConfStreak >= LIVE_DROP_STREAK) {
        this.committedId = null
        this.committedConfidence = 0
        this.committedPositionSec = null
      }
    } else {
      this.lowConfStreak = 0
      if (detectedId === this.committedId) {
        // Same track — refresh live confidence/position.
        this.committedConfidence = top.confidence
        this.committedPositionSec = top.offsetSec
        this.pendingId = null
        this.pendingStreak = 0
      } else {
        // A new candidate — require a streak before committing.
        if (detectedId === this.pendingId) this.pendingStreak++
        else {
          this.pendingId = detectedId
          this.pendingStreak = 1
        }
        if (this.pendingStreak >= LIVE_COMMIT_STREAK) {
          this.committedId = detectedId
          this.committedConfidence = top.confidence
          this.committedPositionSec = top.offsetSec
          this.pendingId = null
          this.pendingStreak = 0
        }
      }
    }

    return {
      trackId: this.committedId,
      confidence: this.committedConfidence,
      positionSec: this.committedPositionSec,
      at: atMs
    }
  }

  reset(): void {
    this.committedId = null
    this.committedConfidence = 0
    this.committedPositionSec = null
    this.pendingId = null
    this.pendingStreak = 0
    this.lowConfStreak = 0
  }
}

// ───────── audio capture seam ─────────

/**
 * Source of rolling PCM windows at FP_SAMPLE_RATE (mono). The real
 * implementation taps the master-out via a loopback device (Web Audio /
 * BlackHole) — that plumbing is built against this seam separately, and tests
 * supply a fake feed.
 */
export interface AudioFeed {
  start(onWindow: (samples: Float32Array, atMs: number) => void): Promise<void>
  stop(): Promise<void>
}

// ───────── the v1 provider ─────────

export class AudioFingerprintSource implements LiveSource {
  readonly kind = 'audio-fingerprint'
  private readonly detector: LiveDetector
  private readonly listeners = new Set<(np: NowPlaying) => void>()

  constructor(
    index: FingerprintIndex,
    private readonly feed: AudioFeed,
    minConfidence = FP_MIN_CONFIDENCE
  ) {
    this.detector = new LiveDetector(fingerprintMatcher(index), minConfidence)
  }

  async start(): Promise<void> {
    this.detector.reset()
    await this.feed.start((samples, atMs) => {
      const np = this.detector.observe(samples, atMs)
      for (const l of this.listeners) l(np)
    })
  }

  async stop(): Promise<void> {
    await this.feed.stop()
  }

  onUpdate(cb: (np: NowPlaying) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}
