/**
 * Local, non-secret license bookkeeping that backs two anti-abuse mechanisms:
 *
 *  1. Clock-rollback detection — we persist the latest wall-clock time we've
 *     ever observed (`lastSeenAt`). Subscription expiry is then evaluated
 *     against max(now, lastSeenAt), so winding the system clock backwards can't
 *     resurrect a lapsed subscription. This is a deterrent, not a vault: the
 *     file is user-editable, but casual rollback is the threat we care about.
 *
 *  2. Online check cache — the last revocation/expiry answer we got from the
 *     license gateway, so the app keeps honouring (or denying) it while offline
 *     instead of forgetting on every launch.
 *
 * The signed key itself stays in the keychain (see secretStore). Nothing here
 * is secret, so electron-store's plaintext JSON is the right home.
 */

import ElectronStore from 'electron-store'
import { getDurableClockHighWater, persistClockHighWater, latestIso } from './licenseAnchors'

interface OnlineCheck {
  /** License id (payload.id) this answer applies to — guards against a new key inheriting an old verdict. */
  licenseId: string
  checkedAt: string
  revoked: boolean
  /** Server-tightened expiry, if any. Never used to *extend* a key, only shorten. */
  expiresAtOverride: string | null
}

interface LicenseLocalState {
  /** Latest wall-clock time ever observed while the app was running (ISO). */
  lastSeenAt: string | null
  onlineCheck: OnlineCheck | null
}

const DEFAULTS: LicenseLocalState = {
  lastSeenAt: null,
  onlineCheck: null
}

const store = new ElectronStore<LicenseLocalState>({ name: 'license-state', defaults: DEFAULTS })

export function getLastSeenAt(): string | null {
  // Reconcile the user-editable JSON with the durable keychain anchor — the
  // furthest clock ever seen wins, so wiping the JSON can't reset the guard.
  return latestIso(store.get('lastSeenAt') ?? null, getDurableClockHighWater())
}

/** Advance the high-water mark. Only ever moves forward, never backward. */
export function recordSeenNow(nowMs: number = Date.now()): void {
  const iso = new Date(nowMs).toISOString()
  const prev = getLastSeenAt()
  const prevMs = prev ? Date.parse(prev) : 0
  if (!Number.isFinite(prevMs) || nowMs > prevMs) {
    store.set('lastSeenAt', iso)
  }
  // Mirror into the keychain (throttled internally) so a JSON wipe can't roll
  // the rollback guard back to zero.
  persistClockHighWater(iso)
}

export function getOnlineCheck(): OnlineCheck | null {
  return store.get('onlineCheck') ?? null
}

export function setOnlineCheck(check: OnlineCheck | null): void {
  store.set('onlineCheck', check)
}

/** Wipe local license bookkeeping (used on deactivate so a fresh key starts clean). */
export function clearOnlineCheck(): void {
  store.set('onlineCheck', null)
}

/**
 * Wipe all local license bookkeeping — clock high-water mark AND online-check
 * cache — back to DEFAULTS (Fresh Start). The signed key itself lives in the
 * keychain and is deliberately NOT touched here, so Pro stays activated.
 */
export function clearLicenseLocalState(): void {
  store.clear()
}

export type { OnlineCheck }
