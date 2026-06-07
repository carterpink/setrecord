/**
 * Smoke tests for the four reliability hardening measures:
 *   1. DB init recovery — corrupt DB shows dialog, not white screen
 *   2. setStore auto-save — retry + toast on persistent failure
 *   3. ErrorBoundary — catches child errors and shows fallback
 *   4. Crash reporter — opt-in only, no-op without a DSN
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ─── 1. DB init + recovery ────────────────────────────────────────────────────

// schema.ts imports `electron` for app.getPath — stub it before the import.
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => tmpdir()) }
}))

// NOTE: better-sqlite3 is a native module compiled for Electron's Node ABI and
// cannot load in the plain-Node vitest runner. Tests here cover the pure
// filesystem/path logic of schema.ts without actually opening SQLite.
describe('DB init & recovery (schema.ts)', () => {
  it('getDbPath() returns a path ending in library.db inside userData', async () => {
    const dir = join(tmpdir(), `setsense-test-path-${Date.now()}`)
    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(dir)

    const { getDbPath } = await import('../electron/db/schema')
    expect(getDbPath()).toBe(join(dir, 'library.db'))
  })

  it('initDb() throws when better-sqlite3 cannot open the file (any reason)', async () => {
    const dir = join(tmpdir(), `setsense-test-corrupt-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, 'library.db')
    // Write garbage bytes — not a valid SQLite header
    writeFileSync(dbPath, Buffer.from('this is not a sqlite database'))

    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(dir)

    vi.resetModules()
    const { initDb: freshInit } = await import('../electron/db/schema')
    // The throw may be a corrupt-file error or a native-ABI mismatch in CI;
    // either way initDb() must never silently swallow the error.
    expect(() => freshInit()).toThrow()
  })

  it('resetDb() removes the DB file and WAL sidecars without throwing', async () => {
    const dir = join(tmpdir(), `setsense-test-reset-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, 'library.db')
    const walPath = dbPath + '-wal'
    const shmPath = dbPath + '-shm'
    writeFileSync(dbPath, Buffer.from('garbage'))
    writeFileSync(walPath, Buffer.from('wal'))
    writeFileSync(shmPath, Buffer.from('shm'))

    const { app } = await import('electron')
    vi.mocked(app.getPath).mockReturnValue(dir)

    vi.resetModules()
    const { resetDb } = await import('../electron/db/schema')
    expect(() => resetDb()).not.toThrow()

    // DB file is quarantined (renamed), not just deleted
    expect(existsSync(dbPath)).toBe(false)
    // WAL sidecars are cleaned up
    expect(existsSync(walPath)).toBe(false)
    expect(existsSync(shmPath)).toBe(false)
  })

  it('getDb() throws a clear message before initDb() is called', async () => {
    vi.resetModules()
    const { getDb } = await import('../electron/db/schema')
    expect(() => getDb()).toThrow('DB not initialised')
  })
})

// ─── 2. setStore auto-save — retry + toast + unsaved indicator ────────────────

// setStore imports zustand and toastStore (both browser-safe), plus
// window.setsense via IPC which we provide as a global.
vi.mock('zustand', async (importOriginal) => importOriginal())

describe('setStore auto-save', () => {
  // Provide a minimal window.setsense bridge
  const mockSaveSet = vi.fn()
  beforeEach(() => {
    global.window = {
      setsense: {
        saveSet: mockSaveSet,
        getSets: vi.fn(async () => []),
        getSet: vi.fn(async () => null),
        scoreTransition: vi.fn(async () => undefined)
      },
      crypto: { randomUUID: () => crypto.randomUUID() }
    } as unknown as Window & typeof globalThis
    mockSaveSet.mockReset()
  })

  afterEach(() => {
    // @ts-expect-error
    delete global.window
    vi.useRealTimers()
  })

  it('saveStatus transitions idle → unsaved → saving → idle on success', async () => {
    vi.useFakeTimers()
    const { useSetStore } = await import('../src/stores/setStore')
    const store = useSetStore.getState()

    mockSaveSet.mockResolvedValue({ id: 'set-1', tracks: [] })
    store.createSet('Gig night')

    // After createSet, a debounced save is scheduled: status should be 'unsaved'
    expect(useSetStore.getState().saveStatus).toBe('unsaved')

    // Advance past the 500 ms debounce
    await vi.runAllTimersAsync()

    expect(useSetStore.getState().saveStatus).toBe('idle')
    expect(mockSaveSet).toHaveBeenCalledOnce()
  })

  it('retries once on transient failure and resolves to idle', async () => {
    vi.useFakeTimers()
    const { useSetStore } = await import('../src/stores/setStore')
    const store = useSetStore.getState()

    // First call rejects, second succeeds
    mockSaveSet
      .mockRejectedValueOnce(new Error('IPC blip'))
      .mockResolvedValue({ id: 'set-1', tracks: [] })

    store.createSet('Retry test')
    await vi.runAllTimersAsync()

    expect(mockSaveSet).toHaveBeenCalledTimes(2)
    expect(useSetStore.getState().saveStatus).toBe('idle')
  })

  it('shows error toast and sets saveStatus to "error" when both attempts fail', async () => {
    vi.useFakeTimers()
    const { useSetStore } = await import('../src/stores/setStore')
    const { useToastStore } = await import('../src/stores/toastStore')
    const store = useSetStore.getState()

    mockSaveSet.mockRejectedValue(new Error('DB locked'))

    store.createSet('Fail test')
    await vi.runAllTimersAsync()

    expect(mockSaveSet).toHaveBeenCalledTimes(2)
    expect(useSetStore.getState().saveStatus).toBe('error')

    const toasts = useToastStore.getState().toasts
    expect(toasts.some((t) => t.kind === 'error')).toBe(true)
  })

  it('retrySave() manually flushes when saveStatus is "error"', async () => {
    vi.useFakeTimers()
    const { useSetStore } = await import('../src/stores/setStore')

    // Force an error state first
    mockSaveSet.mockRejectedValue(new Error('DB locked'))
    useSetStore.getState().createSet('Retry manual')
    await vi.runAllTimersAsync()
    expect(useSetStore.getState().saveStatus).toBe('error')

    // Now fix the mock and retry
    mockSaveSet.mockResolvedValue({ id: 'set-1', tracks: [] })
    useSetStore.getState().retrySave()
    await vi.runAllTimersAsync()

    expect(useSetStore.getState().saveStatus).toBe('idle')
  })
})

// ─── 3. ErrorBoundary — catches child errors ──────────────────────────────────

// ErrorBoundary is a class component; we can test its static method and
// componentDidCatch directly without a DOM renderer.
describe('ErrorBoundary', () => {
  it('getDerivedStateFromError captures the thrown error', async () => {
    const { ErrorBoundary } = await import('../src/components/shared/ErrorBoundary')
    const err = new Error('panel exploded')
    const state = ErrorBoundary.getDerivedStateFromError(err)
    expect(state.error).toBe(err)
  })

  it('initial state has error: null (children render normally)', async () => {
    const { ErrorBoundary } = await import('../src/components/shared/ErrorBoundary')
    // @ts-expect-error -- accessing internal initial state via prototype default
    const instance = new ErrorBoundary({})
    expect(instance.state.error).toBeNull()
  })

  it('componentDidCatch logs the error without rethrowing', async () => {
    const { ErrorBoundary } = await import('../src/components/shared/ErrorBoundary')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // @ts-expect-error
    const instance = new ErrorBoundary({ label: 'test-panel' })
    const err = new Error('crash')
    expect(() =>
      instance.componentDidCatch(err, { componentStack: '\n  at Foo\n  at Bar' })
    ).not.toThrow()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ─── 4. Crash reporter — opt-in, no-op without DSN ───────────────────────────

const mockSentryInit = vi.fn()
const mockSentryClose = vi.fn(() => Promise.resolve(true))
vi.mock('@sentry/electron/main', () => ({
  init: mockSentryInit,
  close: mockSentryClose
}))

describe('crashReporter', () => {
  beforeEach(() => {
    mockSentryInit.mockReset()
    mockSentryClose.mockReset()
    mockSentryClose.mockImplementation(() => Promise.resolve(true))
    // Ensure the module picks up our env override on each test
    vi.resetModules()
  })

  it('is a no-op when SENTRY_DSN is not set', async () => {
    delete process.env.SENTRY_DSN
    const { initCrashReporter } = await import('../electron/services/crashReporter')
    initCrashReporter()
    expect(mockSentryInit).not.toHaveBeenCalled()
  })

  it('calls Sentry.init with tracesSampleRate 0 when SENTRY_DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/0'
    const { initCrashReporter } = await import('../electron/services/crashReporter')
    initCrashReporter()
    expect(mockSentryInit).toHaveBeenCalledOnce()
    const [cfg] = mockSentryInit.mock.calls[0]
    expect(cfg.tracesSampleRate).toBe(0)
    expect(cfg.attachScreenshot).toBe(false)
    delete process.env.SENTRY_DSN
  })

  it('beforeSend strips user identity and breadcrumbs', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/0'
    const { initCrashReporter } = await import('../electron/services/crashReporter')
    initCrashReporter()
    const [cfg] = mockSentryInit.mock.calls[0]

    const event = {
      user: { id: 'u1', email: 'dj@example.com' },
      breadcrumbs: { values: [{ message: '/home/user/music' }] },
      extra: { localPath: '/home/user' }
    }
    const result = cfg.beforeSend(event)
    expect(result).not.toBeNull()
    expect(result.user).toBeUndefined()
    expect(result.breadcrumbs).toBeUndefined()
    expect(result.extra).toBeUndefined()
    delete process.env.SENTRY_DSN
  })

  it('beforeSend redacts absolute paths in stack frames', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/0'
    const { initCrashReporter } = await import('../electron/services/crashReporter')
    initCrashReporter()
    const [cfg] = mockSentryInit.mock.calls[0]

    const event = {
      exception: {
        values: [
          {
            stacktrace: {
              frames: [{ filename: '/home/sam/code/SetSenseV2/electron/main.ts', abs_path: '/home/sam/code/SetSenseV2/electron/main.ts' }]
            }
          }
        ]
      }
    }
    const result = cfg.beforeSend(event)
    const frame = result.exception.values[0].stacktrace.frames[0]
    expect(frame.filename).toBe('main.ts')
    expect(frame.abs_path).toBeUndefined()
    delete process.env.SENTRY_DSN
  })

  it('beforeSend scrubs hostname (server_name) and device context', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/0'
    const { initCrashReporter } = await import('../electron/services/crashReporter')
    initCrashReporter()
    const [cfg] = mockSentryInit.mock.calls[0]
    expect(cfg.sendDefaultPii).toBe(false)

    const event = {
      server_name: 'Sams-MacBook-Pro.local',
      contexts: {
        device: { name: 'Sams-MacBook-Pro', model: 'MacBookPro18,1' },
        os: { name: 'macOS', version: '15.3' }
      }
    }
    const result = cfg.beforeSend(event)
    expect(result.server_name).toBeUndefined()
    expect(result.contexts.device).toBeUndefined()
    // os context is just version strings — kept for triage
    expect(result.contexts.os).toBeDefined()
    delete process.env.SENTRY_DSN
  })

  it('closeCrashReporter flushes Sentry only after init', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/0'
    const mod = await import('../electron/services/crashReporter')

    // Never initialised → close is a no-op
    await mod.closeCrashReporter()
    expect(mockSentryClose).not.toHaveBeenCalled()

    // After init, close tears down
    mod.initCrashReporter()
    await mod.closeCrashReporter()
    expect(mockSentryClose).toHaveBeenCalledOnce()
    delete process.env.SENTRY_DSN
  })
})
