// @ts-check
/**
 * Packaged-app launch smoke test (the "does it even open?" gate).
 *
 * The everyday CI (typecheck/lint/test/build) never actually *opens* the app, so
 * a boot crash — a broken main-process import, a failed DB init, a renderer that
 * never mounts — would ship undetected. This launches the real electron-vite
 * build output (out/main/main.js) through Playwright's Electron driver, waits for
 * the first window, and asserts the renderer actually mounted into #root with no
 * uncaught main- or renderer-process error.
 *
 * The ~1.9 GB Recall model is intentionally NOT required: it loads lazily
 * (memoryAssistant.ensureModel), so first boot works without it — keeping this
 * cheap enough to run on every CI build.
 *
 * Run locally:  npm run build && npm run test:smoke
 * In CI:        a step after the Build job (see .github/workflows/ci.yml).
 */
import { _electron as electron } from 'playwright-core'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const mainEntry = path.join(root, 'out', 'main', 'main.js')

/** @param {string} msg */
function fail(msg) {
  console.error(`✗ smoke: ${msg}`)
  process.exit(1)
}

if (!existsSync(mainEntry)) {
  fail(`build output missing at ${mainEntry} — run "npm run build" first`)
}

const TIMEOUT_MS = 60_000

// Never point the built main at a dev server — force the production file:// load
// path (main.ts loadFile branch). The model env is left untouched (lazy-loaded).
const env = { ...process.env }
delete env.ELECTRON_RENDERER_URL

// Fatal = a real boot failure (uncaught exception, main-process crash, missing
// module). These fail the build. Cosmetic console.error noise (e.g. an empty
// <audio> src or no audio device on a headless runner) is collected as a warning
// and printed, but never gates the smoke test — that altitude is too noisy.
/** @type {string[]} */
const fatal = []
/** @type {string[]} */
const warnings = []

const app = await electron.launch({ args: [mainEntry], timeout: TIMEOUT_MS, env })

try {
  app.process().stderr?.on('data', (d) => {
    const s = String(d)
    if (/\b(UnhandledPromiseRejection|FATAL|Cannot find module|Uncaught)\b/.test(s)) {
      fatal.push(`main stderr: ${s.trim()}`)
    }
  })

  const win = await app.firstWindow({ timeout: TIMEOUT_MS })
  win.on('pageerror', (e) => fatal.push(`renderer pageerror: ${e.message}`))
  win.on('console', (m) => {
    if (m.type() === 'error') warnings.push(m.text())
  })

  // The renderer has truly mounted once React has put children into #root.
  await win.waitForFunction(
    () => {
      const el = document.getElementById('root')
      return !!el && el.childElementCount > 0
    },
    undefined,
    { timeout: TIMEOUT_MS }
  )

  const title = await win.title()
  const mounted = await win.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)
  if (mounted < 1) fail('renderer mounted nothing into #root')

  // Settle window: catch errors thrown just after first paint (effects, IPC).
  await win.waitForTimeout(1500)

  if (fatal.length) {
    fail(`app booted but hit ${fatal.length} fatal error(s):\n  - ${fatal.join('\n  - ')}`)
  }

  if (warnings.length) {
    console.log(`  (${warnings.length} non-fatal console warning(s): ${warnings.join(' | ')})`)
  }

  console.log(
    `✓ smoke: launched, window "${title}" mounted (${mounted} root children), no fatal errors`
  )
} finally {
  await app.close()
}
