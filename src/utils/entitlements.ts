/**
 * Entitlements — the single map of what SetSense Pro unlocks (Section 16).
 *
 * Every feature listed here is Pro-only; the free tier is "import + browse +
 * manual set building + a Library Health headline" (see PRD §16). The metadata
 * powers contextual paywall copy ("Set Architect is a Pro feature — …").
 */

import type { LicenseTier } from '@/types'

export type ProFeature =
  | 'suggestions'
  | 'setArchitect'
  | 'export'
  | 'recall'
  | 'smartCrates'
  | 'cueEditor'
  | 'healthDrilldown'

export interface ProFeatureMeta {
  /** Sentence-case feature name for the paywall headline. */
  label: string
  /** One line on what it does, shown under the headline. */
  blurb: string
}

export const PRO_FEATURES: Record<ProFeature, ProFeatureMeta> = {
  suggestions: {
    label: 'Suggested next',
    blurb: 'Ranked next-track suggestions with harmonic, BPM and energy reason tags.'
  },
  setArchitect: {
    label: 'Set Architect',
    blurb: 'Build a complete, beat-matched set from your library in one click.'
  },
  export: {
    label: 'Export with validation',
    blurb: 'Validate against your CDJs and export a Rekordbox XML you can trust.'
  },
  recall: {
    label: 'Recall',
    blurb: 'Natural-language search, Combos, Identity and full library health drill-down.'
  },
  smartCrates: {
    label: 'Smart Crates',
    blurb: 'Every built-in crate plus a custom rule builder for your own.'
  },
  cueEditor: {
    label: 'Cue point editor',
    blurb: 'Set the default cue and hot cues A–H on a full-width waveform.'
  },
  healthDrilldown: {
    label: 'Health drill-down',
    blurb: 'Click any health number to see the exact tracks and fix them.'
  }
}

/** True when a feature is locked for the given tier. */
export function isLocked(feature: ProFeature, tier: LicenseTier): boolean {
  return tier !== 'pro' && feature in PRO_FEATURES
}

// ── Commerce display (mirrors electron/services/licensing/signingKey.ts) ──────

export const PRO_PRICING = {
  subscription: { price: '$12', period: 'per month' },
  lifetime: { price: '$89', period: 'one-time' }
} as const

export const TIP_AMOUNTS = [5, 12, 25] as const

/** The value props shown on the paywall — order = priority. */
export const PRO_BENEFITS: readonly string[] = [
  'Suggested Next — ranked transitions with reason tags',
  'Set Architect — build a full set in one click',
  'Export with CDJ hardware validation',
  'Recall — natural-language search, Combos, Identity',
  'Library Health drill-down — click a number, fix the tracks',
  'Smart Crates — every preset + custom rule builder',
  'Cue point editor with hot cues A–H'
]
