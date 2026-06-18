/**
 * maintenanceIntent.ts — pure detector for library-management / housekeeping
 * questions (missing metadata, broken paths, duplicates, playlist membership)
 * and destructive ACTIONS (which must be confirmed, never auto-run).
 * Compute lives in electron/algorithms/memory/maintenance.ts.
 */

export type MaintenanceMetric =
  | 'missing_artwork' // 013
  | 'missing_bpm' // 030, 127
  | 'missing_key'
  | 'missing_genre' // 128
  | 'incomplete_metadata' // 129
  | 'broken_paths' // 130
  | 'duplicates' // 017, 132
  | 'oldest_track' // 134 (honest: no release-year field yet)
  | 'tracks_per_playlist' // 135
  | 'multi_playlist_tracks' // 136
  | 'tagged_missing' // 020 (honest: no tags in library)
  | 'remove_broken' // 131 (ACTION)
  | 'cleanup_duplicates' // 137 (ACTION)

export interface MaintenanceHit {
  metric: MaintenanceMetric
  /** Confirmation required for destructive actions. */
  action?: boolean
}

export function detectMaintenance(raw: string): MaintenanceHit | null {
  const q = raw.toLowerCase().trim()

  // ── destructive actions (confirm first) ──────────────────────────────────
  if (
    /\b(remove|delete|clear|purge).*(deleted|broken|missing|dead).*(disk|file|path|track)/.test(
      q
    ) ||
    /\b(remove|delete).*tracks i deleted/.test(q)
  )
    return { metric: 'remove_broken', action: true }
  if (/\b(clean ?up|remove|delete|dedupe|de-?dupe).*(duplicate|dupe)/.test(q))
    return { metric: 'cleanup_duplicates', action: true }

  // ── read-only housekeeping ───────────────────────────────────────────────
  if (/\b(without|missing|no|lacking).*(art ?work|cover|album art)/.test(q))
    return { metric: 'missing_artwork' }
  if (
    /\b(missing|no|without|un-?analy[sz]ed|haven'?t been analy[sz]ed).*\bbpm\b|\bbpm\b.*(missing|not.*analy[sz]ed|has(?:n'?t| not) been analy[sz]ed|null)/.test(
      q
    )
  )
    return { metric: 'missing_bpm' }
  if (/\b(missing|no|without).*\bkeys?\b|\bkeys?\b.*(missing|not set)/.test(q))
    return { metric: 'missing_key' }
  if (/\b(no|missing|without).*\bgenres?\b|\bgenres?\b.*(not set|missing|empty)/.test(q))
    return { metric: 'missing_genre' }
  if (/\bincomplete metadata|missing metadata|metadata.*(incomplete|missing|gaps)/.test(q))
    return { metric: 'incomplete_metadata' }
  if (
    /\b(broken|dead|missing).*(file ?paths?|files?)|files? (that )?(no longer exist|are missing|moved)/.test(
      q
    )
  )
    return { metric: 'broken_paths' }
  if (
    /\b(duplicate|dupe|imported (more than once|twice|multiple times)|same track (twice|multiple))/.test(
      q
    )
  )
    return { metric: 'duplicates' }
  if (/\boldest (track|tune|song|record)\b|earliest (track|release)/.test(q))
    return { metric: 'oldest_track' }
  if (
    /\bhow many tracks (are )?in (each|every) playlist|tracks per playlist|playlist (track )?counts/.test(
      q
    )
  )
    return { metric: 'tracks_per_playlist' }
  if (
    /\b(tracks?|songs?).*(in (multiple|more than one|several)) playlists|appear in (multiple|more than one) playlist/.test(
      q
    )
  )
    return { metric: 'multi_playlist_tracks' }
  if (/\btagged (as|with)\b|i tagged\b|tracks i('?ve)? tagged/.test(q))
    return { metric: 'tagged_missing' }

  return null
}
