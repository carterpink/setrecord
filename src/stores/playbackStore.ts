import { create } from 'zustand'
import type { Track } from '@/types'

interface PlaybackState {
  previewTrack: Track | null
  isPlaying: boolean
  currentTime: number   // ms
  duration: number      // ms
  volume: number        // 0–1
  /** Incrementing token; usePreviewAudio watches it to seek the singleton audio. */
  seekToken: number
  /** Target seek position in ms, applied when seekToken changes. */
  seekTargetMs: number
  startPreview: (track: Track) => void
  stopPreview: () => void
  togglePlay: () => void
  setCurrentTime: (ms: number) => void
  setDuration: (ms: number) => void
  setIsPlaying: (v: boolean) => void
  requestSeek: (ms: number) => void
  setVolume: (v: number) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  previewTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  seekToken: 0,
  seekTargetMs: 0,

  startPreview: (track) => set({ previewTrack: track, isPlaying: true, currentTime: 0 }),
  stopPreview: () => set({ previewTrack: null, isPlaying: false, currentTime: 0, duration: 0 }),
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setCurrentTime: (ms) => set({ currentTime: ms }),
  setDuration: (ms) => set({ duration: ms }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  requestSeek: (ms) => set({ seekTargetMs: ms, seekToken: get().seekToken + 1 }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
}))
