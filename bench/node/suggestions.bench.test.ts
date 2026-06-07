/**
 * NFR-107 · Tier A — Live suggestions latency (PRD §11: < 100 ms).
 *
 * Exercises the real getSuggestions() over a 10k-track synthetic library, in a
 * worst-case mid-set state: current track in the densest BPM cluster, GENERIC
 * profile (widest ±maxStep window → largest candidate pool). Gates on p95.
 */

import { describe, it, expect } from 'vitest'
import { getSuggestions } from '../../electron/algorithms/suggestions'
import { GENERIC_PROFILE } from '../../electron/algorithms/genreProfiles'
import { generateLibrary, BENCH_SEED } from '../fixtures/generateLibrary'
import { buildSuggestionScenario } from '../fixtures/buildPartialSet'
import { BUDGETS, measure, record } from '../budgets'

describe('bench: live suggestions @10k', () => {
  const library = generateLibrary(BENCH_SEED, 10_000)
  const { current, set, comboLookup, count } = buildSuggestionScenario(library)

  it('returns suggestions (sanity)', () => {
    const out = getSuggestions(current, library, set, count, [], comboLookup, GENERIC_PROFILE)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThanOrEqual(count)
  })

  it(`p95 < ${BUDGETS.suggestions.value}ms`, () => {
    const sample = measure(
      () => {
        getSuggestions(current, library, set, count, [], comboLookup, GENERIC_PROFILE)
      },
      { warmup: 10, iterations: 60 }
    )

    const res = record('suggestions', sample.p95, sample)

    console.log(
      `  suggestions: p50=${sample.p50.toFixed(2)}ms p95=${sample.p95.toFixed(
        2
      )}ms (budget ${res.budget}ms, ${(res.utilisation * 100).toFixed(0)}% used)`
    )
    if (res.warn && res.pass) {
      console.warn(`  ⚠ within ${100 - 100 * (1 - res.utilisation)}% of budget`)
    }

    expect(sample.p95).toBeLessThanOrEqual(BUDGETS.suggestions.value)
  })
})
