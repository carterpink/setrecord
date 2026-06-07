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
  // Seconds into the file where this preview began — drives the max-length cap.
  const startSecsRef = useRef(0)
  // True while a fade ramp owns audio.volume, so the volume effect doesn't clobber it.
  const fadingRef = useRef(false)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime * 1000)
      // Auto-stop once the preview has run for the user's max length (Settings → Playback).
      const max = usePlaybackStore.getState().previewMaxSeconds
      if (max > 0 && audio.currentTime - startSecsRef.current >= max) {
        usePlaybackStore.getState().stopPreview()
      }
    })
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
      if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
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
      startSecsRef.current = Math.max(0, secs)
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

    audio
      .play()
      .then(() => {
        // Optional fade-in on a fresh preview (Settings → Playback). A short ramp
        // owns the volume briefly; `fadingRef` tells the volume effect to wait.
        if (!usePlaybackStore.getState().previewFade) return
        const target = usePlaybackStore.getState().volume
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
        fadingRef.current = true
        audio.volume = 0
        const steps = 16
        const stepMs = 280 / steps
        let i = 0
        fadeTimerRef.current = setInterval(() => {
          i += 1
          audio.volume = Math.min(target, (i / steps) * target)
          if (i >= steps) {
            if (fadeTimerRef.current) clearInterval(fadeTimerRef.current)
            fadeTimerRef.current = null
            fadingRef.current = false
          }
        }, stepMs)
      })
      .catch((err) => {
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

  // Sync volume changes from the store (skipped while a fade ramp owns the volume).
  const volume = usePlaybackStore((s) => s.volume)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || fadingRef.current) return
    audio.volume = volume
  }, [volume])

  // Route preview audio to the chosen output device (Settings → Playback).
  // setSinkId is best-effort: unsupported or stale-device errors degrade to default.
  const outputDeviceId = usePlaybackStore((s) => s.outputDeviceId)
  useEffect(() => {
    const audio = audioRef.current as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | null
    if (!audio || typeof audio.setSinkId !== 'function') return
    audio.setSinkId(outputDeviceId ?? '').catch((err) => {
      console.error('[preview-audio] setSinkId failed', err)
    })
  }, [outputDeviceId])

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
