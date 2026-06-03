/**
 * Cross-platform import layer — the source-provider abstraction.
 *
 * SetSense's memory layer (lifecycle, transition history, harmonic/energy
 * planning) is fed entirely by imported tracks + playlists. Historically that
 * meant Rekordbox only. This abstraction generalises "where a library comes
 * from" so the memory layer is platform-agnostic: every source (Rekordbox,
 * Serato, Engine DJ) implements {@link LibrarySourceProvider} and produces the
 * same normalised {@link ImportPayload}, which the shared `applyImport()` writer
 * persists.
 *
 * Routing (see {@link ProviderCapabilities.importRouting}):
 *  - `payload` sources (Serato, Engine DJ) flow through the generic `import:run`
 *    handler: read → applyImport → optional deferred postImport().
 *  - Rekordbox is `native-ipc`: a thin adapter over its existing, battle-tested
 *    consent-gated detect/import code, which is NOT rewritten here.
 */

import type {
  ImportProgress,
  ImportSource,
  LibrarySourceId,
  PostImportProgress,
  SourceDetection,
  SourceReadError
} from '../../../src/types'
import type { ImportPayload } from '../libraryImport'

export type { LibrarySourceId, SourceDetection, SourceReadError }

/** Lightweight reference to a just-imported track, for deferred enrichment passes. */
export interface ImportedTrackRef {
  id: string
  filePath: string
  bpm: number
}

/**
 * Declarative description of what a source can do and how it's driven. Lets the
 * orchestrator and picker UI branch on capability instead of hard-coding `id`.
 */
export interface ProviderCapabilities {
  /** Reads core track metadata (title/artist/bpm/key/…). */
  readsMetadata: boolean
  /** Reads playlists/crates into the playlist tree. */
  readsPlaylists: boolean
  /**
   * Cues / hot-cues / loops / beatgrid arrive inline with `read()`. When false,
   * those live elsewhere (file tags, packed blobs) and require `postImport()`.
   */
  readsCuesInline: boolean
  /** Reads gig / play-session history. */
  readsSessions: boolean
  /** Requires a user consent gate before reading (encrypted / proprietary store). */
  requiresConsentGate: boolean
  /**
   * How the renderer drives an import of this source:
   *  - `payload`    → generic `import:run` handler (read → applyImport → postImport).
   *  - `native-ipc` → the source owns a bespoke IPC flow. Rekordbox does this for
   *    its consent gate + locked/key-mismatch handling + XML fallback.
   */
  importRouting: 'payload' | 'native-ipc'
  /**
   * Reliability signal for the picker. `beta` surfaces an "untested" label;
   * `planned` keeps the source visible but unselectable.
   */
  stability: 'stable' | 'beta' | 'planned'
}

/**
 * Contract every library source implements.
 *
 * `read()` MUST return tracks whose ids were reused from `existingIdsByPath`
 * when the file_path already exists (so `set_tracks` FKs survive re-import),
 * mirroring the Rekordbox/XML importers. Playlist/session trackIds must
 * reference those same ids.
 */
export interface LibrarySourceProvider {
  id: LibrarySourceId
  label: string
  capabilities: ProviderCapabilities
  /** Settings-bookkeeping tag used for stale-detection after an import. */
  sourceTag: ImportSource
  detect(): Promise<SourceDetection>
  read(
    libraryPath: string,
    onProgress: (p: ImportProgress) => void,
    existingIdsByPath: Map<string, string>
  ): Promise<ImportPayload>
  /**
   * The file whose mtime signals this source has changed since last import.
   * Defaults to the `libraryPath` itself (used by the generic `rekordbox:check-stale`
   * style probe). Serato watches its `database V2`, not the `_Serato_` dir.
   */
  watchPathFor?(libraryPath: string): string
  /**
   * Deferred enrichment run AFTER the main import lands, for data that doesn't
   * arrive inline (Serato/Engine cues + beatgrids). Runs in the background; the
   * orchestrator forwards `emit()` to the renderer on `library:post-import-progress`.
   * Only invoked when `capabilities.readsCuesInline === false`.
   */
  postImport?(
    importedTracks: ImportedTrackRef[],
    emit: (p: Omit<PostImportProgress, 'sourceId'>) => void
  ): Promise<void>
}

/** Error thrown by providers that exist only as groundwork (e.g. Engine DJ). */
export class SourceNotImplementedError extends Error {
  constructor(sourceId: LibrarySourceId) {
    super(`Import from "${sourceId}" is not implemented yet.`)
    this.name = 'SourceNotImplementedError'
  }
}
