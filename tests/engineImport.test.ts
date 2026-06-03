import { describe, it, expect, vi } from 'vitest'
import { join } from 'path'

/**
 * Engine DJ reader coverage. better-sqlite3 is built for Electron's ABI and
 * can't be opened under vitest, so — like engineExport.test.ts — we mock it.
 *
 * The mock is seeded with rows shaped EXACTLY as the verified export writer
 * (populateEngineDatabase) emits them, so this still proves the reader inverts
 * the writer: EAV metadata join, rating round-trip, ordered playlist membership,
 * relative-path resolution and id reuse.
 */

// ── Seed data mirroring populateEngineDatabase's output ──────────────────────
const META_ROWS = [
  // Track 1 — Strobe (fully populated)
  { id: 1, type: 1, text: 'Strobe' }, // Title
  { id: 1, type: 2, text: 'deadmau5' }, // Artist
  { id: 1, type: 3, text: 'For Lack of a Better Name' }, // Album
  { id: 1, type: 4, text: 'Progressive House' }, // Genre
  { id: 1, type: 5, text: 'peak time' }, // Comment
  { id: 1, type: 13, text: 'mp3' }, // FileExtension
  // Track 2 — Ghosts (sparse: no album/comment)
  { id: 2, type: 1, text: 'Ghosts n Stuff' },
  { id: 2, type: 2, text: 'deadmau5' },
  { id: 2, type: 4, text: 'Electro' },
  { id: 2, type: 13, text: 'mp3' }
]
const META_INT_ROWS = [{ id: 1, type: 5, value: 80 }] // Strobe Rating 4★ → 80
const TRACK_ROWS = [
  {
    id: 1,
    length: 634,
    bpm: 128,
    bpmAnalyzed: 128,
    year: 2009,
    path: 'Music/strobe.mp3',
    filename: 'strobe.mp3',
    bitrate: 320
  },
  {
    id: 2,
    length: 222,
    bpm: 128,
    bpmAnalyzed: 128,
    year: 0,
    path: 'Music/ghosts.mp3',
    filename: 'ghosts.mp3',
    bitrate: 0
  }
]
const PLAYLIST_ROWS = [{ id: 1, title: 'Warmup' }]
const PLAYLIST_ENTRIES: Record<number, Array<{ trackId: number }>> = {
  1: [{ trackId: 1 }, { trackId: 2 }]
}

class MockReadDb {
  prepare(sql: string): { all: (...a: unknown[]) => unknown[]; get: () => unknown } {
    return {
      all: (...args: unknown[]) => {
        if (sql.includes('FROM MetaDataInteger')) return META_INT_ROWS
        if (sql.includes('FROM MetaData')) return META_ROWS
        if (sql.includes('FROM Track')) return TRACK_ROWS
        if (sql.includes('FROM PlaylistTrackList')) return PLAYLIST_ENTRIES[args[0] as number] ?? []
        if (sql.includes('FROM Playlist')) return PLAYLIST_ROWS
        return []
      },
      get: () => undefined
    }
  }
  close(): void {
    /* no-op for the mock */
  }
}

vi.mock('better-sqlite3', () => ({ default: vi.fn(() => new MockReadDb()) }))

// Imported AFTER the mock is registered.
const { readEngineLibrary, resolveEnginePath } =
  await import('../electron/services/engine/dbReader')

const LIB = '/Users/x/Music/Engine Library'
const MDB = join(LIB, 'm.db')

describe('readEngineLibrary', () => {
  it('round-trips track metadata the export writer produces', async () => {
    const payload = await readEngineLibrary(MDB, () => {}, new Map())

    expect(payload.tracks).toHaveLength(2)
    const strobe = payload.tracks.find((t) => t.title === 'Strobe')!
    expect(strobe.artist).toBe('deadmau5')
    expect(strobe.album).toBe('For Lack of a Better Name')
    expect(strobe.genre).toBe('Progressive House')
    expect(strobe.comment).toBe('peak time')
    expect(strobe.bpm).toBe(128)
    expect(strobe.duration).toBe(634)
    expect(strobe.bitrate).toBe(320)
    expect(strobe.source).toBe('engine')
    // Rating 4★ → export stores 80 → importer back to 4.
    expect(strobe.rating).toBe(4)
    // Key deliberately not read (no verified encoding) — left blank.
    expect(strobe.key).toBe('')
    expect(strobe.energySource).toBe('pending')
    // Relative Track.path resolved against the Engine Library dir.
    expect(strobe.filePath).toBe(join(LIB, 'Music', 'strobe.mp3'))
  })

  it('handles optional/absent metadata without crashing', async () => {
    const payload = await readEngineLibrary(MDB, () => {}, new Map())
    const ghosts = payload.tracks.find((t) => t.title === 'Ghosts n Stuff')!
    expect(ghosts.album).toBeUndefined()
    expect(ghosts.comment).toBeUndefined()
    expect(ghosts.rating).toBe(0)
  })

  it('rebuilds the playlist with ordered membership mapped to internal ids', async () => {
    const payload = await readEngineLibrary(MDB, () => {}, new Map())
    expect(payload.playlists).toHaveLength(1)
    const pl = payload.playlists[0]
    expect(pl.name).toBe('Warmup')
    expect(pl.isFolder).toBe(false)
    expect(pl.trackIds).toHaveLength(2)
    const byId = new Map(payload.tracks.map((t) => [t.id, t.title]))
    expect(pl.trackIds.map((id) => byId.get(id))).toEqual(['Strobe', 'Ghosts n Stuff'])
  })

  it('reuses existing internal ids by file path so set FKs survive re-import', async () => {
    const resolved = join(LIB, 'Music', 'strobe.mp3')
    const payload = await readEngineLibrary(MDB, () => {}, new Map([[resolved, 'stable-id-123']]))
    expect(payload.tracks.find((t) => t.title === 'Strobe')!.id).toBe('stable-id-123')
  })

  it('reports parsing progress', async () => {
    const phases: string[] = []
    await readEngineLibrary(MDB, (p) => phases.push(p.phase), new Map())
    expect(phases[0]).toBe('parsing')
  })
})

describe('resolveEnginePath', () => {
  it('resolves relative paths against the Engine Library dir (exported layout)', () => {
    expect(resolveEnginePath('Music/a.mp3', '/usb/Engine Library/m.db')).toBe(
      '/usb/Engine Library/Music/a.mp3'
    )
  })

  it('resolves relative to the parent of Database2 (desktop layout)', () => {
    expect(resolveEnginePath('Music/a.mp3', '/Users/x/Music/Engine Library/Database2/m.db')).toBe(
      '/Users/x/Music/Engine Library/Music/a.mp3'
    )
  })

  it('passes absolute paths through unchanged', () => {
    expect(resolveEnginePath('/Volumes/USB/track.mp3', '/usb/Engine Library/m.db')).toBe(
      '/Volumes/USB/track.mp3'
    )
  })
})
