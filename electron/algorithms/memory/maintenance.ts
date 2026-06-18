/**
 * maintenance.ts — pure library-housekeeping aggregations.
 *
 * Turns a detected MaintenanceHit into a normalized answer over the track list
 * (+ playlists). Destructive actions return needsConfirmation and never mutate.
 */

import type { Track } from '../../../src/types'
import type { MaintenanceHit } from '../../../src/utils/maintenanceIntent'

export interface MaintenancePlaylist {
  name: string
  trackIds: string[]
}

export interface MaintenanceAnswer {
  kind: 'tracks' | 'stats' | 'count' | 'action' | 'empty'
  tracks?: Track[]
  stats?: { label: string; value: string }[]
  count?: number
  narration: string
  needsConfirmation?: boolean
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function dupGroups(tracks: Track[]): Track[][] {
  const m = new Map<string, Track[]>()
  for (const t of real(tracks)) {
    const k = `${t.title}|${t.artist}`.toLowerCase().trim()
    m.set(k, [...(m.get(k) ?? []), t])
  }
  return Array.from(m.values()).filter((g) => g.length > 1)
}

export function computeMaintenance(
  hit: MaintenanceHit,
  tracksIn: Track[],
  playlists: MaintenancePlaylist[]
): MaintenanceAnswer {
  const tracks = real(tracksIn)

  switch (hit.metric) {
    case 'missing_artwork': {
      const out = tracks.filter((t) => !t.albumArtPath && !t.albumArtUrl)
      return list(out, `${out.length} tracks have no artwork.`)
    }
    case 'missing_bpm': {
      const out = tracks.filter((t) => !t.bpm)
      return list(out, `${out.length} tracks have no analyzed BPM — run analysis on these.`)
    }
    case 'missing_key': {
      const out = tracks.filter((t) => !t.key || t.key.trim() === '')
      return list(out, `${out.length} tracks have no key set.`)
    }
    case 'missing_genre': {
      const out = tracks.filter((t) => !t.genre || t.genre.trim() === '')
      return list(out, `${out.length} tracks have no genre — consider tagging them.`)
    }
    case 'incomplete_metadata': {
      const out = tracks.filter(
        (t) => !t.bpm || !t.key || !t.genre || (!t.albumArtPath && !t.albumArtUrl)
      )
      return list(out, `${out.length} tracks are missing BPM, key, genre or artwork.`)
    }
    case 'broken_paths': {
      const out = tracks.filter((t) => t.missingFile === true)
      return list(out, `${out.length} tracks point at files that no longer exist.`)
    }
    case 'duplicates': {
      const flat = dupGroups(tracks).flat()
      return list(
        flat,
        `${flat.length} duplicate entries across ${dupGroups(tracks).length} groups.`
      )
    }
    case 'oldest_track': {
      // Track has no release-year field yet (only import date) — be honest.
      return {
        kind: 'empty',
        narration:
          "I don't track release year yet (only when a track was imported), so I can't pin the oldest by release date. I can show your earliest-imported tracks instead."
      }
    }
    case 'tracks_per_playlist': {
      const rows = playlists
        .slice()
        .sort((a, b) => b.trackIds.length - a.trackIds.length)
        .map((p) => ({ label: p.name, value: String(p.trackIds.length) }))
      return {
        kind: 'stats',
        stats: rows,
        narration: rows.length
          ? `Track counts across ${rows.length} playlists.`
          : 'No playlists found.'
      }
    }
    case 'multi_playlist_tracks': {
      const counts = new Map<string, number>()
      for (const p of playlists)
        for (const id of p.trackIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      const ids = new Set(
        Array.from(counts.entries())
          .filter(([, c]) => c > 1)
          .map(([id]) => id)
      )
      const out = tracks.filter((t) => ids.has(t.id))
      return list(out, `${out.length} tracks appear in more than one playlist.`)
    }
    case 'tagged_missing': {
      const anyTags = tracks.some((t) => (t.tags?.length ?? 0) > 0)
      if (!anyTags)
        return {
          kind: 'empty',
          narration:
            'None of your tracks are tagged yet — add tags (or run the auto-tagger) and I can filter by them.'
        }
      return { kind: 'empty', narration: 'No tracks match that tag.' }
    }
    case 'remove_broken': {
      const out = tracks.filter((t) => t.missingFile === true)
      return {
        kind: 'action',
        tracks: out,
        needsConfirmation: true,
        narration: `Found ${out.length} tracks whose files are missing. Remove them from your library? This can't be undone — confirm to proceed.`
      }
    }
    case 'cleanup_duplicates': {
      const groups = dupGroups(tracks)
      return {
        kind: 'action',
        tracks: groups.flat(),
        needsConfirmation: true,
        narration: `Found ${groups.length} duplicate groups. Remove the lower-quality copy from each? Confirm to proceed — nothing is deleted until you do.`
      }
    }
    default:
      return { kind: 'empty', narration: 'Nothing to do.' }
  }
}

function list(out: Track[], narration: string): MaintenanceAnswer {
  return { kind: out.length ? 'tracks' : 'empty', tracks: out, narration }
}
