import { describe, it, expect } from 'vitest'
import { generateLibrary, BENCH_SEED } from '../bench/fixtures/generateLibrary'
import { tracksToRekordboxXml } from '../bench/fixtures/toRekordboxXml'
import { buildSuggestionScenario } from '../bench/fixtures/buildPartialSet'

/**
 * Guards the harness's core invariant: the synthetic library is deterministic
 * and realistically distributed. If this drifts, every benchmark number drifts
 * with it — so it's worth a real unit test in the main suite.
 */
describe('bench fixture: generateLibrary', () => {
  it('is deterministic for a given seed (same seed → identical library)', () => {
    const a = generateLibrary(BENCH_SEED, 500)
    const b = generateLibrary(BENCH_SEED, 500)
    expect(b).toEqual(a)
  })

  it('differs across seeds', () => {
    const a = generateLibrary(1, 200)
    const b = generateLibrary(2, 200)
    expect(a[0].bpm === b[0].bpm && a[1].bpm === b[1].bpm && a[2].bpm === b[2].bpm).toBe(false)
  })

  it('produces valid, in-range tracks', () => {
    const lib = generateLibrary(BENCH_SEED, 1_000)
    expect(lib).toHaveLength(1_000)
    for (const t of lib) {
      expect(t.bpm).toBeGreaterThan(100)
      expect(t.bpm).toBeLessThan(200)
      expect(t.energy).toBeGreaterThanOrEqual(1)
      expect(t.energy).toBeLessThanOrEqual(10)
      expect(t.duration).toBeGreaterThanOrEqual(180)
      expect(t.key).toMatch(/^([1-9]|1[0-2])[AB]$/)
    }
    // Unique ids and file paths — required for the import path's UNIQUE(file_path).
    expect(new Set(lib.map((t) => t.id)).size).toBe(1_000)
    expect(new Set(lib.map((t) => t.filePath)).size).toBe(1_000)
  })

  it('clusters BPM realistically (the dense 122–130 band dominates)', () => {
    const lib = generateLibrary(BENCH_SEED, 5_000)
    const inCoreBand = lib.filter((t) => t.bpm >= 119 && t.bpm <= 131).length
    // Weighted clusters put ~74% of mass in 122–128 ± spread; assert a clear majority.
    expect(inCoreBand / lib.length).toBeGreaterThan(0.6)
  })
})

describe('bench fixture: Rekordbox XML', () => {
  it('emits one TRACK per track with a decodable Location', () => {
    const lib = generateLibrary(BENCH_SEED, 50)
    const xml = tracksToRekordboxXml(lib)
    expect((xml.match(/<TRACK /g) ?? []).length).toBe(50)
    expect(xml).toContain(`Entries="50"`)
    // Location round-trips: encodeURIComponent path segments after file://localhost.
    const m = xml.match(/Location="(file:\/\/localhost[^"]+)"/)
    expect(m).not.toBeNull()
    const decoded = decodeURIComponent(m![1].replace('file://localhost', ''))
    expect(decoded.startsWith('/Users/dj/Music/SetRecordBench/')).toBe(true)
  })
})

describe('bench fixture: suggestion scenario', () => {
  it('builds a mid-set state with the current track in the dense band', () => {
    const lib = generateLibrary(BENCH_SEED, 2_000)
    const { current, set, comboLookup, count } = buildSuggestionScenario(lib, 8, 10)
    expect(set.tracks).toHaveLength(8)
    expect(count).toBe(10)
    expect(current.bpm).toBeGreaterThan(120)
    expect(current.bpm).toBeLessThan(132)
    expect(comboLookup.size).toBeGreaterThan(0)
    // The current track must not also be one of the placed tracks.
    expect(set.tracks.some((st) => st.trackId === current.id)).toBe(false)
  })
})
