import { describe, it, expect, vi } from 'vitest'
import {
  generateKeyPairSync,
  sign as cryptoSign,
  type KeyObject
} from 'crypto'

// licenseService eagerly imports keytar / electron-store / electron at module
// load. None are reachable in the node test env, and the logic under test
// (evaluateLicense) is pure anyway — every input arrives via ctx — so we stub
// the native deps just enough to let the import succeed.
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(async () => null),
    setPassword: vi.fn(async () => undefined),
    deletePassword: vi.fn(async () => true)
  }
}))
vi.mock('electron-store', () => ({
  default: class {
    private store = new Map<string, unknown>()
    get(key: string): unknown {
      return this.store.get(key)
    }
    set(key: string, value: unknown): void {
      this.store.set(key, value)
    }
    delete(key: string): void {
      this.store.delete(key)
    }
  }
}))
vi.mock('electron', () => ({ net: { request: vi.fn() } }))

import {
  verifyKey,
  evaluateLicense,
  evaluateTrial,
  TRIAL_DURATION_MS,
  type EvaluateContext
} from '../electron/services/licenseService'
import { LICENSE_KEY_PREFIX, type LicensePayload } from '../electron/services/licensing/signingKey'

// Ephemeral issuing authority for the tests — the real private key never lands
// in the repo, so we mint with a throwaway keypair and hand the matching public
// key to the verifier via ctx.publicKey.
const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const THIS_DEVICE = 'device-local-001'
const OTHER_DEVICE = 'device-other-999'

function mint(payload: LicensePayload, signer: KeyObject = privateKey): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = cryptoSign(null, Buffer.from(payloadB64), signer).toString('base64url')
  return `${LICENSE_KEY_PREFIX}.${payloadB64}.${sig}`
}

function ctx(overrides: Partial<EvaluateContext> = {}): EvaluateContext {
  return {
    deviceId: THIS_DEVICE,
    now: Date.UTC(2026, 0, 1),
    lastSeenAt: null,
    online: null,
    publicKey,
    ...overrides
  }
}

const baseV1: LicensePayload = {
  v: 1,
  id: 'lic-v1',
  plan: 'lifetime',
  email: 'dj@example.com',
  issuedAt: '2025-01-01T00:00:00.000Z'
}

describe('verifyKey', () => {
  it('accepts a well-formed signed v1 key', () => {
    const res = verifyKey(mint(baseV1), publicKey)
    expect(res.ok).toBe(true)
  })

  it('rejects a malformed (non-tripartite) key', () => {
    const res = verifyKey('not-a-key', publicKey)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('malformed')
  })

  it('rejects a key signed by the wrong authority', () => {
    const { privateKey: rogue } = generateKeyPairSync('ed25519')
    const res = verifyKey(mint(baseV1, rogue), publicKey)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('bad-signature')
  })

  it('rejects a tampered payload', () => {
    const good = mint(baseV1)
    const [prefix, , sig] = good.split('.')
    const forged = Buffer.from(JSON.stringify({ ...baseV1, plan: 'subscription' })).toString(
      'base64url'
    )
    const res = verifyKey(`${prefix}.${forged}.${sig}`, publicKey)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('bad-signature')
  })
})

describe('evaluateLicense — backward compatibility', () => {
  it('treats a v1 key as a portable, active Pro license anywhere', () => {
    const { state } = evaluateLicense(mint(baseV1), ctx({ deviceId: OTHER_DEVICE }))
    expect(state.tier).toBe('pro')
    expect(state.status).toBe('active')
    expect(state.deviceBound).toBe(false)
  })
})

describe('evaluateLicense — device binding', () => {
  it('unlocks a key bound to this device', () => {
    const key = mint({ ...baseV1, v: 2, id: 'lic-bound', deviceId: THIS_DEVICE })
    const { state } = evaluateLicense(key, ctx())
    expect(state.tier).toBe('pro')
    expect(state.status).toBe('active')
    expect(state.deviceBound).toBe(true)
  })

  it('rejects a key bound to another device', () => {
    const key = mint({ ...baseV1, v: 2, id: 'lic-bound', deviceId: OTHER_DEVICE })
    const { state } = evaluateLicense(key, ctx())
    expect(state.tier).toBe('free')
    expect(state.status).toBe('device-mismatch')
  })

  it('honours an explicit portable flag on a v2 key everywhere', () => {
    const key = mint({ ...baseV1, v: 2, id: 'lic-port', deviceId: OTHER_DEVICE, portable: true })
    const { state } = evaluateLicense(key, ctx())
    expect(state.tier).toBe('pro')
    expect(state.status).toBe('active')
    expect(state.portable).toBe(true)
  })
})

describe('evaluateLicense — subscription expiry & clock rollback', () => {
  const sub: LicensePayload = {
    v: 1,
    id: 'lic-sub',
    plan: 'subscription',
    email: 'dj@example.com',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-02-01T00:00:00.000Z'
  }

  it('is active before expiry', () => {
    const { state } = evaluateLicense(mint(sub), ctx({ now: Date.UTC(2026, 0, 15) }))
    expect(state.status).toBe('active')
  })

  it('is expired after expiry', () => {
    const { state } = evaluateLicense(mint(sub), ctx({ now: Date.UTC(2026, 2, 1) }))
    expect(state.tier).toBe('free')
    expect(state.status).toBe('expired')
  })

  it('cannot be revived by winding the clock back below expiry', () => {
    // We have already "seen" a clock well past expiry; rolling now back to before
    // expiry must not resurrect the sub, because effectiveNow = max(now, lastSeen).
    const { state } = evaluateLicense(
      mint(sub),
      ctx({ now: Date.UTC(2026, 0, 10), lastSeenAt: '2026-03-01T00:00:00.000Z' })
    )
    expect(state.status).toBe('expired')
    expect(state.clockWarning).toBe(true)
  })

  it('advances the clock high-water mark forward only', () => {
    const { nextLastSeenAt } = evaluateLicense(
      mint(sub),
      ctx({ now: Date.UTC(2026, 0, 5), lastSeenAt: '2026-03-01T00:00:00.000Z' })
    )
    expect(nextLastSeenAt).toBe('2026-03-01T00:00:00.000Z')
  })
})

describe('evaluateLicense — online revocation & expiry override', () => {
  it('downgrades a revoked license even when the signature is valid', () => {
    const { state } = evaluateLicense(
      mint(baseV1),
      ctx({
        online: {
          licenseId: 'lic-v1',
          checkedAt: '2026-01-01T00:00:00.000Z',
          revoked: true,
          expiresAtOverride: null
        }
      })
    )
    expect(state.tier).toBe('free')
    expect(state.status).toBe('revoked')
  })

  it('ignores a revocation verdict meant for a different license id', () => {
    const { state } = evaluateLicense(
      mint(baseV1),
      ctx({
        online: {
          licenseId: 'some-other-license',
          checkedAt: '2026-01-01T00:00:00.000Z',
          revoked: true,
          expiresAtOverride: null
        }
      })
    )
    expect(state.tier).toBe('pro')
    expect(state.status).toBe('active')
  })

  it('tightens expiry when the server override is earlier than now', () => {
    const { state } = evaluateLicense(
      mint(baseV1),
      ctx({
        now: Date.UTC(2026, 5, 1),
        online: {
          licenseId: 'lic-v1',
          checkedAt: '2026-01-01T00:00:00.000Z',
          revoked: false,
          expiresAtOverride: '2026-03-01T00:00:00.000Z'
        }
      })
    )
    expect(state.tier).toBe('free')
    expect(state.status).toBe('expired')
  })
})

describe('evaluateTrial — free post-import Pro trial', () => {
  const START = '2026-01-01T00:00:00.000Z'
  const startMs = Date.parse(START)

  it('is active on the day it starts, with the full window remaining', () => {
    const t = evaluateTrial(START, startMs, null)
    expect(t.active).toBe(true)
    expect(t.daysRemaining).toBe(7)
    expect(t.endsAt).toBe(new Date(startMs + TRIAL_DURATION_MS).toISOString())
  })

  it('counts down as time passes but never reports below 1 day while active', () => {
    const almostOver = startMs + TRIAL_DURATION_MS - 60_000 // one minute left
    const t = evaluateTrial(START, almostOver, null)
    expect(t.active).toBe(true)
    expect(t.daysRemaining).toBe(1)
  })

  it('expires once the window elapses', () => {
    const t = evaluateTrial(START, startMs + TRIAL_DURATION_MS, null)
    expect(t.active).toBe(false)
    expect(t.daysRemaining).toBe(0)
  })

  it('cannot be extended by winding the clock back below the high-water mark', () => {
    // The app has already "seen" a clock past the trial end; rewinding now to the
    // first day must not revive the trial, because effectiveNow = max(now, lastSeen).
    const seenPastEnd = new Date(startMs + TRIAL_DURATION_MS + 1).toISOString()
    const t = evaluateTrial(START, startMs + 1000, seenPastEnd)
    expect(t.active).toBe(false)
    expect(t.daysRemaining).toBe(0)
  })
})
