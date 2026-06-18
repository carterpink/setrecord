/**
 * mediaAccess.ts — filesystem-read confinement for the two primitives the
 * renderer can reach: the `media://` protocol handler and the `audio:read-file`
 * IPC. Both legitimately serve audio that lives ANYWHERE on disk (a DJ's tracks
 * aren't confined to one folder), so a plain directory allowlist won't do.
 *
 * A path is allowed only if it is either:
 *   (a) inside an app-managed cache dir under userData (artwork / models), or
 *   (b) a file the library actually knows about — a track's `file_path` or its
 *       cached `album_art_path`.
 *
 * That blocks `media://local/etc/passwd` / `audio:read-file('~/.ssh/id_rsa')`
 * (which the renderer could otherwise reach if a CSP bypass or supply-chain
 * payload ever lands) while never breaking playback, preview, or artwork. Fails
 * closed: anything we can't positively vouch for is denied.
 */
import { app } from 'electron'
import { join, resolve, sep } from 'path'
import { getDb } from '../db/schema'
import { getArtworkCacheDir } from './artworkExtractor'

let _allowedRoots: string[] | null = null

/** App-managed directories we serve files out of, resolved + cached once. */
function allowedRoots(): string[] {
  if (!_allowedRoots) {
    const userData = app.getPath('userData')
    _allowedRoots = [
      getArtworkCacheDir(), // userData/artwork — cached cover art
      join(userData, 'models'), // on-device model assets
      join(userData, 'recordings') // Flight Recorder lo-fi set audio (local-only)
    ].map((p) => resolve(p))
  }
  return _allowedRoots
}

function underAllowedRoot(resolved: string): boolean {
  return allowedRoots().some((root) => resolved === root || resolved.startsWith(root + sep))
}

/**
 * Is this path a file the library references? `file_path` is UNIQUE (indexed) so
 * this is an O(log n) lookup. Fails closed if the DB isn't open yet.
 */
function isLibraryMember(p: string): boolean {
  try {
    const row = getDb()
      .prepare('SELECT 1 FROM tracks WHERE file_path = ? OR album_art_path = ? LIMIT 1')
      .get(p, p)
    return row !== undefined
  } catch {
    return false
  }
}

/** Gatekeeper for both renderer-reachable file readers. */
export function isAllowedMediaPath(filePath: unknown): boolean {
  if (typeof filePath !== 'string' || filePath.length === 0) return false
  const resolved = resolve(filePath)
  if (underAllowedRoot(resolved)) return true
  // Membership is checked against the original decoded path first — that's
  // exactly what toMediaUrl() round-trips from the stored file_path; resolve()
  // could alter a path containing symlinks/./.. and miss the exact match.
  return isLibraryMember(filePath) || isLibraryMember(resolved)
}
