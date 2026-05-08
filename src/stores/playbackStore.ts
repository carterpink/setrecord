import { create } from 'zustand'
import type { Track } from '@/types'

interface PlaybackState {
  previewTrack: Track | null
  isPlaying: boolean
  currentTime: number   // ms
  duration: number      // ms
  startPreview: (track: Track) => void
  stopPreview: () => void
  togglePlay: () => void
  setCurrentTime: (ms: number) => void
  setDuration: (ms: number) => void
  setIsPlaying: (v: boolean) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  previewTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,

  startPreview: (track) => set({ previewTrack: track, isPlaying: true, currentTime: 0 }),
  stopPreview: () => set({ previewTrack: null, isPlaying: false, currentTime: 0, duration: 0 }),
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setCurrentTime: (ms) => set({ currentTime: ms }),
  setDuration: (ms) => set({ duration: ms }),
  setIsPlaying: (v) => set({ isPlaying: v }),
}))
