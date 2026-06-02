import type { Track } from '@/types'

/**
 * Where a track preview should start, in ms.
 *
 * Priority:
 *   1. The track's default cue point (Rekordbox green cue — usually the drop).
 *   2. The first hot cue (DJs typically set A on the first useful moment).
 *   3. The earliest memory cue, if any.
 *   4. 1/3 of the way in — a crude "skip the intro" heuristic when no cues exist.
 *      Capped at 60s so very long tracks don't drop you way past the interesting bit.
 *
 * We deliberately avoid loudness analysis: it costs ~100ms of audio decoding per
 * track on preview, and cue points are a much stronger signal — the DJ already
 * told us where the track gets interesting when they set the cue.
 */
export function getPreviewStartMs(track: Track, durationMs: number): number {
  const defaultCue = track.cuePoints.find((c) => c.type === 'cue')
  if (defaultCue) return defaultCue.position

  if (track.hotCues.length > 0) {
    const firstHot = [...track.hotCues].sort((a, b) => a.index - b.index)[0]
    return firstHot.position
  }

  const memory = track.cuePoints.filter((c) => c.type === 'memory')
  if (memory.length > 0) {
    return Math.min(...memory.map((m) => m.position))
  }

  if (durationMs > 0) {
    return Math.min(durationMs / 3, 60_000)
  }

  return 0
}
