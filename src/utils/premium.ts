import { useLicenseStore } from '@/stores/licenseStore'

/**
 * Non-reactive Pro check for imperative code paths (event handlers, guards).
 * Entitlement is owned by the main process and mirrored into licenseStore on
 * boot. React components should prefer the reactive `useIsPro` / `useCanUse`
 * selectors so they re-render when a license activates.
 */
export function isProUser(): boolean {
  return useLicenseStore.getState().license.tier === 'pro'
}
