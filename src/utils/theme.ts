/**
 * Theme boot + runtime escape hatch.
 *
 * "Grit" (the State-of-Sites register) is the DEFAULT look and carries no
 * `data-theme` attribute. The previous glossy "aurora" look is preserved
 * verbatim under [data-theme='aurora'] (see tokens.css), so reverting the
 * entire app's visuals is a single attribute flip — no rebuild.
 *
 * Internal/dev hatch (not surfaced in Settings):
 *   • boot reads localStorage.theme and applies it
 *   • window.__setTheme('aurora' | 'light' | 'grit') flips + persists at runtime
 */
export type ThemeName = 'grit' | 'aurora' | 'light'

export function applyTheme(theme: ThemeName | null | undefined): void {
  const root = document.documentElement
  if (theme === 'aurora' || theme === 'light') {
    root.dataset.theme = theme
  } else {
    delete root.dataset.theme // grit = default, no attribute
  }
}

export function initTheme(): void {
  try {
    applyTheme(localStorage.getItem('theme') as ThemeName | null)
  } catch {
    /* localStorage unavailable — fall back to the grit default */
  }
  // Dev helper: flip themes live without a rebuild, e.g. window.__setTheme('aurora').
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __setTheme?: (t: ThemeName) => void }).__setTheme = (t: ThemeName) => {
      try {
        if (t === 'grit') localStorage.removeItem('theme')
        else localStorage.setItem('theme', t)
      } catch {
        /* ignore persistence failures */
      }
      applyTheme(t === 'grit' ? null : t)
    }
  }
}
