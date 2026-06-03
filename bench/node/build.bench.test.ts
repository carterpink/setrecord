/**
 * NFR-107 · Tier A — Set Architect build latency (PRD §11: < 500 ms for ~20 tracks).
 *
 * Exercises the real buildSet() over a 10k-track library with params that target
 * a ~120-minute set (≈ 20 tracks). buildSet calls getSuggestions internally per
 * slot, so this is the compounding case most likely to regress silently when a
 * new scoring factor is added. Gates on p95.
 */

import { describe, it, expect } from 'vitest'
import { buildSet } from '../../electron/algorithms/setArchitect'
import { GENERIC_PROFILE } from '../../electron/algorithms/genreProfiles'
import type { ArchitectParams } from '../../src/types'
import { generateLibrary, BENCH_SEED } from '../fixtures/generateLibrary'
import { BUDGETS, measure, record } from '../budgets'

describe('bench: 20-track build @10k', () => {
  const library = generateLibrary(BENCH_SEED, 10_000)

  // ~120 min / 6 ≈ 20 tracks (buildSet's rawCount = targetDuration / 6).
  const params: ArchitectParams = {
    targetDuration: 120,
    vibe: 'peak',
    slotTime: 'peak',
    crowdAge: 'mixed',
    venueType: 'club',
    bpmMin: 124,
    bpmMax: 130,
    harmonicMixing: true,
    followEnergyCurve: true,
    energyCurveType: 'rise'
  }

  it('builds ~20 tracks (sanity)', () => {
    const out = buildSet(params, library, GENERIC_PROFILE)
    expect(out.length).toBeGreaterThanOrEqual(15)
    expect(out.length).toBeLessThanOrEqual(30)
  })

  it(`p95 < ${BUDGETS.build.value}ms`, () => {
    const sample = measure(() => void buildSet(params, library, GENERIC_PROFILE), {
      warmup: 3,
      iterations: 25
    })

    const res = record('build', sample.p95, sample)

    console.log(
      `  build: p50=${sample.p50.toFixed(2)}ms p95=${sample.p95.toFixed(
        2
      )}ms (budget ${res.budget}ms, ${(res.utilisation * 100).toFixed(0)}% used)`
    )

    expect(sample.p95).toBeLessThanOrEqual(BUDGETS.build.value)
  })
})
