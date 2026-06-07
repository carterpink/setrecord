/**
 * LiveDetector debounce/gating state machine. Uses an injected fake matcher so
 * the logic is tested precisely without real audio.
 */
import { describe, it, expect } from 'vitest'
import {
  LiveDetector,
  LIVE_COMMIT_STREAK,
  LIVE_DROP_STREAK,
  type Matcher
} from '../electron/services/live/liveSource'
import type { MatchResult } from '../electron/services/live/fingerprint'

const PROBE = new Float32Array(0) // ignored by the fake matcher

/** Matcher that returns one scripted result-set per call (last one repeats). */
function scripted(seq: Array<MatchResult[]>): Matcher {
  let i = 0
  return () => seq[Math.min(i++, seq.length - 1)]
}
const hit = (id: string, confidence = 0.8, offsetSec = 10): MatchResult[] => [
  { id, score: 100, confidence, offsetSec }
]
const lowConf = (id = 'X'): MatchResult[] => [{ id, score: 5, confidence: 0.1, offsetSec: 0 }]
const noMatch = (): MatchResult[] => []

describe('LiveDetector', () => {
  it('requires a streak before committing a newly detected track', () => {
    const d = new LiveDetector(scripted([hit('A'), hit('A'), hit('A')]))
    expect(LIVE_COMMIT_STREAK).toBe(2)
    expect(d.observe(PROBE, 1000).trackId).toBeNull() // streak 1 — not yet
    expect(d.observe(PROBE, 2000).trackId).toBe('A') // streak 2 — committed
    expect(d.observe(PROBE, 3000).trackId).toBe('A')
  })

  it('keeps the committed track through brief low-confidence windows', () => {
    const d = new LiveDetector(scripted([hit('A'), hit('A'), lowConf(), lowConf(), lowConf()]))
    d.observe(PROBE, 1000)
    expect(d.observe(PROBE, 2000).trackId).toBe('A') // committed
    expect(LIVE_DROP_STREAK).toBe(3)
    expect(d.observe(PROBE, 3000).trackId).toBe('A') // low 1 — hold
    expect(d.observe(PROBE, 4000).trackId).toBe('A') // low 2 — hold
    expect(d.observe(PROBE, 5000).trackId).toBeNull() // low 3 — drop to listening
  })

  it('ignores a one-window fluke of a different track', () => {
    const d = new LiveDetector(scripted([hit('A'), hit('A'), hit('B'), hit('A')]))
    d.observe(PROBE, 1000)
    d.observe(PROBE, 2000) // commit A
    expect(d.observe(PROBE, 3000).trackId).toBe('A') // single B — ignored
    expect(d.observe(PROBE, 4000).trackId).toBe('A') // back to A
  })

  it('switches tracks after a sustained new detection', () => {
    const d = new LiveDetector(scripted([hit('A'), hit('A'), hit('B'), hit('B')]))
    d.observe(PROBE, 1000)
    d.observe(PROBE, 2000) // commit A
    expect(d.observe(PROBE, 3000).trackId).toBe('A') // B streak 1
    expect(d.observe(PROBE, 4000).trackId).toBe('B') // B streak 2 — switch
  })

  it('treats no-match and below-floor confidence as "listening"', () => {
    const d = new LiveDetector(scripted([noMatch(), lowConf(), noMatch()]))
    expect(d.observe(PROBE, 1000).trackId).toBeNull()
    expect(d.observe(PROBE, 2000).trackId).toBeNull()
    expect(d.observe(PROBE, 3000).trackId).toBeNull()
  })

  it('refreshes confidence and position when the committed track persists', () => {
    const d = new LiveDetector(scripted([hit('A', 0.8, 10), hit('A', 0.8, 10), hit('A', 0.95, 22)]))
    d.observe(PROBE, 1000)
    d.observe(PROBE, 2000)
    const np = d.observe(PROBE, 3000)
    expect(np.trackId).toBe('A')
    expect(np.confidence).toBeCloseTo(0.95)
    expect(np.positionSec).toBeCloseTo(22)
    expect(np.at).toBe(3000)
  })

  it('reset() clears all state', () => {
    const d = new LiveDetector(scripted([hit('A'), hit('A'), hit('A')]))
    d.observe(PROBE, 1000)
    d.observe(PROBE, 2000)
    d.reset()
    expect(d.observe(PROBE, 3000).trackId).toBeNull() // streak restarts from scratch
  })
})
