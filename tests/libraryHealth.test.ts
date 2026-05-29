import { describe, it, expect } from 'vitest'
import { analyzeHealth, HEALTH_WEIGHTS } from '../electron/algorithms/memory/libraryHealth'
import { makeTrack } from './fixtures'

describe('analyzeHealth', () => {
  it('returns perfect health for empty library', () => {
    const report = analyzeHealth([])
    expect(report.totalTracks).toBe(0)
    expect(report.missingFiles).toBe(0)
    expect(report.healthScore).toBe(100)
    expect(report.duplicateGroups).toHaveLength(0)
    expect(report.notAnalysed).toBe(0)
  })

  it('counts missing files', () => {
    const tracks = [
      makeTrack({ id: 'a', missingFile: true }),
      makeTrack({ id: 'b', missingFile: false })
    ]
    const report = analyzeHealth(tracks)
    expect(report.missingFiles).toBe(1)
    expect(report.missingFileIds).toEqual(['a'])
  })

  it('counts missing key', () => {
    const tracks = [makeTrack({ id: 'a', key: '' }), makeTrack({ id: 'b', key: '8A' })]
    const report = analyzeHealth(tracks)
    expect(report.missingKey).toBe(1)
    expect(report.missingKeyIds).toEqual(['a'])
  })

  it('counts missing bpm (zero)', () => {
    const tracks = [makeTrack({ id: 'a', bpm: 0 }), makeTrack({ id: 'b', bpm: 124 })]
    const report = analyzeHealth(tracks)
    expect(report.missingBpm).toBe(1)
    expect(report.missingBpmIds).toEqual(['a'])
  })

  it('counts unsupported formats', () => {
    const tracks = [
      makeTrack({ id: 'a', format: 'unknown' }),
      makeTrack({ id: 'b', format: 'mp3' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.unsupportedFormats).toBe(1)
    expect(report.unsupportedFormatIds).toEqual(['a'])
  })

  it('counts not-analysed tracks (energySource === pending)', () => {
    const tracks = [
      makeTrack({ id: 'a', energySource: 'pending' }),
      makeTrack({ id: 'b', energySource: 'computed' }),
      makeTrack({ id: 'c' }) // undefined source = analysed (legacy row)
    ]
    const report = analyzeHealth(tracks)
    expect(report.notAnalysed).toBe(1)
    expect(report.notAnalysedIds).toEqual(['a'])
  })

  it('detects exact duplicates by artist+title', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Surgeon', title: 'Force the Hands of Time' }),
      makeTrack({ id: 'b', artist: 'Surgeon', title: 'Force the Hands of Time' }),
      makeTrack({ id: 'c', artist: 'Surgeon', title: 'Different Track' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
    expect(report.duplicateGroups[0].ids.sort()).toEqual(['a', 'b'])
  })

  it('normalises case for duplicate detection', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Jeff Mills', title: 'Conspiracy' }),
      makeTrack({ id: 'b', artist: 'jeff mills', title: 'conspiracy' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
  })

  it('strips punctuation for duplicate detection', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Richie Hawtin', title: "It's Over" }),
      makeTrack({ id: 'b', artist: 'Richie Hawtin', title: 'Its Over' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(1)
  })

  it('does not flag genuinely different tracks as duplicates', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'A', title: 'X' }),
      makeTrack({ id: 'b', artist: 'A', title: 'Y' }),
      makeTrack({ id: 'c', artist: 'B', title: 'X' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.duplicateGroups).toHaveLength(0)
  })

  it('hides duplicate groups whose normalised key has been dismissed', () => {
    const tracks = [
      makeTrack({ id: 'a', artist: 'Surgeon', title: 'X' }),
      makeTrack({ id: 'b', artist: 'Surgeon', title: 'X' })
    ]
    const dismissedGroupKeys = new Set(['surgeon|x'])
    const report = analyzeHealth(tracks, { dismissedGroupKeys })
    expect(report.duplicateGroups).toHaveLength(0)
  })

  it('health score is 100 for a clean library', () => {
    const tracks = [
      makeTrack({ id: 'a', key: '8A', bpm: 128, format: 'mp3', missingFile: false })
    ]
    expect(analyzeHealth(tracks).healthScore).toBe(100)
  })

  it('missing files are the heaviest single penalty (S12 P0 recalibration)', () => {
    // 10% missing files in a 3k-track library should drop score to ~60.
    const tracks = Array.from({ length: 3000 }, (_, i) =>
      makeTrack({
        id: `t${i}`,
        title: `Track ${i}`,
        key: '8A',
        bpm: 124,
        format: 'mp3',
        missingFile: i < 300
      })
    )
    const report = analyzeHealth(tracks)
    // 300 × -2 = -600 but cap is -40 → score 60.
    expect(report.healthScore).toBe(60)
    expect(report.scoreBreakdown.missingFiles).toBe(HEALTH_WEIGHTS.missingFilesCap)
  })

  it('a tiny library with even one missing file shows a meaningful hit', () => {
    const tracks = [
      makeTrack({ id: 'a', title: 'A', missingFile: true, key: '8A', bpm: 124, format: 'mp3' }),
      makeTrack({ id: 'b', title: 'B', key: '8A', bpm: 124, format: 'mp3' })
    ]
    const report = analyzeHealth(tracks)
    // -2 from missing file → 98
    expect(report.healthScore).toBe(98)
  })

  it('returns score breakdown with weights', () => {
    const tracks = [
      makeTrack({ id: 'a', missingFile: true, key: '', bpm: 0, format: 'unknown' }),
      makeTrack({ id: 'b', key: '8A', bpm: 124, format: 'mp3' })
    ]
    const report = analyzeHealth(tracks)
    expect(report.scoreBreakdown.missingFiles).toBe(2) // 1 × 2
    expect(report.scoreBreakdown.missingKey).toBe(0.5)
    expect(report.scoreBreakdown.missingBpm).toBe(0.5)
    expect(report.scoreBreakdown.unsupportedFormats).toBe(2)
    expect(report.scoreBreakdown.weights.missingFilesPerTrack).toBe(2)
    expect(report.scoreBreakdown.weights.missingFilesCap).toBe(40)
  })

  it('health score floors at 0 not below', () => {
    const tracks = Array.from({ length: 100 }, (_, i) =>
      makeTrack({ id: `t${i}`, missingFile: true, key: '', bpm: 0, format: 'unknown' })
    )
    const report = analyzeHealth(tracks)
    expect(report.healthScore).toBeGreaterThanOrEqual(0)
  })

  it('counts total tracks correctly', () => {
    const tracks = Array.from({ length: 5 }, (_, i) => makeTrack({ id: `t${i}` }))
    expect(analyzeHealth(tracks).totalTracks).toBe(5)
  })
})
