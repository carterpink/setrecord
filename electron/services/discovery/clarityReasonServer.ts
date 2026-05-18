/**
 * Server-side (main process) version of deriveClarityReason.
 * Must not import from @/ (renderer alias). Keep in sync with src/utils/clarityReason.ts.
 */

import type { ClarityReason, DiscoverSet, TasteProfile } from '../../../src/types'

function ciIncludes(haystack: string[], needle: string): string | undefined {
  const n = needle.toLowerCase()
  return haystack.find((h) => h.toLowerCase() === n)
}

export function deriveClarityReason(
  set: Pick<DiscoverSet, 'djName' | 'tags' | 'tracklist'>,
  taste: TasteProfile,
): ClarityReason {
  const followed = ciIncludes(taste.followedDJs, set.djName)
  if (followed) {
    return {
      kind: 'following-dj',
      label: `Following ${followed}`,
      tooltip: `You follow ${followed}`,
      matchedValue: followed,
    }
  }

  for (const t of set.tracklist) {
    const artist = ciIncludes(taste.favouriteArtists, t.artist)
    if (artist) {
      return {
        kind: 'plays-artist',
        label: `plays ${artist}`,
        tooltip: `This DJ plays artists you follow`,
        matchedValue: artist,
      }
    }
  }

  for (const tag of set.tags) {
    const genre = ciIncludes(taste.favouriteGenres, tag)
    if (genre) {
      return {
        kind: 'matches-genre',
        label: `Popular in ${genre}`,
        tooltip: `Trending in a genre you like`,
        matchedValue: genre,
      }
    }
  }

  return { kind: 'trending', label: 'Trending', tooltip: 'Popular this week' }
}
