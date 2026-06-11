/**
 * Launch profile — the v1 feature gate (renderer side).
 *
 * Each flag hides (or down-labels) a surface that is coded but deliberately not
 * shipped "loud" in v1 — a trust/security risk, an unvalidated second ecosystem,
 * or an off-thesis workflow. NOTHING is deleted: flip a flag to `true` (or set
 * the matching `VITE_FEAT_*` build/runtime env var) and the feature returns.
 *
 * The main-process mirror lives in `electron/config/launchProfile.ts`; the two
 * files MUST stay in sync. Renderer reads `import.meta.env.VITE_FEAT_*` (Vite
 * inlines these at build time, so access must be static — no dynamic keys).
 */

function flag(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback
  return raw === '1' || raw === 'true'
}

export const launchProfile = {
  /** B2B real-time collaboration — no auth yet; hidden in v1. */
  collab: flag(import.meta.env.VITE_FEAT_COLLAB, false),
  /** Rekordbox native MyTag write-back toggle — hidden; XML export stays. */
  rekordboxNativeTagWrite: flag(import.meta.env.VITE_FEAT_RB_NATIVE_TAG_WRITE, false),
  /** Black Box reaction capture (experimental DSP) — toggle hidden in v1. */
  reactionCapture: flag(import.meta.env.VITE_FEAT_REACTION_CAPTURE, false),
  /** Engine DJ library import (beta, untested on hardware) — hidden in v1. */
  engineImport: flag(import.meta.env.VITE_FEAT_ENGINE_IMPORT, false),
  /** Engine DJ USB export — KEPT, with a pre-write backup + Beta label. */
  engineExport: flag(import.meta.env.VITE_FEAT_ENGINE_EXPORT, true),
  /** Beatport CSV export (heuristic match) — flagged off in v1. */
  beatportExport: flag(import.meta.env.VITE_FEAT_BEATPORT_EXPORT, false),
  /** Live next-track HUD — shown with a Beta badge (not hidden). */
  liveHudBeta: flag(import.meta.env.VITE_FEAT_LIVE_HUD_BETA, true)
} as const

export type LaunchProfile = typeof launchProfile
