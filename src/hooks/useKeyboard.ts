import { useEffect } from 'react'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Global keyboard shortcut handler. Mount once in AppShell.
 *
 * ⌘K        — focus library search
 * Space      — toggle preview playback (ignored inside inputs)
 * Escape     — close the topmost open modal
 * ⌘Z        — undo last set action (add / remove / reorder)
 * ⌘N        — create a new set
 * Delete     — remove the selected timeline track (ignored inside inputs)
 * Backspace  — same as Delete when not in an input
 */
export function useKeyboard(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const inInput =
        tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable
      const cmd = e.metaKey || e.ctrlKey

      // ⌘K — focus search regardless of focus position
      if (cmd && e.key === 'k') {
        e.preventDefault()
        useUiStore.getState().requestSearchFocus()
        return
      }

      // ⌘Z — undo last set change
      if (cmd && !e.shiftKey && e.key === 'z') {
        // Only fire when not in a text field so native text undo still works.
        if (!inInput) {
          e.preventDefault()
          useSetStore.getState().undo()
        }
        return
      }

      // ⌘N — new set
      if (cmd && e.key === 'n') {
        if (!inInput) {
          e.preventDefault()
          useSetStore.getState().createSet()
        }
        return
      }

      // Escape — close open modal
      if (e.key === 'Escape') {
        const { openModal, closeModal } = useUiStore.getState()
        if (openModal) {
          e.preventDefault()
          closeModal()
        }
        return
      }

      // Space — toggle preview (only when not in an input and a track is loaded)
      if (e.key === ' ' && !inInput) {
        const { previewTrack: track, togglePlay: toggle } = usePlaybackStore.getState()
        if (track) {
          e.preventDefault()
          e.stopImmediatePropagation()
          toggle()
        }
        return
      }

      // Delete / Backspace — remove the selected timeline track
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        const { currentSet, selectedTrackId, removeTrack } = useSetStore.getState()
        if (currentSet && selectedTrackId) {
          e.preventDefault()
          removeTrack(selectedTrackId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
