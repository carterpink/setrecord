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
}

interface LicenseStoreState {
  license: LicenseState
  loaded: boolean
  hydrate: () => Promise<void>
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
    if (typeof window === 'undefined' || typeof window.setsense === 'undefined') {
      set({ license: PREVIEW_PRO_STATE, loaded: true })
      return
    }
    try {
      const license = await window.setsense.licenseGet()
      set({ license, loaded: true })
    } catch {
      set({ license: FREE_STATE, loaded: true })
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

  can: (_feature) => get().license.tier === 'pro',
}))

/** Reactive selector — true when the current tier is Pro. */
export function useIsPro(): boolean {
  return useLicenseStore((s) => s.license.tier === 'pro')
}

/** Reactive selector — true when the given Pro feature is available. */
export function useCanUse(feature: ProFeature): boolean {
  return useLicenseStore((s) => s.can(feature))
}
