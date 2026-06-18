/**
 * Tests for the Stage-1 update checker (NFR-1001).
 *
 * The module imports `electron` and constructs an `electron-store` at load time,
 * so both are mocked before import. We cover the pure semver comparison and the
 * "never runs in dev/unpackaged builds" gate (a regression here would either
 * spam the GitHub API or pop a dialog during `npm run dev`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted above imports, so any state they reference must
// be created via vi.hoisted (which is hoisted too) rather than plain top-level
// consts.
const h = vi.hoisted(() => ({
  storeData: {} as Record<string, unknown>,
  isPackaged: { value: false },
  showMessageBox: vi.fn(async () => ({ response: 1 })),
  openExternal: vi.fn(async () => undefined)
}))

// In-memory store so module-load `new ElectronStore()` succeeds and we can assert
// on reads/writes. electron-store is a default export.
vi.mock('electron-store', () => ({
  default: class {
    get(key: string): unknown {
      return h.storeData[key]
    }
    set(key: string, value: unknown): void {
      h.storeData[key] = value
    }
  }
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return h.isPackaged.value
    },
    getVersion: () => '1.0.0'
  },
  dialog: { showMessageBox: h.showMessageBox },
  shell: { openExternal: h.openExternal }
}))

const { storeData, isPackaged, showMessageBox, openExternal } = h

import { isNewer, checkForUpdatesAndNotify } from '../electron/services/updateChecker'

describe('isNewer', () => {
  it('detects higher major/minor/patch', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('1.1.0', '1.0.9')).toBe(true)
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
  })

  it('is false for equal or older versions', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
    expect(isNewer('1.2.0', '2.0.0')).toBe(false)
  })

  it('tolerates a leading v and a prerelease/build suffix', () => {
    expect(isNewer('v1.2.3', '1.2.2')).toBe(true)
    expect(isNewer('1.2.3-beta.1', '1.2.2')).toBe(true)
    expect(isNewer('v1.2.3', '1.2.3')).toBe(false)
  })

  it('is false (never prompts) on unparseable input', () => {
    expect(isNewer('garbage', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', 'garbage')).toBe(false)
  })
})

describe('checkForUpdatesAndNotify', () => {
  beforeEach(() => {
    for (const k of Object.keys(storeData)) delete storeData[k]
    showMessageBox.mockClear()
    openExternal.mockClear()
  })

  it('no-ops in dev/unpackaged builds — no network, no dialog, no throttle write', async () => {
    isPackaged.value = false
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await checkForUpdatesAndNotify(null)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(showMessageBox).not.toHaveBeenCalled()
    expect(storeData.lastCheckAt).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
