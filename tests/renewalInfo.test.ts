import { describe, it, expect } from 'vitest'
import { computeRenewal, RENEWAL_NOTICE_DAYS } from '../src/stores/licenseStore'

// Fixed clock so the day math is deterministic (no Date.now() in assertions).
const NOW = Date.parse('2026-06-04T00:00:00.000Z')
const inDays = (n: number): string => new Date(NOW + n * 86_400_000).toISOString()

describe('computeRenewal — pre-expiry renewal nudge', () => {
  it('flags an active subscription inside the notice window', () => {
    const r = computeRenewal('active', 'subscription', inDays(10), NOW)
    expect(r.expiringSoon).toBe(true)
    expect(r.daysRemaining).toBe(10)
  })

  it('does not flag a subscription beyond the window', () => {
    const r = computeRenewal('active', 'subscription', inDays(RENEWAL_NOTICE_DAYS + 5), NOW)
    expect(r.expiringSoon).toBe(false)
  })

  it('flags right at the window boundary', () => {
    expect(
      computeRenewal('active', 'subscription', inDays(RENEWAL_NOTICE_DAYS), NOW).expiringSoon
    ).toBe(true)
  })

  it('never nags a lifetime key (no expiry)', () => {
    expect(computeRenewal('active', 'lifetime', null, NOW).expiringSoon).toBe(false)
  })

  it('ignores trials and non-active states', () => {
    expect(computeRenewal('trial', 'subscription', inDays(5), NOW).expiringSoon).toBe(false)
    expect(computeRenewal('expired', 'subscription', inDays(-1), NOW).expiringSoon).toBe(false)
    expect(computeRenewal('none', null, null, NOW).expiringSoon).toBe(false)
  })

  it('does not flag an already-lapsed key, and floors days at 0', () => {
    const r = computeRenewal('active', 'subscription', inDays(-2), NOW)
    expect(r.expiringSoon).toBe(false)
    expect(r.daysRemaining).toBe(0)
  })

  it('is robust to an unparseable expiry', () => {
    expect(computeRenewal('active', 'subscription', 'not-a-date', NOW).expiringSoon).toBe(false)
  })
})
