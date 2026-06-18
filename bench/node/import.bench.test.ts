/**
 * NFR-107 · Tier A — Import (PRD §11: 10k-track import < 10 s).
 *
 * Two measurements:
 *
 *  1. `importParse` canary — pure-JS XML parse of the 10k fixture. No native
 *     SQLite, so it ALWAYS runs (every PR). It's the dominant, most
 *     regression-prone phase of import and gives fast early warning.
 *
 *  2. Full `importFromXml` end-to-end including the better-sqlite3 writes. The
 *     native binding is built for the Electron ABI and can't load under plain
 *     `vitest` (NODE_MODULE_VERSION mismatch), so — exactly like the repo's DB
 *     integration tests — this SKIPS unless the binary is loadable. Run it via
 *     `npm rebuild better-sqlite3 && npm run bench:node` (CI nightly / release /
 *     local), then `npm run rebuild` to restore the Electron ABI.
 */

import { describe, it, expect, afterAll, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { parseStringPromise } from 'xml2js'
import { generateLibrary, BENCH_SEED } from '../fixtures/generateLibrary'
import { tracksToRekordboxXml } from '../fixtures/toRekordboxXml'
import { BUDGETS, measureAsync, record } from '../budgets'

// Temp userData dir handed to the mocked Electron app. Assigned before any
// dynamic import of 'electron', so the mock's getPath() closure is safe.
const USER_DATA = mkdtempSync(join(tmpdir(), 'setrecord-bench-'))

vi.mock('electron', () => ({
  app: { getPath: (): string => USER_DATA }
}))

const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

const tracks = generateLibrary(BENCH_SEED, 10_000)
const xml = tracksToRekordboxXml(tracks)

afterAll(() => {
  try {
    rmSync(USER_DATA, { recursive: true, force: true })
  } catch {
    /* best effort */
  }
})

describe('bench: import parse canary @10k', () => {
  it(`p95 < ${BUDGETS.importParse.value}ms`, async () => {
    const sample = await measureAsync(
      async () => {
        await parseStringPromise(xml, { explicitArray: true })
      },
      { warmup: 1, iterations: 3 }
    )
    const res = record('importParse', sample.p95, sample)

    console.log(
      `  import.parse: p50=${sample.p50.toFixed(0)}ms p95=${sample.p95.toFixed(
        0
      )}ms (budget ${res.budget}ms, ${(res.utilisation * 100).toFixed(0)}% used)`
    )
    expect(sample.p95).toBeLessThanOrEqual(BUDGETS.importParse.value)
  })
})

describe.skipIf(!dbAvailable)('bench: full import end-to-end @10k', () => {
  it(`< ${BUDGETS.import.value}ms`, async () => {
    const { initDb } = await import('../../electron/db/schema')
    const { importFromXml } = await import('../../electron/services/libraryImport')

    const xmlPath = join(USER_DATA, 'library-10k.xml')
    writeFileSync(xmlPath, xml)
    initDb()

    const sample = await measureAsync(
      async () => {
        await importFromXml(xmlPath, () => {})
      },
      { warmup: 0, iterations: 2 }
    )
    const res = record('import', sample.p95, sample)

    console.log(
      `  import.full: p50=${sample.p50.toFixed(0)}ms p95=${sample.p95.toFixed(
        0
      )}ms (budget ${res.budget}ms, ${(res.utilisation * 100).toFixed(0)}% used)`
    )
    expect(sample.p95).toBeLessThanOrEqual(BUDGETS.import.value)
  })
})
