/**
 * Click-through control for the transparent overlay window.
 *
 * The overlay window is created with `setIgnoreMouseEvents(true, { forward:true })`
 * so the whole transparent surface lets clicks fall through to Rekordbox below.
 * When the pointer is over an interactive glass element we flip that off so the
 * element can be clicked, then restore it on leave. No-ops in a plain browser
 * (no Electron bridge), so the same components work in `?hud-preview`.
 */
export function setOverlayInteractive(interactive: boolean): void {
  window.setrecord?.liveSetIgnoreMouse?.(!interactive)
}

/** Spread onto any interactive glass element to make it clickable on hover. */
export const interactiveHandlers = {
  onMouseEnter: () => setOverlayInteractive(true),
  onMouseLeave: () => setOverlayInteractive(false)
}
