import { describe, it, expect } from 'vitest'
import {
  parseChunks,
  encodeChunks,
  decodeUtf16BE,
  encodeUtf16BE,
  chunkKind
} from '../electron/services/serato/chunks'
import {
  parseDatabaseV2,
  seratoRecordToTrack,
  seratoKeyToCamelot,
  parseSeratoLength,
  resolveSeratoPath
} from '../electron/services/serato/databaseReader'
import { parseCrate, buildPlaylistsFromCrates } from '../electron/services/serato/crateReader'
import {
  findEntriesStart,
  parseMarkers2Entries,
  parseBeatgrid
} from '../electron/services/serato/seratoTags'
import { engineDjProvider } from '../electron/services/import/providers/engineDj'

// ───────── helpers for building binary fixtures ─────────

const u32be = (n: number): Buffer => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}
const f32be = (n: number): Buffer => {
  const b = Buffer.alloc(4)
  b.writeFloatBE(n)
  return b
}
const cstr = (s: string): Buffer => Buffer.from(s + '\0', 'latin1')

/** Build a Markers2 entry: `<name>\0` + 4-byte BE length + body. */
const markersEntry = (name: string, body: Buffer): Buffer =>
  Buffer.concat([cstr(name), u32be(body.length), body])

// ───────── chunks ─────────

describe('serato chunk codec', () => {
  it('classifies tags by prefix', () => {
    expect(chunkKind('otrk')).toBe('nested')
    expect(chunkKind('pfil')).toBe('text')
    expect(chunkKind('tbpm')).toBe('text')
    expect(chunkKind('vrsn')).toBe('text')
    expect(chunkKind('usiz')).toBe('u32')
    expect(chunkKind('bbgl')).toBe('bool')
  })

  it('round-trips UTF-16BE text', () => {
    expect(decodeUtf16BE(encodeUtf16BE('Café Déjà'))).toBe('Café Déjà')
  })

  it('encodes then parses a nested chunk tree', () => {
    const encoded = encodeChunks([
      { tag: 'vrsn', text: '2.0/Serato Database' },
      {
        tag: 'otrk',
        children: [
          { tag: 'pfil', text: 'Users/dj/a.mp3' },
          { tag: 'tbpm', text: '128' },
          { tag: 'usiz', u32: 1234 },
          { tag: 'bbgl', bool: true }
        ]
      }
    ])
    const parsed = parseChunks(encoded)
    expect(parsed[0].text).toBe('2.0/Serato Database')
    expect(parsed[1].tag).toBe('otrk')
    expect(parsed[1].children?.[0].text).toBe('Users/dj/a.mp3')
    expect(parsed[1].children?.[1].text).toBe('128')
    expect(parsed[1].children?.[2].u32).toBe(1234)
    expect(parsed[1].children?.[3].bool).toBe(true)
  })

  it('stops cleanly on a truncated chunk rather than throwing', () => {
    const good = encodeChunks([{ tag: 'tsng', text: 'ok' }])
    const truncated = Buffer.concat([good, Buffer.from('otrk'), Buffer.from([0x00, 0x00, 0xff])])
    expect(() => parseChunks(truncated)).not.toThrow()
    expect(parseChunks(truncated)[0].text).toBe('ok')
  })
})

// ───────── database V2 → records → Track ─────────

describe('serato database V2 reader', () => {
  const dbBuf = encodeChunks([
    { tag: 'vrsn', text: '2.0/Serato Scratch LIVE Database' },
    {
      tag: 'otrk',
      children: [
        { tag: 'pfil', text: 'Users/dj/Music/Song.mp3' },
        { tag: 'tsng', text: 'Song Title' },
        { tag: 'tart', text: 'Artist Name' },
        { tag: 'talb', text: 'Album' },
        { tag: 'tgen', text: 'House' },
        { tag: 'tbpm', text: '128.00' },
        { tag: 'tkey', text: 'Am' },
        { tag: 'tlen', text: '5:23' },
        { tag: 'tbit', text: '320.0kbps' },
        { tag: 'tcom', text: 'great track' },
        { tag: 'tlbl', text: 'Label X' }
      ]
    },
    // A record with no path is skipped.
    { tag: 'otrk', children: [{ tag: 'tsng', text: 'orphan' }] }
  ])

  it('decodes track records and skips pathless ones', () => {
    const records = parseDatabaseV2(dbBuf)
    expect(records).toHaveLength(1)
    const r = records[0]
    expect(r.filePath).toBe('Users/dj/Music/Song.mp3')
    expect(r.title).toBe('Song Title')
    expect(r.artist).toBe('Artist Name')
    expect(r.genre).toBe('House')
    expect(r.bpm).toBe(128)
    expect(r.key).toBe('Am')
    expect(r.durationSec).toBe(323)
    expect(r.bitrate).toBe(320)
    expect(r.comment).toBe('great track')
    expect(r.label).toBe('Label X')
  })

  it('maps a record onto a Track with Serato defaults', () => {
    const track = seratoRecordToTrack(parseDatabaseV2(dbBuf)[0], new Map())
    expect(track.filePath).toBe('/Users/dj/Music/Song.mp3')
    expect(track.key).toBe('8A')
    expect(track.keyOpenNotation).toBe('Am')
    expect(track.format).toBe('mp3')
    expect(track.source).toBe('serato')
    expect(track.energy).toBe(5)
    expect(track.energySource).toBe('pending')
    expect(track.rating).toBe(0)
    expect(track.playCount).toBe(0)
    expect(track.cuePoints).toEqual([])
    expect(track.duration).toBe(323)
  })

  it('reuses an existing track id by file path (re-import safety)', () => {
    const existing = new Map([['/Users/dj/Music/Song.mp3', 'existing-uuid']])
    const track = seratoRecordToTrack(parseDatabaseV2(dbBuf)[0], existing)
    expect(track.id).toBe('existing-uuid')
  })

  it('seratoKeyToCamelot handles open + Camelot notation', () => {
    expect(seratoKeyToCamelot('Am')).toBe('8A')
    expect(seratoKeyToCamelot('F#m')).toBe('5A')
    expect(seratoKeyToCamelot('8A')).toBe('8A')
    expect(seratoKeyToCamelot('11b')).toBe('11B')
    expect(seratoKeyToCamelot('')).toBe('')
    expect(seratoKeyToCamelot(undefined)).toBe('')
  })

  it('parseSeratoLength parses time strings and seconds', () => {
    expect(parseSeratoLength('5:23')).toBe(323)
    expect(parseSeratoLength('1:02:33')).toBe(3753)
    expect(parseSeratoLength('200')).toBe(200)
    expect(parseSeratoLength(undefined)).toBeUndefined()
  })

  it('resolveSeratoPath makes drive-relative paths absolute', () => {
    expect(resolveSeratoPath('Users/dj/a.mp3')).toBe('/Users/dj/a.mp3')
    expect(resolveSeratoPath('/Users/dj/a.mp3')).toBe('/Users/dj/a.mp3')
  })
})

// ───────── crates → playlist tree ─────────

describe('serato crate reader', () => {
  it('parses ordered track paths from a crate', () => {
    const crateBuf = encodeChunks([
      { tag: 'vrsn', text: '1.0/Serato ScratchLive Crate' },
      { tag: 'otrk', children: [{ tag: 'ptrk', text: 'Users/dj/a.mp3' }] },
      { tag: 'otrk', children: [{ tag: 'ptrk', text: 'Users/dj/b.mp3' }] }
    ])
    expect(parseCrate(crateBuf)).toEqual(['Users/dj/a.mp3', 'Users/dj/b.mp3'])
  })

  it('builds a folder tree from %%-nested crate names', () => {
    const byAbsPath = new Map([
      ['/Users/dj/a.mp3', 'idA'],
      ['/Users/dj/b.mp3', 'idB']
    ])
    const playlists = buildPlaylistsFromCrates(
      [
        { name: 'House', trackPaths: ['Users/dj/a.mp3'] },
        { name: 'House%%Deep', trackPaths: ['Users/dj/b.mp3', 'Users/dj/missing.mp3'] }
      ],
      byAbsPath
    )
    const house = playlists.find((p) => p.name === 'House')
    const deep = playlists.find((p) => p.name === 'Deep')
    expect(house).toBeDefined()
    expect(deep).toBeDefined()
    expect(house?.isFolder).toBe(true) // has a child crate
    expect(house?.trackIds).toEqual(['idA'])
    expect(deep?.isFolder).toBe(false)
    expect(deep?.parentId).toBe(house?.id)
    // Unresolved path ('missing.mp3') is dropped.
    expect(deep?.trackIds).toEqual(['idB'])
  })
})

// ───────── per-file Serato tags ─────────

describe('serato Markers2 decoder', () => {
  const cueBody = Buffer.concat([
    Buffer.from([0x00]), // field1
    Buffer.from([0x01]), // index
    u32be(12_345), // position ms
    Buffer.from([0x00]), // field4
    Buffer.from([204, 0, 0]), // color RGB
    Buffer.from([0x00, 0x00]), // field6
    cstr('Intro') // name
  ])
  const loopBody = Buffer.concat([
    Buffer.from([0x00]), // field1
    Buffer.from([0x02]), // index
    u32be(1000), // start ms
    u32be(5000), // end ms
    Buffer.from([0, 0, 0, 0]), // field5
    Buffer.from([0, 0, 0, 0]), // field6
    Buffer.from([0x00]), // color
    Buffer.from([0x00]), // locked
    cstr('Loop1') // name
  ])
  const colorBody = Buffer.concat([Buffer.from([0x00]), Buffer.from([255, 128, 0])])

  const payload = Buffer.concat([
    Buffer.from([0x01, 0x01]), // version
    markersEntry('CUE', cueBody),
    markersEntry('LOOP', loopBody),
    markersEntry('COLOR', colorBody),
    markersEntry('BPMLOCK', Buffer.from([0x01])),
    Buffer.from([0x00]) // empty-name terminator
  ])

  it('locates the entry stream start', () => {
    expect(findEntriesStart(payload)).toBe(2)
  })

  it('parses cues, loops and track colour', () => {
    const parsed = parseMarkers2Entries(payload, findEntriesStart(payload))
    expect(parsed.hotCues).toEqual([
      { index: 1, position: 12_345, color: 'rgb(204,0,0)', label: 'Intro' }
    ])
    expect(parsed.loops).toEqual([{ startMs: 1000, endMs: 5000, name: 'Loop1' }])
    expect(parsed.color).toBe('rgb(255,128,0)')
  })
})

describe('serato BeatGrid decoder', () => {
  it('reads the first marker of a multi-marker grid', () => {
    const grid = Buffer.concat([
      Buffer.from([0x01, 0x00]),
      u32be(2),
      f32be(0.25),
      u32be(4), // non-terminal marker
      f32be(120.0),
      f32be(128.0), // terminal marker
      Buffer.from([0x00]) // footer
    ])
    expect(parseBeatgrid(grid)).toEqual({ offsetMs: 250, bpm: undefined })
  })

  it('reads a single terminal marker with its BPM', () => {
    const grid = Buffer.concat([
      Buffer.from([0x01, 0x00]),
      u32be(1),
      f32be(0.5),
      f32be(128.0),
      Buffer.from([0x00])
    ])
    expect(parseBeatgrid(grid)).toEqual({ offsetMs: 500, bpm: 128 })
  })

  it('returns null on a non-beatgrid buffer', () => {
    expect(parseBeatgrid(Buffer.from('not a beatgrid'))).toBeNull()
  })
})

// ───────── Engine DJ provider (beta) ─────────

describe('engine dj provider', () => {
  it('declares a payload-routed beta provider with deferred cues', () => {
    expect(engineDjProvider.id).toBe('engine-dj')
    expect(engineDjProvider.sourceTag).toBe('engine')
    expect(engineDjProvider.capabilities.importRouting).toBe('payload')
    expect(engineDjProvider.capabilities.stability).toBe('beta')
    // Cues/beatgrids are packed blobs — deferred (Planned), not inline.
    expect(engineDjProvider.capabilities.readsCuesInline).toBe(false)
    expect(engineDjProvider.capabilities.readsMetadata).toBe(true)
    expect(engineDjProvider.capabilities.readsPlaylists).toBe(true)
  })

  it('detect() returns a well-formed engine-dj detection without throwing', async () => {
    const d = await engineDjProvider.detect()
    expect(d.sourceId).toBe('engine-dj')
    expect(d.label).toBe('Engine DJ')
    expect(typeof d.installed).toBe('boolean')
  })
})
