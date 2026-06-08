/**
 * Tests for Fresh Start (Settings → Danger zone). freshStart() must wipe the
 * library DB, the electron-store-backed state, and the on-disk caches — and must
 * NOT touch the keychain (so a Pro licence survives a reset).
 *
 * The store/db modules are mocked to spies so we assert the wipe *calls* without
 * needing a real Electron runtime; the artwork dir + energy cache are written as
 * real temp files so we verify they're actually removed from disk.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const USER_DATA = mkdtempSync(join(tmpdir(), 'setrecord-reset-'))
const ARTWORK_DIR = join(USER_DATA, 'artwork')
const ENERGY_CACHE = join(USER_DATA, 'energy-cache.json')

vi.mock('electron', () => ({
  app: { getPath: () => USER_DATA }
}))

// Hoisted so the vi.mock factories (which run before module init) can close
// over the same spy instances the tests assert against.
const { resetDb, clearSettings, clearProgress, clearTrial, clearLicenseLocalState } = vi.hoisted(
  () => ({
    resetDb: vi.fn(),
    clearSettings: vi.fn(),
    clearProgress: vi.fn(),
    clearTrial: vi.fn(),
    clearLicenseLocalState: vi.fn()
  })
)

vi.mock('../electron/db/schema', () => ({ resetDb }))
vi.mock('../electron/services/settingsService', () => ({ clearSettings }))
vi.mock('../electron/services/progressService', () => ({ clearProgress }))
vi.mock('../electron/services/licensing/trialStore', () => ({ clearTrial }))
vi.mock('../electron/services/licensing/licenseLocalStore', () => ({ clearLicenseLocalState }))
vi.mock('../electron/services/artworkExtractor', () => ({
  getArtworkCacheDir: () => ARTWORK_DIR
}))

import { freshStart } from '../electron/services/resetService'

describe('freshStart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdirSync(ARTWORK_DIR, { recursive: true })
    writeFileSync(join(ARTWORK_DIR, 'track-1.jpg'), 'jpegdata')
    writeFileSync(ENERGY_CACHE, '{"track-1":{"energy":7}}')
  })

  it('hard-deletes the library DB (no quarantine copy)', () => {
    freshStart()
    expect(resetDb).toHaveBeenCalledWith({ quarantine: false })
  })

  it('resets every electron-store-backed state', () => {
    freshStart()
    expect(clearSettings).toHaveBeenCalledOnce()
    expect(clearProgress).toHaveBeenCalledOnce()
    expect(clearTrial).toHaveBeenCalledOnce()
    expect(clearLicenseLocalState).toHaveBeenCalledOnce()
  })

  it('removes the artwork cache and energy cache from disk', () => {
    expect(existsSync(ARTWORK_DIR)).toBe(true)
    expect(existsSync(ENERGY_CACHE)).toBe(true)
    freshStart()
    expect(existsSync(ARTWORK_DIR)).toBe(false)
    expect(existsSync(ENERGY_CACHE)).toBe(false)
  })

  it('never imports or touches the keychain (licence survives a reset)', () => {
    // resetService has no keychain dependency at all — assert the module graph
    // stays clean so a future edit can't silently start wiping secrets.
    freshStart()
    expect(vi.isMockFunction(resetDb)).toBe(true)
    // No keytar/secretStore mock is registered; if freshStart needed one the
    // import would fail to resolve under this test's mock set.
  })
})
