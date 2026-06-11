/**
 * Entitlements — the single map of what SetRecord Pro unlocks (Section 16).
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
  | 'autoTagger'
  | 'hostCollab'
  | 'graph'
  | 'bulkEdit'
  | 'commandPalette'

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
    label: 'Library intelligence',
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
  },
  autoTagger: {
    label: 'Tags',
    blurb: 'Customise your tags and send them straight to Rekordbox.'
  },
  hostCollab: {
    label: 'Live Collaboration',
    blurb: 'Build a set together in real time — invite a back-to-back partner to join your session.'
  },
  graph: {
    label: 'Constellation',
    blurb:
      'See where every track could go next — harmonic and BPM-compatible mixes you haven’t tried yet.'
  },
  bulkEdit: {
    label: 'Bulk editing',
    blurb: 'Select many tracks and edit tags, energy and metadata — or export them — in one move.'
  },
  commandPalette: {
    label: 'Command palette',
    blurb: 'Press ⌘P to jump to any track, crate, set or action instantly.'
  }
}

/** True when a feature is locked for the given tier. */
export function isLocked(feature: ProFeature, tier: LicenseTier): boolean {
  return tier !== 'pro' && feature in PRO_FEATURES
}

// ── Commerce display (mirrors electron/services/licensing/signingKey.ts) ──────
//
// Three tiers, deliberately arranged for the paywall (see UpgradeModal):
//   • monthly  — decoy: weakest value ($9×12 = $108/yr) so annual's saving is obvious
//   • annual   — the recommended default, centre-stage; framed per-month to shrink
//                the number ($79 ÷ 12 ≈ $6.58/mo) and against monthly to show savings
//   • lifetime — the high anchor; "pay once" for buyers who hate subscriptions
// `perMonth` / `save` / `sub` are pre-computed copy so the component stays dumb.

export const PRO_PRICING = {
  monthly: {
    price: '$9',
    period: 'per month',
    sub: 'Billed monthly. Cancel anytime.'
  },
  annual: {
    price: '$79',
    period: 'per year',
    perMonth: '$6.58/mo',
    sub: 'Billed once a year. Cancel anytime.',
    save: 'Save $29 a year vs monthly'
  },
  lifetime: {
    price: '$199',
    period: 'one-time',
    sub: 'Pay once. Yours forever, including future updates.'
  }
} as const

/**
 * Suggested tip amounts (USD). Empty = the tip section is hidden entirely:
 * the checkout backend has no tip product yet, so showing the pills would
 * surface buttons that can only fail. Re-populate once a Lemon Squeezy
 * pay-what-you-want tip variant exists and main.ts routes plan==='tip' to it.
 */
export const TIP_AMOUNTS: readonly number[] = []

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
