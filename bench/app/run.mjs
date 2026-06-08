/**
 * NFR-107 · Tier B — runtime benchmarks (Electron + Playwright).
 *
 * Measures the two budgets that need a real renderer + compositor:
 *   • Cold start → first library paint   (PRD §11: < 3 s)
 *   • 10k-track scroll dropped frames     (PRD §11: 60 fps → ≤ 1% dropped)
 *
 * This is the NIGHTLY / RELEASE / LOCAL tier — it needs a built app, a display,
 * and a GPU, so it never gates a PR. Run:
 *
 *   npm run build           # produces out/main/main.js + renderer
 *   npm run bench:fixtures  # writes bench/results/library-10000.xml
 *   npm run bench:app
 *
 * Budget source of truth is bench/budgets.ts; the two values are mirrored here
 * (with a pointer) because this file is plain ESM and can't import the TS.
 */

import { _electron as electron } from 'playwright-core'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

// ── Budgets — mirror of bench/budgets.ts (BUDGETS.coldStart / BUDGETS.scroll) ──
const COLD_START_MS = 3_000
const SCROLL_DROPPED_PCT_MAX = 1

const MAIN = join(ROOT, 'out', 'main', 'main.js')
const FIXTURE_XML = join(ROOT, 'bench', 'results', 'library-10000.xml')
const LIBRARY_READY = '[data-bench-library-ready="true"]'

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

if (!existsSync(MAIN)) fail(`Built app not found at ${MAIN}. Run \`npm run build\` first.`)
if (!existsSync(FIXTURE_XML))
  fail(`Fixture not found at ${FIXTURE_XML}. Run \`npm run bench:fixtures\` first.`)

// Isolated profile so we never touch the developer's real library.
const userDataDir = mkdtempSync(join(tmpdir(), 'setrecord-bench-app-'))
const launchArgs = [MAIN, `--user-data-dir=${userDataDir}`]

async function launch() {
  const app = await electron.launch({ args: launchArgs })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

async function seed() {
  console.log('• Seeding isolated profile with the 10k fixture…')
  const { app, page } = await launch()
  const result = await page.evaluate(
    (xmlPath) => window.setrecord.importLibrary(xmlPath),
    FIXTURE_XML
  )
  console.log(`  imported ${result?.inserted ?? '?'} tracks`)
  // The 10k virtualized track list (with the data-bench marker) lives in the
  // Build workspace — the "Library" tab renders RecallPanel. Persist Build mode
  // into the profile so every cold launch boots straight into that view.
  await page.evaluate(() => window.localStorage.setItem('setrecord-mode', 'Build'))
  // Give Chromium a beat to flush localStorage to the profile before close.
  await page.waitForTimeout(500)
  await app.close()
}

async function measureColdStart() {
  console.log('• Measuring cold start (median of 5, populated 10k DB)…')
  const samples = []
  for (let i = 0; i < 6; i++) {
    const t0 = performance.now()
    const app = await electron.launch({ args: launchArgs })
    const page = await app.firstWindow()
    await page.waitForSelector(LIBRARY_READY, { timeout: 15_000 })
    const ms = performance.now() - t0
    await app.close()
    if (i > 0) samples.push(ms) // drop first (disk-cache warm-up)
    console.log(`  run ${i}: ${ms.toFixed(0)}ms${i === 0 ? ' (warm-up, discarded)' : ''}`)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]
  const p90 = samples[Math.min(samples.length - 1, Math.ceil(0.9 * samples.length) - 1)]
  return { median, p90, samples }
}

async function measureScroll() {
  console.log('• Measuring 10k scroll (frame intervals during a 2s scroll)…')
  const { app, page } = await launch()
  await page.waitForSelector(LIBRARY_READY, { timeout: 15_000 })

  const stats = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel)
    if (!el) return { error: 'list element not found' }
    const maxScroll = el.scrollHeight - el.clientHeight
    const frames = []
    const DURATION = 3000
    const WARMUP_FRAMES = 5 // discard priming frames (first paint of new rows)
    const start = performance.now()
    let last = start
    return await new Promise((resolve) => {
      function step(now) {
        frames.push(now - last)
        last = now
        const t = (now - start) / DURATION
        el.scrollTop = Math.min(maxScroll, maxScroll * t)
        if (now - start < DURATION) requestAnimationFrame(step)
        else {
          const samples = frames.slice(WARMUP_FRAMES)
          const sorted = [...samples].sort((a, b) => a - b)
          // Estimate the display's frame budget from the median interval — makes
          // the metric refresh-rate-agnostic (60Hz vs 120Hz ProMotion). A
          // *dropped* frame is one that overran by >1.5x a frame budget, i.e. a
          // genuinely skipped vsync — not sub-ms jitter around the threshold.
          const median = sorted[Math.floor(sorted.length / 2)]
          const frameBudget = Math.max(median, 1000 / 120) // floor at 120Hz
          const dropThreshold = frameBudget * 1.5
          const dropped = samples.filter((f) => f > dropThreshold).length
          resolve({
            frames: samples.length,
            fps: Math.round((samples.length / (DURATION - WARMUP_FRAMES * median)) * 1000),
            medianFrameMs: Number(median.toFixed(2)),
            dropThresholdMs: Number(dropThreshold.toFixed(1)),
            dropped,
            droppedPct: (100 * dropped) / samples.length,
            longest: Math.max(...samples)
          })
        }
      }
      requestAnimationFrame(step)
    })
  }, LIBRARY_READY)

  await app.close()
  if (stats.error) fail(`scroll: ${stats.error}`)
  return stats
}

async function main() {
  try {
    await seed()
    const cold = await measureColdStart()
    const scroll = await measureScroll()

    const results = [
      {
        id: 'coldStart',
        metric: cold.median,
        unit: 'ms',
        budget: COLD_START_MS,
        pass: cold.median <= COLD_START_MS,
        detail: cold
      },
      {
        id: 'scroll',
        metric: scroll.droppedPct,
        unit: 'pct',
        budget: SCROLL_DROPPED_PCT_MAX,
        pass: scroll.droppedPct <= SCROLL_DROPPED_PCT_MAX,
        detail: scroll
      }
    ]

    writeFileSync(
      join(ROOT, 'bench', 'results', 'app-latest.json'),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA ?? null, results },
        null,
        2
      )
    )

    console.log('\n─ NFR-107 Tier B summary ─')
    for (const r of results) {
      const flag = r.pass ? '✓ OK' : '✗ FAIL'
      console.log(
        `  ${flag}  ${r.id.padEnd(10)} ${r.metric.toFixed(1)}${r.unit} / ${r.budget}${r.unit}`
      )
    }
    console.log(
      `  scroll: ${scroll.fps}fps, median frame ${scroll.medianFrameMs}ms, ` +
        `${scroll.dropped}/${scroll.frames} frames > ${scroll.dropThresholdMs}ms (dropped), ` +
        `longest ${scroll.longest.toFixed(1)}ms`
    )

    if (results.some((r) => !r.pass)) process.exit(1)
  } finally {
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

main().catch((err) => fail(err?.stack ?? String(err)))
