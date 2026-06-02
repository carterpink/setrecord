import { useEffect, useRef } from 'react'
import { usePlaybackStore } from '@/stores/playbackStore'
import { toMediaUrl } from '@/utils/mediaUrl'
import { getPreviewStartMs } from '@/utils/previewStart'
import { setPreviewAudioElement } from '@/audio/previewAudioElement'

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
    // Publish the singleton so passive visualisers can read currentTime per-frame.
    setPreviewAudioElement(audio)

    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime * 1000))
    audio.addEventListener('durationchange', () =>
      setDuration(isFinite(audio.duration) ? audio.duration * 1000 : 0)
    )
    audio.addEventListener('ended', () => setIsPlaying(false))
    audio.addEventListener('error', () => {
      const e = audio.error
      console.error('[preview-audio] error', { code: e?.code, message: e?.message, src: audio.src })
      setIsPlaying(false)
    })

    return () => {
      audio.pause()
      audio.src = ''
      setPreviewAudioElement(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load and play when previewTrack changes
  const previewTrackId = usePlaybackStore((s) => s.previewTrack?.id)
  const previewFilePath = usePlaybackStore((s) => s.previewTrack?.filePath)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const track = usePlaybackStore.getState().previewTrack
    if (!previewFilePath || !track) {
      audio.pause()
      audio.src = ''
      return
    }
    const url = toMediaUrl(previewFilePath)
    audio.src = url

    // Seek to the smart start point once we know duration. If the track has a
    // default/hot/memory cue we can seek immediately (we know ms without
    // metadata); otherwise we wait for `loadedmetadata` to fall back to the
    // duration-relative heuristic.
    const knownStart = getPreviewStartMs(track, 0)
    const seekTo = (ms: number): void => {
      const secs = ms / 1000
      if (secs > 0) audio.currentTime = secs
    }

    if (knownStart > 0) {
      // Pre-set; browsers will clamp until metadata loads, then snap to value
      seekTo(knownStart)
    } else {
      const onMeta = (): void => {
        audio.removeEventListener('loadedmetadata', onMeta)
        const durMs = isFinite(audio.duration) ? audio.duration * 1000 : 0
        seekTo(getPreviewStartMs(track, durMs))
      }
      audio.addEventListener('loadedmetadata', onMeta)
    }

    audio.play().catch((err) => {
      console.error('[preview-audio] play() rejected', err, 'src:', audio.src)
      setIsPlaying(false)
    })
  }, [previewTrackId, previewFilePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync play/pause changes from the store
  const isPlaying = usePlaybackStore((s) => s.isPlaying)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('[preview-audio] resume play() rejected', err)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume changes from the store
  const volume = usePlaybackStore((s) => s.volume)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  // Honor scrub seeks from the inline waveforms
  const seekToken = usePlaybackStore((s) => s.seekToken)
  useEffect(() => {
    if (seekToken === 0) return
    const audio = audioRef.current
    if (!audio || !audio.src) return
    const targetMs = usePlaybackStore.getState().seekTargetMs
    const secs = targetMs / 1000
    if (isFinite(secs) && secs >= 0) {
      audio.currentTime = secs
    }
  }, [seekToken])
}
