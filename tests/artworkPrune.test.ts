/**
 * Tests for the artwork cache cleanup policy (NFR-901). The cache holds one
 * `<trackId>.jpg` per track; when tracks are deleted/re-imported their files
 * orphan. pruneArtworkCache() must remove exactly those, keep live tracks'
 * art, leave non-cache files alone, and never throw.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Stable temp userData dir for the whole file; getArtworkCacheDir() caches it.
const USER_DATA = mkdtempSync(join(tmpdir(), 'setsense-artwork-'))

vi.mock('electron', () => ({
  app: { getPath: () => USER_DATA }
}))

// Live track ids the DB reports; mutated per-test before calling prune.
let liveIds: Array<{ id: string }> = []
vi.mock('../electron/db/schema', () => ({
  getDb: () => ({
    prepare: () => ({ all: () => liveIds })
  })
}))

import { pruneArtworkCache, getArtworkCacheDir } from '../electron/services/artworkExtractor'

const cacheDir = getArtworkCacheDir()
const writeArt = (name: string, bytes = 'jpegdata'): void =>
  writeFileSync(join(cacheDir, name), bytes)

describe('pruneArtworkCache', () => {
  beforeEach(() => {
    // Clear the cache dir between tests.
    for (const f of readdirSync(cacheDir)) rmSync(join(cacheDir, f))
    liveIds = []
  })
  afterEach(() => {
    for (const f of readdirSync(cacheDir)) rmSync(join(cacheDir, f))
  })

  it('removes orphans and keeps live tracks’ art', () => {
    writeArt('live1.jpg')
    writeArt('live2.jpg')
    writeArt('orphan1.jpg')
    writeArt('orphan2.jpg')
    liveIds = [{ id: 'live1' }, { id: 'live2' }]

    const res = pruneArtworkCache()

    expect(res.removed).toBe(2)
    expect(res.bytesFreed).toBeGreaterThan(0)
    expect(existsSync(join(cacheDir, 'live1.jpg'))).toBe(true)
    expect(existsSync(join(cacheDir, 'live2.jpg'))).toBe(true)
    expect(existsSync(join(cacheDir, 'orphan1.jpg'))).toBe(false)
    expect(existsSync(join(cacheDir, 'orphan2.jpg'))).toBe(false)
  })

  it('never touches non-.jpg files', () => {
    writeArt('keep.txt')
    writeArt('notes.json')
    writeArt('orphan.jpg')
    liveIds = []

    const res = pruneArtworkCache()

    expect(res.removed).toBe(1)
    expect(existsSync(join(cacheDir, 'keep.txt'))).toBe(true)
    expect(existsSync(join(cacheDir, 'notes.json'))).toBe(true)
    expect(existsSync(join(cacheDir, 'orphan.jpg'))).toBe(false)
  })

  it('is a no-op on an empty cache', () => {
    liveIds = [{ id: 'whatever' }]
    expect(pruneArtworkCache()).toEqual({ removed: 0, bytesFreed: 0 })
  })

  it('keeps everything when every file maps to a live track', () => {
    writeArt('a.jpg')
    writeArt('b.jpg')
    liveIds = [{ id: 'a' }, { id: 'b' }]

    const res = pruneArtworkCache()

    expect(res.removed).toBe(0)
    expect(readdirSync(cacheDir).sort()).toEqual(['a.jpg', 'b.jpg'])
  })
})
