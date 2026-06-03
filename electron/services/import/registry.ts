/**
 * Registry of library source providers + cross-source detection.
 *
 * This is the single place that knows the full set of import sources. The
 * source-picker UI calls {@link detectAllSources} to learn what's available;
 * the import handlers look providers up by id. Adding a new source (e.g. a real
 * Engine DJ reader) is a one-line change here.
 */

import type { LibrarySourceId, LibrarySourceProvider, SourceDetection } from './types'
import { rekordboxProvider } from './providers/rekordbox'
import { engineDjProvider } from './providers/engineDj'
import { seratoProvider } from '../serato'

/** Insertion order is the order shown in the picker. */
export const providers: Record<LibrarySourceId, LibrarySourceProvider> = {
  rekordbox: rekordboxProvider,
  serato: seratoProvider,
  'engine-dj': engineDjProvider
}

export function getProvider(id: LibrarySourceId): LibrarySourceProvider | undefined {
  return providers[id]
}

/**
 * Probe every source in parallel. A provider that throws during detection
 * degrades to an `unknown`-error entry rather than failing the whole probe.
 */
export async function detectAllSources(): Promise<SourceDetection[]> {
  return Promise.all(
    Object.values(providers).map(async (p) => {
      try {
        return await p.detect()
      } catch (err) {
        console.error('[import] detect failed for', p.id, err)
        return {
          sourceId: p.id,
          label: p.label,
          installed: false,
          libraryPath: null,
          trackCount: null,
          playlistCount: null,
          readError: 'unknown' as const
        }
      }
    })
  )
}
