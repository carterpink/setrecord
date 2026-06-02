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
 * deleting and re-importing the library does not hand out a fresh trial. The
 * plaintext JSON is user-editable — like the rest of our offline anti-abuse, this
 * deters casual reset rather than promising a vault, and needs no server.
 */

import ElectronStore from 'electron-store'

interface TrialLocalState {
  /** ISO timestamp the trial began (first successful import). null = never started. */
  startedAt: string | null
}

const DEFAULTS: TrialLocalState = { startedAt: null }

const store = new ElectronStore<TrialLocalState>({ name: 'trial-state', defaults: DEFAULTS })

export function getTrialStartedAt(): string | null {
  return store.get('startedAt') ?? null
}

/**
 * Begin the trial if it has never started. No-op once a start time exists, so
 * re-importing can't re-arm it. Returns true only on the first call that arms it.
 */
export function startTrial(nowMs: number = Date.now()): boolean {
  if (getTrialStartedAt()) return false
  store.set('startedAt', new Date(nowMs).toISOString())
  return true
}

/** Wipe the trial start (test-only / deactivation reset). */
export function clearTrial(): void {
  store.set('startedAt', null)
}
