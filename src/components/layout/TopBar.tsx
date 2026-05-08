import { useState } from 'react'
import { Download, Search, Settings, Upload } from 'lucide-react'
import type { AppMode } from '@/types'
import { Badge } from '@/components/shared/Badge'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { Logo } from '@/components/shared/Logo'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { useUiStore } from '@/stores/uiStore'

const MODES: readonly AppMode[] = ['Prepare', 'Play'] as const

export function TopBar(): React.JSX.Element {
  const [mode, setMode] = useState<AppMode>('Prepare')
  const showModal = useUiStore((s) => s.showModal)

  return (
    <div className="topbar glass-2">
      <div className="topbar-left">
        <Logo />
        <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      </div>

      <Badge dot="success" label="Set safety" value="100% · CDJ‑2000NXS2 ready" glass={1} />

      <div className="topbar-right">
        <Button variant="secondary" icon={Upload} onClick={() => showModal('import')}>
          Import
        </Button>
        <IconButton icon={Search} aria-label="Search" />
        <IconButton icon={Settings} aria-label="Settings" />
        <Button variant="primary" icon={Download}>
          Export
        </Button>
      </div>
    </div>
  )
}
