/**
 * libraryHealth.ts — Pure engine: analyse the library for actionable health
 * issues and detect duplicates via fuzzy artist+title matching.
 *
 * Uses normalised-string equality for duplicate detection: lowercase, strip
 * punctuation, collapse whitespace. This is simpler and more predictable than
 * a weighted fuzzy distance for the duplicate use-case where we want near-exact
 * matches rather than broad similarity.
 */

import type { Track } from '../../../src/types'
import type { HealthReport } from '../../../src/types'

export type { HealthReport }

const SUPPORTED_FORMATS = new Set(['mp3', 'aiff', 'wav', 'flac', 'm4a'])

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
}

function normalisedKey(track: Track): string {
  return `${normalise(track.artist)}|${normalise(track.title)}`
}

export function analyzeHealth(tracks: Track[]): HealthReport {
  const missingFileIds: string[] = []
  const missingKeyIds: string[] = []
  const missingBpmIds: string[] = []
  const unsupportedFormatIds: string[] = []

  for (const t of tracks) {
    if (t.missingFile) missingFileIds.push(t.id)
    if (!t.key || t.key.trim() === '') missingKeyIds.push(t.id)
    if (!t.bpm || t.bpm === 0) missingBpmIds.push(t.id)
    if (!SUPPORTED_FORMATS.has(t.format)) unsupportedFormatIds.push(t.id)
  }

  // ── Duplicate detection: group by normalised artist+title
  const groups = new Map<string, Track[]>()
  for (const t of tracks) {
    const key = normalisedKey(t)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  const duplicateGroups: Array<{ ids: string[]; normalisedKey: string }> = []
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      duplicateGroups.push({ ids: group.map((t) => t.id), normalisedKey: key })
    }
  }

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
    duplicateGroups,
    healthScore: computeHealthScore(tracks.length, {
      missingFiles: missingFileIds.length,
      missingKey: missingKeyIds.length,
      missingBpm: missingBpmIds.length,
      unsupportedFormats: unsupportedFormatIds.length,
      duplicates: duplicateGroups.reduce((s, g) => s + g.ids.length - 1, 0)
    })
  }
}

function computeHealthScore(
  total: number,
  issues: {
    missingFiles: number
    missingKey: number
    missingBpm: number
    unsupportedFormats: number
    duplicates: number
  }
): number {
  if (total === 0) return 100
  // Each term is (fraction of library affected) × (max points that issue can
  // cost). The weights sum to 100, so penalty is already on a 0–100 scale —
  // subtract it directly. (The old code multiplied by 100 again, forcing ~0.)
  const penalty =
    (issues.missingFiles / total) * 30 +
    (issues.missingKey / total) * 25 +
    (issues.missingBpm / total) * 20 +
    (issues.unsupportedFormats / total) * 15 +
    (issues.duplicates / total) * 10
  return Math.round(Math.max(0, 100 - penalty))
}
