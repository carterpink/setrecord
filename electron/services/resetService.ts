/**
 * Fresh Start — wipe the app back to its first-launch state.
 *
 * Triggered by the "Danger zone" button in Settings (see SettingsModal). It
 * clears everything the user has accumulated — library, settings, play history,
 * activation/streak progress, and the on-disk caches — so the next boot lands on
 * the first-run onboarding flow with an empty library and default settings.
 *
 * Deliberately PRESERVED:
 *  - Keychain secrets (license key, device id, YouTube key) — Pro stays
 *    activated; a reset is not a sign-out. The license bookkeeping JSON is
 *    cleared, but the signed key in the keychain is untouched.
 *  - The bundled/downloaded ML models in userData/models — heavy, not user data.
 *  - The user's actual audio files — SetSense never owns or moves those.
 *
 * The caller relaunches the app immediately after this returns, so we reset the
 * electron-store instances in-place (`store.clear()`) rather than deleting their
 * JSON files: that avoids a live store rewriting a stale file before quit.
 */

import { app } from 'electron'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'

import { resetDb } from '../db/schema'
import { clearSettings } from './settingsService'
import { clearProgress } from './progressService'
import { clearTrial } from './licensing/trialStore'
import { clearLicenseLocalState } from './licensing/licenseLocalStore'
import { getArtworkCacheDir } from './artworkExtractor'

/** Best-effort recursive delete — a Fresh Start should never throw on a stray file. */
function removeIfExists(path: string): void {
  if (!existsSync(path)) return
  try {
    rmSync(path, { recursive: true, force: true })
  } catch (err) {
    console.error('[freshStart] failed to remove', path, err)
  }
}

/**
 * Wipe all SetSense state to first-launch. Synchronous and best-effort: each
 * step is independent so a single failure can't leave the wipe half-done.
 */
export function freshStart(): void {
  // 1. Library DB (+ WAL sidecars). Hard-delete — the user asked to wipe it.
  try {
    resetDb({ quarantine: false })
  } catch (err) {
    console.error('[freshStart] resetDb failed', err)
  }

  // 2. electron-store backed state, reset in-place to DEFAULTS.
  clearSettings() //   preferences.json — re-arms onboarding (hasCompletedOnboarding=false)
  clearProgress() //   progress.json — activation funnel + weekly streak
  clearTrial() //      trial-state.json — trial re-arms on next import
  clearLicenseLocalState() // license-state.json — clock high-water + online-check cache

  // 3. On-disk caches. Artwork is regenerated on import; energy is recomputed.
  removeIfExists(getArtworkCacheDir())
  removeIfExists(join(app.getPath('userData'), 'energy-cache.json'))

  // Keychain secrets and userData/models are intentionally left in place.
}
