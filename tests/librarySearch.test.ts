import { describe, it, expect } from 'vitest'
import { searchLibrary } from '../electron/algorithms/memory/librarySearch'
import { makeTrack } from './fixtures'

describe('searchLibrary', () => {
  const lib = [
    makeTrack({ id: 'a', genre: 'UK Garage', bpm: 130, energy: 8, playCount: 50, rating: 5 }),
    makeTrack({ id: 'b', genre: 'Tech House', bpm: 126, energy: 9, playCount: 10 }),
    makeTrack({ id: 'c', genre: 'Tech House', bpm: 128, energy: 5, playCount: 80 }),
    makeTrack({ id: 'd', genre: 'Deep House', bpm: 122, energy: 3, playCount: 2 }),
    makeTrack({ id: 'e', genre: 'Drum & Bass', bpm: 174, energy: 9, playCount: 0 }),
    makeTrack({ id: 'p', genre: 'Tech House', bpm: 127, phantom: true })
  ]

  it('matches a genre via synonyms ("ukg" → "UK Garage")', () => {
    const r = searchLibrary(lib, { genre: 'ukg' })
    expect(r.map((t) => t.id)).toEqual(['a'])
  })

  it('never returns phantom tracks', () => {
    const r = searchLibrary(lib, { genre: 'tech house' })
    expect(r.find((t) => t.id === 'p')).toBeUndefined()
  })

  it('filters by plain-language tags (substring-tolerant, any-of)', () => {
    const tagged = [
      makeTrack({ id: 't1', tags: [{ category: 'mood', value: 'dark', source: 'auto' }] }),
      makeTrack({ id: 't2', tags: [{ category: 'mood', value: 'vocals', source: 'auto' }] }),
      makeTrack({ id: 't3', tags: [{ category: 'energy', value: 'punchy', source: 'auto' }] })
    ]
    // "vocal" should match "vocals"; "dark" matches "dark" — t3 excluded.
    const r = searchLibrary(tagged, { tags: ['dark', 'vocal'] })
    expect(r.map((t) => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('filters by BPM range', () => {
    const r = searchLibrary(lib, { bpmMin: 125, bpmMax: 129 })
    expect(r.map((t) => t.id).sort()).toEqual(['b', 'c'])
  })

  it('filters by energy floor (bangers)', () => {
    const r = searchLibrary(lib, { energyMin: 8 })
    expect(r.map((t) => t.id).sort()).toEqual(['a', 'b', 'e'])
  })

  it('sorts by most played and respects limit', () => {
    const r = searchLibrary(lib, { sort: 'mostPlayed', limit: 2 })
    expect(r.map((t) => t.id)).toEqual(['c', 'a'])
  })

  it('finds never-played tracks', () => {
    const r = searchLibrary(lib, { neverPlayed: true })
    expect(r.map((t) => t.id)).toEqual(['e'])
  })

  it('combines genre + bpm + sort (a realistic refined query)', () => {
    const r = searchLibrary(lib, {
      genre: 'tech house',
      bpmMin: 124,
      bpmMax: 130,
      sort: 'mostPlayed'
    })
    expect(r.map((t) => t.id)).toEqual(['c', 'b'])
  })

  it('filters by duration range', () => {
    const tracks = [
      makeTrack({ id: 'short', duration: 120 }),
      makeTrack({ id: 'mid', duration: 240 }),
      makeTrack({ id: 'long', duration: 600 })
    ]
    const r = searchLibrary(tracks, { durationMinSec: 180, durationMaxSec: 360 })
    expect(r.map((t) => t.id)).toEqual(['mid'])
  })

  it('filters by addedAfter / addedBefore', () => {
    const tracks = [
      makeTrack({ id: 'old', dateAdded: '2020-06-01T00:00:00.000Z' }),
      makeTrack({ id: 'mid', dateAdded: '2024-06-01T00:00:00.000Z' }),
      makeTrack({ id: 'new', dateAdded: '2025-06-01T00:00:00.000Z' })
    ]
    const r = searchLibrary(tracks, {
      addedAfter: '2024-01-01T00:00:00.000Z',
      addedBefore: '2024-12-31T23:59:59.999Z'
    })
    expect(r.map((t) => t.id)).toEqual(['mid'])
  })

  it('filters by cueLabel (matches hot-cue labels case-insensitively)', () => {
    const tracks = [
      makeTrack({ id: 'a', hotCues: [{ index: 0, position: 30000, label: 'Drop point' }] }),
      makeTrack({ id: 'b', hotCues: [{ index: 0, position: 30000, label: 'Breakdown' }] }),
      makeTrack({ id: 'c', hotCues: [] })
    ]
    const r = searchLibrary(tracks, { cueLabel: 'drop' })
    expect(r.map((t) => t.id)).toEqual(['a'])
  })

  it('filters by keyExact', () => {
    const tracks = [makeTrack({ id: 'match', key: '8A' }), makeTrack({ id: 'no', key: '9A' })]
    const r = searchLibrary(tracks, { keyExact: '8A' })
    expect(r.map((t) => t.id)).toEqual(['match'])
  })
})
