/**
 * Parse Serato `Subcrates/*.crate` files into the app's {@link Playlist} tree.
 *
 * A `.crate` file lists its tracks by path (`otrk` → `ptrk`). The crate's NAME
 * is not in the file — it's the filename, and Serato encodes folder nesting in
 * that filename with `%%` as the separator, e.g.
 *
 *   House.crate            → crate "House"
 *   House%%Deep.crate      → crate "Deep" inside folder "House"
 *   House%%Deep%%Dub.crate → crate "Dub" inside "Deep" inside "House"
 *
 * We synthesise folder nodes for intermediate segments and resolve each track
 * path to an internal track id (refs we can't resolve are dropped, exactly like
 * the Rekordbox XML importer).
 */

import type { Playlist } from '../../../src/types'
import { parseChunks } from './chunks'
import { resolveSeratoPath } from './databaseReader'

/** A crate file's display name (full `A%%B%%C` form) + its ordered track paths. */
export interface SeratoCrateFile {
  /** Filename without the `.crate` extension (may contain `%%` separators). */
  name: string
  /** `ptrk` values, drive-relative, in crate order. */
  trackPaths: string[]
}

/** Decode the ordered list of drive-relative track paths from a `.crate` buffer. */
export function parseCrate(buf: Buffer): string[] {
  const paths: string[] = []
  for (const chunk of parseChunks(buf)) {
    if (chunk.tag !== 'otrk' || !chunk.children) continue
    const ptrk = chunk.children.find((c) => c.tag === 'ptrk')
    if (ptrk?.text) paths.push(ptrk.text)
  }
  return paths
}

/**
 * Build the {@link Playlist} tree from parsed crate files.
 *
 * @param crates     Parsed crate files (name + track paths).
 * @param byAbsPath  Map of absolute file path → internal track id (from the imported tracks).
 * @param resolvePath Drive-relative → absolute resolver (injectable for tests / platforms).
 */
export function buildPlaylistsFromCrates(
  crates: SeratoCrateFile[],
  byAbsPath: Map<string, string>,
  resolvePath: (p: string) => string = resolveSeratoPath
): Playlist[] {
  const nodes = new Map<string, Playlist>() // "A%%B" path key → node
  const hasChildren = new Set<string>()

  const ensureNode = (segments: string[]): Playlist => {
    const key = segments.join('%%')
    let node = nodes.get(key)
    if (!node) {
      node = {
        id: crypto.randomUUID(),
        name: segments[segments.length - 1],
        parentId: null,
        trackIds: [],
        isFolder: false
      }
      nodes.set(key, node)
    }
    return node
  }

  for (const crate of crates) {
    const segments = crate.name.split('%%').filter((s) => s.length > 0)
    if (segments.length === 0) continue

    // Materialise every ancestor node and link parent → child.
    for (let i = 0; i < segments.length; i++) {
      const node = ensureNode(segments.slice(0, i + 1))
      if (i > 0) {
        const parentKey = segments.slice(0, i).join('%%')
        const parent = nodes.get(parentKey)
        if (parent) {
          node.parentId = parent.id
          hasChildren.add(parentKey)
        }
      }
    }

    // Attach this crate's tracks to its leaf node.
    const leaf = ensureNode(segments)
    for (const p of crate.trackPaths) {
      const id = byAbsPath.get(resolvePath(p))
      if (id) leaf.trackIds.push(id)
    }
  }

  // Any node with descendants is a folder (it may also carry its own tracks).
  for (const [key, node] of nodes) {
    if (hasChildren.has(key)) node.isFolder = true
  }

  return [...nodes.values()]
}
