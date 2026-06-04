/**
 * NFR-801 Phase 2 — log export bundle. Verifies buildLogBundle() produces a zip
 * file under logs/export/, that meta.json has the expected non-identifying shape
 * (and carries no library contents), and that the staging dir is cleaned up.
 *
 * Mirrors tests/logger.test.ts: electron `app` is mocked to a real temp dir,
 * electron-store is stubbed, and db/schema is mocked so we don't pull in the
 * native better-sqlite3 binding.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, mkdirSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

const USER_DATA = mkdtempSync(join(tmpdir(), 'setsense-logexport-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => USER_DATA,
    getName: () => 'SetSense',
    getVersion: () => '9.9.9-test'
  }
}))

vi.mock('electron-store', () => ({
  default: class {
    store: Record<string, unknown> = {
      crashReportingEnabled: false,
      targetHardware: 'CDJ-3000',
      lastImportPath: '/Users/someone/Music/rekordbox/master.db'
    }
    get(key: string): unknown {
      return this.store[key]
    }
    set(): void {
      /* no-op */
    }
  }
}))

// Mock the DB accessor so we don't load the native better-sqlite3 binding in the
// test runner. buildLogBundle reads only coarse counts + user_version, all
// wrapped in try/catch, so a minimal fake is enough.
vi.mock('../electron/db/schema', () => ({
  getDb: () => ({
    pragma: (q: string, opts?: { simple?: boolean }) => {
      if (q === 'user_version' && opts?.simple) return 23
      return 23
    },
    prepare: (sql: string) => ({
      get: () => ({ n: sql.includes('tracks') ? 1200 : 7 })
    })
  })
}))

import { buildLogBundle } from '../electron/services/logging/exportBundle'

// `unzip` is available on the macOS CI runner; use it to read bundle entries.
function unzipList(zipPath: string): string[] {
  const out = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

function unzipRead(zipPath: string, entry: string): string {
  return execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8' })
}

describe('buildLogBundle', () => {
  beforeAll(() => {
    // Seed a redacted main.log so listLogFiles() has something to bundle.
    const logDir = join(USER_DATA, 'logs')
    mkdirSync(logDir, { recursive: true })
    writeFileSync(
      join(logDir, 'main.log'),
      JSON.stringify({ t: '2026-06-04T00:00:00.000Z', lvl: 'info', scope: 'main', msg: 'hi' }) +
        '\n',
      'utf8'
    )
  })

  it('produces a zip file under logs/export/', async () => {
    const zipPath = await buildLogBundle()
    expect(zipPath).toMatch(/logs\/export\/setsense-logs-.*\.zip$/)
    expect(existsSync(zipPath)).toBe(true)
  })

  it('bundles the redacted log file, ring buffer and meta.json', async () => {
    const zipPath = await buildLogBundle()
    const entries = unzipList(zipPath)
    expect(entries).toContain('main.log')
    expect(entries).toContain('ring-buffer.log')
    expect(entries).toContain('meta.json')
  })

  it('writes a meta.json with the expected non-identifying shape', async () => {
    const zipPath = await buildLogBundle()
    const meta = JSON.parse(unzipRead(zipPath, 'meta.json'))

    expect(typeof meta.sid).toBe('string')
    expect(meta.sid.length).toBeGreaterThan(0)
    expect(typeof meta.generatedAt).toBe('string')
    expect(meta.app.version).toBe('9.9.9-test')
    expect(meta.process.platform).toBe(process.platform)
    expect(typeof meta.process.electron).toBe('string')
    expect(typeof meta.process.node).toBe('string')
    expect(meta.crashReportingEnabled).toBe(false)
    // Schema/user_version surfaced from the (mocked) DB.
    expect(meta.db.userVersion).toBe(23)
    expect(meta.db.schemaVersion).toBe(23)
    // Coarse feature snapshot only — counts, never contents.
    expect(meta.features.trackCount).toBe(1200)
    expect(meta.features.setCount).toBe(7)
    expect(meta.features.hasLibrary).toBe(true)
  })

  it('meta.json contains no library contents (titles/paths/emails)', async () => {
    const zipPath = await buildLogBundle()
    const metaRaw = unzipRead(zipPath, 'meta.json')
    expect(metaRaw).not.toContain('/Users/')
    expect(metaRaw).not.toMatch(/@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
    expect(metaRaw.toLowerCase()).not.toContain('master.db')
  })

  it('redacts home-dir paths in the optional settings.json dump', async () => {
    const zipPath = await buildLogBundle()
    const entries = unzipList(zipPath)
    // settings.json is optional but our store mock provides values.
    expect(entries).toContain('settings.json')
    const settingsRaw = unzipRead(zipPath, 'settings.json')
    // The secret-ish lastImportPath key is omitted entirely.
    expect(settingsRaw).not.toContain('master.db')
    expect(settingsRaw).not.toContain('lastImportPath')
    // crashReportingEnabled (consent) is omitted from the dump.
    expect(settingsRaw).not.toContain('crashReportingEnabled')
    // A safe value survives.
    expect(settingsRaw).toContain('CDJ-3000')
  })

  it('cleans up the staging dir, leaving only the zip', async () => {
    const zipPath = await buildLogBundle()
    const exportDir = join(USER_DATA, 'logs', 'export')
    const remaining = readdirSync(exportDir)
    // No leftover staging directories (only *.zip artefacts).
    expect(remaining.every((e) => e.endsWith('.zip'))).toBe(true)
    expect(remaining).toContain(zipPath.split('/').pop())
  })
})
