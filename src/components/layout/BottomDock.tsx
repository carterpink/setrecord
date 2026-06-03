import { Flag, HardDrive, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { IconButton } from '@/components/shared/IconButton'
import { ProBadge } from '@/components/shared/ProGate'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'

export function BottomDock(): React.JSX.Element {
  const { showModal, showUpgrade, smartFilter, toggleSmartFilter } = useUiStore()
  const { selectedTrackId } = useSetStore()
  const isPro = useLicenseStore((s) => s.license.tier === 'pro')

  const canSmartFilter = selectedTrackId !== null
  const canOpenCueEditor = selectedTrackId !== null

  return (
    <div className="dock-trigger">
      <div className="dock-wrap dock-visible">
        <div className="dock glass-3">
          {/* Set Architect — Pro */}
          <span className="dock-item" data-label={isPro ? 'Set Architect' : 'Set Architect — Pro'}>
            <IconButton
              icon={Sparkles}
              aria-label="Set Architect"
              onClick={() => (isPro ? showModal('architect') : showUpgrade('setArchitect'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          {/* Smart filter — Pro; dimmed when no track selected */}
          <span className="dock-item" data-label={isPro ? 'Smart filter' : 'Smart filter — Pro'}>
            <IconButton
              icon={Zap}
              aria-label="Smart filter"
              active={smartFilter}
              disabled={isPro && !canSmartFilter}
              onClick={
                !isPro
                  ? () => showUpgrade('suggestions')
                  : canSmartFilter
                    ? toggleSmartFilter
                    : undefined
              }
              style={{
                opacity: !isPro || canSmartFilter ? 1 : 0.35,
                cursor: !isPro || canSmartFilter ? 'pointer' : 'default'
              }}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          {/* Cue editor — Pro; requires a selected timeline track */}
          <span
            className="dock-item"
            data-label={
              !isPro
                ? 'Cue editor — Pro'
                : canOpenCueEditor
                  ? 'Cue editor'
                  : 'Select a timeline track first'
            }
          >
            <IconButton
              icon={Flag}
              aria-label="Cue editor"
              disabled={isPro && !canOpenCueEditor}
              title={
                isPro && !canOpenCueEditor
                  ? 'Select a track in your timeline to edit its cue points'
                  : undefined
              }
              onClick={
                !isPro
                  ? () => showUpgrade('cueEditor')
                  : canOpenCueEditor
                    ? () => showModal('cueEditor')
                    : undefined
              }
              style={{
                opacity: !isPro || canOpenCueEditor ? 1 : 0.35,
                cursor: !isPro || canOpenCueEditor ? 'pointer' : 'default'
              }}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          <span className="dock-divider" aria-hidden="true" />

          {/* Validate — Pro */}
          <span className="dock-item" data-label={isPro ? 'Validate set' : 'Validate set — Pro'}>
            <IconButton
              icon={ShieldCheck}
              aria-label="Validate set"
              onClick={() => (isPro ? showModal('validate') : showUpgrade('export'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          {/* Export — Pro */}
          <span className="dock-item" data-label={isPro ? 'Export' : 'Export — Pro'}>
            <IconButton
              icon={HardDrive}
              aria-label="Export"
              onClick={() => (isPro ? showModal('export') : showUpgrade('export'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>
        </div>
      </div>
    </div>
  )
}
