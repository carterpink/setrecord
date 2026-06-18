import { create } from 'zustand'
import type { Track, TrackResume, CourageResult } from '@/types'

/**
 * trackInspectStore — app-global host for the per-track "inspect" overlays
 * (Track Résumé + Courage / "dare something different").
 *
 * These used to be local popover state inside LibraryPanel, which trapped them
 * in the narrow Prepare panel (a transformed ancestor clips `position: fixed`).
 * Hoisting them to a single store rendered at the app root (TrackInspectOverlays,
 * portaled to <body>) makes them true full-screen modals AND lets ANY track card
 * — library rows, recall lines, anywhere — open them with one call.
 *
 * Each opener fetches its data and guards against stale responses (a newer open
 * for a different track wins) so rapid right-clicks never flash old data.
 */

function api(): Window['setrecord'] | undefined {
  return typeof window !== 'undefined' ? window.setrecord : undefined
}

interface ResumeState {
  track: Track
  resume: TrackResume | null
  loading: boolean
}
interface CourageState {
  track: Track
  courage: CourageResult | null
  loading: boolean
}

interface TrackInspectState {
  resume: ResumeState | null
  courage: CourageState | null
  openResume: (track: Track) => Promise<void>
  closeResume: () => void
  openCourage: (track: Track) => Promise<void>
  closeCourage: () => void
}

export const useTrackInspectStore = create<TrackInspectState>((set, get) => ({
  resume: null,
  courage: null,

  openResume: async (track) => {
    set({ resume: { track, resume: null, loading: true } })
    const s = api()
    if (!s) {
      set({ resume: { track, resume: null, loading: false } })
      return
    }
    let resume: TrackResume | null = null
    try {
      resume = await s.historyTrackResume(track.id)
    } catch {
      resume = null
    }
    // Only apply if this is still the track the user is looking at.
    if (get().resume?.track.id === track.id) set({ resume: { track, resume, loading: false } })
  },
  closeResume: () => set({ resume: null }),

  openCourage: async (track) => {
    set({ courage: { track, courage: null, loading: true } })
    const s = api()
    if (!s) {
      set({ courage: { track, courage: null, loading: false } })
      return
    }
    let courage: CourageResult | null = null
    try {
      courage = await s.historyCourage(track.id)
    } catch {
      courage = null
    }
    if (get().courage?.track.id === track.id) set({ courage: { track, courage, loading: false } })
  },
  closeCourage: () => set({ courage: null })
}))
