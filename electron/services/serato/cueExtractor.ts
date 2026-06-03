/**
 * Background extraction of Serato cue points, hot cues, loops, track colour and
 * beatgrid from the audio files of a just-imported Serato library.
 *
 * Serato stores this data inside each file (not its `database V2`), so reading
 * it is a per-file pass — expensive on large libraries. It therefore runs as a
 * background worker pool AFTER the metadata import completes (mirroring
 * energyAnalyser / artwork extraction), so tracks land instantly and cues fill
 * in shortly after. Interrupted runs are simply re-done on the next re-import.
 */

import { existsSync } from 'fs'
import { cpus } from 'os'
import { getDb } from '../../db/schema'
import {
  updateTrackBeatgrid,
  updateTrackColor,
  updateTrackCues,
  updateTrackLoops
} from '../../db/queries'
import { extractSeratoTags } from './seratoTags'

/** A track to scan for embedded Serato tags. */
export interface SeratoCueTrack {
  id: string
  filePath: string
  /** Current BPM — paired with the beatgrid offset when persisting the grid. */
  bpm: number
}

export interface SeratoCueQueueCallbacks {
  onStart?: (total: number) => void
  onItem?: (trackId: string, hadTags: boolean, processed: number, total: number) => void
  onComplete?: (processed: number, total: number) => void
}

let _running = false

export function isSeratoCueExtractionRunning(): boolean {
  return _running
}

/**
 * Extract + persist Serato tags for each given track. Idempotent — a no-op when
 * a run is already in flight, so overlapping imports can't double-spawn.
 */
export async function runSeratoCueQueue(
  tracks: SeratoCueTrack[],
  cbs: SeratoCueQueueCallbacks = {}
): Promise<void> {
  if (_running) return
  _running = true

  try {
    const db = getDb()
    const total = tracks.length
    cbs.onStart?.(total)
    if (total === 0) {
      cbs.onComplete?.(0, 0)
      return
    }

    const concurrency = Math.min(8, Math.max(1, cpus().length - 1))
    let cursor = 0
    let processed = 0

    const worker = async (): Promise<void> => {
      while (cursor < tracks.length) {
        const t = tracks[cursor++]
        let hadTags = false
        try {
          if (existsSync(t.filePath)) {
            const tags = await extractSeratoTags(t.filePath)
            if (tags) {
              if (tags.hotCues.length > 0) {
                // Serato has no separate memory cues — cuePoints stays empty.
                updateTrackCues(db, t.id, [], tags.hotCues)
                hadTags = true
              }
              if (tags.loops.length > 0) {
                updateTrackLoops(db, t.id, tags.loops)
                hadTags = true
              }
              if (tags.color) {
                updateTrackColor(db, t.id, tags.color)
                hadTags = true
              }
              if (tags.beatgridOffset != null) {
                updateTrackBeatgrid(db, t.id, t.bpm, tags.beatgridOffset)
                hadTags = true
              }
            }
          }
        } catch (err) {
          console.error('[serato] cue extraction failed for', t.id, err)
        }
        processed++
        cbs.onItem?.(t.id, hadTags, processed, total)
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    cbs.onComplete?.(processed, total)
  } finally {
    _running = false
  }
}
