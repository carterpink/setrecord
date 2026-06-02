/**
 * License service — the single source of truth for SetSense Pro entitlement.
 *
 * The stored credential is an offline Ed25519-signed key (see signingKey.ts).
 * We never cache a derived "isPro" boolean: every read re-verifies the key and
 * re-evaluates expiry, so a subscription that lapsed while the app was open
 * downgrades correctly the next time the renderer asks.
 *
 * Beyond signature verification this layer adds three anti-abuse checks, all of
 * which still work fully offline:
 *   • Device binding — a v2 key bound to another device is rejected unless the
 *     key is explicitly `portable`. v1 keys predate binding and are portable.
 *   • Clock-rollback — subscription expiry is judged against max(now, the
 *     highest clock we've ever seen), so winding the clock back can't revive a
 *     lapsed sub. Legit users are never bricked; we only surface a soft warning.
 *   • Online revocation — an optional gateway can mark a key revoked or tighten
 *     its expiry (refunds/charge-backs). Unreachable network is a no-op.
 */

import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'crypto'
import type { LicenseActivationError, LicenseActivationResult, LicenseState } from '../../src/types'
import {
  LICENSE_KEY_PREFIX,
  LICENSE_PUBLIC_KEY_PEM,
  type LicensePayload
} from './licensing/signingKey'
import { getLicenseKey, setLicenseKey, clearLicenseKey } from './secretStore'
import { getDeviceId } from './licensing/deviceId'
import {
  getLastSeenAt,
  recordSeenNow,
  getOnlineCheck,
  setOnlineCheck,
  clearOnlineCheck,
  type OnlineCheck
} from './licensing/licenseLocalStore'
import { getGateway } from './licensing/gateway'
import { getTrialStartedAt } from './licensing/trialStore'

const FREE_STATE: LicenseState = {
  tier: 'free',
  plan: null,
  status: 'none',
  keyMasked: null,
  buyerEmail: null,
  activatedAt: null,
  expiresAt: null,
  deviceBound: false,
  portable: false,
  clockWarning: false,
  trialEndsAt: null,
  trialDaysRemaining: null
}

/** A backward clock jump larger than this (ms) is treated as a rollback warning. */
const CLOCK_ROLLBACK_SLOP_MS = 24 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000
/** Length of the free post-import Pro trial. */
export const TRIAL_DURATION_MS = 7 * DAY_MS

const embeddedPublicKey = createPublicKey(LICENSE_PUBLIC_KEY_PEM)

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

interface VerifyOk {
  ok: true
  payload: LicensePayload
}
interface VerifyFail {
  ok: false
  error: Extract<LicenseActivationError, 'malformed' | 'bad-signature'>
}

/**
 * Validate the key's structure + signature. Expiry, device binding and
 * revocation are evaluated separately (see evaluateLicense). The public key is
 * injectable so tests can sign with an ephemeral keypair.
 */
export function verifyKey(
  rawKey: string,
  publicKey: KeyObject = embeddedPublicKey
): VerifyOk | VerifyFail {
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
    (payload.v !== 1 && payload.v !== 2) ||
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

/** Is this payload bound to a specific device (and not flagged portable)? */
function isDeviceBound(payload: LicensePayload): boolean {
  return (
    typeof payload.deviceId === 'string' && payload.deviceId.length > 0 && payload.portable !== true
  )
}

export interface EvaluateContext {
  deviceId: string
  now: number
  lastSeenAt: string | null
  online: OnlineCheck | null
  publicKey?: KeyObject
}

export interface EvaluateResult {
  state: LicenseState
  /** New clock high-water mark to persist (max of lastSeenAt and now). */
  nextLastSeenAt: string
}

/**
 * Pure entitlement decision. No I/O — every input is in `ctx`, so tests can
 * exercise device binding, clock rollback and revocation deterministically.
 */
export function evaluateLicense(rawKey: string, ctx: EvaluateContext): EvaluateResult {
  const lastSeenMs = ctx.lastSeenAt ? Date.parse(ctx.lastSeenAt) : 0
  const safeLastSeen = Number.isFinite(lastSeenMs) ? lastSeenMs : 0
  const nextLastSeenAt = new Date(Math.max(safeLastSeen, ctx.now)).toISOString()
  const clockWarning = ctx.now < safeLastSeen - CLOCK_ROLLBACK_SLOP_MS

  const result = verifyKey(rawKey, ctx.publicKey)
  if (!result.ok) {
    return {
      state: { ...FREE_STATE, status: 'invalid', keyMasked: maskKey(rawKey), clockWarning },
      nextLastSeenAt
    }
  }

  const payload = result.payload
  const bound = isDeviceBound(payload)
  const base: LicenseState = {
    tier: 'pro',
    plan: payload.plan,
    status: 'active',
    keyMasked: maskKey(rawKey),
    buyerEmail: payload.email,
    activatedAt: payload.issuedAt ?? null,
    expiresAt: payload.expiresAt ?? null,
    deviceBound: bound,
    portable: payload.portable === true,
    clockWarning,
    trialEndsAt: null,
    trialDaysRemaining: null
  }

  // Server verdict wins when we have a fresh one for *this* license.
  const online = ctx.online && ctx.online.licenseId === payload.id ? ctx.online : null
  if (online?.revoked) {
    return { state: { ...base, tier: 'free', status: 'revoked' }, nextLastSeenAt }
  }

  // A key minted for another machine doesn't unlock here.
  if (bound && payload.deviceId !== ctx.deviceId) {
    return { state: { ...base, tier: 'free', status: 'device-mismatch' }, nextLastSeenAt }
  }

  // Expiry: honour the tighter of the signed expiry and any server override,
  // judged against the rollback-resistant effective clock.
  const candidates = [payload.expiresAt, online?.expiresAtOverride]
    .filter((x): x is string => typeof x === 'string')
    .map((iso) => Date.parse(iso))
    .filter((ms) => Number.isFinite(ms))
  if (candidates.length > 0) {
    const effectiveExpiry = Math.min(...candidates)
    const effectiveNow = Math.max(ctx.now, safeLastSeen)
    base.expiresAt = new Date(effectiveExpiry).toISOString()
    if (effectiveExpiry < effectiveNow) {
      return { state: { ...base, tier: 'free', status: 'expired' }, nextLastSeenAt }
    }
  }

  return { state: base, nextLastSeenAt }
}

/** Build the live evaluation context from the environment (device, clock, cache). */
function liveContext(): EvaluateContext {
  return {
    deviceId: getDeviceId(),
    now: Date.now(),
    lastSeenAt: getLastSeenAt(),
    online: getOnlineCheck()
  }
}

export interface TrialVerdict {
  active: boolean
  /** ISO end of the trial window. */
  endsAt: string
  /** Whole days left while active (≥1), else 0. */
  daysRemaining: number
}

/**
 * Pure trial decision. Expiry is judged against the rollback-resistant effective
 * clock (max of now and the highest clock we've ever seen), so the trial can't be
 * extended by winding the system clock backwards.
 */
export function evaluateTrial(
  startedAt: string,
  now: number,
  lastSeenAt: string | null
): TrialVerdict {
  const startMs = Date.parse(startedAt)
  const endMs = startMs + TRIAL_DURATION_MS
  const endsAt = new Date(Number.isFinite(endMs) ? endMs : now).toISOString()
  const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : 0
  const safeLastSeen = Number.isFinite(lastSeenMs) ? lastSeenMs : 0
  const effectiveNow = Math.max(now, safeLastSeen)
  const active = Number.isFinite(startMs) && effectiveNow < endMs
  const daysRemaining = active ? Math.max(1, Math.ceil((endMs - effectiveNow) / DAY_MS)) : 0
  return { active, endsAt, daysRemaining }
}

/**
 * Upgrade a free, keyless state to a pseudo-Pro trial when one is running. A real
 * paid key always wins over the trial; any keyed state (expired/invalid/etc) is
 * left untouched so its own messaging stands. A used-up trial reports
 * `trial-expired` so the UI can nudge toward purchase.
 */
function applyTrial(base: LicenseState): LicenseState {
  if (base.tier !== 'free' || base.status !== 'none') return base
  const startedAt = getTrialStartedAt()
  if (!startedAt) return base

  const t = evaluateTrial(startedAt, Date.now(), getLastSeenAt())
  if (t.active) {
    return {
      ...base,
      tier: 'pro',
      status: 'trial',
      expiresAt: t.endsAt,
      trialEndsAt: t.endsAt,
      trialDaysRemaining: t.daysRemaining
    }
  }
  return { ...base, status: 'trial-expired', trialEndsAt: t.endsAt, trialDaysRemaining: 0 }
}

/** Current entitlement, derived fresh from the stored key (or the free trial). Never throws. */
export function getLicenseState(): LicenseState {
  const key = getLicenseKey()
  const base = key ? evaluateLicense(key, liveContext()).state : FREE_STATE
  // Advance the clock high-water mark on every read (only ever moves forward).
  recordSeenNow()
  return applyTrial(base)
}

/** True when the user is entitled to Pro right now — used for IPC enforcement. */
export function isProEntitled(): boolean {
  return getLicenseState().tier === 'pro'
}

/**
 * Verify + persist a key. Tries the online gateway first so a freshly purchased
 * key can be device-bound server-side; falls back to storing the pasted key as
 * given when offline. A key bound to another device, or one the server has
 * revoked, is rejected and NOT stored.
 */
export async function activateLicense(
  rawKey: string,
  /** Inject an alternative public key — used only in tests with an ephemeral keypair. */
  publicKeyOverride?: KeyObject
): Promise<LicenseActivationResult> {
  const signature = verifyKey(rawKey, publicKeyOverride)
  if (!signature.ok) {
    return { ok: false, state: getLicenseState(), error: signature.error }
  }

  // Best-effort online activation: the server may hand back a device-bound key.
  let keyToStore = rawKey.trim()
  try {
    const res = await getGateway().activate({
      keyOrOrderToken: keyToStore,
      deviceId: getDeviceId()
    })
    if (res.reachable && res.key && verifyKey(res.key, publicKeyOverride).ok) {
      keyToStore = res.key.trim()
    }
  } catch {
    // Offline / gateway error — keep the pasted key. Activation must not depend on network.
  }

  const ctx = { ...liveContext(), publicKey: publicKeyOverride }
  const { state } = evaluateLicense(keyToStore, ctx)

  // Refuse to store a key that isn't this user's to use on this machine.
  if (state.status === 'device-mismatch') {
    return { ok: false, state: getLicenseState(), error: 'device-mismatch' }
  }
  if (state.status === 'revoked') {
    return { ok: false, state: getLicenseState(), error: 'revoked' }
  }

  if (state.status === 'expired') {
    // Still store it — the manage UI shows "expired" and offers renewal.
    await setLicenseKey(keyToStore)
    recordSeenNow(ctx.now)
    return { ok: false, state, error: 'expired' }
  }

  await setLicenseKey(keyToStore)
  recordSeenNow(ctx.now)
  return { ok: true, state }
}

/**
 * Refresh revocation/expiry from the online gateway. Caches the answer so the
 * verdict survives going offline. Unreachable network is a silent no-op — the
 * locally-stored entitlement stands. Returns the (possibly updated) state.
 */
export async function refreshLicenseOnline(): Promise<LicenseState> {
  const key = getLicenseKey()
  if (!key) return FREE_STATE
  const verified = verifyKey(key)
  if (!verified.ok) return getLicenseState()

  try {
    const res = await getGateway().check({
      licenseId: verified.payload.id,
      deviceId: getDeviceId()
    })
    if (res.reachable) {
      setOnlineCheck({
        licenseId: verified.payload.id,
        checkedAt: new Date().toISOString(),
        revoked: res.revoked === true,
        expiresAtOverride: res.expiresAt ?? null
      })
    }
  } catch {
    // Keep the cached verdict; never lock out on a failed refresh.
  }
  return getLicenseState()
}

/** Remove the stored key + local bookkeeping and drop back to the free tier. */
export async function deactivateLicense(): Promise<LicenseState> {
  await clearLicenseKey()
  clearOnlineCheck()
  return FREE_STATE
}
