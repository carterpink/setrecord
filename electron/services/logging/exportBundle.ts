import { execFile } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import ElectronStore from 'electron-store'
import { getDb } from '../../db/schema'
import { getLogDir, getRingBuffer, getSessionId, listLogFiles } from './logger'
import { redactPath, scrubString } from './redact'

const execFileAsync = promisify(execFile)

/**
 * NFR-801 Phase 2 — diagnostic log export.
 *
 * Bundles the (already-redacted) NDJSON logs + the in-memory debug ring buffer +
 * a small non-identifying environment snapshot into a single zip the user can
 * attach to a bug report. Everything that reaches the bundle is run through the
 * shared redaction helpers, so it is safe by construction:
 *   - log files are written redacted by the Phase 1 file transport
 *   - ring-buffer lines pass through scrubString()
 *   - meta.json carries only environment facts (no library contents)
 *   - settings.json values pass through redactPath()/scrubString()
 *
 * On macOS (the app + CI target) we shell out to the system `zip` rather than
 * adding a new npm dependency just for this.
 */

/** Keys we deliberately never export, even redacted (consent/credentials/paths). */
const SETTINGS_OMIT = new Set<string>([
  'crashReportingEnabled',
  'rekordboxDbConsent',
  'lastImportPath',
  'lastImportSource',
  'lastImportMtime',
  'lastImportAt',
  'youtubeApiKey',
  'licenseKey',
  'buyerEmail'
])

/** A small, non-identifying environment snapshot. No library contents. */
interface BundleMeta {
  sid: string
  generatedAt: string
  app: {
    name: string
    version: string
  }
  process: {
    platform: NodeJS.Platform
    arch: string
    electron: string
    chrome: string
    node: string
  }
  crashReportingEnabled: boolean
  db: {
    /** SQLite PRAGMA user_version — the app's migration/schema marker. */
    userVersion: number | null
    schemaVersion: number | null
  }
  /** Coarse counts only — never titles, paths, venues, or emails. */
  features: {
    hasLibrary: boolean
    trackCount: number | null
    setCount: number | null
  }
}

/** Read crashReportingEnabled defensively from the same store the app uses. */
function readCrashReporting(): boolean {
  try {
    const store = new ElectronStore<Record<string, unknown>>({ name: 'preferences' })
    return store.get('crashReportingEnabled') === true
  } catch {
    return false
  }
}

/**
 * Pull a couple of coarse, non-identifying counts + the schema version straight
 * from SQLite. Wrapped defensively: a missing/locked DB just yields nulls rather
 * than failing the whole export.
 */
function readDbSnapshot(): {
  userVersion: number | null
  trackCount: number | null
  setCount: number | null
} {
  try {
    const db = getDb()
    const uv = db.pragma('user_version', { simple: true })
    const userVersion = typeof uv === 'number' ? uv : null
    let trackCount: number | null = null
    let setCount: number | null = null
    try {
      const r = db.prepare('SELECT COUNT(*) AS n FROM tracks').get() as { n: number } | undefined
      trackCount = r?.n ?? null
    } catch {
      /* table may not exist in a fresh/headless DB */
    }
    try {
      const r = db.prepare('SELECT COUNT(*) AS n FROM sets').get() as { n: number } | undefined
      setCount = r?.n ?? null
    } catch {
      /* table may not exist */
    }
    return { userVersion, trackCount, setCount }
  } catch {
    return { userVersion: null, trackCount: null, setCount: null }
  }
}

/** Build the meta.json payload — environment facts only, never library content. */
function buildMeta(sid: string): BundleMeta {
  const dbSnap = readDbSnapshot()
  return {
    sid,
    generatedAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion()
    },
    process: {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      node: process.versions.node ?? 'unknown'
    },
    crashReportingEnabled: readCrashReporting(),
    db: {
      userVersion: dbSnap.userVersion,
      schemaVersion: dbSnap.userVersion
    },
    features: {
      hasLibrary: (dbSnap.trackCount ?? 0) > 0,
      trackCount: dbSnap.trackCount,
      setCount: dbSnap.setCount
    }
  }
}

/**
 * Optional redacted settings dump. Every string value is run through
 * redactPath() then scrubString() so home dirs collapse to '~' and any
 * stray email-shaped token is stripped. Secret-ish keys are omitted entirely.
 */
function buildRedactedSettings(): Record<string, unknown> | null {
  try {
    const store = new ElectronStore<Record<string, unknown>>({ name: 'preferences' })
    const raw = store.store
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (SETTINGS_OMIT.has(k)) continue
      if (typeof v === 'string') {
        out[k] = scrubString(redactPath(v))
      } else {
        out[k] = v
      }
    }
    return out
  } catch {
    return null
  }
}

/**
 * Build the diagnostic log bundle and return the absolute path to the zip.
 *
 * The zip lands at logs/export/setrecord-logs-<sid>-<timestamp>.zip. Files are
 * first written into a temp staging dir under logs/export/, then zipped and the
 * staging dir removed.
 */
export async function buildLogBundle(): Promise<string> {
  const sid = getSessionId()
  const logDir = getLogDir()
  const exportDir = join(logDir, 'export')
  mkdirSync(exportDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const stem = `setrecord-logs-${sid}-${timestamp}`
  const stageDir = join(exportDir, stem)
  // Start from a clean staging dir in case an earlier run was interrupted.
  rmSync(stageDir, { recursive: true, force: true })
  mkdirSync(stageDir, { recursive: true })

  try {
    // 1) Redacted log files (live + archives), copied as-is — already safe.
    for (const file of listLogFiles()) {
      try {
        copyFileSync(file, join(stageDir, basename(file)))
      } catch {
        // skip a file we couldn't read; the rest of the bundle is still useful
      }
    }

    // 2) Ring buffer — debug/verbose trail, each line scrubbed defensively.
    const ringLines = getRingBuffer().map((line) => scrubString(line))
    writeFileSync(join(stageDir, 'ring-buffer.log'), ringLines.join('\n') + '\n', 'utf8')

    // 3) meta.json — environment snapshot, no library contents.
    writeFileSync(join(stageDir, 'meta.json'), JSON.stringify(buildMeta(sid), null, 2), 'utf8')

    // 4) settings.json — optional redacted settings dump.
    const settings = buildRedactedSettings()
    if (settings) {
      writeFileSync(join(stageDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf8')
    }

    // 5) Zip the staging dir's contents. Use the macOS system `zip` (no new dep).
    const zipPath = join(exportDir, `${stem}.zip`)
    rmSync(zipPath, { force: true })
    const entries = readdirSync(stageDir)
    // -j junks paths so the zip is flat; cwd set to the staging dir.
    await execFileAsync('zip', ['-q', '-j', zipPath, ...entries.map((e) => join(stageDir, e))], {
      cwd: stageDir
    })

    if (!existsSync(zipPath)) {
      throw new Error('zip did not produce an output file')
    }
    return zipPath
  } finally {
    // Always clean the staging dir — only the final zip should remain.
    rmSync(stageDir, { recursive: true, force: true })
  }
}
