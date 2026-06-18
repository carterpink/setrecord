import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateKeyPairSync, createPrivateKey, sign as cryptoSign } from 'crypto'
import {
  parseActivationUrl,
  checkoutUrl,
  ACTIVATION_DEEP_LINK,
  ACTIVATION_SCHEME,
  LICENSE_KEY_PREFIX
} from '../electron/services/licensing/signingKey'

// Mocks must be declared before any import that transitively needs them.
// vi.mock() is hoisted to the top of the file by Vitest at transform time.

// ─── URL parsing ─────────────────────────────────────────────────────────────

describe('parseActivationUrl', () => {
  it('extracts the key from a well-formed activation deep-link', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=SES1.payload.sig`)).toBe(
      'SES1.payload.sig'
    )
  })

  it('accepts the triple-slash shape where activate is a path segment', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}:///activate?key=TEST`)).toBe('TEST')
  })

  it('trims surrounding whitespace from the key', () => {
    expect(
      parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=${encodeURIComponent(' SES1.x ')}`)
    ).toBe('SES1.x')
  })

  it('rejects a foreign scheme', () => {
    expect(parseActivationUrl('https://setrecord.app/activate?key=SES1.x')).toBeNull()
  })

  it('rejects the right scheme but wrong action', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://checkout?key=SES1.x`)).toBeNull()
  })

  it('rejects a link with no key', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate`)).toBeNull()
  })

  it('rejects an absurdly long key rather than passing it downstream', () => {
    const huge = 'A'.repeat(2000)
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=${huge}`)).toBeNull()
  })

  it('returns null for garbage input instead of throwing', () => {
    expect(parseActivationUrl('not a url')).toBeNull()
  })
})

describe('checkoutUrl', () => {
  it('appends the activation deep-link as the return context for plan checkout', () => {
    const url = new URL(checkoutUrl('lifetime'))
    expect(url.searchParams.get('plan')).toBe('lifetime')
    expect(url.searchParams.get('redirect')).toBe(ACTIVATION_DEEP_LINK)
  })

  it('carries both the tip amount and the redirect for the support path', () => {
    const url = new URL(checkoutUrl('tip', 25))
    expect(url.searchParams.get('amount')).toBe('25')
    expect(url.searchParams.get('redirect')).toBe(ACTIVATION_DEEP_LINK)
  })
})

// ─── Full deep-link activation path ──────────────────────────────────────────
// These tests exercise the complete chain:
//   setrecord://activate?key=SES1.… → parseActivationUrl → activateLicense
//   → Ed25519 verify → store in keychain → return Pro state
//
// licenseService imports keytar, electron-store, and electron (for gateway net
// requests). None are available in the Node test runner, so we stub them at the
// module level before importing licenseService.

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

// Gateway uses electron.net — stub so activate() stays offline (returns unreachable)
vi.mock('electron', () => ({ net: { request: vi.fn() } }))

// Import keytar AFTER vi.mock() declarations so we get the mocked instance.
import keytar from 'keytar'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mint a real Ed25519-signed key with an ephemeral keypair. */
function mintKey(
  privateKeyPem: string,
  overrides: Record<string, unknown> = {}
): { rawKey: string; payloadB64: string } {
  const payload = {
    v: 1,
    id: 'test-order-1',
    plan: 'lifetime',
    email: 'dj@test.com',
    issuedAt: new Date().toISOString(),
    ...overrides
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const privKey = createPrivateKey(privateKeyPem)
  const sig = cryptoSign(null, Buffer.from(payloadB64), privKey).toString('base64url')
  return { rawKey: `${LICENSE_KEY_PREFIX}.${payloadB64}.${sig}`, payloadB64 }
}

/** Build the activation deep-link URL for a raw key. */
function toDeepLink(rawKey: string): string {
  return `${ACTIVATION_SCHEME}://activate?key=${encodeURIComponent(rawKey)}`
}

describe('full deep-link activation path', () => {
  // Generate a fresh Ed25519 keypair for each test group so tests are
  // self-contained and never share state with the production public key.
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string

  beforeEach(() => {
    // Reset keytar mock state between tests so stored keys don't bleed across.
    vi.mocked(keytar.getPassword).mockResolvedValue(null)
    vi.mocked(keytar.setPassword).mockResolvedValue(undefined)
  })

  it('parseActivationUrl → activateLicense resolves to Pro for a valid key', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')
    const { __setDeviceIdForTest } = await import('../electron/services/licensing/deviceId')
    __setDeviceIdForTest('test-device-abc')

    const { rawKey } = mintKey(privateKeyPem)
    const deepLink = toDeepLink(rawKey)

    // Step 1 — extract the key from the URL
    const extracted = parseActivationUrl(deepLink)
    expect(extracted).toBe(rawKey)

    // Step 2 — activate (inject the ephemeral public key so the embedded key isn't used)
    const result = await activateLicense(extracted!, publicKey)
    expect(result.ok).toBe(true)
    expect(result.state.tier).toBe('pro')
    expect(result.state.plan).toBe('lifetime')
    expect(result.state.buyerEmail).toBe('dj@test.com')
  })

  it('a tampered key embedded in a deep-link is rejected at the signature step', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')

    const { rawKey } = mintKey(privateKeyPem)
    // Corrupt the payload segment so the signature no longer matches
    const parts = rawKey.split('.')
    parts[1] = Buffer.from(JSON.stringify({ v: 1, plan: 'lifetime', email: 'hacker@bad.com', id: 'x', issuedAt: new Date().toISOString() })).toString('base64url')
    const tamperedKey = parts.join('.')
    const deepLink = toDeepLink(tamperedKey)

    const extracted = parseActivationUrl(deepLink)
    expect(extracted).not.toBeNull()

    const result = await activateLicense(extracted!, publicKey)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('bad-signature')
    expect(result.state.tier).toBe('free')
  })

  it('a key from a different private key (wrong issuer) is rejected', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')

    // Mint with a second, unrelated keypair
    const { privateKey: otherPrivKey } = generateKeyPairSync('ed25519')
    const otherPem = otherPrivKey.export({ format: 'pem', type: 'pkcs8' }) as string
    const { rawKey } = mintKey(otherPem)
    const deepLink = toDeepLink(rawKey)

    const extracted = parseActivationUrl(deepLink)!
    // Verify against our *first* public key — the signature won't match
    const result = await activateLicense(extracted, publicKey)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('bad-signature')
  })

  it('a device-bound key in a deep-link is rejected on a different device', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')
    const { __setDeviceIdForTest } = await import('../electron/services/licensing/deviceId')
    __setDeviceIdForTest('device-B')

    const { rawKey } = mintKey(privateKeyPem, { v: 2, deviceId: 'device-A' })
    const deepLink = toDeepLink(rawKey)

    const extracted = parseActivationUrl(deepLink)!
    const result = await activateLicense(extracted, publicKey)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('device-mismatch')
  })

  it('a device-bound key in a deep-link activates on the correct device', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')
    const { __setDeviceIdForTest } = await import('../electron/services/licensing/deviceId')
    __setDeviceIdForTest('device-C')

    const { rawKey } = mintKey(privateKeyPem, { v: 2, deviceId: 'device-C' })
    const deepLink = toDeepLink(rawKey)

    const extracted = parseActivationUrl(deepLink)!
    const result = await activateLicense(extracted, publicKey)
    expect(result.ok).toBe(true)
    expect(result.state.deviceBound).toBe(true)
    expect(result.state.tier).toBe('pro')
  })

  it('an expired subscription in a deep-link stores but returns ok:false + expired status', async () => {
    const { activateLicense } = await import('../electron/services/licenseService')
    const { __setDeviceIdForTest } = await import('../electron/services/licensing/deviceId')
    __setDeviceIdForTest('device-exp')

    const pastExpiry = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { rawKey } = mintKey(privateKeyPem, { plan: 'subscription', expiresAt: pastExpiry })
    const deepLink = toDeepLink(rawKey)

    const extracted = parseActivationUrl(deepLink)!
    const result = await activateLicense(extracted, publicKey)
    // Expired keys are stored (manage-license UI shows them) but ok is false
    expect(result.ok).toBe(false)
    expect(result.error).toBe('expired')
    // Keychain write still happened so the user's key isn't lost
    expect(vi.mocked(keytar.setPassword)).toHaveBeenCalled()
  })
})
