import { create } from 'zustand'
import type { CheckoutPlan, LicenseActivationResult, LicenseState } from '@/types'
import type { ProFeature } from '@/utils/entitlements'

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

// Browser-only preview (Claude Preview / `npx vite`) has no licensing backend.
// Render the full Pro experience there so the design can be reviewed; real
// entitlement is only ever decided by the main process in packaged Electron.
const PREVIEW_PRO_STATE: LicenseState = {
  tier: 'pro',
  plan: 'lifetime',
  status: 'active',
  keyMasked: 'SES1·••••·DEMO',
  buyerEmail: 'preview@setsense.app',
  activatedAt: new Date().toISOString(),
  expiresAt: null,
  deviceBound: false,
  portable: true,
  clockWarning: false,
  trialEndsAt: null,
  trialDaysRemaining: null
}

// The fake-Pro fallback is only honoured in a dev build (`npm run dev`) or when a
// preview build is explicitly opted in via VITE_PREVIEW_PRO=true. A packaged
// production renderer never unlocks Pro without the main-process bridge — if the
// IPC bridge is missing there, we fail closed (see isProductionWithoutBridge).
const PREVIEW_PRO_ALLOWED = import.meta.env.DEV || import.meta.env.VITE_PREVIEW_PRO === 'true'

function bridgeMissing(): boolean {
  return typeof window === 'undefined' || typeof window.setsense === 'undefined'
}

/** True when a packaged production renderer is running without the IPC bridge —
 *  a state that must surface a fatal error rather than silently unlock Pro. */
export function isProductionWithoutBridge(): boolean {
  return !PREVIEW_PRO_ALLOWED && bridgeMissing()
}

interface LicenseStoreState {
  license: LicenseState
  loaded: boolean
  hydrate: () => Promise<void>
  /** Best-effort online revocation/expiry refresh; offline is a silent no-op. */
  refresh: () => Promise<void>
  activate: (key: string) => Promise<LicenseActivationResult>
  deactivate: () => Promise<void>
  checkout: (plan: CheckoutPlan, tipAmount?: number) => Promise<boolean>
  /** Pro entitlement gate. All ProFeatures resolve the same way today, but the
   *  signature is per-feature so tier-specific bundles can land without churn. */
  can: (feature: ProFeature) => boolean
}

export const useLicenseStore = create<LicenseStoreState>((set, get) => ({
  license: FREE_STATE,
  loaded: false,

  hydrate: async () => {
    if (bridgeMissing()) {
      // Dev / opted-in preview gets fake Pro; production fails closed to free.
      set({ license: PREVIEW_PRO_ALLOWED ? PREVIEW_PRO_STATE : FREE_STATE, loaded: true })
      return
    }
    try {
      const license = await window.setsense.licenseGet()
      set({ license, loaded: true })
    } catch {
      set({ license: FREE_STATE, loaded: true })
    }
    // Kick a non-blocking online refresh; failure leaves the offline state intact.
    void get().refresh()
  },

  refresh: async () => {
    if (typeof window === 'undefined' || typeof window.setsense === 'undefined') return
    try {
      const license = await window.setsense.licenseRefresh()
      set({ license, loaded: true })
    } catch {
      // Offline / no gateway — keep whatever hydrate produced.
    }
  },

  activate: async (key) => {
    const result = await window.setsense.licenseActivate(key)
    set({ license: result.state, loaded: true })
    return result
  },

  deactivate: async () => {
    const license = await window.setsense.licenseDeactivate()
    set({ license, loaded: true })
  },

  checkout: async (plan, tipAmount) => {
    if (typeof window.setsense === 'undefined') return false
    return window.setsense.licenseCheckout(plan, tipAmount)
  },

  can: (_feature) => get().license.tier === 'pro'
}))

/** Reactive selector — true when the current tier is Pro. */
export function useIsPro(): boolean {
  return useLicenseStore((s) => s.license.tier === 'pro')
}

/** Reactive selector — true when the given Pro feature is available. */
export function useCanUse(feature: ProFeature): boolean {
  return useLicenseStore((s) => s.can(feature))
}

export interface TrialInfo {
  /** Inside the free post-import Pro trial right now (everything unlocked). */
  onTrial: boolean
  /** The trial ran out and there's no paid key. */
  expired: boolean
  /** Whole days left while on trial (≥1), else 0. */
  daysRemaining: number
}

/** Reactive view of the free-trial state for messaging (countdown chip, modal banner). */
export function useTrialInfo(): TrialInfo {
  const status = useLicenseStore((s) => s.license.status)
  const daysRemaining = useLicenseStore((s) => s.license.trialDaysRemaining ?? 0)
  return {
    onTrial: status === 'trial',
    expired: status === 'trial-expired',
    daysRemaining
  }
}
