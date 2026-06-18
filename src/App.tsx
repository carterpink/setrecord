import { AppShell } from './components/layout/AppShell'
import { FatalError } from './components/shared/FatalError'
import { TrackInspectOverlays } from './components/shared/TrackInspectOverlays'
import { isProductionWithoutBridge } from './stores/licenseStore'

export default function App(): React.JSX.Element {
  if (isProductionWithoutBridge()) return <FatalError />
  return (
    <>
      <AppShell />
      {/* App-root host for per-track inspect overlays (Résumé / Courage) so they
          render full-screen from anywhere, not squished inside a panel. */}
      <TrackInspectOverlays />
    </>
  )
}
