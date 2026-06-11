/**
 * Local persistence for the free post-import Pro trial (Section 16).
 *
 * A new user who imports a library gets a 7-day full-Pro trial so they can feel
 * the core magic — Suggestions, Set Architect, Recall, Export — before any
 * paywall. We persist only the moment the trial *started*; expiry is derived at
 * read time against the clock high-water mark (see licenseLocalStore), so
 * winding the system clock back can't extend it.
 *
 * The start time is written exactly once and never reset by later imports, so
 * deleting and re-importing the library does not hand out a fresh trial.
 *
 * The plaintext JSON is user-editable, so the authoritative copy is mirrored in
 * the OS keychain (see licenseAnchors.ts): every read reconciles the local JSON
 * with the durable keychain anchor and keeps the EARLIEST start. Deleting
 * trial-state.json — or a Fresh Start, which clears it — therefore can no longer
 * re-arm the trial on a device that has already consumed it.
 */

import ElectronStore from 'electron-store'
import { getDurableTrialStartedAt, persistTrialStartedAt, earliestIso } from './licenseAnchors'

interface TrialLocalState {
  /** ISO timestamp the trial began (first successful import). null = never started. */
  startedAt: string | null
}

const DEFAULTS: TrialLocalState = { startedAt: null }

const store = new ElectronStore<TrialLocalState>({ name: 'trial-state', defaults: DEFAULTS })

export function getTrialStartedAt(): string | null {
  // Reconcile the user-editable JSON with the durable keychain anchor — the
  // earliest of the two wins, so wiping the JSON can't push the start forward.
  return earliestIso(store.get('startedAt') ?? null, getDurableTrialStartedAt())
}

/**
 * Begin the trial if it has never started. No-op once a start time exists —
 * including a start recorded only in the durable keychain anchor — so neither
 * re-importing, deleting trial-state.json, nor a Fresh Start can re-arm it.
 * Returns true only on the first call that arms it.
 */
export function startTrial(nowMs: number = Date.now()): boolean {
  if (getTrialStartedAt()) return false
  const iso = new Date(nowMs).toISOString()
  store.set('startedAt', iso)
  persistTrialStartedAt(iso) // durable mirror — survives a JSON wipe / Fresh Start
  return true
}

/**
 * Clear the LOCAL trial start. The durable keychain anchor is deliberately left
 * in place so a device that already consumed its trial cannot win a fresh one
 * via Fresh Start. Use __clearDurableAnchorsForTest() in tests for a pristine
 * device.
 */
export function clearTrial(): void {
  store.set('startedAt', null)
}
