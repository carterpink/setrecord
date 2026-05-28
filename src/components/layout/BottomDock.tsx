import { Flag, HardDrive, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { IconButton } from '@/components/shared/IconButton'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'

interface BottomDockProps {
  visible: boolean
}

export function BottomDock({ visible }: BottomDockProps): React.JSX.Element {
  const { showModal, smartFilter, toggleSmartFilter } = useUiStore()
  const { selectedTrackId } = useSetStore()

  const canSmartFilter = selectedTrackId !== null
  const canOpenCueEditor = selectedTrackId !== null

  return (
    <div className="dock-trigger">
      <div className={`dock-wrap${visible ? ' dock-visible' : ''}`}>
        <div className="dock glass-3">

          {/* Generate */}
          <span className="dock-item" data-label="Set Architect">
            <IconButton
              icon={Sparkles}
              aria-label="Set Architect"
              onClick={() => showModal('architect')}
            />
          </span>

          {/* Smart filter — dimmed when no track selected */}
          <span className="dock-item" data-label="Smart filter">
            <IconButton
              icon={Zap}
              aria-label="Smart filter"
              active={smartFilter}
              disabled={!canSmartFilter}
              onClick={canSmartFilter ? toggleSmartFilter : undefined}
              style={{ opacity: canSmartFilter ? 1 : 0.35, cursor: canSmartFilter ? 'pointer' : 'default' }}
            />
          </span>

          {/* Cue editor — requires a selected timeline track */}
          <span
            className="dock-item"
            data-label={canOpenCueEditor ? 'Cue editor' : 'Select a timeline track first'}
          >
            <IconButton
              icon={Flag}
              aria-label="Cue editor"
              disabled={!canOpenCueEditor}
              title={!canOpenCueEditor ? 'Select a track in your timeline to edit its cue points' : undefined}
              onClick={canOpenCueEditor ? () => showModal('cueEditor') : undefined}
              style={{ opacity: canOpenCueEditor ? 1 : 0.35, cursor: canOpenCueEditor ? 'pointer' : 'default' }}
            />
          </span>

          <span className="dock-divider" aria-hidden="true" />

          {/* Validate */}
          <span className="dock-item" data-label="Validate set">
            <IconButton
              icon={ShieldCheck}
              aria-label="Validate set"
              onClick={() => showModal('validate')}
            />
          </span>

          {/* Export */}
          <span className="dock-item" data-label="Export">
            <IconButton
              icon={HardDrive}
              aria-label="Export"
              onClick={() => showModal('export')}
            />
          </span>

        </div>
      </div>
    </div>
  )
}
