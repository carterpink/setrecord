import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
// Self-hosted fonts (offline-safe): Space Grotesk (UI/body) + Fraunces (display heads).
import '@fontsource/space-grotesk/300.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource-variable/fraunces/full.css'
import './styles/globals.css'
import './styles/grit.css' // editorial layer — loaded LAST so it wins
import './i18n'
import App from './App'
import { initTheme } from './utils/theme'
import { installBackgroundAnimationPause } from './utils/backgroundAnimations'

// Apply the persisted theme (grit default) before first paint.
initTheme()

const root = createRoot(document.getElementById('root')!)
const params = new URLSearchParams(window.location.search)

// Freeze decorative background drift while the window is hidden/unfocused so the
// app stops re-blurring its glass surfaces when it's not the one you're using.
installBackgroundAnimationPause()

function render(node: React.ReactNode): void {
  root.render(
    <StrictMode>
      <MotionConfig reducedMotion="user">{node}</MotionConfig>
    </StrictMode>
  )
}

// Dev-only: `?hud-preview` renders just the floating Live HUD (mock-driven,
// no Electron bridge) so it can be viewed/screenshotted in a plain browser.
if (import.meta.env.DEV && params.has('hud-preview')) {
  void import('./components/live/LiveHudPreview').then(({ LiveHudPreview }) => {
    render(<LiveHudPreview />)
  })
} else {
  render(<App />)
}
