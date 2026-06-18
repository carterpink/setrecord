import { describe, it, expect, beforeEach } from 'vitest'
import {
  startLive,
  stopLive,
  beginRecordingSession,
  setLiveVenue,
  finalizeLiveSession,
  processDetectedTrack
} from '../electron/services/live/liveEngine'
import { makeTrack } from './fixtures'

/**
 * The Flight Recorder accumulator inside the live engine: it taps the SAME
 * debounced commit stream that drives the HUD, so a committed track only lands
 * once the LiveDetector commits it (2 consecutent detections). These tests drive
 * processDetectedTrack (the screen/metadata sensor path) so no real audio/ffmpeg
 * is involved.
 */
const LIB = [
  makeTrack({ id: 't1', title: 'Nocturne Drive', artist: 'Lunar Bloc' }),
  makeTrack({ id: 't2', title: 'Escape Velocity', artist: 'Vela' })
]

/** Commit a track by feeding it twice (LIVE_COMMIT_STREAK = 2). */
function commit(trackId: string, atMs: number): void {
  processDetectedTrack(trackId, 0.9, atMs)
  processDetectedTrack(trackId, 0.9, atMs)
}

beforeEach(() => {
  // Clear any accumulator/detector left over from a previous test.
  finalizeLiveSession(0)
  stopLive()
})

describe('live flight recorder', () => {
  it('records committed tracks in order with lag-corrected, non-overlapping timing', () => {
    const t0 = 1_000_000
    startLive(LIB)
    beginRecordingSession(t0)

    commit('t1', t0 + 3000) // committed at +3s; COMMIT_LAG_MS (3s) → startMs 0
    commit('t2', t0 + 31_500) // committed at +31.5s → startMs 28.5s

    const result = finalizeLiveSession(t0 + 60_000)
    expect(result).not.toBeNull()
    expect(result!.durationMs).toBe(60_000)
    expect(result!.entries).toEqual([
      {
        trackId: 't1',
        title: 'Nocturne Drive',
        artist: 'Lunar Bloc',
        startMs: 0,
        endMs: 28_500,
        matchOffsetSec: 0
      },
      {
        trackId: 't2',
        title: 'Escape Velocity',
        artist: 'Vela',
        startMs: 28_500,
        endMs: 60_000,
        matchOffsetSec: 0
      }
    ])
  })

  it('does not double-log the current track when startLive re-wires mid-session', () => {
    const t0 = 2_000_000
    startLive(LIB)
    beginRecordingSession(t0)
    commit('t1', t0 + 3000)

    // The index build finishes and the engine re-wires the audio matcher by
    // calling startLive again — this must NOT reset or duplicate the recording.
    startLive(LIB)
    commit('t1', t0 + 10_000) // t1 still playing → re-committed, but already logged

    const result = finalizeLiveSession(t0 + 20_000)
    expect(result!.entries.map((e) => e.trackId)).toEqual(['t1'])
  })

  it('captures the chosen venue and is idempotent on a second finalize', () => {
    startLive(LIB)
    beginRecordingSession(5_000_000)
    setLiveVenue('Warehouse')
    commit('t1', 5_003_000)

    const first = finalizeLiveSession(5_060_000)
    expect(first!.venue).toBe('Warehouse')
    expect(finalizeLiveSession(5_060_000)).toBeNull()
  })

  it('returns null when nothing was armed', () => {
    expect(finalizeLiveSession(9_000_000)).toBeNull()
  })
})
