import { describe, it, expect } from 'vitest'
import { detectReverseShazam } from '../src/utils/reverseShazamIntent'
import {
  computeReverseShazam,
  type ShazamSession
} from '../electron/algorithms/memory/reverseShazam'
import { buildWorld } from './eval/fixtures'

const NOW = new Date('2025-08-01T00:00:00.000Z')

describe('detectReverseShazam — recall by moment', () => {
  it('detects an occasion', () => {
    expect(detectReverseShazam("what was that track I played last New Year's Eve?")).toEqual({
      occasion: 'nye',
      position: undefined,
      clockHour: undefined
    })
  })
  it('detects occasion + opening position', () => {
    expect(detectReverseShazam('what did I open with on NYE')).toEqual({
      occasion: 'nye',
      position: 'first',
      clockHour: undefined
    })
  })
  it('detects a numeric track position', () => {
    const h = detectReverseShazam('the 3rd track I played last new years')
    expect(h?.position).toBe(3)
    expect(h?.occasion).toBe('nye')
  })
  it('detects a clock anchor', () => {
    expect(detectReverseShazam('what was that tune around 1am at new years')?.clockHour).toBe(1)
  })
  it('ignores plain gig recall with no moment anchor', () => {
    expect(detectReverseShazam('what did I play last Saturday')).toBeNull()
    expect(detectReverseShazam('build me a set')).toBeNull()
  })
})

describe('computeReverseShazam — resolve the moment', () => {
  it('returns the whole set for an occasion', () => {
    const w = buildWorld(NOW)
    const a = computeReverseShazam({ occasion: 'nye' }, w.tracks, w.sessions, w.now)
    expect(a.kind).toBe('gig')
    expect(a.session?.id).toBe('s-marathon') // 2024-12-31
    expect(a.tracks?.length).toBe(16)
  })

  it('picks the opening / closing / Nth track by play order', () => {
    const w = buildWorld(NOW)
    const open = computeReverseShazam(
      { occasion: 'nye', position: 'first' },
      w.tracks,
      w.sessions,
      w.now
    )
    const close = computeReverseShazam(
      { occasion: 'nye', position: 'last' },
      w.tracks,
      w.sessions,
      w.now
    )
    const third = computeReverseShazam(
      { occasion: 'nye', position: 3 },
      w.tracks,
      w.sessions,
      w.now
    )
    expect(open.tracks?.[0]?.id).toBe('fisher1')
    expect(close.tracks?.[0]?.id).toBe('body3')
    expect(third.tracks?.[0]?.id).toBe('fisher3')
  })

  it('uses per-track timestamps for a clock query when present', () => {
    const w = buildWorld(NOW)
    const session: ShazamSession = {
      id: 'nye-timed',
      performedAt: '2024-12-31',
      venue: 'The Cause',
      trackIds: ['fisher1', 'dc1', 'plastik1'],
      trackTimes: ['2024-12-31T23:30:00', '2025-01-01T00:45:00', '2025-01-01T01:10:00']
    }
    const a = computeReverseShazam({ occasion: 'nye', clockHour: 1 }, w.tracks, [session], w.now)
    expect(a.kind).toBe('tracks')
    expect(a.tracks?.[0]?.id).toBe('plastik1') // closest to 1am
  })

  it('degrades honestly when minute-level timing was not logged', () => {
    const w = buildWorld(NOW)
    const a = computeReverseShazam({ occasion: 'nye', clockHour: 1 }, w.tracks, w.sessions, w.now)
    expect(a.kind).toBe('gig')
    expect(a.narration).toMatch(/minute-by-minute/i)
  })

  it('is honest when the occasion never happened', () => {
    const w = buildWorld(NOW)
    const a = computeReverseShazam({ occasion: 'halloween' }, w.tracks, w.sessions, w.now)
    expect(a.kind).toBe('empty')
    expect(a.narration).toMatch(/No Halloween/)
  })
})
