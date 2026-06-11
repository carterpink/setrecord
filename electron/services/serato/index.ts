/**
 * Serato library source provider + high-level import entry point.
 *
 * Pipeline:
 *   1. Parse `database V2` → metadata Track[] (no cues — those live in files).
 *   2. Parse `Subcrates/*.crate` → Playlist tree (folder nesting via `%%`).
 *   3. Parse `History/` → gig sessions (source='serato', method='imported-history').
 *   4. Hand the normalised ImportPayload to the shared `applyImport()` writer.
 *   5. (Caller) schedule a background pass to extract cues/beatgrids from files.
 *
 * Mirrors electron/services/rekordbox/index.ts so both sources converge on the
 * same writer.
 */

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import type { ImportProgress, Playlist, Track } from '../../../src/types'
import { type ImportPayload } from '../libraryImport'
import type { LibrarySourceProvider, SourceDetection } from '../import/types'
import { parseDatabaseV2, seratoRecordToTrack } from './databaseReader'
import { parseCrate, buildPlaylistsFromCrates, type SeratoCrateFile } from './crateReader'
import { databaseV2Path, detectSerato, SERATO_LABEL } from './detect'
import { runSeratoCueQueue } from './cueExtractor'
import { readSeratoHistory } from './historyReader'

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

/** Build the normalised payload from a `_Serato_` folder. */
export async function readSeratoLibrary(
  seratoDir: string,
  onProgress: (p: ImportProgress) => void,
  existingIdsByPath: Map<string, string>
): Promise<ImportPayload> {
  onProgress({ processed: 0, total: 0, phase: 'parsing' })
  await yieldToEventLoop()

  // 1. Tracks from database V2.
  const dbPath = databaseV2Path(seratoDir)
  const records = parseDatabaseV2(readFileSync(dbPath))
  const total = records.length
  onProgress({ processed: 0, total, phase: 'parsing' })

  const tracks: Track[] = []
  const byAbsPath = new Map<string, string>()
  for (let i = 0; i < records.length; i++) {
    const track = seratoRecordToTrack(records[i], existingIdsByPath)
    tracks.push(track)
    byAbsPath.set(track.filePath, track.id)
    if (i > 0 && i % 500 === 0) {
      onProgress({ processed: i, total, phase: 'parsing' })
      await yieldToEventLoop()
    }
  }

  // 2. Playlists from Subcrates/*.crate.
  let playlists: Playlist[] = []
  try {
    const crateFiles = readSubcrates(seratoDir)
    playlists = buildPlaylistsFromCrates(crateFiles, byAbsPath)
  } catch (err) {
    console.error('[serato] crate parsing failed', err)
  }

  // 3. Gig sessions from History/history.database + History/Sessions/*.session.
  let sessions: ImportPayload['sessions'] = []
  try {
    const parsed = readSeratoHistory(seratoDir, byAbsPath)
    sessions = parsed.filter((s) => s.trackIds.length > 0)
    console.log(
      `[serato] history: ${parsed.length} session(s), ${sessions.length} non-empty, ` +
        `${sessions.reduce((n, s) => n + s.trackIds.length, 0)} track refs`
    )
  } catch (err) {
    console.error('[serato] history parsing failed', err)
  }

  return { tracks, playlists, sessions, sessionSource: 'serato' }
}

/** Read + parse every `.crate` file in a `_Serato_` folder's Subcrates dir. */
function readSubcrates(seratoDir: string): SeratoCrateFile[] {
  const dir = join(seratoDir, 'Subcrates')
  if (!existsSync(dir)) return []
  const out: SeratoCrateFile[] = []
  for (const file of readdirSync(dir)) {
    if (!file.toLowerCase().endsWith('.crate')) continue
    try {
      const trackPaths = parseCrate(readFileSync(join(dir, file)))
      out.push({ name: basename(file, '.crate'), trackPaths })
    } catch (err) {
      console.error('[serato] failed to parse crate', file, err)
    }
  }
  return out
}

export const seratoProvider: LibrarySourceProvider = {
  id: 'serato',
  label: SERATO_LABEL,
  sourceTag: 'serato',
  capabilities: {
    readsMetadata: true,
    readsPlaylists: true,
    readsCuesInline: false, // cues/beatgrids live in file tags → deferred postImport()
    readsSessions: true, // History/Sessions/*.session → play_sessions (source='serato')
    requiresConsentGate: false, // plain `database V2` + crate files
    importRouting: 'payload',
    stability: 'stable'
  },
  detect: detectSerato,
  // Serato watches its `database V2` file, not the `_Serato_` directory.
  watchPathFor: (seratoDir) => databaseV2Path(seratoDir),
  read: (libraryPath, onProgress, existingIdsByPath) =>
    readSeratoLibrary(libraryPath, onProgress, existingIdsByPath),
  // Cues/beatgrids stream in from each file's Serato tags after the main import.
  async postImport(importedTracks, emit) {
    await runSeratoCueQueue(importedTracks, {
      onStart: (total) => emit({ processed: 0, total, phase: total === 0 ? 'done' : 'extracting' }),
      onItem: (_id, _hadTags, processed, total) => emit({ processed, total, phase: 'extracting' }),
      onComplete: (processed, total) => emit({ processed, total, phase: 'done' })
    })
  }
}

export type { SourceDetection }
