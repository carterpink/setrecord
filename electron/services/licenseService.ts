/**
 * License service — the single source of truth for SetSense Pro entitlement.
 *
 * The stored credential is an offline Ed25519-signed key (see signingKey.ts).
 * We never cache a derived "isPro" boolean: every read re-verifies the key and
 * re-evaluates expiry, so a subscription that lapsed while the app was open
 * downgrades correctly the next time the renderer asks.
 */

import { createPublicKey, verify as cryptoVerify } from 'crypto'
import type {
  LicenseActivationError,
  LicenseActivationResult,
  LicenseState,
} from '../../src/types'
import {
  LICENSE_KEY_PREFIX,
  LICENSE_PUBLIC_KEY_PEM,
  type LicensePayload,
} from './licensing/signingKey'
import { getLicenseKey, setLicenseKey, clearLicenseKey } from './secretStore'

const FREE_STATE: LicenseState = {
  tier: 'free',
  plan: null,
  status: 'none',
  keyMasked: null,
  buyerEmail: null,
  activatedAt: null,
  expiresAt: null,
}

const publicKey = createPublicKey(LICENSE_PUBLIC_KEY_PEM)

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

interface VerifyOk {
  ok: true
  payload: LicensePayload
}
interface VerifyFail {
  ok: false
  error: Exclude<LicenseActivationError, 'expired'>
}

/** Validate the key's structure + signature. Expiry is evaluated separately. */
function verifyKey(rawKey: string): VerifyOk | VerifyFail {
  const key = rawKey.trim()
  const parts = key.split('.')
  if (parts.length !== 3 || parts[0] !== LICENSE_KEY_PREFIX) {
    return { ok: false, error: 'malformed' }
  }
  const [, payloadB64, sigB64] = parts

  let payload: LicensePayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as LicensePayload
  } catch {
    return { ok: false, error: 'malformed' }
  }

  if (
    payload.v !== 1 ||
    (payload.plan !== 'lifetime' && payload.plan !== 'subscription') ||
    typeof payload.id !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    return { ok: false, error: 'malformed' }
  }

  // The signature covers the exact payload-segment bytes, not the re-serialised
  // JSON, so issuer/verifier never disagree on key ordering or whitespace.
  let signatureValid = false
  try {
    signatureValid = cryptoVerify(null, Buffer.from(payloadB64), publicKey, b64urlDecode(sigB64))
  } catch {
    signatureValid = false
  }
  if (!signatureValid) return { ok: false, error: 'bad-signature' }

  return { ok: true, payload }
}

function maskKey(key: string): string {
  const parts = key.trim().split('.')
  const sig = parts[2] ?? ''
  const tail = sig.slice(-4).toUpperCase() || '????'
  return `${LICENSE_KEY_PREFIX}·••••·${tail}`
}

/** Build the renderer-facing state from a verified payload, applying expiry. */
function stateFromPayload(rawKey: string, payload: LicensePayload): LicenseState {
  const expiresAt = payload.expiresAt ?? null
  const expired = expiresAt != null && Date.parse(expiresAt) < Date.now()
  return {
    tier: expired ? 'free' : 'pro',
    plan: payload.plan,
    status: expired ? 'expired' : 'active',
    keyMasked: maskKey(rawKey),
    buyerEmail: payload.email,
    activatedAt: payload.issuedAt ?? null,
    expiresAt,
  }
}

/** Current entitlement, derived fresh from the stored key. Never throws. */
export function getLicenseState(): LicenseState {
  const key = getLicenseKey()
  if (!key) return FREE_STATE
  const result = verifyKey(key)
  if (!result.ok) {
    return { ...FREE_STATE, status: 'invalid', keyMasked: maskKey(key) }
  }
  return stateFromPayload(key, result.payload)
}

/** True when the user is entitled to Pro right now — used for IPC enforcement. */
export function isProEntitled(): boolean {
  return getLicenseState().tier === 'pro'
}

/** Verify + persist a pasted key. On success the key lands in the keychain. */
export async function activateLicense(rawKey: string): Promise<LicenseActivationResult> {
  const result = verifyKey(rawKey)
  if (!result.ok) {
    return { ok: false, state: getLicenseState(), error: result.error }
  }
  const state = stateFromPayload(rawKey, result.payload)
  if (state.status === 'expired') {
    // Still store it — the manage UI shows "expired" and offers renewal.
    await setLicenseKey(rawKey.trim())
    return { ok: false, state, error: 'expired' }
  }
  await setLicenseKey(rawKey.trim())
  return { ok: true, state }
}

/** Remove the stored key and drop back to the free tier. */
export async function deactivateLicense(): Promise<LicenseState> {
  await clearLicenseKey()
  return FREE_STATE
}
