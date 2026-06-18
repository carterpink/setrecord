/**
 * Anonymous device identity for license binding.
 *
 * This is a random UUID minted once and persisted in the OS keychain — NOT a
 * hardware fingerprint. It is deliberately anonymous (no MAC, serial, or any
 * PII): it only has to be *stable* on a given install so a license can be bound
 * to "this machine" and a key copied to a friend's laptop won't unlock there.
 *
 * Because keytar is async, we load the id once at startup (see loadDeviceId)
 * and keep it in-memory so the synchronous license-verification path can read
 * it without awaiting.
 */

import keytar from 'keytar'
import { randomUUID } from 'crypto'

const SERVICE = 'SetRecord'
const DEVICE_ACCOUNT = 'deviceId'

let _deviceId = ''

/**
 * Read the persisted device id, generating + storing one on first run. Safe to
 * call multiple times. If the keychain is unavailable we fall back to a
 * process-lifetime id so verification still functions (it just won't persist —
 * the worst case is the user re-activates after a keychain failure).
 */
export async function loadDeviceId(): Promise<string> {
  if (_deviceId) return _deviceId
  try {
    const existing = await keytar.getPassword(SERVICE, DEVICE_ACCOUNT)
    if (existing) {
      _deviceId = existing
      return _deviceId
    }
    const fresh = randomUUID()
    await keytar.setPassword(SERVICE, DEVICE_ACCOUNT, fresh)
    _deviceId = fresh
    return _deviceId
  } catch (err) {
    console.error('[deviceId] keychain unavailable, using ephemeral id', err)
    if (!_deviceId) _deviceId = randomUUID()
    return _deviceId
  }
}

/** The cached device id. Empty string until loadDeviceId() has run at startup. */
export function getDeviceId(): string {
  return _deviceId
}

/** Test-only: inject a known device id without touching the keychain. */
export function __setDeviceIdForTest(id: string): void {
  _deviceId = id
}
