/**
 * Persistent per-track energy cache.
 *
 * Spectral analysis decodes ~60s of PCM and runs an FFT per frame — affordable
 * once, wasteful on every set. We key cached results by a file *signature*
 * (path + byte size + mtime) rather than by track id so the cache survives a
 * library rebuild and self-invalidates whenever the underlying file changes
 * (re-encode, replaced master, etc.). Net effect: a track is analysed exactly
 * once, then every future set reads it back instantly.
 *
 * The store is a plain object persisted as JSON in userData. The cache logic is
 * decoupled from fs (constructor takes a backing record + an optional persist
 * hook) so it can be exercised in-memory by the tests.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { dirname } from 'path'
import type { EnergySource } from '../../../src/types'

/** What we persist per track. Mirrors the columns the DB ultimately stores. */
export interface CachedEnergy {
  energy: number
  energyRaw: number
  source: EnergySource
  /** Normalised components, kept for debugging / future re-weighting + tag inference. */
  rms: number
  brightness: number
  loudness: number
  /** Vocal-presence proxy (0..1), feeds the Vocals tag. */
  vocalness: number
  /** Schema version so a future calibration change can invalidate cleanly. */
  v: number
}

/**
 * Bump when the feature math or weighting changes so stale entries are ignored.
 * v2: added the vocal-presence proxy (`vocalness`) for auto-tagging.
 */
export const CACHE_VERSION = 2

type CacheStore = Record<string, CachedEnergy>

/**
 * Build the cache key from a file's identity. A re-encode changes size and/or
 * mtime, so the old entry is naturally bypassed.
 */
export function signature(filePath: string, size: number, mtimeMs: number): string {
  return `${filePath}|${size}|${Math.round(mtimeMs)}`
}

export class EnergyCache {
  private store: CacheStore
  private readonly persist?: (store: CacheStore) => void
  private dirty = false

  constructor(store: CacheStore = {}, persist?: (store: CacheStore) => void) {
    this.store = store
    this.persist = persist
  }

  /** Key for a file on disk, or null if it can't be stat'd (missing/unreadable). */
  keyForFile(filePath: string): string | null {
    try {
      const st = statSync(filePath)
      return signature(filePath, st.size, st.mtimeMs)
    } catch {
      return null
    }
  }

  /** Cache hit only if present and the schema version matches. */
  get(key: string): CachedEnergy | undefined {
    const hit = this.store[key]
    if (!hit || hit.v !== CACHE_VERSION) return undefined
    return hit
  }

  set(key: string, value: CachedEnergy): void {
    this.store[key] = value
    this.dirty = true
  }

  /** Flush to the backing store if anything changed since the last flush. */
  flush(): void {
    if (!this.dirty || !this.persist) return
    this.persist(this.store)
    this.dirty = false
  }

  /** Test/inspection helper. */
  size(): number {
    return Object.keys(this.store).length
  }
}

// ───────── file-backed singleton ─────────

let _shared: EnergyCache | null = null

function load(path: string): CacheStore {
  try {
    if (!existsSync(path)) return {}
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as CacheStore) : {}
  } catch {
    // Corrupt cache is non-fatal — start fresh.
    return {}
  }
}

/**
 * The process-wide cache, lazily loaded from `path` (userData/energy-cache.json
 * in production). Writes are atomic-ish: serialise then write in one call.
 */
export function getEnergyCache(path: string): EnergyCache {
  if (_shared) return _shared
  const store = load(path)
  _shared = new EnergyCache(store, (s) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(s), 'utf8')
    } catch (err) {
      console.error('[energyCache] failed to persist', err)
    }
  })
  return _shared
}

/** Test hook — drop the singleton so a fresh path is picked up. */
export function _resetEnergyCacheForTests(): void {
  _shared = null
}
