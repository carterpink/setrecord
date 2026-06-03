import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, renameSync, rmSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import log from 'electron-log/main'
import ElectronStore from 'electron-store'
import { frameBasename, redactPath, scrubString } from './redact'

/**
 * NFR-801 Phase 1 — capture foundation.
 *
 * A thin wrapper around electron-log (main process) that:
 *  - writes redacted NDJSON to userData/logs/main.log
 *  - rotates at 5 MB, keeping 5 archives (main.1.log … main.5.log)
 *  - prunes logs older than 30 days on startup
 *  - keeps an in-memory ring buffer of debug/verbose records (NOT on disk)
 *  - stamps a per-launch, non-identifying session id on every record
 *  - routes main-process console.* through itself (no call-site rewrites)
 *
 * Export (logs:export) and settings-schema wiring land in a later phase.
 */

// ── Session id ──────────────────────────────────────────────────────────────
// Random per process launch. Not derived from anything identifying; it only
// correlates lines within a single run. Stable for the process lifetime.
const SESSION_ID = randomUUID()

/** The per-launch, non-identifying session id stamped on every log line. */
export function getSessionId(): string {
  return SESSION_ID
}

// ── In-memory ring buffer ────────────────────────────────────────────────────
const RING_CAPACITY = 2000
const ring: string[] = []

function pushRing(line: string): void {
  ring.push(line)
  if (ring.length > RING_CAPACITY) ring.shift()
}

/**
 * Snapshot of the in-memory ring buffer (oldest → newest). Captures debug/verbose
 * records that are deliberately NOT written to disk, for a later export phase.
 */
export function getRingBuffer(): string[] {
  return ring.slice()
}

// ── Levels ───────────────────────────────────────────────────────────────────
type Level = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly'
const LEVEL_RANK: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5
}

/**
 * Read settings.logLevel defensively. The setting is NOT part of the settings
 * schema in this phase, so we read it from the same electron-store the app uses
 * without registering it. Any failure falls back to 'info'.
 */
function readDiskLevel(): Level {
  try {
    const store = new ElectronStore<Record<string, unknown>>({ name: 'preferences' })
    const raw = store.get('logLevel')
    if (typeof raw === 'string' && raw in LEVEL_RANK) return raw as Level
  } catch {
    // store unavailable (e.g. headless/test) — fall through to default
  }
  return 'info'
}

// ── Redaction of a single record ─────────────────────────────────────────────
interface SerializedErr {
  name: string
  msg: string
  stack: string[]
}

interface LogRecord {
  t: string
  lvl: string
  scope: string
  sid: string
  msg: string
  err?: SerializedErr
  ctx?: Record<string, unknown>
}

/** Turn an Error into a redacted {name,msg,stack[]} shape. */
function serializeError(err: Error): SerializedErr {
  const stack = (err.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // Run each frame through the shared basename helper + scrubber so absolute
    // paths never reach disk. frameBasename collapses the path token; scrubString
    // is a defensive final pass on the rest of the frame text.
    .map((line) =>
      scrubString(line.replace(/\(?([^\s()]+[/\\][^\s()]+)\)?/g, (_m, p) => frameBasename(p)))
    )
  return {
    name: err.name,
    msg: scrubString(err.message),
    stack
  }
}

/** Deep-ish redact of a ctx object's string values (one level + nested objects). */
function redactCtx(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'string') {
      // A value that looks like a path gets path-aware redaction first.
      out[k] = scrubString(redactPath(v))
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactCtx(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

// ── electron-log wiring ──────────────────────────────────────────────────────
let initialised = false

/** Resolve (and ensure) the logs directory under userData. */
function logsDir(): string {
  const dir = join(app.getPath('userData'), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Backstop: delete any logs/*.log not modified in the last 30 days. */
function pruneOldLogs(dir: string): void {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - THIRTY_DAYS
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (!name.endsWith('.log')) continue
    const full = join(dir, name)
    try {
      if (statSync(full).mtimeMs < cutoff) rmSync(full, { force: true })
    } catch {
      // best-effort
    }
  }
}

/**
 * Remove stale contents of logs/export/ on startup. Exported bundles are
 * one-shot artefacts the user is expected to attach to a bug report immediately;
 * we never want old zips (or interrupted staging dirs) lingering across runs.
 * Mirrors the 30-day prune above but clears the export dir wholesale.
 */
function cleanExportStaging(dir: string): void {
  const exportDir = join(dir, 'export')
  try {
    rmSync(exportDir, { recursive: true, force: true })
  } catch {
    // best-effort — a leftover bundle is harmless
  }
}

/**
 * Size-based rotation keeping 5 archives: main.5.log is discarded, each
 * main.N.log shifts to main.(N+1).log, and the live main.log becomes main.1.log.
 * electron-log invokes this when the live file exceeds maxSize, then resets it.
 */
function rotate(dir: string): void {
  const KEEP = 5
  const live = join(dir, 'main.log')
  try {
    rmSync(join(dir, `main.${KEEP}.log`), { force: true })
  } catch {
    /* ignore */
  }
  for (let i = KEEP - 1; i >= 1; i--) {
    const from = join(dir, `main.${i}.log`)
    const to = join(dir, `main.${i + 1}.log`)
    try {
      if (existsSync(from)) renameSync(from, to)
    } catch {
      /* ignore */
    }
  }
  try {
    if (existsSync(live)) renameSync(live, join(dir, 'main.1.log'))
  } catch {
    /* ignore */
  }
}

/**
 * Build the NDJSON record for a message and (a) format it for the file transport
 * and (b) capture debug/verbose into the ring buffer. electron-log calls the
 * file transform with `{ message, transport }` and expects the transformed data
 * back; we return a single pre-serialized string.
 */
function buildRecord(
  scope: string,
  level: string,
  args: unknown[]
): { record: LogRecord; line: string } {
  let msg = ''
  let err: SerializedErr | undefined
  let ctx: Record<string, unknown> | undefined

  const msgParts: string[] = []
  for (const a of args) {
    if (a instanceof Error) {
      err = serializeError(a)
    } else if (a && typeof a === 'object' && !Array.isArray(a)) {
      ctx = { ...(ctx ?? {}), ...redactCtx(a as Record<string, unknown>) }
    } else {
      msgParts.push(typeof a === 'string' ? a : String(a))
    }
  }
  msg = scrubString(redactPath(msgParts.join(' ')))

  const record: LogRecord = {
    t: new Date().toISOString(),
    lvl: level,
    scope,
    sid: SESSION_ID,
    msg,
    ...(err ? { err } : {}),
    ...(ctx ? { ctx } : {})
  }
  return { record, line: JSON.stringify(record) }
}

/**
 * Initialise the logger. Idempotent. Call EARLY in main startup so the startup
 * lifecycle is captured before DB init / window creation.
 */
export function initLogger(): void {
  if (initialised) return
  initialised = true

  const dir = logsDir()
  pruneOldLogs(dir)
  cleanExportStaging(dir)

  const diskLevel = readDiskLevel()

  // ── File transport: NDJSON, redacted, 5 MB rotation, 5 archives ────────────
  log.transports.file.level = diskLevel
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.fileName = 'main.log'
  log.transports.file.resolvePathFn = () => join(dir, 'main.log')
  log.transports.file.archiveLogFn = () => rotate(dir)

  // The file transform turns each surviving record into one redacted NDJSON line.
  log.transports.file.transforms = [
    ({ message }) => {
      const { line } = buildRecord(message.scope ?? 'main', message.level, message.data)
      return [line]
    }
  ]

  // ── Console transport: redact dev output too (safe by construction) ────────
  log.transports.console.level = diskLevel
  log.transports.console.transforms = [
    ({ message }) => {
      const { line } = buildRecord(message.scope ?? 'main', message.level, message.data)
      return [line]
    }
  ]

  // ── Ring buffer transport: capture debug/verbose/silly records that are
  // below the disk level (so never written to file) for a later in-app export.
  // electron-log filters per-transport by level BEFORE running it, so a custom
  // transport at 'silly' sees everything; we keep only sub-info records here to
  // avoid duplicating what already reaches disk.
  const ringTransport = ((message: { scope?: string; level: string; data: unknown[] }) => {
    const rank = LEVEL_RANK[message.level] ?? LEVEL_RANK.info
    if (rank >= LEVEL_RANK.verbose) {
      const { line } = buildRecord(message.scope ?? 'main', message.level, message.data)
      pushRing(line)
    }
  }) as unknown as (typeof log.transports)['file']
  ;(ringTransport as { level: string }).level = 'silly'
  log.transports.ring = ringTransport

  // ── Route main-process console.* through the logger ────────────────────────
  // This persists the ~72 existing console.* call sites without rewriting them.
  Object.assign(console, log.functions)

  log.scope('logger').info('logging initialised', { sid: SESSION_ID, diskLevel })
}

/**
 * A scoped logger. `scope` matches existing bracket tags ([import]/[energy]/[usb]).
 * Returns the standard electron-log level methods; everything passes through the
 * redacting transforms before it reaches disk.
 */
export function createLogger(scope: string): ReturnType<typeof log.scope> {
  if (!initialised) initLogger()
  return log.scope(scope)
}

// ── Export accessors (Phase 2) ───────────────────────────────────────────────

/**
 * The absolute userData/logs directory (created if missing). Used by the log
 * bundle exporter to locate the live log + archives and to stage the zip.
 */
export function getLogDir(): string {
  return logsDir()
}

/**
 * Absolute paths of the live log (main.log) plus any existing rotated archives
 * (main.1.log … main.5.log), in order, skipping ones that don't exist. These
 * files are already redacted (safe by construction) so they can be bundled as-is.
 */
export function listLogFiles(): string[] {
  const dir = logsDir()
  const out: string[] = []
  const live = join(dir, 'main.log')
  if (existsSync(live)) out.push(live)
  for (let i = 1; i <= 5; i++) {
    const archive = join(dir, `main.${i}.log`)
    if (existsSync(archive)) out.push(archive)
  }
  return out
}
