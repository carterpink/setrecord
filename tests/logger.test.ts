/**
 * NFR-801 Phase 1 — logger foundation. Verifies the per-launch session id is
 * stable + non-empty, that createLogger returns a scoped logger, and that
 * debug/verbose records land in the in-memory ring buffer (and are redacted).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { vi } from 'vitest'

const USER_DATA = mkdtempSync(join(tmpdir(), 'setsense-logger-'))

vi.mock('electron', () => ({
  app: { getPath: () => USER_DATA }
}))

// logLevel is intentionally absent from the schema this phase; the store read
// must tolerate that and fall back to 'info'.
vi.mock('electron-store', () => ({
  default: class {
    get(): unknown {
      return undefined
    }
    set(): void {
      /* no-op: logLevel is not persisted in this phase */
    }
  }
}))

import {
  initLogger,
  createLogger,
  getSessionId,
  getRingBuffer
} from '../electron/services/logging/logger'

describe('logger', () => {
  beforeAll(() => {
    initLogger()
  })

  it('exposes a stable, non-empty, non-identifying session id', () => {
    const a = getSessionId()
    const b = getSessionId()
    expect(a).toBeTruthy()
    expect(a).toBe(b)
    // UUID v4 shape — random, not derived from anything identifying.
    expect(a).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('createLogger returns a scoped logger with level methods', () => {
    const log = createLogger('import')
    expect(typeof log.info).toBe('function')
    expect(typeof log.debug).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('captures debug records into the ring buffer (not requiring disk)', () => {
    const before = getRingBuffer().length
    const log = createLogger('energy')
    log.debug('ring probe', { detail: 'x' })
    const after = getRingBuffer()
    expect(after.length).toBeGreaterThan(before)
    const last = JSON.parse(after[after.length - 1])
    expect(last.scope).toBe('energy')
    expect(last.lvl).toBe('debug')
    expect(last.sid).toBe(getSessionId())
    expect(last.msg).toContain('ring probe')
  })

  it('redacts emails in ring-buffer records', () => {
    const log = createLogger('test')
    log.verbose('contact carter.pink@gmail.com about this')
    const buf = getRingBuffer()
    const line = buf[buf.length - 1]
    expect(line).not.toContain('carter.pink@gmail.com')
    expect(line).toContain('[redacted-email]')
  })
})
