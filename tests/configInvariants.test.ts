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

describe('createSchema must not index migration-added columns', () => {
  // createSchema() runs BEFORE migrations in initDb. A column added later via
  // `ALTER TABLE … ADD COLUMN` does not exist on a not-yet-migrated DB, so any
  // `CREATE INDEX … ON t(col)` for such a column in createSchema throws
  // "no such column: col" and aborts startup before the migration can run.
  // (Regression: idx_play_sessions_method crashed every pre-v23 library on open.)
  // Indexes on migration-added columns belong in the migration, after ADD COLUMN.
  const schema = read('../electron/db/schema.ts')
  const migrations = read('../electron/db/migrations.ts')

  it('no createSchema index references a column added by an ALTER TABLE migration', () => {
    const altered = new Set(
      [...migrations.matchAll(/ADD COLUMN\s+(\w+)/g)].map((m) => m[1])
    )
    expect(altered.size).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const m of schema.matchAll(/CREATE INDEX[^(]*\bON\s+\w+\s*\(([^)]+)\)/g)) {
      for (const col of m[1].split(',').map((c) => c.trim())) {
        if (altered.has(col)) offenders.push(`${m[0].trim()} → column "${col}"`)
      }
    }
    expect(offenders, `createSchema indexes a migration-added column:\n${offenders.join('\n')}`).toEqual([])
  })
})
