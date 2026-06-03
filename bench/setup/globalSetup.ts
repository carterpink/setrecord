/**
 * NFR-107 — Vitest globalSetup for the Tier A harness. Runs once in the main
 * process (not a worker), so it's the right place to reset the append-only
 * results log before the run and consolidate it into node-latest.json after.
 */

import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import {
  RESULTS_DIR,
  RESULTS_JSONL,
  RESULTS_JSON,
  WARN_FRACTION,
  type BenchResult
} from '../budgets'

export default function setup(): () => void {
  // Fresh start: drop any results from a previous run.
  mkdirSync(RESULTS_DIR, { recursive: true })
  if (existsSync(RESULTS_JSONL)) rmSync(RESULTS_JSONL)

  // Teardown: fold the JSONL lines into one report.
  return () => {
    const results: BenchResult[] = []
    if (existsSync(RESULTS_JSONL)) {
      for (const line of readFileSync(RESULTS_JSONL, 'utf-8').split('\n')) {
        const trimmed = line.trim()
        if (trimmed) results.push(JSON.parse(trimmed))
      }
    }
    results.sort((a, b) => a.id.localeCompare(b.id))

    const failed = results.filter((r) => !r.pass)
    const warned = results.filter((r) => r.warn && r.pass)

    writeFileSync(
      RESULTS_JSON,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          commit: process.env.GITHUB_SHA ?? process.env.GIT_COMMIT ?? null,
          summary: {
            total: results.length,
            failed: failed.length,
            warned: warned.length
          },
          results
        },
        null,
        2
      )
    )

    // Surface the verdict in the bench output. Vitest already fails the run on
    // the per-bench expect() breaches; this is a readable consolidated summary.

    console.log('\n─ NFR-107 budget summary ─')
    for (const r of results) {
      const pctUsed = (r.utilisation * 100).toFixed(0)
      const flag = !r.pass ? '✗ FAIL' : r.warn ? '⚠ WARN' : '✓ OK'

      console.log(
        `  ${flag}  ${r.id.padEnd(12)} ${r.metric.toFixed(1)}${r.unit} / ${r.budget}${r.unit} (${pctUsed}%)`
      )
    }
    if (warned.length) {
      console.log(
        `  (${warned.length} crossed the ${WARN_FRACTION * 100}%-of-budget warn line — watch these)`
      )
    }
  }
}
