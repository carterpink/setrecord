import type { ClarityReason, DiscoverSet, TasteProfile } from '@/types'

function ciIncludes(haystack: string[], needle: string): string | undefined {
  const n = needle.toLowerCase()
  return haystack.find((h) => h.toLowerCase() === n)
}

/**
 * Pure: derive the clarity reason for a set against a taste profile.
 * Preference order:
 *   1. The set's DJ is followed → "Following [DJ]"
 *   2. The tracklist contains a favourite artist → "plays [Artist]"
 *   3. The set's tags include a favourite genre → "Popular in [Genre]"
 *   4. Otherwise → "Trending"
 */
export function deriveClarityReason(
  set: Pick<DiscoverSet, 'djName' | 'tags' | 'tracklist'>,
  taste: TasteProfile
): ClarityReason {
  // 1. Following DJ
  const followed = ciIncludes(taste.followedDJs, set.djName)
  if (followed) {
    return {
      kind: 'following-dj',
      label: `Following ${followed}`,
      tooltip: `You follow ${followed}`,
      matchedValue: followed,
    }
  }

  // 2. Plays favourite artist (check tracklist artists)
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

  // 3. Matches favourite genre
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

  // 4. Fallback
  return {
    kind: 'trending',
    label: 'Trending',
    tooltip: 'Popular this week',
  }
}
