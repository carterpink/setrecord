import { describe, it, expect } from 'vitest'
import { classifyLifecycle, classifyAll } from '../electron/algorithms/memory/lifecycle'
import { makeTrack } from './fixtures'

const NOW = new Date('2026-01-01T00:00:00Z')

function daysBack(n: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe('classifyLifecycle', () => {
  it('returns "new" for track added within 30 days and never played', () => {
    const t = makeTrack({ playCount: 0, dateAdded: daysBack(10) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('new')
  })

  it('returns "untested" for track added > 30 days ago and never played', () => {
    const t = makeTrack({ playCount: 0, dateAdded: daysBack(60) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('untested')
  })

  it('returns "testing" for 1-play track', () => {
    const t = makeTrack({ playCount: 1, lastPlayed: daysBack(20), dateAdded: daysBack(90) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('testing')
  })

  it('returns "testing" for 3-play track', () => {
    const t = makeTrack({ playCount: 3, lastPlayed: daysBack(30), dateAdded: daysBack(120) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('testing')
  })

  it('returns "active" for 4+ plays and played within 90 days', () => {
    const t = makeTrack({ playCount: 6, lastPlayed: daysBack(60), dateAdded: daysBack(180) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('active')
  })

  it('returns "peak" for 10+ plays played within 90 days', () => {
    const t = makeTrack({ playCount: 15, lastPlayed: daysBack(30), dateAdded: daysBack(365) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('peak')
  })

  it('returns "occasional" for track played 90–365 days ago', () => {
    const t = makeTrack({ playCount: 5, lastPlayed: daysBack(180), dateAdded: daysBack(365) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('occasional')
  })

  it('returns "archive" for track last played 1–3 years ago', () => {
    const t = makeTrack({ playCount: 5, lastPlayed: daysBack(500), dateAdded: daysBack(1000) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('archive')
  })

  it('returns "forgotten" for track last played >3 years ago', () => {
    const t = makeTrack({ playCount: 8, lastPlayed: daysBack(1200), dateAdded: daysBack(1500) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('forgotten')
  })

  it('treats high-playCount track played >365 days as "archive" not "peak"', () => {
    const t = makeTrack({ playCount: 20, lastPlayed: daysBack(400), dateAdded: daysBack(800) })
    expect(classifyLifecycle(t, { now: NOW })).toBe('archive')
  })

  it('uses current date when ctx.now is omitted', () => {
    // Should not throw
    const t = makeTrack({
      playCount: 0,
      dateAdded: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    })
    expect(() => classifyLifecycle(t)).not.toThrow()
  })
})

describe('classifyAll', () => {
  it('returns a Map with an entry per track', () => {
    const tracks = [
      makeTrack({ id: 't1', playCount: 0, dateAdded: daysBack(5) }),
      makeTrack({ id: 't2', playCount: 5, lastPlayed: daysBack(30), dateAdded: daysBack(200) })
    ]
    const map = classifyAll(tracks, { now: NOW })
    expect(map.size).toBe(2)
    expect(map.get('t1')).toBe('new')
    expect(map.get('t2')).toBe('active')
  })

  it('returns empty Map for empty library', () => {
    expect(classifyAll([], { now: NOW }).size).toBe(0)
  })
})
