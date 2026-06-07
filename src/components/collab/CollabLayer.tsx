/**
 * Mounts the collaboration modals (invite / join) based on collabStore.panel.
 * Rendered once at the app shell level so the panels float above everything.
 */

import { useCollabStore } from '@/stores/collabStore'
import { InvitePanel } from './InvitePanel'
import { JoinDialog } from './JoinDialog'

export function CollabLayer(): React.JSX.Element | null {
  const panel = useCollabStore((s) => s.panel)
  if (panel === 'invite') return <InvitePanel />
  if (panel === 'join') return <JoinDialog />
  return null
}
