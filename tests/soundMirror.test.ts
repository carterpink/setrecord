import { describe, it, expect } from 'vitest'
import { computeSoundMirror, type MirrorSession } from '../electron/algorithms/memory/soundMirror'
import type { Track, TrackAnalysisFeatures, TrackTag } from '../src/types'

const NOW = new Date('2025-08-01T00:00:00.000Z')

function mk(
  over: Partial<Track> & {
    id: string
    bpm: number
    energy: number
    brightness?: number
    vibe?: string
  }
): Track {
  const tags: TrackTag[] = over.vibe ? [{ category: 'vibe', value: over.vibe, source: 'auto' }] : []
  const analysisFeatures: TrackAnalysisFeatures | undefined =
    over.brightness != null
      ? { rms: 0.5, brightness: over.brightness, loudness: 0.5, vocalness: 0.2 }
      : undefined
  return {
    id: over.id,
    title: over.title ?? `Track ${over.id}`,
    artist: over.artist ?? 'Artist',
    genre: over.genre,
    bpm: over.bpm,
    key: '8A',
    energy: over.energy,
    duration: 360,
    filePath: `/m/${over.id}.mp3`,
    format: 'mp3',
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: '2025-01-01T00:00:00.000Z',
    missingFile: false,
    analysisFeatures,
    tags
  }
}

describe('computeSoundMirror — artistic drift over time', () => {
  it('detects a slower, darker, less-euphoric drift across quarters', () => {
    const tracks = [
      mk({ id: 'a1', bpm: 130, energy: 8, brightness: 0.8, vibe: 'euphoric', genre: 'Trance' }),
      mk({ id: 'a2', bpm: 128, energy: 8, brightness: 0.75, vibe: 'euphoric', genre: 'Trance' }),
      mk({ id: 'a3', bpm: 126, energy: 7, brightness: 0.7, vibe: 'driving', genre: 'Tech House' }),
      mk({ id: 'd1', bpm: 120, energy: 4, brightness: 0.3, vibe: 'dark', genre: 'Melodic Techno' }),
      mk({
        id: 'd2',
        bpm: 122,
        energy: 4,
        brightness: 0.35,
        vibe: 'hypnotic',
        genre: 'Melodic Techno'
      }),
      mk({ id: 'd3', bpm: 118, energy: 3, brightness: 0.25, vibe: 'dark', genre: 'Deep House' })
    ]
    const sessions: MirrorSession[] = [
      { id: 's1', performedAt: '2025-01-15', trackIds: ['a1', 'a2', 'a3'] },
      { id: 's2', performedAt: '2025-02-20', trackIds: ['a1', 'a2', 'a3'] },
      { id: 's3', performedAt: '2025-05-10', trackIds: ['d1', 'd2', 'd3'] },
      { id: 's4', performedAt: '2025-06-12', trackIds: ['d1', 'd2', 'd3'] }
    ]
    const r = computeSoundMirror(tracks, sessions, NOW)
    expect(r.windows.map((w) => w.label)).toEqual(['2025 Q1', '2025 Q2'])
    expect(r.drift).toBeDefined()
    expect(r.drift!.bpmDelta).toBe(-8)
    expect(r.drift!.energyDelta).toBeLessThan(0)
    expect(r.drift!.brightnessDelta!).toBeLessThan(0)
    const joined = r.drift!.statements.join(' ')
    expect(joined).toMatch(/slower/)
    expect(joined).toMatch(/darker/)
    expect(joined).toMatch(/euphoric/)
    expect(r.becoming).toMatch(/late-night/)
  })

  it('flags a rut when the same track opens most recent sets', () => {
    const tracks = [
      mk({ id: 'x', bpm: 124, energy: 6 }),
      mk({ id: 'y', bpm: 125, energy: 6 }),
      mk({ id: 'z', bpm: 126, energy: 6 })
    ]
    const sessions: MirrorSession[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      performedAt: `2025-0${i + 1}-10`,
      trackIds: ['x', 'y', 'z']
    }))
    const r = computeSoundMirror(tracks, sessions, NOW, { recentSessions: 5 })
    const opener = r.ruts.find((rt) => rt.kind === 'opener')
    expect(opener?.trackId).toBe('x')
    expect(opener?.occurrences).toBe(5)
  })

  it('is honest when there is no history', () => {
    const r = computeSoundMirror([], [], NOW)
    expect(r.windows).toEqual([])
    expect(r.drift).toBeUndefined()
    expect(r.narration).toMatch(/No gig history/i)
  })

  it('does not over-claim drift from a single window', () => {
    const tracks = [mk({ id: 'a', bpm: 124, energy: 6 })]
    const sessions: MirrorSession[] = [{ id: 's', performedAt: '2025-03-01', trackIds: ['a'] }]
    const r = computeSoundMirror(tracks, sessions, NOW)
    expect(r.windows).toHaveLength(1)
    expect(r.drift).toBeUndefined()
    expect(r.narration).toMatch(/One window/i)
  })
})
