/**
 * Engine DJ (Denon) library detection.
 *
 * Engine's "Engine Library" is plain SQLite, so we can probe + count it with the
 * bundled `better-sqlite3` (read-only). We look in the default macOS location and
 * across mounted volumes (USB drives prepped on Denon gear).
 *
 *   Desktop : ~/Music/Engine Library/Database2/m.db
 *   USB     : /Volumes/<drive>/Engine Library/Database2/m.db
 *
 * `libraryPath` in the returned detection is the absolute path to `m.db` — that's
 * exactly what {@link readEngineLibrary} expects.
 */

import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import type { SourceDetection } from '../import/types'

export const ENGINE_LABEL = 'Engine DJ'

/** Candidate `m.db` locations, in priority order (desktop first, then USB volumes). */
export function engineDbCandidates(): string[] {
  const candidates: string[] = [join(homedir(), 'Music', 'Engine Library', 'Database2', 'm.db')]

  // Mounted volumes — USB drives formatted by Engine / Denon hardware.
  try {
    for (const vol of readdirSync('/Volumes')) {
      candidates.push(join('/Volumes', vol, 'Engine Library', 'Database2', 'm.db'))
      // Some exported / older drives keep m.db directly under "Engine Library".
      candidates.push(join('/Volumes', vol, 'Engine Library', 'm.db'))
    }
  } catch {
    /* /Volumes unreadable (non-macOS or sandbox) — desktop candidate still stands. */
  }

  return candidates
}

/** First existing candidate, or null. */
function firstExistingDb(): string | null {
  for (const path of engineDbCandidates()) {
    if (existsSync(path)) return path
  }
  return null
}

function baseDetection(): SourceDetection {
  return {
    sourceId: 'engine-dj',
    label: ENGINE_LABEL,
    installed: false,
    libraryPath: null,
    trackCount: null,
    playlistCount: null,
    readError: null
  }
}

/**
 * Probe for an Engine library and report counts + schema version. Read-only —
 * never opens the database for writing.
 */
export async function detectEngine(): Promise<SourceDetection> {
  const base = baseDetection()

  if (process.platform !== 'darwin') {
    return { ...base, readError: 'unsupported', meta: { reason: 'macOS only in v1' } }
  }

  const dbPath = firstExistingDb()
  if (!dbPath) return base // not installed / no library found

  let db: Database.Database | null = null
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const trackCount = (db.prepare('SELECT COUNT(*) AS n FROM Track').get() as { n: number }).n
    const playlistCount = (db.prepare('SELECT COUNT(*) AS n FROM Playlist').get() as { n: number })
      .n
    const info = db
      .prepare(
        'SELECT schemaVersionMajor AS major, schemaVersionMinor AS minor, schemaVersionPatch AS patch FROM Information LIMIT 1'
      )
      .get() as { major: number; minor: number; patch: number } | undefined

    return {
      ...base,
      installed: true,
      libraryPath: dbPath,
      trackCount,
      playlistCount,
      readError: null,
      meta: {
        schemaVersion: info ? `${info.major}.${info.minor}.${info.patch}` : 'unknown',
        // Surfaced as an "untested" label — we can't validate against real hardware.
        beta: true
      }
    }
  } catch (err) {
    console.error('[engine] detect failed reading', dbPath, err)
    return { ...base, installed: true, libraryPath: dbPath, readError: 'unknown' }
  } finally {
    db?.close()
  }
}
