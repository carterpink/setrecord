/**
 * Engine DJ (Denon) import provider.
 *
 * Engine's "Engine Library" is plain (unencrypted) SQLite, so the bundled
 * `better-sqlite3` is all that's needed to read it. The reader lives in
 * `electron/services/engine/` alongside the export code, which already encodes
 * the modern schema (see {@link file://electron/services/engine/engineSchema.ts}).
 *
 * ⚠️ SCHEMA NOTE — the modern Engine layout is EAV, not flat columns.
 * (An earlier version of this comment described the legacy Engine Prime schema
 * with title/artist columns + `Track.trackData` blobs — that is WRONG for 1.6+.)
 *
 *  • Location (macOS): ~/Music/Engine Library/Database2/m.db  (and p.db).
 *    On USB drives: <drive>/Engine Library/Database2/m.db.
 *  • `Track`: real columns are `length`, `bpm`, `bpmAnalyzed`, `year`, `path`,
 *    `filename`, `bitrate` — NOT title/artist/genre.
 *  • Text metadata is EAV in `MetaData(id, type, text)` and numerics in
 *    `MetaDataInteger(id, type, value)`, keyed by the `MetaDataType` /
 *    `MetaDataIntegerType` enums (Title=1, Artist=2, Album=3, Genre=4, …).
 *  • Playlists: `Playlist(id, title)` + `PlaylistTrackList(playlistId, trackId,
 *    trackNumber)`. Folder nesting (if present) via a parent-list column.
 *  • Cues / loops / beatgrid are packed performance blobs — NOT decoded here.
 *    Export deliberately skips them (Denon re-analyses on load), so there is no
 *    in-repo reference to invert. They belong in a future `postImport()` pass
 *    and are formally Planned, not shipped.
 *  • Key is an integer index → Camelot via electron/utils/camelot.ts.
 *
 * Stability: `beta`. Authored by inverting the verified export schema, but it
 * cannot be tested against real Denon hardware — surfaced to users as untested.
 */

import type { ImportProgress } from '../../../../src/types'
import type { LibrarySourceProvider, SourceDetection } from '../types'
import type { ImportPayload } from '../../libraryImport'
import { detectEngine } from '../../engine/detect'
import { readEngineLibrary } from '../../engine/dbReader'

const ENGINE_DJ_LABEL = 'Engine DJ'

export const engineDjProvider: LibrarySourceProvider = {
  id: 'engine-dj',
  label: ENGINE_DJ_LABEL,
  sourceTag: 'engine',
  capabilities: {
    readsMetadata: true,
    readsPlaylists: true,
    readsCuesInline: false, // cues/beatgrids are packed blobs — Planned, not yet decoded
    readsSessions: false,
    requiresConsentGate: false, // plain SQLite, read-only
    importRouting: 'payload',
    stability: 'beta' // inverted from the export schema; untested on real hardware
  },

  detect(): Promise<SourceDetection> {
    return detectEngine()
  },

  // libraryPath is the absolute path to the Engine `m.db` file.
  read(
    libraryPath: string,
    onProgress: (p: ImportProgress) => void,
    existingIdsByPath: Map<string, string>
  ): Promise<ImportPayload> {
    return readEngineLibrary(libraryPath, onProgress, existingIdsByPath)
  }
}
