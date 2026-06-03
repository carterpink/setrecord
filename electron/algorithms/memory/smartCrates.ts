/**
 * smartCrates.ts — Pure engine: JSON-serialisable rule sets that filter
 * tracks into themed "crates" without touching the database.
 *
 * CrateRule supports a predicate on each supported field.  A SmartCrate
 * combines a list of rules with match:'all' (AND) or match:'any' (OR).
 *
 * SEED_CRATES are preset crates shipped with the app.
 */

import type { Track } from '../../../src/types'
import type { SmartCrate, CrateRule } from '../../../src/types'
import { getKeyCompatibility } from '../../utils/camelot'

export type { SmartCrate, CrateRule }

function monthsAgo(isoDate: string, now: Date): number {
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
  return (now.getTime() - new Date(isoDate).getTime()) / msPerMonth
}

/**
 * Compute the BPM threshold for the top N% of a track set.
 * Returns 0 when the library is empty (so nothing matches the rule).
 */
function bpmTopPercentThreshold(tracks: Track[], topPercent: number): number {
  const bpms = tracks.map((t) => t.bpm).filter((b) => b > 0)
  if (bpms.length === 0) return Infinity
  bpms.sort((a, b) => a - b)
  const cutoffIndex = Math.floor(bpms.length * (1 - topPercent / 100))
  return bpms[Math.max(0, Math.min(cutoffIndex, bpms.length - 1))]
}

/**
 * Test a single rule against a track.
 */
function evalRule(rule: CrateRule, track: Track, now: Date, bpmThreshold: number): boolean {
  if (rule.bpmMin !== undefined && track.bpm < rule.bpmMin) return false
  if (rule.bpmMax !== undefined && track.bpm > rule.bpmMax) return false
  if (rule.energyMin !== undefined && track.energy < rule.energyMin) return false
  if (rule.energyMax !== undefined && track.energy > rule.energyMax) return false

  if (rule.keyExact !== undefined && track.key !== rule.keyExact) return false
  if (rule.keyCompatibleWith !== undefined) {
    const compat = getKeyCompatibility(track.key, rule.keyCompatibleWith)
    if (compat.relationship === 'clash') return false
  }

  if (rule.genreIncludes !== undefined) {
    const trackGenre = (track.genre ?? '').toLowerCase()
    if (!trackGenre.includes(rule.genreIncludes.toLowerCase())) return false
  }

  if (rule.playCountOp !== undefined && rule.playCountValue !== undefined) {
    const pc = track.playCount
    if (rule.playCountOp === 'gt' && !(pc > rule.playCountValue)) return false
    if (rule.playCountOp === 'lt' && !(pc < rule.playCountValue)) return false
    if (rule.playCountOp === 'gte' && !(pc >= rule.playCountValue)) return false
    if (rule.playCountOp === 'lte' && !(pc <= rule.playCountValue)) return false
    if (rule.playCountOp === 'eq' && pc !== rule.playCountValue) return false
  }

  if (rule.lastPlayedOlderThanMonths !== undefined) {
    if (!track.lastPlayed) return false // never played → doesn't qualify
    if (monthsAgo(track.lastPlayed, now) < rule.lastPlayedOlderThanMonths) return false
  }

  if (rule.ratingMin !== undefined && track.rating < rule.ratingMin) return false

  if (rule.neverPlayed === true && (track.playCount > 0 || track.lastPlayed)) return false
  if (rule.neverPlayed === false && track.playCount === 0) return false

  if (rule.missingMetadata === true) {
    const hasMissingMeta = !track.key || track.key === '' || track.bpm === 0
    if (!hasMissingMeta) return false
  }
  if (rule.missingMetadata === false) {
    if (!track.key || track.key === '' || track.bpm === 0) return false
  }

  if (rule.format !== undefined && track.format !== rule.format) return false

  if (rule.noCuePoints === true) {
    if (track.hotCues.length > 0 || track.cuePoints.length > 0) return false
  }

  if (rule.durationMinSec !== undefined && track.duration < rule.durationMinSec) return false
  if (rule.durationMaxSec !== undefined && track.duration > rule.durationMaxSec) return false

  if (rule.bpmTopPercentOfLibrary !== undefined && track.bpm < bpmThreshold) return false

  // Plain-language tags: must carry ALL of tagsInclude and NONE of tagsExclude.
  if (rule.tagsInclude && rule.tagsInclude.length > 0) {
    const have = new Set((track.tags ?? []).map((t) => t.value))
    if (!rule.tagsInclude.every((slug) => have.has(slug))) return false
  }
  if (rule.tagsExclude && rule.tagsExclude.length > 0) {
    const have = new Set((track.tags ?? []).map((t) => t.value))
    if (rule.tagsExclude.some((slug) => have.has(slug))) return false
  }

  return true
}

/**
 * Filter a library of tracks against a SmartCrate definition.
 * Returns tracks satisfying the crate rules under its match mode.
 */
export function evaluateCrate(crate: SmartCrate, tracks: Track[], now?: Date): Track[] {
  const _now = now ?? new Date()
  if (crate.rules.length === 0) return [...tracks]

  // Pre-compute the BPM percentile threshold once if any rule uses it.
  let bpmThreshold = 0
  const usesPercentile = crate.rules.some((r) => r.bpmTopPercentOfLibrary !== undefined)
  if (usesPercentile) {
    // Pick the largest topPercent across rules — we only need one threshold per evaluation
    // because `bpmTopPercentOfLibrary` is single-value-per-rule and rules combine via match.
    // For 'all' the tightest (smallest percent) applies; for 'any' the loosest (largest).
    const percents = crate.rules
      .map((r) => r.bpmTopPercentOfLibrary)
      .filter((p): p is number => p !== undefined)
    const effective = crate.match === 'any' ? Math.max(...percents) : Math.min(...percents)
    bpmThreshold = bpmTopPercentThreshold(tracks, effective)
  }

  return tracks.filter((track) => {
    if (crate.match === 'any') {
      return crate.rules.some((rule) => evalRule(rule, track, _now, bpmThreshold))
    }
    return crate.rules.every((rule) => evalRule(rule, track, _now, bpmThreshold))
  })
}

// ───────── Seed crates ─────────

export const SEED_CRATES: SmartCrate[] = [
  {
    id: 'peak-weapons',
    name: 'Peak weapons',
    description: 'Energy 8+ and BPM in the top 30% of your library — ready-to-deploy bangers.',
    rules: [{ energyMin: 8, bpmTopPercentOfLibrary: 30 }],
    match: 'all'
  },
  {
    id: 'never-tested-live',
    name: 'Never tested live',
    description: 'Tracks you’ve never played at a gig or in a saved set.',
    rules: [{ neverPlayed: true }],
    match: 'all'
  },
  {
    id: 'forgotten-heaters',
    name: 'Forgotten heaters',
    description: 'Energy 7+, played 3+ times before, untouched for 6+ months.',
    rules: [
      { lastPlayedOlderThanMonths: 6 },
      { playCountOp: 'gte', playCountValue: 3 },
      { energyMin: 7 }
    ],
    match: 'all'
  },
  {
    id: 'overplayed',
    name: 'Overplayed',
    description: 'Tracks you’ve played 10+ times — your heaviest-rotation records.',
    rules: [{ playCountOp: 'gte', playCountValue: 10 }],
    match: 'all'
  },
  {
    id: 'missing-metadata',
    name: 'Missing metadata',
    description: 'Tracks with no key or no BPM — actionable library health.',
    rules: [{ missingMetadata: true }],
    match: 'all'
  },
  {
    id: 'safe-bridges',
    name: 'Safe bridges',
    description:
      'Mid-energy (4–6), fully-tagged tracks in a tight 120–128 BPM band — the groove glue.',
    // Mid-energy, fully-tagged tracks in a tight tempo band — the kind of
    // groove-preserving record you reach for to glue two sections together.
    rules: [
      { energyMin: 4, energyMax: 6 },
      { bpmMin: 120, bpmMax: 128 },
      { missingMetadata: false }
    ],
    match: 'all'
  },
  {
    id: 'downloaded-worth-auditioning',
    name: 'Downloaded, Worth Auditioning',
    description: 'Imported but never played and never cued — the audition backlog.',
    rules: [{ neverPlayed: true }, { noCuePoints: true }],
    match: 'all'
  }
]
