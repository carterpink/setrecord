import type Database from 'better-sqlite3'

/**
 * Run pending schema migrations in order.
 * Each migration is idempotent — safe to re-run on any startup.
 * NOTE: We check column existence directly rather than relying solely on the version
 * number because an earlier bad deploy briefly wrote schema_version = 2 to existing
 * databases before the ALTER TABLE ran, leaving the column missing at v2.
 */
export function runMigrations(db: Database.Database): void {
  // v2: art_gradient column — check existence unconditionally so corrupt version state can't skip it
  const cols = (
    db.prepare('PRAGMA table_info(tracks)').all() as Array<{ name: string }>
  ).map((c) => c.name)

  if (!cols.includes('art_gradient')) {
    db.exec('ALTER TABLE tracks ADD COLUMN art_gradient TEXT')
  }

  // Stamp version 2 regardless (handles both fresh DBs and the corrupted-version case)
  db.prepare('INSERT OR REPLACE INTO schema_version VALUES (2)').run()
}
