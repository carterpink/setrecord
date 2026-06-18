/**
 * Tests for the retention/activation progress service (brief #22, Phase B):
 *   - weekOrdinal: Monday-based week math
 *   - computeStreak: pure weekly-streak transitions
 *   - markFirst: write-once activation timestamps
 *   - claimMilestone: fires exactly once
 *   - recordActivity: streak increment / reset across week boundaries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// electron-store needs Electron's app paths and writes a real file. Replace it
// with a tiny in-memory implementation so the service logic runs in plain Node.
vi.mock('electron-store', () => ({
  default: class {
    private data: Record<string, unknown>
    constructor(opts: { defaults: Record<string, unknown> }) {
      this.data = { ...opts.defaults }
    }
    get(key: string): unknown {
      return this.data[key]
    }
    set(key: string | Record<string, unknown>, value?: unknown): void {
      if (typeof key === 'object') this.data = { ...this.data, ...key }
      else this.data[key] = value
    }
  }
}))

import {
  weekOrdinal,
  computeStreak,
  markFirst,
  claimMilestone,
  recordActivity,
  getProgress,
  clearProgress
} from '../electron/services/progressService'

const DAY = 86_400_000
const WEEK = 7 * DAY

beforeEach(() => {
  clearProgress()
})

describe('weekOrdinal', () => {
  it('increments by exactly 1 every 7 days', () => {
    const t = 1_700_000_000_000 // arbitrary fixed instant
    expect(weekOrdinal(t + WEEK) - weekOrdinal(t)).toBe(1)
    expect(weekOrdinal(t + 3 * WEEK) - weekOrdinal(t)).toBe(3)
  })

  it('ticks over on Monday (2024-01-01 is a Monday)', () => {
    const monday = Date.UTC(2024, 0, 1) // Mon
    const sunday = Date.UTC(2024, 0, 7) // Sun, same week
    const nextMonday = Date.UTC(2024, 0, 8) // Mon, next week
    expect(weekOrdinal(monday)).toBe(weekOrdinal(sunday))
    expect(weekOrdinal(nextMonday)).toBe(weekOrdinal(monday) + 1)
  })
})

describe('computeStreak', () => {
  it('starts at 1 with no prior activity', () => {
    expect(computeStreak(null, 0, 100)).toEqual({ currentStreak: 1, changed: true })
  })
  it('does not change within the same week', () => {
    expect(computeStreak(100, 3, 100)).toEqual({ currentStreak: 3, changed: false })
  })
  it('extends from the immediately-previous week', () => {
    expect(computeStreak(99, 3, 100)).toEqual({ currentStreak: 4, changed: true })
  })
  it('resets after a gap', () => {
    expect(computeStreak(97, 9, 100)).toEqual({ currentStreak: 1, changed: true })
  })
})

describe('markFirst (write-once)', () => {
  it('records a timestamp once and never overwrites it', () => {
    markFirst('import', 1000)
    const first = getProgress().firstImportAt
    expect(first).not.toBeNull()
    markFirst('import', 9_999_999) // later call must be a no-op
    expect(getProgress().firstImportAt).toBe(first)
  })

  it('tracks each funnel event independently', () => {
    markFirst('suggestion', 1000)
    expect(getProgress().firstSuggestionSeenAt).not.toBeNull()
    expect(getProgress().firstSetStartedAt).toBeNull()
  })
})

describe('claimMilestone', () => {
  it('returns true only on the first claim', () => {
    expect(claimMilestone('first_set')).toBe(true)
    expect(claimMilestone('first_set')).toBe(false)
    expect(getProgress().milestonesSeen).toEqual(['first_set'])
  })
})

describe('recordActivity (weekly streak)', () => {
  it('builds a streak across consecutive weeks and resets on a gap', () => {
    const base = 1_700_000_000_000
    expect(recordActivity(base).currentStreak).toBe(1)
    // Same week again → no change
    expect(recordActivity(base + DAY).currentStreak).toBe(1)
    // Next two weeks → 2, 3
    expect(recordActivity(base + WEEK).currentStreak).toBe(2)
    expect(recordActivity(base + 2 * WEEK).currentStreak).toBe(3)
    // Skip a week → reset to 1, but longest is retained
    const afterGap = recordActivity(base + 5 * WEEK)
    expect(afterGap.currentStreak).toBe(1)
    expect(afterGap.longestStreak).toBe(3)
  })
})
