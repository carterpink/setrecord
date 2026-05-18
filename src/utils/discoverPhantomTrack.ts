import type { DiscoverSet, DiscoverTrack, Track } from '@/types'
import { beatportSearchUrl, soundcloudSearchUrl, youtubeTimestampUrl } from './shopLinks'
import { gradientForId } from './format'

/**
 * Synthesise a Track for a DiscoverTrack with no library match. Phantom tracks
 * persist in the user's set but never reference a real file on disk — file_path
 * is a sentinel `discover://...` URL that satisfies the NOT NULL UNIQUE
 * constraint without colliding with any imported file.
 */
export function toPhantomTrack(dt: DiscoverTrack, set: DiscoverSet): Track {
  const id = `phantom-${set.id}-${dt.id}`
  return {
    id,
    title: dt.title,
    artist: dt.artist,
    bpm: 0,
    key: '',
    energy: 5,
    duration: dt.durationSeconds ?? 0,
    filePath: `discover://${set.id}/${dt.id}`,
    format: 'unknown',
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: new Date().toISOString(),
    artGradient: gradientForId(id),
    missingFile: true,
    phantom: true,
    discoverMeta: {
      discoverSetId: set.id,
      discoverSetTitle: set.title,
      beatportUrl: beatportSearchUrl(dt.artist, dt.title),
      soundcloudUrl: soundcloudSearchUrl(dt.artist, dt.title),
      youtubeUrl: youtubeTimestampUrl(set.videoId, dt.startSeconds),
    },
  }
}
