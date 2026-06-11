import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, Download, FilePlus2, Flag, ListPlus, Pencil, Trash2, X } from 'lucide-react'
import { motion, AnimatePresence } from '@/components/shared/Motion'
import { useSelectionStore } from '@/stores/selectionStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { useIsPro } from '@/stores/licenseStore'
import { useToastStore } from '@/stores/toastStore'
import { formatTotalDuration } from '@/utils/format'

interface MenuItem {
  label: string
  onClick: () => void
}

/** Small popover menu anchored above a toolbar button. */
function ToolbarMenu({
  label,
  icon: Icon,
  items
}: {
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  items: MenuItem[]
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="selection-toolbar-menu" ref={ref}>
      <button type="button" className="selection-toolbar-btn" onClick={() => setOpen((v) => !v)}>
        <Icon size={14} strokeWidth={1.7} />
        <span>{label}</span>
        <ChevronUp size={12} strokeWidth={2} style={{ opacity: 0.6 }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="selection-toolbar-popover glass-3"
            role="menu"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0.12, 1] }}
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className="selection-toolbar-popover-item"
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
              >
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SelectionToolbar(): React.JSX.Element {
  const { t } = useTranslation('power')
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clear = useSelectionStore((s) => s.clear)
  const tracks = useLibraryStore((s) => s.tracks)
  const isPro = useIsPro()
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const showModal = useUiStore((s) => s.showModal)

  const count = selectedIds.size
  const selectedTracks = useMemo(
    () => tracks.filter((tr) => selectedIds.has(tr.id)),
    [tracks, selectedIds]
  )

  const stats = useMemo(() => {
    if (selectedTracks.length === 0) return null
    const bpms = selectedTracks.map((tr) => tr.bpm).filter((b) => b > 0)
    const energies = selectedTracks.map((tr) => tr.energy).filter((e) => e > 0)
    const keys = new Set(selectedTracks.map((tr) => tr.key).filter(Boolean))
    const totalSec = selectedTracks.reduce((sum, tr) => sum + (tr.duration || 0), 0)
    return {
      avgBpm: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0,
      keyCount: keys.size,
      energyMin: energies.length ? Math.min(...energies) : 0,
      energyMax: energies.length ? Math.max(...energies) : 0,
      runtime: formatTotalDuration(totalSec)
    }
  }, [selectedTracks])

  const toast = useToastStore.getState()

  function doAddToSet(): void {
    useSetStore.getState().addTracksToCurrent(selectedTracks)
    toast.success(t('toolbar.addedToSet', { count }))
    clear()
  }
  function doNewSet(): void {
    useSetStore.getState().createSetFromTracks(`${t('toolbar.newSet')} (${count})`, selectedTracks)
    toast.success(t('toolbar.newSetCreated', { count }))
    clear()
  }
  function doEdit(): void {
    if (!isPro) {
      showUpgrade('bulkEdit')
      return
    }
    showModal('bulkEdit')
  }
  async function doFlagForGig(): Promise<void> {
    await window.setrecord.lifecycleFlagForGig([...selectedIds])
    toast.success(t('toolbar.flagged', { count }))
    clear()
  }
  async function doLifecycle(state: string): Promise<void> {
    await window.setrecord.tracksBulkSetLifecycle([...selectedIds], state)
    toast.success(t('toolbar.lifecycleSet', { count }))
    clear()
  }
  function doExport(): void {
    if (!isPro) {
      showUpgrade('export')
      return
    }
    useSetStore.getState().createSetFromTracks(`${t('toolbar.newSet')} (${count})`, selectedTracks)
    showModal('export')
    clear()
  }
  function doRemove(): void {
    showModal('removeConfirm')
  }

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="selection-toolbar glass-3"
          role="region"
          aria-label={t('toolbar.selected', { count })}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0.12, 1] }}
        >
          <div className="selection-toolbar-stats" aria-live="polite">
            <span className="selection-toolbar-count">{t('toolbar.selected', { count })}</span>
            {stats && (
              <span className="selection-toolbar-meta">
                {t('toolbar.avgBpm', { bpm: stats.avgBpm })} ·{' '}
                {t('toolbar.keys', {
                  count: stats.keyCount
                })}{' '}
                · {t('toolbar.energy', { min: stats.energyMin, max: stats.energyMax })} ·{' '}
                {stats.runtime}
              </span>
            )}
          </div>
          <div className="selection-toolbar-actions">
            <button type="button" className="selection-toolbar-btn" onClick={doAddToSet}>
              <ListPlus size={14} strokeWidth={1.7} />
              <span>{t('toolbar.addToSet')}</span>
            </button>
            <button type="button" className="selection-toolbar-btn" onClick={doNewSet}>
              <FilePlus2 size={14} strokeWidth={1.7} />
              <span>{t('toolbar.newSet')}</span>
            </button>
            <button
              type="button"
              className={`selection-toolbar-btn${isPro ? '' : ' is-pro'}`}
              onClick={doEdit}
            >
              <Pencil size={14} strokeWidth={1.7} />
              <span>{t('toolbar.edit')}</span>
            </button>
            <ToolbarMenu
              label={t('toolbar.flag')}
              icon={Flag}
              items={[
                { label: t('toolbar.flagForGig'), onClick: () => void doFlagForGig() },
                {
                  label: t('toolbar.lifecycleTesting'),
                  onClick: () => void doLifecycle('testing')
                },
                { label: t('toolbar.lifecycleActive'), onClick: () => void doLifecycle('active') },
                { label: t('toolbar.lifecycleArchive'), onClick: () => void doLifecycle('archive') }
              ]}
            />
            <button
              type="button"
              className={`selection-toolbar-btn${isPro ? '' : ' is-pro'}`}
              onClick={doExport}
            >
              <Download size={14} strokeWidth={1.7} />
              <span>{t('toolbar.export')}</span>
            </button>
            <button
              type="button"
              className="selection-toolbar-btn selection-toolbar-btn--danger"
              onClick={doRemove}
            >
              <Trash2 size={14} strokeWidth={1.7} />
              <span>{t('toolbar.remove')}</span>
            </button>
            <button
              type="button"
              className="selection-toolbar-close"
              aria-label={t('toolbar.clear')}
              onClick={clear}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
