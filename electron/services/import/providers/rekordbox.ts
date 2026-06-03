/**
 * Rekordbox as a {@link LibrarySourceProvider}.
 *
 * This is a thin ADAPTER over the existing, battle-tested Rekordbox code — it
 * does not reimplement detection or the encrypted master.db reader. Its job is
 * to make Rekordbox a first-class entry in the source registry/picker.
 *
 * At runtime the renderer routes a Rekordbox selection back into the dedicated
 * `rekordbox:detect` / `rekordbox:import-db` IPC flow (which carries the consent
 * gate, locked/key-mismatch handling and XML fallback). `read()` is provided for
 * contract completeness and delegates to the real master.db reader.
 */

import type { LibrarySourceProvider, SourceDetection, SourceReadError } from '../types'
import { detectRekordbox } from '../../rekordbox'
import { readMasterDb } from '../../rekordbox/dbReader'

const REKORDBOX_LABEL = 'Rekordbox'

function mapReadError(dbReadError: 'locked' | 'key-mismatch' | 'unknown' | null): SourceReadError {
  if (dbReadError === 'locked') return 'locked'
  if (dbReadError === 'key-mismatch') return 'unsupported'
  if (dbReadError === 'unknown') return 'unknown'
  return null
}

export const rekordboxProvider: LibrarySourceProvider = {
  id: 'rekordbox',
  label: REKORDBOX_LABEL,
  sourceTag: 'rekordbox-db',
  capabilities: {
    readsMetadata: true,
    readsPlaylists: true,
    readsCuesInline: true, // master.db carries cues/beatgrids; no deferred pass
    readsSessions: true, // Rekordbox history
    requiresConsentGate: true, // encrypted master.db
    importRouting: 'native-ipc', // owns rekordbox:detect / rekordbox:import-db + XML fallback
    stability: 'stable'
  },

  async detect(): Promise<SourceDetection> {
    const d = await detectRekordbox()
    return {
      sourceId: 'rekordbox',
      label: REKORDBOX_LABEL,
      installed: d.installed && !!d.dbPath && (d.dbSize ?? 0) > 0,
      libraryPath: d.dbPath,
      trackCount: d.trackCount,
      playlistCount: d.playlistCount,
      readError: mapReadError(d.dbReadError),
      // Keep the full Rekordbox detection so the existing RB-specific UI can read it.
      meta: { rekordbox: d }
    }
  },

  read: (libraryPath, onProgress, existingIdsByPath) =>
    readMasterDb(libraryPath, onProgress, existingIdsByPath)
}
