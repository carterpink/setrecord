/**
 * Detect a Serato library on disk.
 *
 * Serato keeps its library in `~/Music/_Serato_/` (macOS): a binary
 * `database V2` file plus a `Subcrates/` directory of `.crate` files. Detection
 * is read-only and cheap — confirm the database exists, count tracks + crates.
 *
 * v1 scope: macOS, primary user library only. Windows uses a different
 * `_Serato_` location and external drives carry their own `_Serato_` folder —
 * both are deferred (reported as a known limit), so non-macOS returns
 * `unsupported`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { SourceDetection } from '../import/types'
import { parseDatabaseV2 } from './databaseReader'

export const SERATO_LABEL = 'Serato DJ'

/** Absolute path to the primary `_Serato_` library folder on macOS. */
export function defaultSeratoDir(): string {
  return join(homedir(), 'Music', '_Serato_')
}

/** Path to the `database V2` file within a `_Serato_` folder. */
export function databaseV2Path(seratoDir: string): string {
  return join(seratoDir, 'database V2')
}

function countCrates(seratoDir: string): number {
  try {
    const subcrates = join(seratoDir, 'Subcrates')
    if (!existsSync(subcrates)) return 0
    return readdirSync(subcrates).filter((f) => f.toLowerCase().endsWith('.crate')).length
  } catch {
    return 0
  }
}

export async function detectSerato(): Promise<SourceDetection> {
  const base: SourceDetection = {
    sourceId: 'serato',
    label: SERATO_LABEL,
    installed: false,
    libraryPath: null,
    trackCount: null,
    playlistCount: null,
    readError: null
  }

  if (process.platform !== 'darwin') {
    return { ...base, readError: 'unsupported', meta: { reason: 'macOS only in v1' } }
  }

  const seratoDir = defaultSeratoDir()
  const dbPath = databaseV2Path(seratoDir)
  if (!existsSync(dbPath)) return base // not installed / no library

  try {
    const buf = readFileSync(dbPath)
    const records = parseDatabaseV2(buf)
    return {
      ...base,
      installed: true,
      libraryPath: seratoDir,
      trackCount: records.length,
      playlistCount: countCrates(seratoDir),
      meta: { dbMtime: statSync(dbPath).mtimeMs }
    }
  } catch (err) {
    console.error('[serato] detect read failed', err)
    return { ...base, installed: true, libraryPath: seratoDir, readError: 'unknown' }
  }
}
