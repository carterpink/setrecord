import { useEffect } from 'react'
import { usePlaybackStore } from '@/stores/playbackStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * Global keyboard shortcut handler. Mount once in AppShell.
 *
 * ⌘K  — focus library search (switches to Library tab if needed)
 * Space — toggle preview playback (ignored when focus is inside an input/textarea)
 * Escape — close the topmost open modal
 */
export function useKeyboard(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable

      // ⌘K — focus search regardless of focus position
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        useUiStore.getState().requestSearchFocus()
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
          toggle()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
