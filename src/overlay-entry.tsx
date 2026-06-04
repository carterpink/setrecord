import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './styles/globals.css'
import { useLiveStore } from '@/stores/liveStore'
import { LiveOverlay } from '@/components/live/LiveOverlay'

/**
 * Renderer entry for the transparent always-on-top SetSense Live window.
 * Renders only the floating glass HUD (no app chrome, no aurora — the window is
 * transparent over Rekordbox). Mock-driven for now; the real path subscribes to
 * live deck data over IPC (window.setsense.onLiveData).
 */
// This is a renderer entry point (like main.tsx), not a reusable module — the
// component is mounted directly below and never exported, so Fast Refresh's
// export requirement does not apply.
// eslint-disable-next-line react-refresh/only-export-components
function Overlay(): React.JSX.Element {
  const goLive = useLiveStore((s) => s.goLive)
  const setLiveActive = useLiveStore((s) => s.setLiveActive)
  const applyLiveData = useLiveStore((s) => s.applyLiveData)
  const applyIndexProgress = useLiveStore((s) => s.applyIndexProgress)
  const setReady = useLiveStore((s) => s.setReady)
  useEffect(() => {
    // Real path: mark live and stream deck data + indexing status from the engine.
    if (typeof window.setsense !== 'undefined') {
      setLiveActive(true)
      const unsubData = window.setsense.onLiveData(applyLiveData)
      const unsubIdx = window.setsense.onLiveIndexProgress(applyIndexProgress)
      const unsubReady = window.setsense.onLiveReady(setReady)
      return () => {
        unsubData()
        unsubIdx()
        unsubReady()
      }
    }
    // Browser preview (?hud-preview): drive with the mock.
    goLive()
    return undefined
  }, [goLive, setLiveActive, applyLiveData, applyIndexProgress, setReady])
  return <LiveOverlay />
}

createRoot(document.getElementById('overlay-root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Overlay />
    </MotionConfig>
  </StrictMode>
)
