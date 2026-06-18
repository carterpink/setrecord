/**
 * NFR-801 Phase 4 — Sentry breadcrumb bridge.
 *
 * Verifies that:
 *  - NO breadcrumb is emitted while the bridge is inactive (Sentry not init'd).
 *  - Once activated, info/warn/error records ARE mirrored as breadcrumbs.
 *  - The breadcrumb text is the ALREADY-REDACTED log line: no home-dir paths,
 *    no email-shaped tokens — same scrubbing the file logger applies.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir, homedir } from 'os'
import { join } from 'path'

const USER_DATA = mkdtempSync(join(tmpdir(), 'setrecord-breadcrumb-'))
const HOME = homedir().replace(/\\/g, '/').replace(/\/+$/, '')

vi.mock('electron', () => ({
  app: { getPath: () => USER_DATA }
}))

vi.mock('electron-store', () => ({
  default: class {
    get(): unknown {
      return undefined
    }
    set(): void {
      /* no-op */
    }
  }
}))

// Capture every breadcrumb the logger pushes. The logger reaches this through a
// dynamic import('@sentry/electron/main'), so the mock must expose addBreadcrumb.
const breadcrumbs: Array<{ category?: string; level?: string; message?: string }> = []
vi.mock('@sentry/electron/main', () => ({
  addBreadcrumb: (b: { category?: string; level?: string; message?: string }) => {
    breadcrumbs.push(b)
  }
}))

import {
  initLogger,
  createLogger,
  setSentryBreadcrumbsActive
} from '../electron/services/logging/logger'

// The logger pushes breadcrumbs through a dynamic import().then() chain, so wait
// for the buffer to reach an expected length rather than racing a single tick.
async function waitForBreadcrumbs(expected: number): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (breadcrumbs.length >= expected) return
    await new Promise((r) => setTimeout(r, 2))
  }
}
// A plain settle for the negative (no-breadcrumb-expected) case.
const settle = (): Promise<void> =>
  new Promise((r) => setTimeout(r, 20))

describe('logger → Sentry breadcrumbs', () => {
  beforeAll(() => {
    initLogger()
  })

  it('emits NOTHING while the bridge is inactive (Sentry not initialised)', async () => {
    setSentryBreadcrumbsActive(false)
    breadcrumbs.length = 0
    const log = createLogger('gate')
    log.info('this should not become a breadcrumb')
    log.error('neither should this')
    await settle()
    expect(breadcrumbs).toHaveLength(0)
  })

  it('mirrors info/warn/error records once the bridge is active', async () => {
    setSentryBreadcrumbsActive(true)
    breadcrumbs.length = 0
    const log = createLogger('bridge')
    log.info('hello from the bridge')
    await waitForBreadcrumbs(1)
    expect(breadcrumbs.length).toBeGreaterThan(0)
    const last = breadcrumbs[breadcrumbs.length - 1]
    expect(last.category).toBe('bridge')
    expect(last.level).toBe('info')
    expect(last.message).toContain('hello from the bridge')
    setSentryBreadcrumbsActive(false)
  })

  it('only sends the already-redacted line — no home paths or emails', async () => {
    setSentryBreadcrumbsActive(true)
    breadcrumbs.length = 0
    const log = createLogger('redact')
    log.warn(`failed reading ${HOME}/Music/secret/track.flac for carter.pink@gmail.com`)
    await waitForBreadcrumbs(1)
    const last = breadcrumbs[breadcrumbs.length - 1]
    expect(last).toBeTruthy()
    const text = last.message ?? ''
    expect(text).not.toContain(HOME)
    expect(text).not.toContain('carter.pink@gmail.com')
    expect(text).toContain('[redacted-email]')
    expect(last.level).toBe('warning')
    setSentryBreadcrumbsActive(false)
  })
})
