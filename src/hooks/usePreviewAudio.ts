import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '@/stores/playbackStore'

/**
 * Singleton HTMLAudioElement for library-row preview.
 * Mount once in AppShell; manages play/pause/load in response to playbackStore.
 */
export function usePreviewAudio(): void {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Stable action refs — avoids stale closures in event listeners
  const setCurrentTime = usePlaybackStore.getState().setCurrentTime
  const setDuration = usePlaybackStore.getState().setDuration
  const setIsPlaying = usePlaybackStore.getState().setIsPlaying

  // Create audio element once
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    audio.addEventListener('timeupdate', () =>
      setCurrentTime(audio.currentTime * 1000)
    )
    audio.addEventListener('durationchange', () =>
      setDuration(isFinite(audio.duration) ? audio.duration * 1000 : 0)
    )
    audio.addEventListener('ended', () => setIsPlaying(false))

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load and play when previewTrack changes
  const previewTrackId = usePlaybackStore((s) => s.previewTrack?.id)
  const previewFilePath = usePlaybackStore((s) => s.previewTrack?.filePath)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!previewFilePath) {
      audio.pause()
      audio.src = ''
      return
    }
    audio.src = 'media://' + previewFilePath
    audio.currentTime = 0
    audio.play().catch(() => setIsPlaying(false))
  }, [previewTrackId, previewFilePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause changes from the store
  const isPlaying = usePlaybackStore((s) => s.isPlaying)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps
}
