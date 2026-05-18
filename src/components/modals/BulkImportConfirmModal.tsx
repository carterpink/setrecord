import { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { IconButton } from '@/components/shared/IconButton'
import { motion, modalBackdrop, modalPanel } from '@/components/shared/Motion'
import { useUiStore } from '@/stores/uiStore'
import { useDiscoverStore } from '@/stores/discoverStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useSetStore } from '@/stores/setStore'
import { useToastStore } from '@/stores/toastStore'
import { matchManyToLibrary } from '@/utils/libraryMatch'
import { toPhantomTrack } from '@/utils/discoverPhantomTrack'

export function BulkImportConfirmModal(): React.JSX.Element | null {
  const closeModal = useUiStore((s) => s.closeModal)
  const showModal = useUiStore((s) => s.showModal)
  const activeId = useUiStore((s) => s.activeDiscoverSetId)
  const getSetById = useDiscoverStore((s) => s.getSetById)
  const allTracks = useLibraryStore((s) => s.tracks)
  const currentSet = useSetStore((s) => s.currentSet)
  const addTrack = useSetStore((s) => s.addTrack)
  const toast = useToastStore()
  const [unmatchedExpanded, setUnmatchedExpanded] = useState(false)

  const set = activeId ? getSetById(activeId) : undefined

  const summary = useMemo(() => {
    if (!set) return null
    const matches = matchManyToLibrary(set.tracklist, allTracks)
    const matched = matches.filter((m) => m.match !== null)
    const unmatched = matches.filter((m) => m.match === null)
    const alreadyInSet = matched.filter(
      (m) => currentSet?.tracks.some((st) => st.trackId === m.match!.id) ?? false
    )
    return { matches, matched, unmatched, alreadyInSet }
  }, [set, allTracks, currentSet])

  if (!set || !summary) return null

  const currentSetName = currentSet?.name ?? 'New set'
  const totalToAdd =
    summary.matched.length - summary.alreadyInSet.length + summary.unmatched.length

  function handleConfirm(): void {
    if (!set || !summary) return
    let added = 0
    for (const m of summary.matches) {
      const trackToAdd = m.match ?? toPhantomTrack(m.discoverTrack, set)
      // addTrack early-returns on duplicates so this is safe
      const sizeBefore = useSetStore.getState().currentSet?.tracks.length ?? 0
      addTrack(trackToAdd)
      const sizeAfter = useSetStore.getState().currentSet?.tracks.length ?? 0
      if (sizeAfter > sizeBefore) added++
    }
    toast.success(`Added ${added} track${added === 1 ? '' : 's'} to ${currentSetName}`, 6000)
    // Close both modals — bulk import then set details
    closeModal()
    setTimeout(() => {
      const open = useUiStore.getState().openModal
      if (open === 'setDetails') closeModal()
    }, 0)
  }

  return (
    <motion.div
      className="modal-overlay"
      variants={modalBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={() => showModal('setDetails')}
    >
      <motion.div
        className="modal glass-3 bulk-import-modal"
        variants={modalPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm bulk import"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <div className="modal-header">
          <span className="ss-h2">Bulk import set</span>
          <IconButton
            icon={X}
            size="sm"
            aria-label="Cancel"
            onClick={() => showModal('setDetails')}
          />
        </div>

        <div className="modal-body">
          <p className="ss-body-sm" style={{ marginBottom: 16 }}>
            Add {totalToAdd} of {set.tracklist.length} tracks from{' '}
            <strong>{set.djName}</strong> to <strong>{currentSetName}</strong>?
          </p>

          <div className="bulk-summary glass-1">
            <div className="bulk-summary-row">
              <span className="ss-body-sm">In your library</span>
              <span className="ss-mono bulk-summary-good">
                {summary.matched.length - summary.alreadyInSet.length}
              </span>
            </div>
            <div className="bulk-summary-row">
              <span className="ss-body-sm">Phantom (not in library)</span>
              <span className="ss-mono bulk-summary-phantom">{summary.unmatched.length}</span>
            </div>
            {summary.alreadyInSet.length > 0 && (
              <div className="bulk-summary-row">
                <span className="ss-body-sm">Already in this set</span>
                <span className="ss-mono bulk-summary-skip">
                  {summary.alreadyInSet.length}
                </span>
              </div>
            )}
          </div>

          {summary.unmatched.length > 0 && (
            <div className="bulk-unmatched">
              <button
                type="button"
                className="bulk-unmatched-toggle"
                onClick={() => setUnmatchedExpanded((v) => !v)}
                aria-expanded={unmatchedExpanded}
              >
                {unmatchedExpanded ? (
                  <ChevronDown size={14} strokeWidth={1.7} />
                ) : (
                  <ChevronRight size={14} strokeWidth={1.7} />
                )}
                <span className="ss-caption">
                  {summary.unmatched.length} phantom track{summary.unmatched.length === 1 ? '' : 's'}{' '}
                  will need buying/downloading
                </span>
              </button>
              {unmatchedExpanded && (
                <ul className="bulk-unmatched-list">
                  {summary.unmatched.map((m) => (
                    <li key={m.discoverTrack.id} className="ss-caption">
                      {m.discoverTrack.artist} — {m.discoverTrack.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button variant="ghost" onClick={() => showModal('setDetails')}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Add {totalToAdd} track{totalToAdd === 1 ? '' : 's'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
