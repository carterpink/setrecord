import { AppShell } from './components/layout/AppShell'
import { FatalError } from './components/shared/FatalError'
import { isProductionWithoutBridge } from './stores/licenseStore'

export default function App(): React.JSX.Element {
  if (isProductionWithoutBridge()) return <FatalError />
  return <AppShell />
}
