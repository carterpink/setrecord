/**
 * Tagging orchestration — glue between the pure rules (tagRules.ts) and the DB.
 *
 * Two entry points:
 *   - {@link tagTrack}: tag a single track right after the energy analyser
 *     computes its features (called from the energy queue worker).
 *   - {@link retagLibrary}: re-infer tags for the whole library from features
 *     already stored in the DB — instant, no audio decode. Used by the manual
 *     "Re-tag library" action and after a user resets overrides.
 *
 * User-locked categories are preserved by upsertAutoTags in the DB layer.
 */

import type Database from 'better-sqlite3'
import { inferTags, type TagInput } from './tagRules'
import { getTagInputRows, getTrackById, upsertAutoTags, type TagInputRow } from '../../db/queries'
import type { TrackAnalysisFeatures } from '../../../src/types'

/** Neutral features for tracks we couldn't decode — energy + genre still tag. */
const NEUTRAL_FEATURES: TrackAnalysisFeatures = {
  rms: 0.5,
  brightness: 0.5,
  loudness: 0.5,
  vocalness: 0
}

export interface TagTrackMeta {
  energy: number
  features: TrackAnalysisFeatures | null
  bpm: number
  key: string
  genre?: string | null
  durationSec: number
}

export function buildTagInput(meta: TagTrackMeta): TagInput {
  const f = meta.features ?? NEUTRAL_FEATURES
  return {
    energy: meta.energy,
    rms: f.rms,
    brightness: f.brightness,
    loudness: f.loudness,
    vocalness: f.vocalness,
    bpm: meta.bpm,
    key: meta.key,
    genre: meta.genre ?? undefined,
    durationSec: meta.durationSec
  }
}

/** Compute + persist auto tags for one track, preserving user-locked categories. */
export function tagTrack(db: Database.Database, trackId: string, meta: TagTrackMeta): void {
  upsertAutoTags(db, trackId, inferTags(buildTagInput(meta)))
}

/**
 * Re-infer one track's auto tags from its stored features. Used after a user
 * resets a category back to auto.
 */
export function retagTrack(db: Database.Database, trackId: string): void {
  const t = getTrackById(db, trackId)
  if (!t) return
  tagTrack(db, trackId, {
    energy: t.energy,
    features: t.analysisFeatures ?? null,
    bpm: t.bpm,
    key: t.key,
    genre: t.genre ?? null,
    durationSec: t.duration
  })
}

export interface RetagCallbacks {
  onProgress?: (processed: number, total: number) => void
}

/**
 * Re-infer tags for every analysable track from stored features. Runs in chunked
 * transactions for throughput while still streaming progress.
 */
export function retagLibrary(
  db: Database.Database,
  cbs: RetagCallbacks = {}
): { processed: number; total: number } {
  const rows = getTagInputRows(db)
  const total = rows.length
  let processed = 0

  const applyChunk = db.transaction((batch: TagInputRow[]) => {
    for (const row of batch) {
      upsertAutoTags(
        db,
        row.id,
        inferTags(
          buildTagInput({
            energy: row.energy,
            features: row.analysisFeatures,
            bpm: row.bpm,
            key: row.key,
            genre: row.genre,
            durationSec: row.duration
          })
        )
      )
    }
  })

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    applyChunk(chunk)
    processed += chunk.length
    cbs.onProgress?.(processed, total)
  }

  cbs.onProgress?.(processed, total)
  return { processed, total }
}
