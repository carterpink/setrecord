import type { ImportProgress, ImportResult, RekordboxDetection } from '../../../src/types'
import { applyImport } from '../libraryImport'
import { getDb } from '../../db/schema'
import { getExistingTrackIdsByPath } from '../../db/queries'
import { readMasterDb } from './dbReader'
import { detectRekordbox as detectFilesystem } from './detect'
import { openMasterDb, RekordboxKeyMismatchError, RekordboxLockedError } from './cipher'

export { RekordboxLockedError, RekordboxKeyMismatchError } from './cipher'

/**
 * Combined detection: filesystem probe + (if available) cipher open + counts.
 *
 * Returns a single enriched RekordboxDetection so the renderer can decide on
 * a single round trip whether to show the "detected, ready to import"
 * preview or the XML guide.
 */
export async function detectRekordbox(): Promise<RekordboxDetection> {
  const fs = await detectFilesystem()
  if (!fs.dbPath) return fs

  // Probe the cipher to confirm we can actually read it + get counts.
  try {
    const db = await openMasterDb(fs.dbPath)
    try {
      const trackRow = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM djmdContent WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0`)
      const playlistRow = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM djmdPlaylist WHERE rb_local_deleted IS NULL OR rb_local_deleted = 0`)
      return {
        ...fs,
        trackCount: trackRow?.n ?? 0,
        playlistCount: playlistRow?.n ?? 0,
        dbReadError: null,
      }
    } finally {
      await db.close().catch(() => {})
    }
  } catch (err) {
    if (err instanceof RekordboxLockedError) {
      return { ...fs, dbLocked: true, dbReadError: 'locked' }
    }
    if (err instanceof RekordboxKeyMismatchError) {
      return { ...fs, dbReadError: 'key-mismatch' }
    }
    console.error('[rekordbox] preview open failed', err)
    return { ...fs, dbReadError: 'unknown' }
  }
}

/**
 * High-level entry point for "import the user's Rekordbox library directly
 * from master.db." Reads the encrypted database, maps it to our shapes,
 * threads existing track ids through so re-syncs preserve set_tracks FKs,
 * and writes via the shared `applyImport()` writer.
 *
 * Errors (RekordboxLockedError, RekordboxKeyMismatchError) propagate to the
 * IPC layer where the renderer surfaces a clear fallback message.
 */
export async function importFromMasterDb(
  path: string,
  onProgress: (p: ImportProgress) => void
): Promise<ImportResult> {
  const db = getDb()
  const existingIdsByPath = getExistingTrackIdsByPath(db)

  const payload = await readMasterDb(path, onProgress, existingIdsByPath)

  if (payload.tracks.length === 0) {
    onProgress({ processed: 0, total: 0, phase: 'done' })
    return await applyImport(payload, onProgress)
  }

  return applyImport(payload, onProgress)
}
