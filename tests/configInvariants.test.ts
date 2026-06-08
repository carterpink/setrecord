/**
 * Config-drift guards.
 *
 * These are text-invariant tests (they read source as plain text and never load
 * native modules), guarding two "silent breakage" classes that bit us before:
 *
 *  1. The in-app update notice must point at the same GitHub repo that
 *     electron-builder publishes the signed DMG to. A mismatch makes the update
 *     API 404 silently, so installed builds never learn about new releases —
 *     including security patches. (Regression: REPO_NAME was once `setrecordnsev2`
 *     while publish.repo was `setrecordv2`.)
 *
 *  2. LATEST_SCHEMA_VERSION in schema.ts must equal the highest version written
 *     by migrations.ts. initDb() uses it to decide whether to take a
 *     pre-migration backup; if it lags, a real migration could run without a
 *     safety snapshot.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')

describe('update channel ↔ publish target', () => {
  const builder = read('../electron-builder.yml')
  const updateChecker = read('../electron/services/updateChecker.ts')

  it('updateChecker REPO_OWNER/REPO_NAME match electron-builder publish config', () => {
    const owner = /publish:[\s\S]*?owner:\s*(\S+)/.exec(builder)?.[1]
    const repo = /publish:[\s\S]*?repo:\s*(\S+)/.exec(builder)?.[1]
    expect(owner, 'publish.owner missing in electron-builder.yml').toBeTruthy()
    expect(repo, 'publish.repo missing in electron-builder.yml').toBeTruthy()

    const codeOwner = /REPO_OWNER\s*=\s*'([^']+)'/.exec(updateChecker)?.[1]
    const codeRepo = /REPO_NAME\s*=\s*'([^']+)'/.exec(updateChecker)?.[1]
    expect(codeOwner).toBe(owner)
    expect(codeRepo).toBe(repo)
  })
})

describe('schema version pin', () => {
  const schema = read('../electron/db/schema.ts')
  const migrations = read('../electron/db/migrations.ts')

  it('LATEST_SCHEMA_VERSION equals the highest version migrations.ts writes', () => {
    const declared = Number(/LATEST_SCHEMA_VERSION\s*=\s*(\d+)/.exec(schema)?.[1])
    expect(Number.isFinite(declared)).toBe(true)

    const versions = [...migrations.matchAll(/schema_version VALUES \((\d+)\)/g)].map((m) =>
      Number(m[1])
    )
    expect(versions.length).toBeGreaterThan(0)
    expect(declared).toBe(Math.max(...versions))
  })
})
