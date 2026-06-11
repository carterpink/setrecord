/**
 * Launch profile — the v1 feature gate (main-process mirror).
 *
 * Keep these defaults in lockstep with `src/config/launchProfile.ts`. The
 * renderer hides the entry points; this side enforces the same gates at the
 * IPC / service boundary so a stale stored setting can't reach a hidden path.
 *
 * Override with `SETRECORD_FEAT_*` env vars (e.g. SETRECORD_FEAT_ENGINE_IMPORT=1).
 */

function flag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback
  return raw === '1' || raw === 'true'
}

export const launchProfile = {
  /** Rekordbox native MyTag write-back — force XML when off. */
  rekordboxNativeTagWrite: flag(process.env.SETRECORD_FEAT_RB_NATIVE_TAG_WRITE, false),
  /** Black Box reaction capture — never run the pipeline when off. */
  reactionCapture: flag(process.env.SETRECORD_FEAT_REACTION_CAPTURE, false),
  /** Engine DJ import — keep the provider out of the picker + reject runs when off. */
  engineImport: flag(process.env.SETRECORD_FEAT_ENGINE_IMPORT, false),
  /** Engine DJ USB export — kept; back up any existing m.db before writing. */
  engineExport: flag(process.env.SETRECORD_FEAT_ENGINE_EXPORT, true)
} as const

export type LaunchProfile = typeof launchProfile
