import { create } from 'zustand'

/**
 * SetSense Live — renderer state for the floating HUD.
 *
 * Mirrors the main-process pipeline output (NowPlaying + LiveConsequence from
 * electron/services/live + electron/algorithms/liveSuggestions) as plain,
 * serialisable shapes. For step 4 the store is driven by a built-in MOCK that
 * simulates a set progressing — so the HUD is fully visible/testable with no
 * audio capture. The real path swaps `_startMock` for an IPC subscription to
 * the AudioFingerprintSource; the component layer never changes.
 */

export type KeyCompatibility = 'perfect' | 'compatible' | 'neutral' | 'clash'

export interface LiveTrackInfo {
  id: string
  title: string
  artist: string
  bpm: number
  key: string
  energy: number
}

export interface LiveNextUp {
  id: string
  title: string
  artist: string
  /** Transition cleanliness 0–100. */
  matchScore: number
  /** Signed deltas, current → candidate. */
  bpmDelta: number
  energyDelta: number
  keyCompatibility: KeyCompatibility
  /** Glanceable consequence line. */
  summary: string
  best: boolean
}

/** idle = not live; indexing = building the library fingerprint index;
 *  listening = live but nothing recognised; locked = track id'd. */
export type LiveStatus = 'idle' | 'indexing' | 'listening' | 'locked'

interface LiveState {
  isLive: boolean
  expanded: boolean
  status: LiveStatus
  confidence: number
  positionSec: number | null
  /** Seconds since Go Live — drives the control-strip timer. */
  elapsedSec: number
  /** Index-build progress while status === 'indexing'. */
  indexProgress: { done: number; total: number } | null
  /** Tracks in the live fingerprint index once built. */
  indexedTracks: number
  current: LiveTrackInfo | null
  nextUp: LiveNextUp[]
  /** 0–100 composite (energy fit / harmonic runway / BPM trap / ammunition). */
  setHealth: number

  goLive: () => void
  endLive: () => void
  setExpanded: (v: boolean) => void
  toggleExpanded: () => void

  /** Real path: mark the session live (starts the clock) without the mock. */
  setLiveActive: (active: boolean) => void
  /** Real path: index-build progress from the engine. */
  applyIndexProgress: (p: { done: number; total: number }) => void
  /** Real path: index ready → switch to listening. */
  setReady: (s: { indexedTracks: number }) => void
  /** Real path: apply a frame of live deck data pushed from the engine. */
  applyLiveData: (d: {
    status: LiveStatus
    confidence: number
    positionSec: number | null
    current: LiveTrackInfo | null
    nextUp: LiveNextUp[]
    setHealth: number
  }) => void

  /** @internal mock driver (replaced by the real IPC path above). */
  _startMock: () => void
}

// ───────── mock set timeline ─────────

interface Scene {
  status: LiveStatus
  current: LiveTrackInfo | null
  nextUp: LiveNextUp[]
  setHealth: number
  confidence: number
  /** how long this scene shows, ms */
  hold: number
}

const N = (
  id: string,
  title: string,
  artist: string,
  matchScore: number,
  bpmDelta: number,
  energyDelta: number,
  keyCompatibility: KeyCompatibility,
  summary: string,
  best = false
): LiveNextUp => ({ id, title, artist, matchScore, bpmDelta, energyDelta, keyCompatibility, summary, best })

const SCENES: Scene[] = [
  {
    status: 'listening',
    current: null,
    nextUp: [],
    setHealth: 0,
    confidence: 0,
    hold: 2600
  },
  {
    status: 'locked',
    confidence: 0.96,
    current: { id: 't1', title: 'Nocturne Drive', artist: 'Lunar Bloc', bpm: 124, key: '8A', energy: 6 },
    setHealth: 92,
    nextUp: [
      N('a', 'Escape Velocity', 'Vela', 97, 0, 1, 'perfect', 'Perfect harmony · +1 energy · same BPM', true),
      N('b', 'Midnight Driver', 'Korso', 94, 2, 0, 'compatible', 'Harmonic · holds energy · +2 BPM'),
      N('c', 'Oxygen', 'Halcyon', 88, 4, 2, 'neutral', 'Key OK · +2 energy · +4 BPM')
    ],
    hold: 5200
  },
  {
    status: 'locked',
    confidence: 0.93,
    current: { id: 't2', title: 'Escape Velocity', artist: 'Vela', bpm: 124, key: '8A', energy: 7 },
    setHealth: 88,
    nextUp: [
      N('d', 'Glass Horizon', 'Aeon Field', 95, 1, 1, 'perfect', 'Perfect harmony · +1 energy · +1 BPM', true),
      N('e', 'Afterglow', 'Mirae', 90, 0, 0, 'compatible', 'Harmonic · holds energy · same BPM'),
      N('f', 'Static Bloom', 'Rell', 72, 3, -1, 'clash', 'Key clash · -1 energy · +3 BPM')
    ],
    hold: 5200
  },
  {
    status: 'listening',
    current: null,
    nextUp: [],
    setHealth: 88,
    confidence: 0,
    hold: 1800
  },
  {
    status: 'locked',
    confidence: 0.91,
    current: { id: 't3', title: 'Glass Horizon', artist: 'Aeon Field', bpm: 125, key: '9A', energy: 8 },
    setHealth: 79,
    nextUp: [
      N('g', 'Peak Theory', 'Dusk Lab', 93, 1, 1, 'perfect', 'Perfect harmony · +1 energy · +1 BPM', true),
      N('h', 'Gravity Well', 'Soma Ridge', 86, 2, 0, 'compatible', 'Harmonic · holds energy · +2 BPM'),
      N('i', 'Last Light', 'Verzo', 64, -3, -2, 'clash', 'Key clash · -2 energy · -3 BPM')
    ],
    hold: 5200
  }
]

export const useLiveStore = create<LiveState>((set, get) => {
  let sceneIdx = 0
  let sceneTimer: ReturnType<typeof setTimeout> | null = null
  let posTimer: ReturnType<typeof setInterval> | null = null
  let clockTimer: ReturnType<typeof setInterval> | null = null

  const applyScene = (i: number): void => {
    const s = SCENES[i]
    set({
      status: s.status,
      current: s.current,
      nextUp: s.nextUp,
      setHealth: s.setHealth,
      confidence: s.confidence,
      positionSec: s.current ? Math.floor(20 + Math.random() * 40) : null
    })
  }

  const stopTimers = (): void => {
    if (sceneTimer) clearTimeout(sceneTimer)
    if (posTimer) clearInterval(posTimer)
    if (clockTimer) clearInterval(clockTimer)
    sceneTimer = null
    posTimer = null
    clockTimer = null
  }

  return {
    isLive: false,
    expanded: true,
    status: 'idle',
    confidence: 0,
    positionSec: null,
    elapsedSec: 0,
    indexProgress: null,
    indexedTracks: 0,
    current: null,
    nextUp: [],
    setHealth: 0,

    goLive: () => {
      if (get().isLive) return
      set({ isLive: true, expanded: true, elapsedSec: 0 })
      get()._startMock()
    },

    endLive: () => {
      stopTimers()
      sceneIdx = 0
      set({
        isLive: false,
        status: 'idle',
        current: null,
        nextUp: [],
        setHealth: 0,
        confidence: 0,
        positionSec: null,
        elapsedSec: 0,
        indexProgress: null,
        indexedTracks: 0
      })
    },

    setExpanded: (v) => set({ expanded: v }),
    toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),

    setLiveActive: (active) => {
      if (active) {
        if (get().isLive) return
        // Screen-read + metadata work immediately, so go straight to listening.
        set({ isLive: true, expanded: true, status: 'listening', indexProgress: null, elapsedSec: 0 })
        clockTimer = setInterval(() => set((s) => ({ elapsedSec: s.elapsedSec + 1 })), 1000)
      } else {
        get().endLive()
      }
    },

    applyIndexProgress: (p) => set({ isLive: true, status: 'indexing', indexProgress: p }),

    setReady: (s) =>
      set({ isLive: true, status: 'listening', indexedTracks: s.indexedTracks, indexProgress: null }),

    applyLiveData: (d) =>
      set({
        isLive: true,
        status: d.status,
        confidence: d.confidence,
        positionSec: d.positionSec,
        current: d.current,
        nextUp: d.nextUp,
        setHealth: d.setHealth
      }),

    _startMock: () => {
      if (sceneTimer || posTimer) return
      sceneIdx = 0
      applyScene(0)

      // Recursive timeout so each scene can hold for its own duration.
      const tick = (): void => {
        sceneTimer = setTimeout(() => {
          sceneIdx = (sceneIdx + 1) % SCENES.length
          applyScene(sceneIdx)
          tick()
        }, SCENES[sceneIdx].hold)
      }
      tick()

      // Tick the set timer always; advance the playhead while a track is locked.
      posTimer = setInterval(() => {
        const st = get()
        const patch: Partial<LiveState> = { elapsedSec: st.elapsedSec + 1 }
        if (st.status === 'locked' && st.positionSec != null) {
          patch.positionSec = st.positionSec + 1
        }
        set(patch)
      }, 1000)
    }
  }
})
