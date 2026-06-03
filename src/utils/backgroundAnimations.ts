/**
 * Pause purely-decorative background motion whenever this window is hidden or
 * unfocused.
 *
 * The aurora drift and the Home "neural" blobs animate continuously. On their
 * own they're cheap-ish, but they sit *behind* glass `backdrop-filter` surfaces
 * (and the blobs are themselves blurred, screen-blended layers), so every frame
 * they move forces the compositor to re-blur. While the window isn't the user's
 * focus there is nothing to see, so freezing the drift costs zero perceived
 * motion while removing the single biggest reason the app kept a CPU core and
 * the GPU busy as it sat behind another app (e.g. Rekordbox).
 *
 * Functional motion (loading spinners, progress) is intentionally NOT paused —
 * only the decorative background layers carry the `.is-backgrounded` rule.
 */
export function installBackgroundAnimationPause(): () => void {
  const root = document.documentElement

  const update = (): void => {
    const hidden = document.hidden
    // `is-backgrounded` (blurred OR hidden) freezes the heavy decorative drift.
    // `is-hidden` (minimised / occluded only) freezes *all* animation — when the
    // window paints nothing there's no reason any spinner keeps ticking. Both are
    // invisible to the user by construction.
    root.classList.toggle('is-backgrounded', hidden || !document.hasFocus())
    root.classList.toggle('is-hidden', hidden)
  }

  update()
  document.addEventListener('visibilitychange', update)
  window.addEventListener('focus', update)
  window.addEventListener('blur', update)

  return () => {
    document.removeEventListener('visibilitychange', update)
    window.removeEventListener('focus', update)
    window.removeEventListener('blur', update)
    root.classList.remove('is-backgrounded')
    root.classList.remove('is-hidden')
  }
}
