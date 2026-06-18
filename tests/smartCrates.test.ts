import { describe, it, expect } from 'vitest'
import { evaluateCrate, SEED_CRATES } from '../electron/algorithms/memory/smartCrates'
import type { SmartCrate } from '../src/types'
import { makeTrack } from './fixtures'

const NOW = new Date('2026-01-01T00:00:00Z')

function monthsBack(n: number): string {
  const d = new Date(NOW)
  d.setMonth(d.getMonth() - n)
  return d.toISOString()
}

describe('evaluateCrate — BPM rules', () => {
  it('filters by bpmMin', () => {
    const crate: SmartCrate = { id: 'c', name: 'c', rules: [{ bpmMin: 128 }], match: 'all' }
    const tracks = [makeTrack({ id: 'a', bpm: 126 }), makeTrack({ id: 'b', bpm: 130 })]
    const result = evaluateCrate(crate, tracks, NOW)
    expect(result.map((t) => t.id)).toEqual(['b'])
  })

  it('filters by bpmMax', () => {
    const crate: SmartCrate = { id: 'c', name: 'c', rules: [{ bpmMax: 127 }], match: 'all' }
    const tracks = [makeTrack({ id: 'a', bpm: 126 }), makeTrack({ id: 'b', bpm: 130 })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['a'])
  })

  it('filters by bpm range', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ bpmMin: 124, bpmMax: 128 }],
      match: 'all'
    }
    const tracks = [makeTrack({ id: 'in', bpm: 126 }), makeTrack({ id: 'out', bpm: 132 })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['in'])
  })
})

describe('evaluateCrate — energy rules', () => {
  it('filters by energyMin and energyMax', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ energyMin: 7, energyMax: 9 }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'low', energy: 5 }),
      makeTrack({ id: 'mid', energy: 8 }),
      makeTrack({ id: 'high', energy: 10 })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['mid'])
  })
})

describe('evaluateCrate — key rules', () => {
  it('exact key match', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ keyExact: '8A' }],
      match: 'all'
    }
    const tracks = [makeTrack({ id: 'match', key: '8A' }), makeTrack({ id: 'no', key: '9B' })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['match'])
  })

  it('keyCompatibleWith excludes clashing keys', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ keyCompatibleWith: '8A' }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'compat', key: '8B' }), // mood shift — compatible
      makeTrack({ id: 'compat2', key: '7A' }), // energy shift — compatible
      makeTrack({ id: 'clash', key: '2B' }) // clash
    ]
    const result = evaluateCrate(crate, tracks, NOW).map((t) => t.id)
    expect(result).toContain('compat')
    expect(result).toContain('compat2')
    expect(result).not.toContain('clash')
  })
})

describe('evaluateCrate — play count rules', () => {
  it('gt operator', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ playCountOp: 'gt', playCountValue: 5 }],
      match: 'all'
    }
    const tracks = [makeTrack({ id: 'a', playCount: 5 }), makeTrack({ id: 'b', playCount: 6 })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['b'])
  })

  it('lte operator', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ playCountOp: 'lte', playCountValue: 3 }],
      match: 'all'
    }
    const tracks = [makeTrack({ id: 'a', playCount: 3 }), makeTrack({ id: 'b', playCount: 4 })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['a'])
  })
})

describe('evaluateCrate — neverPlayed rule', () => {
  it('selects only unplayed tracks', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ neverPlayed: true }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'played', playCount: 3, lastPlayed: monthsBack(2) }),
      makeTrack({ id: 'virgin', playCount: 0 })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['virgin'])
  })
})

describe('evaluateCrate — missingMetadata rule', () => {
  it('selects tracks missing key or bpm', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ missingMetadata: true }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'nokey', key: '', bpm: 124 }),
      makeTrack({ id: 'nobpm', key: '8A', bpm: 0 }),
      makeTrack({ id: 'ok', key: '8A', bpm: 124 })
    ]
    const result = evaluateCrate(crate, tracks, NOW).map((t) => t.id)
    expect(result).toContain('nokey')
    expect(result).toContain('nobpm')
    expect(result).not.toContain('ok')
  })
})

describe('evaluateCrate — lastPlayedOlderThan rule', () => {
  it('excludes tracks played recently', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ lastPlayedOlderThanMonths: 6 }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'recent', playCount: 3, lastPlayed: monthsBack(2) }),
      makeTrack({ id: 'old', playCount: 3, lastPlayed: monthsBack(9) })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['old'])
  })

  it('excludes never-played tracks (no lastPlayed)', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ lastPlayedOlderThanMonths: 6 }],
      match: 'all'
    }
    const tracks = [makeTrack({ id: 'never', playCount: 0 })]
    expect(evaluateCrate(crate, tracks, NOW)).toHaveLength(0)
  })
})

describe('evaluateCrate — match:any mode', () => {
  it('passes tracks satisfying at least one rule', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ energyMin: 9 }, { bpmMin: 132 }],
      match: 'any'
    }
    const tracks = [
      makeTrack({ id: 'e', energy: 9, bpm: 120 }), // passes energy rule
      makeTrack({ id: 'b', energy: 5, bpm: 135 }), // passes bpm rule
      makeTrack({ id: 'n', energy: 5, bpm: 120 }) // passes neither
    ]
    const result = evaluateCrate(crate, tracks, NOW).map((t) => t.id)
    expect(result).toContain('e')
    expect(result).toContain('b')
    expect(result).not.toContain('n')
  })
})

describe('evaluateCrate — edge cases', () => {
  it('empty library returns empty', () => {
    const crate: SmartCrate = { id: 'c', name: 'c', rules: [{ energyMin: 5 }], match: 'all' }
    expect(evaluateCrate(crate, [], NOW)).toHaveLength(0)
  })

  it('empty rules returns all tracks', () => {
    const crate: SmartCrate = { id: 'c', name: 'c', rules: [], match: 'all' }
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })]
    expect(evaluateCrate(crate, tracks, NOW)).toHaveLength(2)
  })
})

describe('SEED_CRATES', () => {
  it('exports 7 seed crates with unique ids (including DWA)', () => {
    expect(SEED_CRATES).toHaveLength(7)
    const ids = SEED_CRATES.map((c) => c.id)
    expect(new Set(ids).size).toBe(7)
    expect(ids).toContain('downloaded-worth-auditioning')
  })

  it('every seed crate has a description subtitle', () => {
    for (const crate of SEED_CRATES) {
      expect(crate.description, `crate ${crate.id} is missing description`).toBeTruthy()
    }
  })

  it('peak-weapons selects high-energy tracks in the top BPM tier of the library', () => {
    const crate = SEED_CRATES.find((c) => c.id === 'peak-weapons')!
    // 10 tracks evenly spread BPM 100..145. The top 30% threshold should sit ≈ 132.
    const tracks = Array.from({ length: 10 }, (_, i) =>
      makeTrack({ id: `t${i}`, energy: 9, bpm: 100 + i * 5 })
    )
    // Add one low-energy track at peak BPM — must be excluded by the energy clause
    tracks.push(makeTrack({ id: 'low', energy: 4, bpm: 150 }))
    const result = evaluateCrate(crate, tracks, NOW).map((t) => t.id)
    expect(result).not.toContain('low')
    // The very-lowest-BPM tracks should be filtered out by the percentile threshold
    expect(result).not.toContain('t0')
    expect(result).not.toContain('t1')
  })

  it('downloaded-worth-auditioning matches imported-but-never-cued tracks', () => {
    const crate = SEED_CRATES.find((c) => c.id === 'downloaded-worth-auditioning')!
    const tracks = [
      makeTrack({ id: 'audition-me', playCount: 0, hotCues: [], cuePoints: [] }),
      makeTrack({ id: 'has-cue', playCount: 0, hotCues: [{ index: 0, position: 30000 }] }),
      makeTrack({ id: 'played', playCount: 5, hotCues: [], cuePoints: [] })
    ]
    const result = evaluateCrate(crate, tracks, NOW).map((t) => t.id)
    expect(result).toEqual(['audition-me'])
  })

  it('never-tested-live selects unplayed tracks', () => {
    const crate = SEED_CRATES.find((c) => c.id === 'never-tested-live')!
    const tracks = [
      makeTrack({ id: 'virgin', playCount: 0 }),
      makeTrack({ id: 'played', playCount: 1, lastPlayed: monthsBack(1) })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['virgin'])
  })

  it('overplayed selects high-playcount tracks', () => {
    const crate = SEED_CRATES.find((c) => c.id === 'overplayed')!
    const tracks = [makeTrack({ id: 'op', playCount: 12 }), makeTrack({ id: 'ok', playCount: 5 })]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['op'])
  })
})

describe('evaluateCrate — new rule fields', () => {
  it('noCuePoints filters out tracks that have any hot cues or cue points', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ noCuePoints: true }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'clean', hotCues: [], cuePoints: [] }),
      makeTrack({ id: 'has-hot', hotCues: [{ index: 0, position: 100 }], cuePoints: [] }),
      makeTrack({ id: 'has-cue', hotCues: [], cuePoints: [{ position: 100, type: 'cue' }] })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['clean'])
  })

  it('durationMinSec / durationMaxSec filters by track duration', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ durationMinSec: 180, durationMaxSec: 360 }],
      match: 'all'
    }
    const tracks = [
      makeTrack({ id: 'short', duration: 120 }),
      makeTrack({ id: 'mid', duration: 240 }),
      makeTrack({ id: 'long', duration: 420 })
    ]
    expect(evaluateCrate(crate, tracks, NOW).map((t) => t.id)).toEqual(['mid'])
  })

  it('bpmTopPercentOfLibrary computes the threshold from the supplied library', () => {
    const crate: SmartCrate = {
      id: 'c',
      name: 'c',
      rules: [{ bpmTopPercentOfLibrary: 30 }],
      match: 'all'
    }
    // 10 tracks 100..145 BPM. Top 30% → threshold ≈ 132. The fastest 3–4 should pass.
    const tracks = Array.from({ length: 10 }, (_, i) =>
      makeTrack({ id: `t${i}`, bpm: 100 + i * 5 })
    )
    const result = evaluateCrate(crate, tracks, NOW)
    expect(result.length).toBeGreaterThanOrEqual(3)
    expect(result.length).toBeLessThanOrEqual(4)
    // Verify the slowest tracks are excluded
    expect(result.map((t) => t.id)).not.toContain('t0')
  })
})
