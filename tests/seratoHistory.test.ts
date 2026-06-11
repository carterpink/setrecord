/**
 * Serato History import — binary parsers (pure) + replaceImportedSessions
 * (real-DB; skipped, like the other real-DB suites, when better-sqlite3 can't
 * load under the test runner's Node ABI).
 *
 * Fixtures are built with the encoders (encodeChunks / encodeAdatFields) so we
 * never ship real Serato files in the repo — same approach as serato.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { encodeChunks, encodeUtf16BE, type SeratoChunk } from '../electron/services/serato/chunks'
import {
  parseAdatFields,
  encodeAdatFields,
  parseSessionFile,
  parseHistoryDatabase,
  readSeratoHistory,
  type AdatField
} from '../electron/services/serato/historyReader'
import { createSchema } from '../electron/db/schema'
import { replaceImportedSessions } from '../electron/db/queries'

const dbAvailable = ((): boolean => {
  try {
    new Database(':memory:').close()
    return true
  } catch {
    return false
  }
})()

// ───────── fixture builders ─────────

const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n, 0)
  return b
}

/** Wrap adat fields into an `oent`/`oses` chunk. */
const row = (tag: 'oent' | 'oses', fields: AdatField[]): SeratoChunk => ({
  tag,
  children: [{ tag: 'adat', raw: encodeAdatFields(fields) }]
})

interface EntryOpts {
  path: string
  startedAt?: number // unix seconds
  played?: boolean // omit → no field 50
}

function sessionFileBuf(entries: EntryOpts[]): Buffer {
  const chunks: SeratoChunk[] = [{ tag: 'vrsn', text: '1.0/Serato Scratch LIVE Review' }]
  for (const e of entries) {
    const fields: AdatField[] = [
      { id: 2, payload: encodeUtf16BE(e.path) },
      { id: 6, payload: encodeUtf16BE('Some Title') },
      { id: 7, payload: encodeUtf16BE('Some Artist') }
    ]
    if (e.startedAt !== undefined) fields.push({ id: 28, payload: u32(e.startedAt) })
    if (e.played !== undefined) fields.push({ id: 50, payload: Buffer.from([e.played ? 1 : 0]) })
    chunks.push(row('oent', fields))
  }
  return encodeChunks(chunks)
}

function historyDatabaseBuf(sessions: Array<{ id: number; date: number }>): Buffer {
  const chunks: SeratoChunk[] = [{ tag: 'vrsn', text: '1.0/Serato Scratch LIVE Database' }]
  for (const s of sessions) {
    chunks.push(
      row('oses', [
        { id: 1, payload: u32(s.id) },
        { id: 29, payload: u32(s.date) }
      ])
    )
  }
  return encodeChunks(chunks)
}

const T1 = 1717063200 // 2024-05-30T10:00:00Z
const T2 = 1717066800 // 2024-05-30T11:00:00Z

// ───────── pure parser tests ─────────

describe('parseAdatFields', () => {
  it('round-trips through encodeAdatFields', () => {
    const fields: AdatField[] = [
      { id: 2, payload: encodeUtf16BE('Users/x/a.mp3') },
      { id: 28, payload: u32(T1) },
      { id: 50, payload: Buffer.from([1]) }
    ]
    const parsed = parseAdatFields(encodeAdatFields(fields))
    expect(parsed.map((f) => f.id)).toEqual([2, 28, 50])
    expect(parsed[1].payload.readUInt32BE(0)).toBe(T1)
  })

  it('stops on a truncated length instead of reading past the buffer', () => {
    const good = encodeAdatFields([{ id: 2, payload: encodeUtf16BE('a') }])
    const garbage = Buffer.concat([good, u32(9), u32(0xffffff)]) // claims huge payload
    expect(parseAdatFields(garbage)).toHaveLength(1)
  })

  it('returns [] for empty/short buffers', () => {
    expect(parseAdatFields(Buffer.alloc(0))).toEqual([])
    expect(parseAdatFields(Buffer.from([1, 2, 3]))).toEqual([])
  })
})

describe('parseSessionFile', () => {
  it('decodes path, start time and played flag per oent row', () => {
    const buf = sessionFileBuf([
      { path: 'Users/x/a.mp3', startedAt: T1, played: true },
      { path: 'Users/x/b.mp3', startedAt: T2, played: false }
    ])
    const entries = parseSessionFile(buf)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      filePath: 'Users/x/a.mp3',
      startedAt: '2024-05-30T10:00:00.000Z',
      played: true
    })
    expect(entries[1].played).toBe(false)
  })

  it('drops rows without a file path and rejects absurd timestamps', () => {
    const buf = encodeChunks([
      row('oent', [{ id: 28, payload: u32(T1) }]), // no path
      row('oent', [
        { id: 2, payload: encodeUtf16BE('Users/x/c.mp3') },
        { id: 28, payload: u32(0) } // epoch 0 → null, not a 1970 gig
      ])
    ])
    const entries = parseSessionFile(buf)
    expect(entries).toHaveLength(1)
    expect(entries[0].startedAt).toBeNull()
  })

  it('returns [] on garbage input', () => {
    expect(parseSessionFile(Buffer.from('not a serato file'))).toEqual([])
  })
})

describe('parseHistoryDatabase', () => {
  it('maps session id → ISO date', () => {
    const dates = parseHistoryDatabase(historyDatabaseBuf([{ id: 7, date: T1 }]))
    expect(dates.get(7)).toBe('2024-05-30T10:00:00.000Z')
  })

  it('skips entries with missing id or unusable date', () => {
    const buf = encodeChunks([
      row('oses', [{ id: 29, payload: u32(T1) }]), // no id
      row('oses', [
        { id: 1, payload: u32(9) },
        { id: 29, payload: u32(1) } // pre-1990 → rejected
      ])
    ])
    expect(parseHistoryDatabase(buf).size).toBe(0)
  })
})

describe('readSeratoHistory', () => {
  function makeHistoryDir(opts: { index?: Buffer; sessions: Record<string, Buffer> }): string {
    const seratoDir = mkdtempSync(join(tmpdir(), 'serato-history-'))
    const sessionsDir = join(seratoDir, 'History', 'Sessions')
    mkdirSync(sessionsDir, { recursive: true })
    if (opts.index) writeFileSync(join(seratoDir, 'History', 'history.database'), opts.index)
    for (const [name, buf] of Object.entries(opts.sessions)) {
      writeFileSync(join(sessionsDir, name), buf)
    }
    return seratoDir
  }

  const byAbsPath = new Map([
    ['/Users/x/a.mp3', 'track-a'],
    ['/Users/x/b.mp3', 'track-b']
  ])

  it('resolves played tracks to internal ids, dates from the index', () => {
    const dir = makeHistoryDir({
      index: historyDatabaseBuf([{ id: 3, date: T1 }]),
      sessions: {
        '3.session': sessionFileBuf([
          { path: 'Users/x/a.mp3', startedAt: T1, played: true },
          { path: 'Users/x/b.mp3', startedAt: T2, played: true },
          { path: 'Users/x/loaded-not-played.mp3', startedAt: T2, played: false },
          { path: 'Users/x/not-in-library.mp3', startedAt: T2, played: true }
        ])
      }
    })
    const sessions = readSeratoHistory(dir, byAbsPath)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      name: 'Serato 2024-05-30',
      performedAt: '2024-05-30T10:00:00.000Z',
      venue: null,
      trackIds: ['track-a', 'track-b']
    })
  })

  it('falls back to earliest start time when the index is missing', () => {
    const dir = makeHistoryDir({
      sessions: {
        '42.session': sessionFileBuf([
          { path: 'Users/x/b.mp3', startedAt: T2 }, // no played flag → all kept
          { path: 'Users/x/a.mp3', startedAt: T1 }
        ])
      }
    })
    const sessions = readSeratoHistory(dir, byAbsPath)
    expect(sessions[0].performedAt).toBe('2024-05-30T10:00:00.000Z')
    expect(sessions[0].trackIds).toEqual(['track-b', 'track-a'])
  })

  it('survives a corrupt session file and returns [] without a History dir', () => {
    const dir = makeHistoryDir({
      sessions: {
        'bad.session': Buffer.from('garbage'),
        '5.session': sessionFileBuf([{ path: 'Users/x/a.mp3', startedAt: T1, played: true }])
      }
    })
    const sessions = readSeratoHistory(dir, byAbsPath)
    expect(sessions).toHaveLength(2) // garbage parses to 0 entries, not a throw
    expect(sessions.some((s) => s.trackIds.includes('track-a'))).toBe(true)

    const empty = mkdtempSync(join(tmpdir(), 'serato-nohistory-'))
    expect(readSeratoHistory(empty, byAbsPath)).toEqual([])
  })
})

// ───────── real-DB suite ─────────

describe.skipIf(!dbAvailable)('replaceImportedSessions (serato)', () => {
  let db: Database.Database

  function addTrack(id: string): void {
    db.prepare(
      `INSERT INTO tracks (id, title, artist, bpm, play_count, date_added, file_path)
       VALUES (?, ?, 'Artist', 120, 0, '2025-01-01', ?)`
    ).run(id, `Track ${id}`, `/music/${id}.mp3`)
  }

  const allSessions = (): Array<Record<string, unknown>> =>
    db.prepare('SELECT * FROM play_sessions ORDER BY performed_at').all() as Array<
      Record<string, unknown>
    >

  beforeEach(() => {
    db = new Database(':memory:')
    createSchema(db)
    addTrack('t1')
    addTrack('t2')
  })

  const seratoSession = {
    name: 'Serato 2024-05-30',
    performedAt: '2024-05-30T10:00:00.000Z',
    venue: null,
    trackIds: ['t1', 't2']
  }

  it("inserts with source='serato' and method='imported-history'", () => {
    replaceImportedSessions(db, 'serato', [seratoSession])
    const rows = allSessions()
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('serato')
    expect(rows[0].method).toBe('imported-history')
    const tracks = db
      .prepare('SELECT track_id FROM session_tracks WHERE session_id = ? ORDER BY play_order')
      .all(rows[0].id) as Array<{ track_id: string }>
    expect(tracks.map((t) => t.track_id)).toEqual(['t1', 't2'])
  })

  it('is idempotent and never touches other sources', () => {
    db.prepare(
      `INSERT INTO play_sessions (id, name, source, performed_at, created_at, method)
       VALUES ('rb1', 'RB gig', 'rekordbox', '2024-01-01T00:00:00.000Z', '2024-01-01', 'imported-history'),
              ('sr1', 'Live gig', 'setrecord', '2024-02-01T00:00:00.000Z', '2024-02-01', 'live-recorded')`
    ).run()

    replaceImportedSessions(db, 'serato', [seratoSession])
    replaceImportedSessions(db, 'serato', [seratoSession]) // re-import

    const rows = allSessions()
    expect(rows.filter((r) => r.source === 'serato')).toHaveLength(1)
    expect(rows.filter((r) => r.source === 'rekordbox')).toHaveLength(1)
    expect(rows.filter((r) => r.source === 'setrecord')).toHaveLength(1)
  })

  it('preserves user-edited venue metadata across re-import (same source only)', () => {
    replaceImportedSessions(db, 'serato', [seratoSession])
    db.prepare(
      `UPDATE play_sessions SET venue = 'Hi Ibiza', venue_source = 'user' WHERE source = 'serato'`
    ).run()

    replaceImportedSessions(db, 'serato', [seratoSession])
    const rows = allSessions().filter((r) => r.source === 'serato')
    expect(rows).toHaveLength(1)
    expect(rows[0].venue).toBe('Hi Ibiza')
    expect(rows[0].venue_source).toBe('user')
  })

  it('back-fills track play stats from session dates', () => {
    replaceImportedSessions(db, 'serato', [seratoSession])
    const t1 = db.prepare('SELECT play_count, last_played FROM tracks WHERE id = ?').get('t1') as {
      play_count: number
      last_played: string
    }
    expect(t1.play_count).toBe(1)
    expect(t1.last_played).toBe('2024-05-30T10:00:00.000Z')
  })
})
