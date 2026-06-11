/**
 * Durable, device-scoped anti-abuse anchors that survive an electron-store wipe.
 *
 * The free-trial start and the clock high-water mark used to live ONLY in
 * plaintext electron-store JSON (trial-state.json / license-state.json). Deleting
 * those files — or triggering a Fresh Start, which clears the same JSON — re-armed
 * the 7-day Pro trial and reset the clock-rollback guard, so a single device could
 * farm unlimited trials. We mirror both values into the OS keychain (exactly like
 * the anonymous device id in deviceId.ts), which an app-data wipe does NOT clear,
 * and reconcile keychain ⊕ electron-store on every read: the keychain remembers
 * the earliest trial start and the furthest clock we've ever seen, so a JSON
 * delete can no longer undo either.
 *
 * keytar is async, so — mirroring deviceId.ts / secretStore.ts — we load once at
 * startup into an in-memory cache and write through synchronously to the cache +
 * asynchronously to keytar, keeping the synchronous license-read path intact.
 */

import keytar from 'keytar'

const SERVICE = 'SetRecord'
const TRIAL_ANCHOR = 'trialStartedAtDurable'
const CLOCK_ANCHOR = 'clockHighWaterDurable'

/**
 * Advancing the durable clock writes to the keychain. recordSeenNow() runs on
 * every license read (often), so we only touch the keychain when the high-water
 * mark jumps at least this far past the last persisted value — frequent reads
 * advance the in-memory mark for free and never thrash the keychain. The slop is
 * far below the 24h clock-rollback tolerance, so it costs no protection.
 */
const CLOCK_PERSIST_THRESHOLD_MS = 60 * 60 * 1000

/** Earliest trial start ever recorded (in-memory mirror of the keychain). */
let _trialStartedAt: string | null = null
/** Furthest clock ever observed (in-memory; advances freely, persists throttled). */
let _clockHighWater: string | null = null
/** Epoch-ms of the value last actually written to the keychain (throttle gate). */
let _clockPersistedMs = 0

/** Earliest of two ISO timestamps, treating null/unparseable as "absent". */
export function earliestIso(a: string | null, b: string | null): string | null {
  if (!a) return b ?? null
  if (!b) return a
  const ma = Date.parse(a)
  const mb = Date.parse(b)
  if (!Number.isFinite(ma)) return b
  if (!Number.isFinite(mb)) return a
  return ma <= mb ? a : b
}

/** Latest of two ISO timestamps, treating null/unparseable as "absent". */
export function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b ?? null
  if (!b) return a
  const ma = Date.parse(a)
  const mb = Date.parse(b)
  if (!Number.isFinite(ma)) return b
  if (!Number.isFinite(mb)) return a
  return ma >= mb ? a : b
}

/**
 * Hydrate the in-memory anchors from the keychain. Call once at startup BEFORE
 * any license/trial read (see main.ts, right after loadDeviceId). Never throws —
 * a keychain failure just leaves the anchors empty, degrading to the old
 * electron-store-only behaviour rather than blocking startup.
 */
export async function loadLicenseAnchors(): Promise<void> {
  try {
    _trialStartedAt = (await keytar.getPassword(SERVICE, TRIAL_ANCHOR)) || null
    _clockHighWater = (await keytar.getPassword(SERVICE, CLOCK_ANCHOR)) || null
    const ms = _clockHighWater ? Date.parse(_clockHighWater) : 0
    _clockPersistedMs = Number.isFinite(ms) ? ms : 0
  } catch (err) {
    console.error('[licenseAnchors] keychain read failed', err)
  }
}

/** Durable trial-start anchor (earliest ever), or null if this device never started one. */
export function getDurableTrialStartedAt(): string | null {
  return _trialStartedAt
}

/** Durable clock high-water mark (furthest ever), or null if none recorded yet. */
export function getDurableClockHighWater(): string | null {
  return _clockHighWater
}

/**
 * Record the trial start durably. Keeps the EARLIEST value ever seen (write-once
 * in spirit), so re-importing or a Fresh Start cannot push the start forward to
 * win back a fresh window.
 */
export function persistTrialStartedAt(iso: string): void {
  const next = earliestIso(_trialStartedAt, iso)
  if (next && next !== _trialStartedAt) {
    _trialStartedAt = next
    void keytar.setPassword(SERVICE, TRIAL_ANCHOR, next).catch((err) => {
      console.error('[licenseAnchors] trial anchor write failed', err)
    })
  }
}

/**
 * Advance the durable clock high-water mark. The in-memory mark always moves
 * forward; the keychain is only written when the mark jumps past the last
 * persisted value by CLOCK_PERSIST_THRESHOLD_MS, so per-read calls stay cheap.
 */
export function persistClockHighWater(iso: string): void {
  const next = latestIso(_clockHighWater, iso)
  if (!next) return
  _clockHighWater = next
  const nextMs = Date.parse(next)
  if (Number.isFinite(nextMs) && nextMs - _clockPersistedMs >= CLOCK_PERSIST_THRESHOLD_MS) {
    _clockPersistedMs = nextMs
    void keytar.setPassword(SERVICE, CLOCK_ANCHOR, next).catch((err) => {
      console.error('[licenseAnchors] clock anchor write failed', err)
    })
  }
}

/**
 * Test-only: forget the durable anchors AND their keychain entries, simulating a
 * pristine device/keychain. NOT used in production — the whole point is that
 * neither Fresh Start nor a JSON delete can reach these.
 */
export function __clearDurableAnchorsForTest(): void {
  _trialStartedAt = null
  _clockHighWater = null
  _clockPersistedMs = 0
  void keytar.deletePassword(SERVICE, TRIAL_ANCHOR).catch(() => undefined)
  void keytar.deletePassword(SERVICE, CLOCK_ANCHOR).catch(() => undefined)
}

/**
 * Test-only: drop just the in-memory cache (keychain untouched), simulating an
 * app restart / fresh process. A following loadLicenseAnchors() rehydrates from
 * the keychain — used to prove the anchors survive an electron-store wipe.
 */
export function __resetAnchorMemoryForTest(): void {
  _trialStartedAt = null
  _clockHighWater = null
  _clockPersistedMs = 0
}
