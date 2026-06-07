import { Flag, HardDrive, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/shared/IconButton'
import { ProBadge } from '@/components/shared/ProGate'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useLicenseStore } from '@/stores/licenseStore'

export function BottomDock(): React.JSX.Element {
  const { t } = useTranslation('layout')
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
          <span
            className="dock-item"
            data-label={isPro ? t('dock.setArchitect') : t('dock.setArchitectPro')}
          >
            <IconButton
              icon={Sparkles}
              aria-label={t('dock.setArchitect')}
              onClick={() => (isPro ? showModal('architect') : showUpgrade('setArchitect'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          {/* Smart filter — Pro; dimmed when no track selected */}
          <span
            className="dock-item"
            data-label={isPro ? t('dock.smartFilter') : t('dock.smartFilterPro')}
          >
            <IconButton
              icon={Zap}
              aria-label={t('dock.smartFilter')}
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
                ? t('dock.cueEditorPro')
                : canOpenCueEditor
                  ? t('dock.cueEditor')
                  : t('dock.cueEditorSelectFirst')
            }
          >
            <IconButton
              icon={Flag}
              aria-label={t('dock.cueEditor')}
              disabled={isPro && !canOpenCueEditor}
              title={isPro && !canOpenCueEditor ? t('dock.cueEditorTitle') : undefined}
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
          <span
            className="dock-item"
            data-label={isPro ? t('dock.validateSet') : t('dock.validateSetPro')}
          >
            <IconButton
              icon={ShieldCheck}
              aria-label={t('dock.validateSet')}
              onClick={() => (isPro ? showModal('validate') : showUpgrade('export'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>

          {/* Export — Pro */}
          <span className="dock-item" data-label={isPro ? t('dock.export') : t('dock.exportPro')}>
            <IconButton
              icon={HardDrive}
              aria-label={t('dock.export')}
              onClick={() => (isPro ? showModal('export') : showUpgrade('export'))}
            />
            {!isPro && <ProBadge className="dock-pro-badge" />}
          </span>
        </div>
      </div>
    </div>
  )
}
