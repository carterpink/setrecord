import type { Track, AudioFormat } from '../src/types'

/**
 * Minimal Track factory. Defaults are "clean / neutral" so callers only
 * override fields the test actually cares about — keeps tests focused.
 */
export function makeTrack(overrides: Partial<Track> = {}): Track {
  const base: Track = {
    id: overrides.id ?? `track-${Math.random().toString(36).slice(2, 10)}`,
    title: 'Test Track',
    artist: 'Test Artist',
    bpm: 124,
    key: '8A',
    energy: 5,
    duration: 360,
    filePath: '/tmp/test.mp3',
    format: 'mp3' as AudioFormat,
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: new Date('2025-01-01T00:00:00Z').toISOString(),
    missingFile: false,
  }
  return { ...base, ...overrides }
}
