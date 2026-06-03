/**
 * Native Rekordbox MyTag writer (advanced, Pro).
 *
 * Writes SetSense's plain-language tags into Rekordbox's own MyTag tables
 * (djmdMyTag categories/tags + djmdSongMyTag associations) so they become real,
 * filterable MyTags inside Rekordbox.
 *
 * Safety is non-negotiable here — this touches the user's library DB:
 *   1. A timestamped backup of master.db (+ WAL/SHM) is taken BEFORE opening it.
 *   2. The DB is opened read-write; if Rekordbox is running the open fails with a
 *      lock error and nothing is written.
 *   3. All writes happen in a single transaction; ANY error rolls back and the
 *      user is pointed at the backup.
 *   4. Column sets are introspected so we adapt to RB6 vs RB7 schema differences;
 *      a missing MyTag table aborts cleanly with no changes.
 *
 * Because schema/USN semantics vary by Rekordbox version, this should be
 * validated against real RB6 and RB7 databases (on a copy) before being made the
 * default hand-off — see the plan's verification spike. The backup makes the
 * worst case fully recoverable.
 */

import { copyFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { openMasterDbWritable, type MasterDbRW } from './cipher'
import { labelForSlug } from '../../../src/utils/tagging/taxonomy'
import type { RekordboxTagWriteResult } from '../../../src/types'

export interface MyTagEntry {
  rekordboxId: string
  tags: Array<{ category: string; value: string }>
}

export type MyTagWriteResult = RekordboxTagWriteResult

/** Top-level MyTag category SetSense creates to hold its tags. */
const PARENT_NAME = 'SetSense'

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function nowStamp(): string {
  // Rekordbox stores timestamps like "2024-01-02 03:04:05.678 +00:00".
  return new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00')
}

async function tableColumns(db: MasterDbRW, table: string): Promise<string[]> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`)
  return rows.map((r) => r.name)
}

async function nextNumericId(db: MasterDbRW, table: string): Promise<number> {
  const row = await db.get<{ m: number | null }>(
    `SELECT MAX(CAST(ID AS INTEGER)) AS m FROM ${table}`
  )
  const base = row?.m ?? 0
  // Offset well clear of existing ids to avoid any collision window.
  return Math.max(base, Date.now() % 1_000_000_000) + 1
}

/** Default value for a column we don't explicitly set. */
function columnDefault(col: string, stamp: string): unknown {
  if (col === 'UUID') return randomUUID()
  if (col === 'created_at' || col === 'updated_at') return stamp
  // rb_* bookkeeping + usn fields, and anything else numeric, default to 0.
  return 0
}

async function insertRow(
  db: MasterDbRW,
  table: string,
  cols: string[],
  known: Record<string, unknown>,
  stamp: string
): Promise<void> {
  const values = cols.map((c) => (c in known ? known[c] : columnDefault(c, stamp)))
  const placeholders = cols.map(() => '?').join(', ')
  await db.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, values)
}

export async function writeMyTags(
  dbPath: string,
  entries: MyTagEntry[]
): Promise<MyTagWriteResult> {
  // 1. Mandatory backup before touching anything.
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dbPath}.setsense-backup-${ts}`
  try {
    copyFileSync(dbPath, backupPath)
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(dbPath + suffix)) copyFileSync(dbPath + suffix, backupPath + suffix)
    }
  } catch (err) {
    return {
      success: false,
      error: `Couldn't back up your Rekordbox database, so nothing was written. (${msg(err)})`
    }
  }

  // 2. Open read-write (fails if Rekordbox is open).
  let db: MasterDbRW
  try {
    db = await openMasterDbWritable(dbPath)
  } catch (err) {
    return { success: false, backupPath, error: msg(err) }
  }

  try {
    const myTagCols = await tableColumns(db, 'djmdMyTag')
    const songCols = await tableColumns(db, 'djmdSongMyTag')
    if (myTagCols.length === 0 || songCols.length === 0) {
      await db.close()
      return {
        success: false,
        backupPath,
        error:
          'This Rekordbox database has no MyTag tables yet. Create at least one MyTag in Rekordbox, then try again.'
      }
    }

    // Distinct plain-language labels used across all entries.
    const usedLabels = new Map<string, true>()
    for (const e of entries) {
      for (const t of e.tags) {
        if (t.value) usedLabels.set(labelForSlug(t.value), true)
      }
    }

    const stamp = nowStamp()
    await db.run('BEGIN')

    // Parent category.
    let id = await nextNumericId(db, 'djmdMyTag')
    const parentId = String(id++)
    await insertRow(
      db,
      'djmdMyTag',
      myTagCols,
      { ID: parentId, Name: PARENT_NAME, ParentID: 'root', Seq: 1, Attribute: 0 },
      stamp
    )

    // Child tags.
    const labelToId = new Map<string, string>()
    let seq = 1
    for (const label of usedLabels.keys()) {
      const childId = String(id++)
      await insertRow(
        db,
        'djmdMyTag',
        myTagCols,
        { ID: childId, Name: label, ParentID: parentId, Seq: seq++, Attribute: 0 },
        stamp
      )
      labelToId.set(label, childId)
    }

    // Associations (skip ones that already exist).
    let songId = await nextNumericId(db, 'djmdSongMyTag')
    let associations = 0
    for (const e of entries) {
      for (const t of e.tags) {
        if (!t.value) continue
        const myTagId = labelToId.get(labelForSlug(t.value))
        if (!myTagId) continue
        const exists = await db.get(
          `SELECT 1 FROM djmdSongMyTag WHERE ContentID = ? AND MyTagID = ? LIMIT 1`,
          [e.rekordboxId, myTagId]
        )
        if (exists) continue
        await insertRow(
          db,
          'djmdSongMyTag',
          songCols,
          { ID: String(songId++), MyTagID: myTagId, ContentID: e.rekordboxId },
          stamp
        )
        associations++
      }
    }

    await db.run('COMMIT')
    await db.close()
    return { success: true, backupPath, tagsCreated: labelToId.size, associations }
  } catch (err) {
    try {
      await db.run('ROLLBACK')
    } catch {
      /* nothing committed */
    }
    await db.close()
    return {
      success: false,
      backupPath,
      error: `The write failed and was rolled back — your Rekordbox library is unchanged. A backup is saved at ${backupPath}. (${msg(err)})`
    }
  }
}
