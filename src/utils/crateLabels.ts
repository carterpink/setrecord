/**
 * crateLabels.ts — Render a SmartCrate's rules as plain-English text for the UI.
 * Used by the Crates section to show one-line subtitles on custom crates that
 * don't have an author-supplied `description`, and to inspect rule logic.
 */

import type { CrateRule, SmartCrate } from '@/types'

function formatRule(r: CrateRule): string {
  const parts: string[] = []
  if (r.bpmMin != null && r.bpmMax != null) parts.push(`BPM ${r.bpmMin}–${r.bpmMax}`)
  else if (r.bpmMin != null) parts.push(`BPM ≥ ${r.bpmMin}`)
  else if (r.bpmMax != null) parts.push(`BPM ≤ ${r.bpmMax}`)

  if (r.bpmTopPercentOfLibrary != null)
    parts.push(`BPM in top ${r.bpmTopPercentOfLibrary}% of library`)

  if (r.energyMin != null && r.energyMax != null) parts.push(`Energy ${r.energyMin}–${r.energyMax}`)
  else if (r.energyMin != null) parts.push(`Energy ≥ ${r.energyMin}`)
  else if (r.energyMax != null) parts.push(`Energy ≤ ${r.energyMax}`)

  if (r.keyExact) parts.push(`Key = ${r.keyExact}`)
  if (r.keyCompatibleWith) parts.push(`Key compatible with ${r.keyCompatibleWith}`)
  if (r.genreIncludes) parts.push(`Genre contains “${r.genreIncludes}”`)
  if (r.ratingMin != null) parts.push(`Rating ≥ ${r.ratingMin}★`)

  if (r.playCountOp && r.playCountValue != null) {
    const op = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=' }[r.playCountOp]
    parts.push(`Play count ${op} ${r.playCountValue}`)
  }
  if (r.lastPlayedOlderThanMonths != null)
    parts.push(`Not played in ${r.lastPlayedOlderThanMonths}+ months`)

  if (r.neverPlayed === true) parts.push('Never played live')
  if (r.missingMetadata === true) parts.push('Missing key or BPM')
  if (r.missingMetadata === false) parts.push('Fully tagged')
  if (r.format) parts.push(`Format = ${r.format}`)
  if (r.noCuePoints === true) parts.push('No cue points set')

  if (r.durationMinSec != null && r.durationMaxSec != null) {
    parts.push(`${Math.round(r.durationMinSec / 60)}–${Math.round(r.durationMaxSec / 60)} min`)
  } else if (r.durationMinSec != null) {
    parts.push(`≥ ${Math.round(r.durationMinSec / 60)} min`)
  } else if (r.durationMaxSec != null) {
    parts.push(`≤ ${Math.round(r.durationMaxSec / 60)} min`)
  }

  return parts.join(' · ') || 'Empty rule'
}

/**
 * Render a one-line summary of a crate's rules. Honours any author-supplied
 * `description` first; otherwise synthesises from the rule list.
 */
export function formatCrateRules(crate: SmartCrate): string {
  if (crate.description) return crate.description
  if (crate.rules.length === 0) return 'No rules — matches all tracks.'
  const joiner = crate.match === 'any' ? ' OR ' : ' AND '
  return crate.rules.map(formatRule).join(joiner)
}

/** Render rules as separate lines (used in the inspect/disclosure block). */
export function formatCrateRuleLines(crate: SmartCrate): string[] {
  return crate.rules.map(formatRule)
}
