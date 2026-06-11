/**
 * Durable anti-abuse anchors (licenseAnchors.ts) + their reconciliation with the
 * user-editable electron-store JSON in trialStore.ts / licenseLocalStore.ts.
 *
 * The vulnerability these close: the 7-day Pro trial and the clock-rollback guard
 * used to live ONLY in plaintext JSON, so deleting trial-state.json / license-
 * state.json — or a Fresh Start, which clears the same JSON — re-armed an
 * unlimited supply of fresh trials and reset the guard. The fix mirrors both into
 * the OS keychain. These tests model a JSON wipe (clear the store) + a process
 * restart (drop the in-memory cache, reload from the keychain) and assert the
 * trial can NOT be re-armed and the clock can NOT be rolled back.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Hoisted so the vi.mock factories (which run before module init) can close over
// the same instances the tests manipulate.
const { keychain, stores } = vi.hoisted(() => ({
  // Stateful keychain — a real backing Map so set/getPassword persist across a
  // simulated restart (the production keychain's whole job).
  keychain: new Map<string, string>(),
  // Every electron-store instance's backing Map, so a test can wipe them all to
  // model a deleted JSON file.
  stores: [] as Array<Map<string, unknown>>
}))

vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(
      async (service: string, account: string) => keychain.get(`${service}:${account}`) ?? null
    ),
    setPassword: vi.fn(async (service: string, account: string, value: string) => {
      keychain.set(`${service}:${account}`, value)
    }),
    deletePassword: vi.fn(async (service: string, account: string) =>
      keychain.delete(`${service}:${account}`)
    )
  }
}))

vi.mock('electron-store', () => ({
  default: class {
    store = new Map<string, unknown>()
    constructor() {
      stores.push(this.store)
    }
    get(key: string): unknown {
      return this.store.get(key)
    }
    set(key: string, value: unknown): void {
      this.store.set(key, value)
    }
    delete(key: string): void {
      this.store.delete(key)
    }
    clear(): void {
      this.store.clear()
    }
  }
}))

import {
  earliestIso,
  latestIso,
  loadLicenseAnchors,
  getDurableTrialStartedAt,
  __clearDurableAnchorsForTest,
  __resetAnchorMemoryForTest
} from '../electron/services/licensing/licenseAnchors'
import {
  getTrialStartedAt,
  startTrial,
  clearTrial
} from '../electron/services/licensing/trialStore'
import { getLastSeenAt, recordSeenNow } from '../electron/services/licensing/licenseLocalStore'

/** Wipe every electron-store-backed JSON — models `rm *-state.json` / Fresh Start file delete. */
function wipeAllJson(): void {
  for (const s of stores) s.clear()
}

const T0 = Date.UTC(2026, 0, 1) // trial start
const HOUR = 60 * 60 * 1000

describe('earliestIso / latestIso', () => {
  it('treat null as absent', () => {
    expect(earliestIso(null, '2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z')
    expect(earliestIso('2026-01-01T00:00:00.000Z', null)).toBe('2026-01-01T00:00:00.000Z')
    expect(earliestIso(null, null)).toBeNull()
    expect(latestIso(null, null)).toBeNull()
  })

  it('pick the correct extreme', () => {
    const early = '2026-01-01T00:00:00.000Z'
    const late = '2026-06-01T00:00:00.000Z'
    expect(earliestIso(late, early)).toBe(early)
    expect(earliestIso(early, late)).toBe(early)
    expect(latestIso(early, late)).toBe(late)
    expect(latestIso(late, early)).toBe(late)
  })

  it('fall back to the parseable side when one is garbage', () => {
    expect(earliestIso('not-a-date', '2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z')
    expect(latestIso('2026-01-01T00:00:00.000Z', 'not-a-date')).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('trial cannot be farmed by wiping JSON / Fresh Start', () => {
  beforeEach(async () => {
    keychain.clear()
    wipeAllJson()
    __clearDurableAnchorsForTest()
    await loadLicenseAnchors() // pristine device
  })

  it('arms exactly once on a fresh device', () => {
    expect(startTrial(T0)).toBe(true)
    expect(getTrialStartedAt()).toBe(new Date(T0).toISOString())
    // Already armed → no re-arm even with a later clock.
    expect(startTrial(T0 + 10 * 24 * HOUR)).toBe(false)
  })

  it('survives a Fresh Start (clearTrial clears JSON, keychain remembers)', () => {
    startTrial(T0)
    clearTrial() // Fresh Start path — wipes trial-state.json only
    // The durable anchor still reports the original start...
    expect(getTrialStartedAt()).toBe(new Date(T0).toISOString())
    // ...so re-arming is refused.
    expect(startTrial(T0 + 10 * 24 * HOUR)).toBe(false)
  })

  it('survives a full JSON delete + app restart', async () => {
    startTrial(T0)
    expect(getDurableTrialStartedAt()).toBe(new Date(T0).toISOString())

    // Model: user deletes every *-state.json AND the app restarts (memory lost).
    wipeAllJson()
    __resetAnchorMemoryForTest()
    expect(getDurableTrialStartedAt()).toBeNull() // memory really was dropped
    await loadLicenseAnchors() // rehydrate from the keychain

    expect(getTrialStartedAt()).toBe(new Date(T0).toISOString())
    expect(startTrial(T0 + 10 * 24 * HOUR)).toBe(false)
  })
})

describe('clock-rollback guard cannot be reset by wiping JSON', () => {
  beforeEach(async () => {
    keychain.clear()
    wipeAllJson()
    __clearDurableAnchorsForTest()
    await loadLicenseAnchors()
  })

  it('persists the high-water mark to the keychain and restores it after a wipe', async () => {
    const seen = Date.UTC(2026, 5, 1)
    recordSeenNow(seen) // crosses the 1h persist threshold from zero → keychain write
    expect(getLastSeenAt()).toBe(new Date(seen).toISOString())

    // Delete JSON + restart.
    wipeAllJson()
    __resetAnchorMemoryForTest()
    await loadLicenseAnchors()

    // The furthest clock survives, so a later read can't pretend time went backward.
    expect(getLastSeenAt()).toBe(new Date(seen).toISOString())
    expect(latestIso(getLastSeenAt(), new Date(seen - 30 * 24 * HOUR).toISOString())).toBe(
      new Date(seen).toISOString()
    )
  })
})
