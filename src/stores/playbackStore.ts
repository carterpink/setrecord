import { create } from 'zustand'
import type { Track } from '@/types'

interface PlaybackState {
  previewTrack: Track | null
  isPlaying: boolean
  currentTime: number // ms
  duration: number // ms
  volume: number // 0–1
  /** Incrementing token; usePreviewAudio watches it to seek the singleton audio. */
  seekToken: number
  /** Target seek position in ms, applied when seekToken changes. */
  seekTargetMs: number
  // ── User preferences (Settings → Playback), hydrated on boot + on Save. ──────
  /** Auto-stop the preview this many seconds after its start point. */
  previewMaxSeconds: number
  /** Short fade in/out on preview start/stop. */
  previewFade: boolean
  /** Audio output device id for previews. null = system default. */
  outputDeviceId: string | null
  startPreview: (track: Track) => void
  stopPreview: () => void
  togglePlay: () => void
  setCurrentTime: (ms: number) => void
  setDuration: (ms: number) => void
  setIsPlaying: (v: boolean) => void
  requestSeek: (ms: number) => void
  setVolume: (v: number) => void
  /** Apply persisted playback preferences (boot + after Settings save). */
  applyPlaybackSettings: (s: {
    previewVolume: number
    previewMaxSeconds: number
    previewFade: boolean
    outputDeviceId: string | null
  }) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  previewTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  seekToken: 0,
  seekTargetMs: 0,
  previewMaxSeconds: 60,
  previewFade: false,
  outputDeviceId: null,

  startPreview: (track) => set({ previewTrack: track, isPlaying: true, currentTime: 0 }),
  stopPreview: () => set({ previewTrack: null, isPlaying: false, currentTime: 0, duration: 0 }),
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setCurrentTime: (ms) => set({ currentTime: ms }),
  setDuration: (ms) => set({ duration: ms }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  requestSeek: (ms) => set({ seekTargetMs: ms, seekToken: get().seekToken + 1 }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  applyPlaybackSettings: ({ previewVolume, previewMaxSeconds, previewFade, outputDeviceId }) =>
    set({
      volume: Math.max(0, Math.min(1, previewVolume)),
      previewMaxSeconds,
      previewFade,
      outputDeviceId
    })
}))
