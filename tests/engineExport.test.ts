import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Set as DJSet, Track } from '../src/types'
import { validateForTarget } from '../electron/services/usbValidator'
import {
  M_DB_SCHEMA,
  P_DB_SCHEMA,
  ratingToEngine,
  safeMusicFilename
} from '../electron/services/engine/engineSchema'
import {
  populateEngineDatabase,
  exportSetToEngineUsb,
  type EngineTrackInput
} from '../electron/services/engine/engineExport'
import { makeTrack } from './fixtures'

function makeSet(tracks: Track[], name = 'My Set'): DJSet {
  const now = new Date('2025-01-01T00:00:00Z').toISOString()
  return {
    id: 'set-1',
    name,
    createdAt: now,
    updatedAt: now,
    tracks: tracks.map((t, i) => ({ id: `st-${i}`, trackId: t.id, track: t, position: i }))
  }
}

// Temp dir with real (dummy) files so existsSync-based checks pass.
let workDir: string
function realTrack(name: string, over: Partial<Track> = {}): Track {
  const filePath = join(workDir, name)
  writeFileSync(filePath, 'dummy audio bytes')
  return makeTrack({ filePath, ...over })
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'ss-engine-'))
})
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true })
})

// ───────── validator: ownership / missing = blocking on every target ─────────

describe('export validation — no surprises at the gig', () => {
  it('blocks a phantom (non-owned) track on both ecosystems', () => {
    const set = makeSet([makeTrack({ id: 'p', phantom: true })])
    for (const ecosystem of ['pioneer', 'engine'] as const) {
      const r = validateForTarget(set, { ecosystem, hardware: 'CDJ-2000NXS2' })
      const blocking = r.issues.filter((i) => i.severity === 'blocking')
      expect(blocking).toHaveLength(1)
      expect(blocking[0].type).toBe('missing_file')
      expect(r.isExportReady).toBe(false)
    }
  })

  it('blocks a missing-file track (flagged or not on disk)', () => {
    const flagged = makeSet([makeTrack({ id: 'a', missingFile: true })])
    expect(validateForTarget(flagged, { ecosystem: 'engine' }).isExportReady).toBe(false)

    const gone = makeSet([makeTrack({ id: 'b', filePath: '/no/such/file.mp3' })])
    expect(validateForTarget(gone, { ecosystem: 'engine' }).isExportReady).toBe(false)
  })

  it('passes a real, owned track', () => {
    const set = makeSet([realTrack('ok.mp3')])
    const r = validateForTarget(set, { ecosystem: 'engine' })
    expect(r.isExportReady).toBe(true)
    expect(r.issues.filter((i) => i.severity === 'blocking')).toHaveLength(0)
  })
})

describe('validator — ecosystem format differences', () => {
  it('Engine accepts FLAC that legacy CDJs reject', () => {
    const set = makeSet([realTrack('hires.flac', { format: 'flac' })])
    const engine = validateForTarget(set, { ecosystem: 'engine' })
    const pioneer = validateForTarget(set, { ecosystem: 'pioneer', hardware: 'CDJ-2000NXS2' })
    expect(engine.issues.some((i) => i.type === 'unsupported_format')).toBe(false)
    expect(pioneer.issues.some((i) => i.type === 'unsupported_format')).toBe(true)
  })

  it('Engine has no 99-minute duration block', () => {
    const set = makeSet([realTrack('epic.mp3', { duration: 100 * 60 })])
    const engine = validateForTarget(set, { ecosystem: 'engine' })
    const pioneer = validateForTarget(set, { ecosystem: 'pioneer', hardware: 'CDJ-3000' })
    expect(engine.issues.some((i) => i.type === 'duration')).toBe(false)
    expect(pioneer.issues.some((i) => i.type === 'duration' && i.severity === 'blocking')).toBe(
      true
    )
  })

  it('an unidentifiable format is blocking even on Engine', () => {
    const set = makeSet([realTrack('weird.xyz', { format: 'unknown' })])
    expect(validateForTarget(set, { ecosystem: 'engine' }).isExportReady).toBe(false)
  })
})

// ───────── Engine schema helpers ─────────

describe('engine schema helpers', () => {
  it('maps 0–5 stars to Engine 0–120', () => {
    expect(ratingToEngine(0)).toBe(0)
    expect(ratingToEngine(3)).toBe(60)
    expect(ratingToEngine(5)).toBe(100)
    expect(ratingToEngine(9)).toBe(100) // clamped
  })

  it('produces collision-free, FAT-safe Music filenames', () => {
    const taken = new Set<string>()
    expect(safeMusicFilename('/a/b/Track One.mp3', taken)).toBe('Track One.mp3')
    expect(safeMusicFilename('/c/Track One.mp3', taken)).toBe('Track One-1.mp3') // dedupe
    expect(safeMusicFilename('/d/bad:name?.flac', taken)).toBe('bad_name_.flac') // sanitised
  })

  it('declares the load-critical tables', () => {
    const ddl = M_DB_SCHEMA.join('\n')
    for (const table of [
      'Information',
      'AlbumArt',
      'Track',
      'MetaData',
      'MetaDataInteger',
      'Playlist',
      'PlaylistTrackList'
    ]) {
      expect(ddl).toContain(`CREATE TABLE ${table} `)
    }
    expect(P_DB_SCHEMA.join('\n')).toContain('CREATE TABLE Information')
  })
})

// ───────── Engine Library writer logic (recording mock — better-sqlite3 is
// built for Electron's ABI and can't be opened under vitest) ─────────

interface RunCall {
  sql: string
  args: unknown[]
}
class MockDb {
  execs: string[] = []
  runs: RunCall[] = []
  private rowid = 0
  exec(sql: string): void {
    this.execs.push(sql)
  }
  prepare(sql: string): {
    run: (...args: unknown[]) => { lastInsertRowid: number; changes: number }
  } {
    return {
      run: (...args: unknown[]) => {
        this.runs.push({ sql, args })
        return { lastInsertRowid: ++this.rowid, changes: 1 }
      }
    }
  }
  transaction<T>(fn: (arg: T) => void): (arg: T) => void {
    return (arg: T) => fn(arg)
  }
  runsFor(fragment: string): RunCall[] {
    return this.runs.filter((r) => r.sql.includes(fragment))
  }
}

describe('Engine Library m.db writer logic', () => {
  const inputs: EngineTrackInput[] = [
    {
      title: 'First',
      artist: 'A1',
      album: 'Alb',
      genre: 'House',
      comment: 'note',
      bpm: 124.6,
      durationSec: 200.9,
      bitrate: 320,
      rating: 4,
      relPath: 'Music/first.mp3',
      filename: 'first.mp3',
      extension: 'mp3'
    },
    {
      title: 'Second',
      artist: 'A2',
      bpm: 128,
      durationSec: 180,
      rating: 0,
      relPath: 'Music/second.flac',
      filename: 'second.flac',
      extension: 'flac'
    }
  ]

  it('emits the schema + correctly-shaped inserts', () => {
    const db = new MockDb()
    populateEngineDatabase(db as unknown as Parameters<typeof populateEngineDatabase>[0], {
      uuid: 'uuid-123',
      playlistTitle: 'My Set',
      tracks: inputs
    })

    // All DDL ran.
    expect(db.execs).toHaveLength(M_DB_SCHEMA.length)

    // Information row carries the version + uuid.
    const info = db.runsFor('INSERT INTO Information')[0]
    expect(info.args).toEqual(['uuid-123', 1, 6, 0])

    // Two tracks, with rounded numerics and relative paths.
    const trackRuns = db.runsFor('INSERT INTO Track')
    expect(trackRuns).toHaveLength(2)
    // args order: playOrder, length, lengthCalculated, bpm, year, path, filename, bitrate, bpmAnalyzed, trackType
    expect(trackRuns[0].args[3]).toBe(125) // bpm rounded
    expect(trackRuns[0].args[1]).toBe(201) // length rounded
    expect(trackRuns[0].args[5]).toBe('Music/first.mp3') // relative path

    // Text metadata: title + artist for both, plus album/genre/comment/ext for the first.
    const titles = db.runsFor('INSERT INTO MetaData').filter((r) => r.args[1] === 1)
    expect(titles.map((r) => r.args[2])).toEqual(['First', 'Second'])

    // Rating maps 4★ → 80 for the first; the zero-rated second writes none.
    const ratings = db.runsFor('INSERT INTO MetaDataInteger')
    expect(ratings).toHaveLength(1)
    expect(ratings[0].args).toEqual([expect.anything(), 5, 80])

    // Playlist + ordered entries referencing the database uuid.
    expect(db.runsFor('INSERT INTO Playlist (title)')).toHaveLength(1)
    const entries = db.runsFor('INSERT INTO PlaylistTrackList')
    expect(entries).toHaveLength(2)
    expect(entries[0].args[4]).toBe(1) // trackNumber
    expect(entries[1].args[4]).toBe(2)
    expect(entries[0].args[3]).toBe('uuid-123') // databaseUuid
  })
})

describe('exportSetToEngineUsb — refuses to write a surprising USB', () => {
  it('aborts before writing the database when a track has no local file', async () => {
    const usb = mkdtempSync(join(tmpdir(), 'ss-usb-'))
    // Real track first (copies fine), then a phantom — the guard must trip.
    const set = makeSet([realTrack('present.mp3'), makeTrack({ id: 'x', phantom: true })])

    const result = await exportSetToEngineUsb(set, usb, () => {})
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()

    rmSync(usb, { recursive: true, force: true })
  })
})
