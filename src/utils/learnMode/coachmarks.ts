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
  }
}
