import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { exportSet } from '../electron/services/exportService'
import type { Set as DJSet, SetTrack } from '../src/types'
import { makeTrack } from './fixtures'

function tmp(): string {
  return join(
    tmpdir(),
    `setrecord-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.xml`
  )
}

function buildSetWithTracks(): DJSet {
  const trackA = makeTrack({
    id: 'a',
    rekordboxId: '101',
    title: 'Opener',
    artist: 'DJ One',
    bpm: 124,
    key: '8A'
  })
  const trackB = makeTrack({
    id: 'b',
    rekordboxId: '102',
    title: 'Closer',
    artist: 'DJ Two',
    bpm: 125,
    key: '9A',
    hotCues: [{ index: 0, position: 32000, color: '#3B82F6' }]
  })
  const tracks: SetTrack[] = [
    { id: 'st-0', trackId: 'a', track: trackA, position: 0 },
    { id: 'st-1', trackId: 'b', track: trackB, position: 1 }
  ]
  return {
    id: 'set-1',
    name: 'Smoke test set',
    createdAt: new Date('2026-05-19T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-05-19T00:00:00Z').toISOString(),
    tracks
  }
}

describe('exportSet', () => {
  const created: string[] = []

  afterEach(() => {
    for (const p of created) {
      if (existsSync(p)) {
        try {
          unlinkSync(p)
        } catch {
          /* best effort cleanup */
        }
      }
    }
    created.length = 0
  })

  it('writes a Rekordbox-compatible XML with the expected COLLECTION and PLAYLIST entries', async () => {
    const path = tmp()
    created.push(path)
    const result = await exportSet(buildSetWithTracks(), path)

    expect(result.success).toBe(true)
    expect(result.trackCount).toBe(2)
    expect(result.filePath).toBe(path)

    const xml = readFileSync(path, 'utf-8')
    expect(xml).toContain('<DJ_PLAYLISTS')
    expect(xml).toContain('Name="rekordbox"')
    expect(xml).toContain('Entries="2"')
    expect(xml).toContain('TrackID="101"')
    expect(xml).toContain('TrackID="102"')
    expect(xml).toContain('Name="Opener"')
    expect(xml).toContain('Name="Closer"')
    expect(xml).toContain('Name="Smoke test set"')
    // Hot cue should round-trip into a POSITION_MARK
    expect(xml).toContain('POSITION_MARK')
  })

  it('returns success=false instead of throwing when the write fails', async () => {
    const result = await exportSet(buildSetWithTracks(), '/this/path/does/not/exist/at-all.xml')
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
