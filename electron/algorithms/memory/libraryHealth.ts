/**
 * libraryHealth.ts — Pure engine: analyse the library for actionable health
 * issues and detect duplicates via fuzzy artist+title matching.
 *
 * Scoring (change-matrix S12 P0 recalibration):
 *   Missing files dominate the score because at gig time a missing file is a
 *   0/100 outcome — the deck just won't play it. Flat per-track penalties with
 *   per-issue caps so a single category can't push the score to zero on its
 *   own. Numbers come from the matrix verbatim.
 *
 * Duplicate detection uses normalised-string equality on artist+title:
 * lowercase, strip punctuation, collapse whitespace. Predictable and tight
 * enough for the "same record imported twice" case without false positives.
 */

import type { Track } from '../../../src/types'
import type { HealthReport, HealthScoreBreakdown } from '../../../src/types'

export type { HealthReport }

const SUPPORTED_FORMATS = new Set(['mp3', 'aiff', 'wav', 'flac', 'm4a'])

/** Per-issue penalty weights — exported so the UI tooltip stays in sync. */
export const HEALTH_WEIGHTS = {
  missingFilesPerTrack: 2,
  missingFilesCap: 40,
  missingKeyPerTrack: 0.5,
  missingKeyCap: 20,
  missingBpmPerTrack: 0.5,
  missingBpmCap: 20,
  unsupportedFormatsPerTrack: 2,
  unsupportedFormatsCap: 10,
  duplicatesPerGroup: 1,
  duplicatesCap: 10
} as const

/**
 * Lowercase, strip punctuation, collapse whitespace. Exported so the backup
 * re-linker (backupService.ts) builds match keys with the SAME normalisation
 * the duplicate detector uses — otherwise migration matching and dedupe could
 * disagree on what counts as "the same record".
 */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalisedKey(track: Track): string {
  return `${normalise(track.artist)}|${normalise(track.title)}`
}

export function analyzeHealth(
  tracks: Track[],
  opts: { dismissedGroupKeys?: ReadonlySet<string> } = {}
): HealthReport {
  const dismissed = opts.dismissedGroupKeys ?? new Set<string>()

  const missingFileIds: string[] = []
  const missingKeyIds: string[] = []
  const missingBpmIds: string[] = []
  const unsupportedFormatIds: string[] = []
  const notAnalysedIds: string[] = []

  for (const t of tracks) {
    if (t.missingFile) missingFileIds.push(t.id)
    if (!t.key || t.key.trim() === '') missingKeyIds.push(t.id)
    if (!t.bpm || t.bpm === 0) missingBpmIds.push(t.id)
    if (!SUPPORTED_FORMATS.has(t.format)) unsupportedFormatIds.push(t.id)
    // "Not yet analysed" = energy analyser hasn't written a real value.
    // Treat undefined as analysed (legacy rows from before the column existed).
    if (t.energySource === 'pending') notAnalysedIds.push(t.id)
  }

  const groups = new Map<string, Track[]>()
  for (const t of tracks) {
    const key = normalisedKey(t)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  const duplicateGroups: Array<{ ids: string[]; normalisedKey: string }> = []
  for (const [key, group] of groups.entries()) {
    if (group.length > 1 && !dismissed.has(key)) {
      duplicateGroups.push({ ids: group.map((t) => t.id), normalisedKey: key })
    }
  }

  const dupTrackCount = duplicateGroups.reduce((sum, g) => sum + g.ids.length - 1, 0)
  const { healthScore, scoreBreakdown } = scoreHealth({
    missingFiles: missingFileIds.length,
    missingKey: missingKeyIds.length,
    missingBpm: missingBpmIds.length,
    unsupportedFormats: unsupportedFormatIds.length,
    duplicateGroups: duplicateGroups.length,
    dupTrackCount
  })

  return {
    totalTracks: tracks.length,
    missingFiles: missingFileIds.length,
    missingFileIds,
    missingKey: missingKeyIds.length,
    missingKeyIds,
    missingBpm: missingBpmIds.length,
    missingBpmIds,
    unsupportedFormats: unsupportedFormatIds.length,
    unsupportedFormatIds,
    notAnalysed: notAnalysedIds.length,
    notAnalysedIds,
    duplicateGroups,
    healthScore,
    scoreBreakdown
  }
}

function capped(perUnit: number, units: number, cap: number): number {
  return Math.min(cap, perUnit * units)
}

function scoreHealth(counts: {
  missingFiles: number
  missingKey: number
  missingBpm: number
  unsupportedFormats: number
  duplicateGroups: number
  dupTrackCount: number
}): { healthScore: number; scoreBreakdown: HealthScoreBreakdown } {
  const w = HEALTH_WEIGHTS

  const missingFilesPenalty = capped(w.missingFilesPerTrack, counts.missingFiles, w.missingFilesCap)
  const missingKeyPenalty = capped(w.missingKeyPerTrack, counts.missingKey, w.missingKeyCap)
  const missingBpmPenalty = capped(w.missingBpmPerTrack, counts.missingBpm, w.missingBpmCap)
  const unsupportedFormatsPenalty = capped(
    w.unsupportedFormatsPerTrack,
    counts.unsupportedFormats,
    w.unsupportedFormatsCap
  )
  const duplicatesPenalty = capped(w.duplicatesPerGroup, counts.duplicateGroups, w.duplicatesCap)

  const total =
    missingFilesPenalty +
    missingKeyPenalty +
    missingBpmPenalty +
    unsupportedFormatsPenalty +
    duplicatesPenalty

  return {
    healthScore: Math.round(Math.max(0, 100 - total)),
    scoreBreakdown: {
      missingFiles: Math.round(missingFilesPenalty * 10) / 10,
      missingKey: Math.round(missingKeyPenalty * 10) / 10,
      missingBpm: Math.round(missingBpmPenalty * 10) / 10,
      unsupportedFormats: Math.round(unsupportedFormatsPenalty * 10) / 10,
      duplicates: Math.round(duplicatesPenalty * 10) / 10,
      weights: { ...w }
    }
  }
}
