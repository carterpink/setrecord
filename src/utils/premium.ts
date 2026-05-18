import { useUiStore } from '@/stores/uiStore'

/**
 * Returns true when the current user is on a paid tier and should see Pro
 * features (Learn Mode content, etc.). No billing system exists yet; this is
 * a stub that always returns true and is the single gating point so a real
 * entitlement check can replace it later.
 */
export function isProUser(): boolean {
  return useUiStore.getState().isPro
}
