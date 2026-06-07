/**
 * NFR-107 — Performance benchmark harness: budgets + measurement primitives.
 *
 * Single source of truth for the PRD §11 performance budgets. Every benchmark
 * (Tier A headless + Tier B runtime) and the result reporter import from here,
 * so the budget the code gates on can never drift from the spec.
 *
 *   PRD §11 budgets
 *   ───────────────
 *   • Live suggestions ............ < 100 ms   (electron/algorithms/suggestions.ts)
 *   • 20-track Architect build ..... < 500 ms   (electron/algorithms/setArchitect.ts)
 *   • 10k-track import ............. < 10 s     (electron/services/libraryImport.ts)
 *   • 10k-track 60 fps scroll ...... ≤ 1% dropped frames (renderer)
 *   • Cold start ................... < 3 s      (Electron boot → first paint)
 */

import { appendFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))

export type BudgetUnit = 'ms' | 'pct'

export interface Budget {
  /** Stable id, also the key used in the results JSON. */
  id: string
  /** Human label for reports. */
  label: string
  /** The PRD §11 ceiling. Lower is better. */
  value: number
  unit: BudgetUnit
  /** Which referenced module this budget protects. */
  source: string
}

/**
 * The five PRD §11 budgets, plus `importParse` — a pure-JS canary that times
 * just the XML parse + field-mapping phase of import. The canary runs on every
 * PR (no native SQLite needed); the full `import` budget runs where the
 * Electron-ABI better-sqlite3 is loadable (nightly / release / local rebuild).
 */
export const BUDGETS = {
  suggestions: {
    id: 'suggestions',
    label: 'Live suggestions @10k',
    value: 100,
    unit: 'ms',
    source: 'electron/algorithms/suggestions.ts'
  },
  build: {
    id: 'build',
    label: '20-track Set Architect build @10k',
    value: 500,
    unit: 'ms',
    source: 'electron/algorithms/setArchitect.ts'
  },
  import: {
    id: 'import',
    label: '10k-track import (end-to-end, incl. SQLite)',
    value: 10_000,
    unit: 'ms',
    source: 'electron/services/libraryImport.ts'
  },
  importParse: {
    id: 'importParse',
    label: '10k-track XML parse + map (canary)',
    value: 4_000,
    unit: 'ms',
    source: 'electron/services/libraryImport.ts (parse phase)'
  },
  coldStart: {
    id: 'coldStart',
    label: 'Cold start → first library paint',
    value: 3_000,
    unit: 'ms',
    source: 'electron main → renderer first paint'
  },
  scroll: {
    id: 'scroll',
    label: '10k-track scroll dropped frames',
    value: 1,
    unit: 'pct',
    source: 'renderer LibraryPanel (@tanstack/react-virtual)'
  }
} as const satisfies Record<string, Budget>

export type BudgetId = keyof typeof BUDGETS

/**
 * Warn (but don't fail) once a measurement crosses this fraction of budget.
 * Phase 1 ships measure-only at full-budget hard-fail; Phase 2 can tighten the
 * hard gate to WARN_FRACTION once baselines are known to sit comfortably under.
 */
export const WARN_FRACTION = 0.8

// ───────── Measurement ─────────

export interface Sample {
  /** All raw per-iteration timings (ms), in call order. */
  samples: number[]
  n: number
  min: number
  max: number
  mean: number
  p50: number
  p95: number
  p99: number
}

export interface MeasureOpts {
  /** Untimed iterations to warm JIT / caches before sampling. */
  warmup?: number
  /** Timed iterations. */
  iterations?: number
}

/** Nearest-rank percentile (p in [0,100]) over an unsorted sample array. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return NaN
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1))
  return sorted[idx]
}

export function summarise(samples: number[]): Sample {
  const n = samples.length
  const sum = samples.reduce((a, b) => a + b, 0)
  return {
    samples,
    n,
    min: Math.min(...samples),
    max: Math.max(...samples),
    mean: sum / n,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99)
  }
}

/**
 * Time `fn` repeatedly and return latency percentiles. Latency budgets are tail
 * guarantees, so callers gate on `p95`, never the mean.
 */
export function measure(fn: () => void, opts: MeasureOpts = {}): Sample {
  const warmup = opts.warmup ?? 5
  const iterations = opts.iterations ?? 50
  for (let i = 0; i < warmup; i++) fn()
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  return summarise(samples)
}

/** Async variant — for the import path, which awaits disk + SQLite. */
export async function measureAsync(
  fn: () => Promise<void>,
  opts: MeasureOpts = {}
): Promise<Sample> {
  const warmup = opts.warmup ?? 1
  const iterations = opts.iterations ?? 3
  for (let i = 0; i < warmup; i++) await fn()
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(performance.now() - t0)
  }
  return summarise(samples)
}

// ───────── Result sink ─────────

export interface BenchResult {
  id: BudgetId
  label: string
  /** The figure gated against budget (p95 for latency, the metric for scroll). */
  metric: number
  unit: BudgetUnit
  budget: number
  warnAt: number
  /** metric ≤ budget. */
  pass: boolean
  /** metric > warnAt (within 20% of budget) — early-warning, not a failure. */
  warn: boolean
  /** Fraction of budget consumed (metric / budget). */
  utilisation: number
  detail?: Partial<Sample>
}

export const RESULTS_DIR = join(HERE, 'results')
/** Append sink: one JSON object per line. Robust to Vitest's per-file forks —
 *  benches run sequentially (fileParallelism: false), so appends don't interleave. */
export const RESULTS_JSONL = join(RESULTS_DIR, 'node-latest.jsonl')
/** Consolidated report, written once by the globalSetup teardown. */
export const RESULTS_JSON = join(RESULTS_DIR, 'node-latest.json')

/**
 * Record one budget result and return it. The pass/warn flags are derived from
 * the budget so individual benches only choose the metric (e.g. p95). Each call
 * appends a line to node-latest.jsonl; globalSetup consolidates at run end.
 */
export function record(id: BudgetId, metric: number, detail?: Partial<Sample>): BenchResult {
  const b = BUDGETS[id]
  const warnAt = b.value * WARN_FRACTION
  const result: BenchResult = {
    id,
    label: b.label,
    metric,
    unit: b.unit,
    budget: b.value,
    warnAt,
    pass: metric <= b.value,
    warn: metric > warnAt,
    utilisation: metric / b.value,
    detail: detail
      ? {
          p50: detail.p50,
          p95: detail.p95,
          p99: detail.p99,
          min: detail.min,
          max: detail.max,
          n: detail.n
        }
      : undefined
  }
  mkdirSync(RESULTS_DIR, { recursive: true })
  appendFileSync(RESULTS_JSONL, JSON.stringify(result) + '\n')
  return result
}
