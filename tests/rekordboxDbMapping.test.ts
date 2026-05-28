import { describe, it, expect } from 'vitest'
import {
  bucketCuesByContent,
  combinePath,
  mapContentRow,
  mapPlaylists,
  mapSessions,
  type RawContentRow,
  type RawCueRow,
  type RawHistoryRow,
  type RawPlaylistRow,
  type RawSongHistoryRow,
  type RawSongPlaylistRow,
} from '../electron/services/rekordbox/dbReader'

describe('combinePath', () => {
  it('joins folder + filename when the folder has a trailing slash', () => {
    expect(combinePath('/Users/dj/Music/', 'track.mp3')).toBe('/Users/dj/Music/track.mp3')
  })

  it('inserts a slash when the folder lacks one', () => {
    expect(combinePath('/Users/dj/Music', 'track.mp3')).toBe('/Users/dj/Music/track.mp3')
  })

  it('decodes percent-encoded characters in paths', () => {
    expect(combinePath('/Users/dj/Music/', 'Bicep%20-%20Glue.wav')).toBe(
      '/Users/dj/Music/Bicep - Glue.wav',
    )
  })

  it('returns null when folder or file is missing', () => {
    expect(combinePath(null, 'a.mp3')).toBeNull()
    expect(combinePath('/Users/dj/', null)).toBeNull()
  })
})

describe('mapContentRow', () => {
  function row(overrides: Partial<RawContentRow> = {}): RawContentRow {
    return {
      ID: 'rb-1',
      Title: 'Glue',
      ArtistName: 'Bicep',
      AlbumName: null,
      GenreName: 'Electronic',
      KeyName: 'Am',
      LabelName: null,
      ColorName: null,
      BPM: 12800, // BPM * 100
      Length: 360000, // ms
      FolderPath: '/Users/dj/Music/',
      FileNameL: 'glue.mp3',
      FileSize: 1024,
      BitRate: 320,
      Rating: 4,
      DJPlayCount: 12,
      Commnt: null,
      StockDate: '2024-01-15',
      created_at: '2024-01-15T00:00:00Z',
      ...overrides,
    }
  }

  it('maps a basic Rekordbox row into the SetSense Track shape', () => {
    const t = mapContentRow(row(), [])
    expect(t).not.toBeNull()
    expect(t!.title).toBe('Glue')
    expect(t!.artist).toBe('Bicep')
    expect(t!.bpm).toBe(128)
    expect(t!.duration).toBe(360)
    expect(t!.key).toBe('8A')
    expect(t!.keyOpenNotation).toBe('Am')
    expect(t!.filePath).toBe('/Users/dj/Music/glue.mp3')
    expect(t!.format).toBe('mp3')
    expect(t!.playCount).toBe(12)
    expect(t!.rating).toBe(4)
    expect(t!.rekordboxId).toBe('rb-1')
  })

  it('returns null when the file path is unbuildable', () => {
    expect(mapContentRow(row({ FolderPath: null }), [])).toBeNull()
    expect(mapContentRow(row({ FileNameL: null }), [])).toBeNull()
  })

  it('treats BPM and Length as nullable without crashing', () => {
    const t = mapContentRow(row({ BPM: null, Length: null }), [])
    expect(t!.bpm).toBe(0)
    expect(t!.duration).toBe(0)
  })

  it('reuses an existing internal id when the file path matches', () => {
    const existing = new Map<string, string>([['/Users/dj/Music/glue.mp3', 'existing-uuid']])
    const t = mapContentRow(row(), [], existing)
    expect(t!.id).toBe('existing-uuid')
  })

  it('mints a fresh id when there is no match', () => {
    const t = mapContentRow(row(), [], new Map())
    expect(t!.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('marks energy as pending so the background analyser picks it up', () => {
    const t = mapContentRow(row(), [])
    expect(t!.energy).toBe(5)
    expect(t!.energySource).toBe('pending')
  })

  it('falls back to "Unknown title/artist" when missing', () => {
    const t = mapContentRow(row({ Title: null, ArtistName: null }), [])
    expect(t!.title).toBe('Unknown title')
    expect(t!.artist).toBe('Unknown artist')
  })

  it('clamps rating into the 0-5 range', () => {
    expect(mapContentRow(row({ Rating: -3 }), [])!.rating).toBe(0)
    expect(mapContentRow(row({ Rating: 99 }), [])!.rating).toBe(5)
  })

  it('builds memory cues and hot cues from the cue rows', () => {
    const cues: RawCueRow[] = [
      { ContentID: 'rb-1', Kind: 0, InMsec: 5000, Color: null, ActiveLoop: null },
      { ContentID: 'rb-1', Kind: 1, InMsec: 30000, Color: 0xff0044, ActiveLoop: 0 },
      { ContentID: 'rb-1', Kind: 1, InMsec: 60000, Color: 0x00ff00, ActiveLoop: 1 },
    ]
    const t = mapContentRow(row(), cues)
    expect(t!.cuePoints).toEqual([{ position: 5000, type: 'memory' }])
    expect(t!.hotCues).toHaveLength(2)
    expect(t!.hotCues[0]).toMatchObject({ index: 0, position: 30000 })
    expect(t!.hotCues[0].color).toMatch(/^rgb\(/)
  })
})

describe('bucketCuesByContent', () => {
  it('groups cues by their content id', () => {
    const rows: RawCueRow[] = [
      { ContentID: 'a', Kind: 0, InMsec: 1, Color: null, ActiveLoop: null },
      { ContentID: 'b', Kind: 0, InMsec: 2, Color: null, ActiveLoop: null },
      { ContentID: 'a', Kind: 1, InMsec: 3, Color: null, ActiveLoop: 0 },
    ]
    const map = bucketCuesByContent(rows)
    expect(map.get('a')).toHaveLength(2)
    expect(map.get('b')).toHaveLength(1)
  })

  it('returns an empty map when given no rows', () => {
    expect(bucketCuesByContent([]).size).toBe(0)
  })
})

describe('mapPlaylists', () => {
  it('builds a tree with folder + leaf attributes and skips orphan members', () => {
    const playlistRows: RawPlaylistRow[] = [
      { ID: 'p-root', Name: 'Folder', Attribute: 1, ParentID: 'root' },
      { ID: 'p-leaf', Name: 'Peak', Attribute: 0, ParentID: 'p-root' },
    ]
    const songRows: RawSongPlaylistRow[] = [
      { PlaylistID: 'p-leaf', ContentID: 'rb-1', TrackNo: 1 },
      { PlaylistID: 'p-leaf', ContentID: 'rb-unknown', TrackNo: 2 },
    ]
    const idMap = new Map([['rb-1', 'internal-uuid-1']])
    const playlists = mapPlaylists(playlistRows, songRows, idMap)
    expect(playlists).toHaveLength(2)
    const folder = playlists.find((p) => p.rekordboxId === 'p-root')!
    const leaf = playlists.find((p) => p.rekordboxId === 'p-leaf')!
    expect(folder.isFolder).toBe(true)
    expect(leaf.isFolder).toBe(false)
    expect(leaf.parentId).toBe(folder.id)
    expect(leaf.trackIds).toEqual(['internal-uuid-1'])
  })
})

describe('mapSessions', () => {
  it('emits sessions and drops empty ones', () => {
    const historyRows: RawHistoryRow[] = [
      { ID: 'h1', Name: 'Friday', DateCreated: '2024-05-18T20:00:00Z' },
      { ID: 'h2', Name: 'Saturday', DateCreated: '2024-05-19T20:00:00Z' },
    ]
    const songHistoryRows: RawSongHistoryRow[] = [
      { HistoryID: 'h1', ContentID: 'rb-1', TrackNo: 1 },
      { HistoryID: 'h2', ContentID: 'rb-unknown', TrackNo: 1 },
    ]
    const idMap = new Map([['rb-1', 'internal-uuid-1']])
    const sessions = mapSessions(historyRows, songHistoryRows, idMap)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      name: 'Friday',
      performedAt: '2024-05-18',
      trackIds: ['internal-uuid-1'],
    })
  })
})
