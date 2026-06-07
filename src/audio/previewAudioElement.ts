/**
 * Non-reactive bridge to the singleton preview <audio> element.
 *
 * `usePreviewAudio` owns the one HTMLAudioElement used for library-row preview
 * and publishes it here on creation. Passive visualisers (the inline waveform
 * canvas) read `.currentTime` from it inside a requestAnimationFrame loop to
 * paint a smooth 60fps playhead — without subscribing to the store or causing
 * React re-renders per frame.
 *
 * The store remains the source of truth for *which* track and *isPlaying*
 * (reactive); the element is the source of truth for *currentTime* (imperative,
 * per-frame). Readers must use optional chaining — the reference is briefly null
 * between mounts (e.g. React StrictMode double-invoke).
 */
let element: HTMLAudioElement | null = null

/** Called once by usePreviewAudio after it constructs the element (and null on teardown). */
export function setPreviewAudioElement(el: HTMLAudioElement | null): void {
  element = el
  // Dev aid: the preview element is detached from the DOM, so expose it for
  // debugging/inspection in development builds only.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    ;(window as unknown as { __ssPreviewAudio?: HTMLAudioElement | null }).__ssPreviewAudio = el
  }
}

/** Read-only accessor for renderers that need per-frame currentTime. */
export function getPreviewAudioElement(): HTMLAudioElement | null {
  return element
}
