import { useEffect } from 'react'
import { useLiveStore } from '@/stores/liveStore'
import { LiveOverlay } from './LiveOverlay'

/**
 * Standalone, bridge-free preview of the Live HUD over the aurora backdrop.
 * Loaded via `?hud-preview` (see main.tsx) so the overlay can be seen and
 * screenshotted in a plain browser, mock-driven, without the Electron bridge.
 */
export function LiveHudPreview(): React.JSX.Element {
  const goLive = useLiveStore((s) => s.goLive)
  useEffect(() => {
    goLive()
  }, [goLive])

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <LiveOverlay />
    </>
  )
}
