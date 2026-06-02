import type { MatchReason, SetMeta, SetTrack, Suggestion, Track, TransitionScore } from '@/types'

/**
 * Phase 1/2 dummy data — used by Timeline + Suggestions panels until Phase 3
 * wires those to real SQLite data. LibraryPanel now reads from libraryStore instead.
 */

// ───────── Helpers ─────────

function dummyTrack(
  partial: Pick<Track, 'id' | 'title' | 'artist' | 'bpm' | 'key' | 'energy' | 'duration'> & {
    artGradient?: string
  }
): Track {
  return {
    filePath: '',
    format: 'mp3',
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: '2024-01-01T00:00:00.000Z',
    ...partial
  }
}

function dummyScore(overall: TransitionScore['overall'], label: string): TransitionScore {
  return {
    overall,
    score: overall === 'clean' ? 85 : overall === 'messy' ? 55 : 20,
    bpmDelta: 0,
    keyCompatibility: 'perfect',
    energyDelta: 0,
    reasons: [label],
    dotKind: overall === 'clean' ? 'success' : overall === 'messy' ? 'warning' : 'danger',
    label
  }
}

// ───────── Library ─────────

export const LIBRARY_TRACKS: Track[] = [
  dummyTrack({
    id: 'lib-01',
    title: 'Outer space',
    artist: 'Maral Salmassi',
    bpm: 124.0,
    key: '9A',
    energy: 6,
    duration: 402,
    artGradient: 'linear-gradient(135deg,#3D2A6E,#6E2A4A)'
  }),
  dummyTrack({
    id: 'lib-02',
    title: 'Reverb gospel',
    artist: 'DJ Python · Mas amable',
    bpm: 122.5,
    key: '8A',
    energy: 5,
    duration: 386,
    artGradient: 'linear-gradient(135deg,#1A3D5E,#1A5E4D)'
  }),
  dummyTrack({
    id: 'lib-03',
    title: 'Limpid air',
    artist: 'upsammy · Zoom',
    bpm: 128.0,
    key: '10A',
    energy: 7,
    duration: 354,
    artGradient: 'linear-gradient(135deg,#5E1A3F,#3F1A5E)'
  }),
  dummyTrack({
    id: 'lib-04',
    title: 'Stoned at the jukebox',
    artist: 'Skee Mask',
    bpm: 126.0,
    key: '9B',
    energy: 6,
    duration: 412,
    artGradient: 'linear-gradient(135deg,#2A4E1A,#1A4E5E)'
  }),
  dummyTrack({
    id: 'lib-05',
    title: 'Kerala dust',
    artist: 'Four Tet',
    bpm: 120.0,
    key: '7A',
    energy: 4,
    duration: 488,
    artGradient: 'linear-gradient(135deg,#6E2A2A,#2A2A6E)'
  }),
  dummyTrack({
    id: 'lib-06',
    title: 'Dripfeed',
    artist: 'Pearson Sound',
    bpm: 130.0,
    key: '11A',
    energy: 8,
    duration: 366,
    artGradient: 'linear-gradient(135deg,#2A6E5E,#5E2A6E)'
  }),
  dummyTrack({
    id: 'lib-07',
    title: 'Maelstrom',
    artist: 'Objekt',
    bpm: 132.0,
    key: '11B',
    energy: 9,
    duration: 398,
    artGradient: 'linear-gradient(135deg,#3F4E1A,#1A3F4E)'
  }),
  dummyTrack({
    id: 'lib-08',
    title: 'Harvest moon',
    artist: 'Avalon Emerson',
    bpm: 121.0,
    key: '7B',
    energy: 5,
    duration: 432,
    artGradient: 'linear-gradient(135deg,#5E3F1A,#1A5E3F)'
  }),
  dummyTrack({
    id: 'lib-09',
    title: 'Anchor song',
    artist: 'Björk · Debut',
    bpm: 118.0,
    key: '6A',
    energy: 4,
    duration: 256,
    artGradient: 'linear-gradient(135deg,#2A3F6E,#6E2A3F)'
  })
]

export const LIBRARY_PLAYING_INDEX = 0

// ───────── Active set (used by Timeline + Suggestions until Phase 3) ─────────

export const SET_META: SetMeta = {
  id: 'set-friday',
  name: 'Friday — peak hour',
  durationMinutes: 90,
  trackCount: 22,
  bpmMin: 120,
  bpmMax: 128
}

export const SET_TRACKS: SetTrack[] = [
  {
    id: 'st-01',
    trackId: 'set-anchor',
    position: 0,
    track: dummyTrack({
      id: 'set-anchor',
      title: 'Anchor song',
      artist: 'Björk',
      bpm: 118.0,
      key: '6A',
      energy: 4,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean')
  },
  {
    id: 'st-02',
    trackId: 'set-kerala',
    position: 1,
    track: dummyTrack({
      id: 'set-kerala',
      title: 'Kerala dust',
      artist: 'Four Tet',
      bpm: 120.0,
      key: '7A',
      energy: 5,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean')
  },
  {
    id: 'st-03',
    trackId: 'set-reverb',
    position: 2,
    track: dummyTrack({
      id: 'set-reverb',
      title: 'Reverb gospel',
      artist: 'DJ Python',
      bpm: 122.5,
      key: '8A',
      energy: 5,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean')
  },
  {
    id: 'st-04',
    trackId: 'set-outer',
    position: 3,
    playing: true,
    track: dummyTrack({
      id: 'set-outer',
      title: 'Outer space',
      artist: 'Maral Salmassi',
      bpm: 124.0,
      key: '9A',
      energy: 6,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean')
  },
  {
    id: 'st-05',
    trackId: 'set-polar',
    position: 4,
    track: dummyTrack({
      id: 'set-polar',
      title: 'Polar inertia',
      artist: 'Cassegrain',
      bpm: 124.0,
      key: '9A',
      energy: 6,
      duration: 402
    }),
    transitionScore: dummyScore('messy', 'Messy · key clash')
  },
  {
    id: 'st-06',
    trackId: 'set-limpid',
    position: 5,
    track: dummyTrack({
      id: 'set-limpid',
      title: 'Limpid air',
      artist: 'upsammy',
      bpm: 128.0,
      key: '10A',
      energy: 7,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean')
  }
]

export const SET_SELECTED_INDEX = 3

// ───────── Suggestions ─────────

const reason = (label: string, quality: MatchReason['quality'] = 'neutral'): MatchReason => ({
  label,
  type: 'key',
  quality
})

export const SUGGESTIONS: Suggestion[] = [
  {
    rank: 1,
    best: true,
    track: dummyTrack({
      id: 'sugg-polar',
      title: 'Polar inertia',
      artist: 'Cassegrain — Soporific',
      bpm: 124.0,
      key: '9A',
      energy: 6,
      duration: 402
    }),
    transitionScore: dummyScore('clean', 'Clean'),
    matchReasons: [
      reason('Perfect harmony', 'positive'),
      reason('Energy match'),
      reason('Smooth blend')
    ]
  },
  {
    rank: 2,
    track: dummyTrack({
      id: 'sugg-limpid',
      title: 'Limpid air',
      artist: 'upsammy — Zoom',
      bpm: 128.0,
      key: '10A',
      energy: 7,
      duration: 354
    }),
    transitionScore: dummyScore('clean', 'Clean'),
    matchReasons: [reason('Harmonic ↑'), reason('+4 BPM')]
  },
  {
    rank: 3,
    track: dummyTrack({
      id: 'sugg-maelstrom',
      title: 'Maelstrom',
      artist: 'Objekt — Cocoon Crush',
      bpm: 132.0,
      key: '11B',
      energy: 9,
      duration: 398
    }),
    transitionScore: dummyScore('messy', 'Messy'),
    matchReasons: [reason('Energy +1'), reason('Bridge to peak')]
  },
  {
    rank: 4,
    track: dummyTrack({
      id: 'sugg-dripfeed',
      title: 'Dripfeed',
      artist: 'Pearson Sound',
      bpm: 130.0,
      key: '11A',
      energy: 8,
      duration: 366
    }),
    transitionScore: dummyScore('clean', 'Clean'),
    matchReasons: [reason('Texture match')]
  }
]
