export { useReducedMotion } from 'framer-motion'

/** Returns true if the user's OS has requested reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
