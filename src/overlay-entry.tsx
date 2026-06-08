/* eslint-disable react-refresh/only-export-components --
   Renderer entry file: it boots the HUD via createRoot and intentionally has no
   component exports, so the Fast Refresh single-export-boundary rule doesn't apply. */
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource-variable/fraunces/full.css'
import './styles/globals.css'
import './styles/grit.css' // editorial layer — loaded LAST so it wins
import { initTheme } from '@/utils/theme'
import { useLiveStore } from '@/stores/liveStore'
import { LiveOverlay } from '@/components/live/LiveOverlay'

initTheme()

/**
 * Renderer entry for the transparent always-on-top SetRecord Live window.
 * Renders only the floating glass HUD (no app chrome, no aurora — the window is
 * transparent over Rekordbox). Mock-driven for now; the real path subscribes to
 * live deck data over IPC (window.setrecord.onLiveData).
 */
function Overlay(): React.JSX.Element {
  const goLive = useLiveStore((s) => s.goLive)
  const setLiveActive = useLiveStore((s) => s.setLiveActive)
  const applyLiveData = useLiveStore((s) => s.applyLiveData)
  const setVenue = useLiveStore((s) => s.setVenue)
  const applyIndexProgress = useLiveStore((s) => s.applyIndexProgress)
  const setReady = useLiveStore((s) => s.setReady)
  useEffect(() => {
    // Real path: mark live and stream deck data + indexing status from the engine.
    if (typeof window.setrecord !== 'undefined') {
      setLiveActive(true)
      const unsubData = window.setrecord.onLiveData(applyLiveData)
      const unsubIdx = window.setrecord.onLiveIndexProgress(applyIndexProgress)
      const unsubReady = window.setrecord.onLiveReady(setReady)
      const unsubVenue = window.setrecord.onLiveVenue(setVenue)
      return () => {
        unsubData()
        unsubIdx()
        unsubReady()
        unsubVenue()
      }
    }
    // Browser preview (?hud-preview): drive with the mock.
    goLive()
    return undefined
  }, [goLive, setLiveActive, applyLiveData, setVenue, applyIndexProgress, setReady])
  return <LiveOverlay />
}

createRoot(document.getElementById('overlay-root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Overlay />
    </MotionConfig>
  </StrictMode>
)
