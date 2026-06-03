import type { CoachmarkKey } from '@/stores/coachmarkStore'

export interface CoachmarkCopy {
  title: string
  body: string
}

/**
 * Concise, plain-language first-sight explanations. Kept to one sentence each —
 * the full explanation + diagrams live behind the (i) LearnTooltip on the same
 * chip, which the coachmark points the user toward.
 */
export const COACHMARK_COPY: Record<CoachmarkKey, CoachmarkCopy> = {
  camelot: {
    title: 'This is a Camelot key',
    body: 'It tells you a track’s musical key. Tracks with the same number or one step apart mix together smoothly.'
  },
  bpm: {
    title: 'BPM = tempo',
    body: 'Beats per minute. Keep tracks within a few BPM of each other and the beats stay locked through the blend.'
  },
  energy: {
    title: 'Energy score (1–10)',
    body: 'How hard a track hits. Build the night by stepping energy up gradually — big jumps can lose the floor.'
  },
  transition: {
    title: 'Transition quality',
    body: 'Green means the mix into this track is clean, amber needs care, red is a likely trainwreck.'
  },
  energyCurve: {
    title: 'Your energy curve',
    body: 'Each point is one track’s energy. A rising line builds the room; a dip gives it a breather before the next peak.'
  }
}

/**
 * Lightweight, jargon-free explainer copy for the (i) tooltip, shown FREE to
 * self-identified beginners (the richer Pro explanation + diagram stays gated).
 * `summary`/`detail` match the shape of LearnTooltip's `basic` prop.
 */
export const BEGINNER_TOOLTIP_COPY: Record<CoachmarkKey, { summary: string; detail: string }> = {
  camelot: {
    summary: 'Camelot key',
    detail:
      'A simple code for a track’s musical key. Tracks sharing the same number — or one step up or down — sound harmonic when mixed together. Far-apart numbers can clash.'
  },
  bpm: {
    summary: 'BPM — beats per minute',
    detail:
      'How fast the track is. Mixing tracks that are close in BPM keeps the beats lined up through the blend; big tempo jumps are harder to pull off smoothly.'
  },
  energy: {
    summary: 'Energy score (1–10)',
    detail:
      'A read on how hard the track hits. Stepping energy up gradually builds the dancefloor; sudden drops can lose the room.'
  },
  transition: {
    summary: 'Transition quality',
    detail:
      'How clean the mix into this track is likely to be. Green is smooth, amber needs a careful blend, red is a likely clash.'
  },
  energyCurve: {
    summary: 'Energy curve',
    detail:
      'The shape of your set’s energy over time. A steady climb builds the night; a dip resets the room before the next lift.'
  }
}
