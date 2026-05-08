import { create } from 'zustand'

interface PlaybackState {
  previewTrackId: string | null
  isPlaying: boolean
}

export const usePlaybackStore = create<PlaybackState>(() => ({
  previewTrackId: null,
  isPlaying: false,
}))
