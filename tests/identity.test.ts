import { describe, it, expect } from 'vitest'
import { buildIdentity } from '../electron/algorithms/memory/identity'
import { makeTrack } from './fixtures'

describe('buildIdentity', () => {
  it('returns empty snapshot for empty library', () => {
    const snap = buildIdentity([])
    expect(snap.genreDistribution).toHaveLength(0)
    expect(snap.bpmHistogram).toHaveLength(0)
    expect(snap.keyDistribution).toHaveLength(0)
    expect(snap.topArtists).toHaveLength(0)
    expect(snap.tasteTimeline).toHaveLength(0)
  })

  it('builds genre distribution', () => {
    const tracks = [
      makeTrack({ id: 'a', genre: 'Techno' }),
      makeTrack({ id: 'b', genre: 'Techno' }),
      makeTrack({ id: 'c', genre: 'House' }),
    ]
    const snap = buildIdentity(tracks)
    const techno = snap.genreDistribution.find((g) => g.label === 'Techno')
    const house = snap.genreDistribution.find((g) => g.label === 'House')
    expect(techno?.count).toBe(2)
    expect(house?.count).toBe(1)
    // Sorted descending
    expect(snap.genreDistribution[0].label).toBe('Techno')
  })

  it('builds bpm histogram in 10-bpm buckets', () => {
    const tracks = [
      makeTrack({ id: 'a', bpm: 124 }),
      makeTrack({ id: 'b', bpm: 126 }),
      makeTrack({ id: 'c', bpm: 132 }),
    ]
    const snap = buildIdentity(tracks)
    const bucket120 = snap.bpmHistogram.find((b) => b.range === '120–129')
    const bucket130 = snap.bpmHistogram.find((b) => b.range === '130–139')
    expect(bucket120?.count).toBe(2)
    expect(bucket130?.count).toBe(1)
  })

  it('builds key distribution', () => {
    const tracks = [
      makeTrack({ id: 'a', key: '8A' }),
      makeTrack({ id: 'b', key: '8A' }),
      makeTrack({ id: 'c', key: '9B' }),
    ]
    const snap = buildIdentity(tracks)
    expect(snap.keyDistribution[0]).toEqual({ label: '8A', count: 2 })
  })

  it('builds energy distribution with integer levels', () => {
    const tracks = [
      makeTrack({ id: 'a', energy: 7 }),
      makeTrack({ id: 'b', energy: 7 }),
      makeTrack({ id: 'c', energy: 9 }),
    ]
    const snap = buildIdentity(tracks)
    const e7 = snap.energyDistribution.find((e) => e.level === 7)
    const e9 = snap.energyDistribution.find((e) => e.level === 9)
    expect(e7?.count).toBe(2)
    expect(e9?.count).toBe(1)
  })

  it('builds top artists', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Richie Hawtin' }),
      makeTrack({ id: 'b', artist: 'Richie Hawtin' }),
      makeTrack({ id: 'c', artist: 'Jeff Mills' }),
    ]
    const snap = buildIdentity(tracks)
    expect(snap.topArtists[0]).toEqual({ label: 'Richie Hawtin', count: 2 })
  })

  it('builds top labels (omits tracks with no label)', () => {
    const tracks = [
      makeTrack({ id: 'a', label: 'M_nus' }),
      makeTrack({ id: 'b', label: 'M_nus' }),
      makeTrack({ id: 'c' }), // no label
    ]
    const snap = buildIdentity(tracks)
    expect(snap.topLabels).toHaveLength(1)
    expect(snap.topLabels[0]).toEqual({ label: 'M_nus', count: 2 })
  })

  it('builds tasteTimeline bucketed by year/quarter of dateAdded', () => {
    const tracks = [
      makeTrack({ id: 'a', dateAdded: '2024-01-15T00:00:00Z' }),
      makeTrack({ id: 'b', dateAdded: '2024-02-10T00:00:00Z' }),
      makeTrack({ id: 'c', dateAdded: '2024-07-01T00:00:00Z' }),
    ]
    const snap = buildIdentity(tracks)
    const q1 = snap.tasteTimeline.find((t) => t.period === '2024 Q1')
    const q3 = snap.tasteTimeline.find((t) => t.period === '2024 Q3')
    expect(q1?.count).toBe(2)
    expect(q3?.count).toBe(1)
  })

  it('incorporates session performedAt into tasteTimeline performedCount', () => {
    const tracks = [
      makeTrack({ id: 'a', dateAdded: '2024-01-01T00:00:00Z' }),
      makeTrack({ id: 'b', dateAdded: '2024-01-01T00:00:00Z' }),
    ]
    const sessions = [
      { performedAt: '2024-02-01T00:00:00Z', trackIds: ['a', 'b'] },
    ]
    const snap = buildIdentity(tracks, sessions)
    const q1 = snap.tasteTimeline.find((t) => t.period === '2024 Q1')
    expect(q1?.performedCount).toBe(2)
  })

  it('tasteTimeline is sorted chronologically', () => {
    const tracks = [
      makeTrack({ id: 'a', dateAdded: '2023-06-01T00:00:00Z' }),
      makeTrack({ id: 'b', dateAdded: '2022-01-01T00:00:00Z' }),
    ]
    const snap = buildIdentity(tracks)
    const periods = snap.tasteTimeline.map((t) => t.period)
    expect(periods.indexOf('2022 Q1')).toBeLessThan(periods.indexOf('2023 Q2'))
  })
})
