import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/shared/Modal'
import { useSelectionStore } from '@/stores/selectionStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useUiStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'

/**
 * Confirm a bulk remove. Removes from the SetRecord DB only — never touches the
 * audio files on disk — and offers an Undo via the resulting toast.
 */
export function RemoveConfirmModal(): React.JSX.Element {
  const { t } = useTranslation('power')
  const closeModal = useUiStore((s) => s.closeModal)
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const clearSelection = useSelectionStore((s) => s.clear)
  const ids = useMemo(() => [...selectedIds], [selectedIds])
  const count = ids.length
  const [busy, setBusy] = useState(false)

  async function confirm(): Promise<void> {
    setBusy(true)
    const removed = await useLibraryStore.getState().bulkDelete(ids)
    setBusy(false)
    clearSelection()
    closeModal()
    useToastStore.getState().push({
      kind: 'success',
      message: t('remove.done', { count: removed.length }),
      durationMs: 8000,
      action: removed.length
        ? {
            label: t('remove.undo'),
            onClick: () => {
              void useLibraryStore
                .getState()
                .bulkRestore(removed)
                .then(() =>
                  useToastStore.getState().success(t('remove.restored', { count: removed.length }))
                )
            }
          }
        : undefined
    })
  }

  return (
    <Modal
      onClose={closeModal}
      closeOnBackdrop={false}
      labelledById="remove-title"
      maxWidth={420}
      bloom={{ icon: 'shield', tone: 'magenta' }}
    >
      <h2 id="remove-title" className="modal-title">
        {t('remove.title', { count })}
      </h2>
      <p className="modal-subtitle">{t('remove.body')}</p>
      <div className="bulk-edit-actions">
        <button type="button" className="btn-ghost" onClick={closeModal}>
          {t('remove.cancel')}
        </button>
        <button
          type="button"
          className="btn-danger-solid"
          disabled={busy}
          onClick={() => void confirm()}
        >
          {t('remove.confirm', { count })}
        </button>
      </div>
    </Modal>
  )
}
