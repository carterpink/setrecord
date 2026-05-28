import { describe, it, expect } from 'vitest'
import { analyzeHealth } from '../electron/algorithms/memory/libraryHealth'
import { makeTrack } from './fixtures'

describe('analyzeHealth', () => {
  it('returns perfect health for empty library', () => {
    const report = analyzeHealth([])
    expect(report.totalTracks).toBe(0)
    expect(report.missingFiles).toBe(0)
    expect(report.healthScore).toBe(100)
    expect(report.duplicateGroups).toHaveLength(0)
  })

  it('counts missing files', () => {
    const tracks = [
      makeTrack({ id: 'a', missingFile: true }),
      makeTrack({ id: 'b', missingFile: false }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.missingFiles).toBe(1)
    expect(report.missingFileIds).toEqual(['a'])
  })

  it('counts missing key', () => {
    const tracks = [
      makeTrack({ id: 'a', key: '' }),
      makeTrack({ id: 'b', key: '8A' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.missingKey).toBe(1)
    expect(report.missingKeyIds).toEqual(['a'])
  })

  it('counts missing bpm (zero)', () => {
    const tracks = [
      makeTrack({ id: 'a', bpm: 0 }),
      makeTrack({ id: 'b', bpm: 124 }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.missingBpm).toBe(1)
    expect(report.missingBpmIds).toEqual(['a'])
  })

  it('counts unsupported formats', () => {
    const tracks = [
      makeTrack({ id: 'a', format: 'unknown' }),
      makeTrack({ id: 'b', format: 'mp3' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.unsupportedFormats).toBe(1)
    expect(report.unsupportedFormatIds).toEqual(['a'])
  })

  it('detects exact duplicates by artist+title', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Surgeon', title: 'Force the Hands of Time' }),
      makeTrack({ id: 'b', artist: 'Surgeon', title: 'Force the Hands of Time' }),
      makeTrack({ id: 'c', artist: 'Surgeon', title: 'Different Track' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
    expect(report.duplicateGroups[0].ids.sort()).toEqual(['a', 'b'])
  })

  it('normalises case for duplicate detection', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Jeff Mills', title: 'Conspiracy' }),
      makeTrack({ id: 'b', artist: 'jeff mills', title: 'conspiracy' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
  })

  it('strips punctuation for duplicate detection', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Richie Hawtin', title: "It's Over" }),
      makeTrack({ id: 'b', artist: 'Richie Hawtin', title: 'Its Over' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
  })

  it('does not flag genuinely different tracks as duplicates', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'A', title: 'X' }),
      makeTrack({ id: 'b', artist: 'A', title: 'Y' }),
      makeTrack({ id: 'c', artist: 'B', title: 'X' }),
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(0)
  })

  it('health score is 100 for a clean library', () => {
    const tracks = [
      makeTrack({ id: 'a', key: '8A', bpm: 128, format: 'mp3', missingFile: false }),
    ]
    expect(analyzeHealth(tracks).healthScore).toBe(100)
  })

  it('health score is < 100 when there are issues', () => {
    const tracks = [
      makeTrack({ id: 'a', missingFile: true, key: '', bpm: 0, format: 'unknown' }),
      makeTrack({ id: 'b', key: '8A', bpm: 124, format: 'mp3' }),
    ]
    expect(analyzeHealth(tracks).healthScore).toBeLessThan(100)
  })

  it('health score is near 0 when everything is broken', () => {
    const tracks = Array.from({ length: 10 }, (_, i) =>
      makeTrack({ id: `t${i}`, missingFile: true, key: '', bpm: 0, format: 'unknown' }),
    )
    // All tracks missing file+key+bpm+format → 30+25+20+15 = 90 penalty, plus
    // near-total duplicate penalty (10 identical tracks → 9 dupes → ~9). ≈ 1.
    expect(analyzeHealth(tracks).healthScore).toBeLessThan(5)
  })

  it('counts total tracks correctly', () => {
    const tracks = Array.from({ length: 5 }, (_, i) => makeTrack({ id: `t${i}` }))
    expect(analyzeHealth(tracks).totalTracks).toBe(5)
  })
})
