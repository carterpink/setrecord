import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, statSync, readdirSync } from 'fs'
import type { RekordboxDetection } from '../../../src/types'

const PIONEER_DIR = join(homedir(), 'Library', 'Pioneer')
const REKORDBOX_DIR = join(PIONEER_DIR, 'rekordbox')
const MASTER_DB = join(REKORDBOX_DIR, 'master.db')
const OPTIONS_JSON = join(REKORDBOX_DIR, 'options.json')
const APPLICATIONS_DIR = '/Applications'

/**
 * Inspect the user's macOS filesystem for a Rekordbox install and library.
 *
 * Read-only — never opens master.db (the cipher service does that), never
 * touches anything outside Rekordbox's own directories. Every probe is
 * try/catch'd; failures are silent and reflected in the returned object's
 * null fields. Never throws.
 */
export async function detectRekordbox(): Promise<RekordboxDetection> {
  const result: RekordboxDetection = {
    installed: false,
    dbPath: null,
    dbMtime: null,
    dbSize: null,
    dbLocked: false,
    optionsJsonPath: null,
    xmlExportPath: null,
    xmlExportExists: false,
    appVersion: null,
    trackCount: null,
    playlistCount: null,
    dbReadError: null,
  }

  // 1. ~/Library/Pioneer/rekordbox exists at all?
  try {
    if (existsSync(REKORDBOX_DIR)) {
      result.installed = true
    }
  } catch {
    // ignore
  }

  // 2. master.db present?
  try {
    if (existsSync(MASTER_DB)) {
      const st = statSync(MASTER_DB)
      result.dbPath = MASTER_DB
      result.dbMtime = st.mtimeMs
      result.dbSize = st.size
      result.installed = true
    }
  } catch {
    // ignore — fields stay null
  }

  // 3. options.json present? If so, parse for the user's XML export path.
  try {
    if (existsSync(OPTIONS_JSON)) {
      result.optionsJsonPath = OPTIONS_JSON
      const raw = readFileSync(OPTIONS_JSON, 'utf-8')
      const xmlPath = parseXmlExportPath(raw)
      if (xmlPath) {
        result.xmlExportPath = xmlPath
        try {
          result.xmlExportExists = existsSync(xmlPath)
        } catch {
          result.xmlExportExists = false
        }
      }
    }
  } catch {
    // ignore — options.json absent or unparseable
  }

  // 4. /Applications/rekordbox*.app — read CFBundleShortVersionString from Info.plist.
  try {
    const appPath = findRekordboxApp()
    if (appPath) {
      result.installed = true
      result.appVersion = readAppVersion(appPath)
    }
  } catch {
    // ignore
  }

  return result
}

/**
 * options.json holds Rekordbox preferences as a JSON object whose structure
 * has changed across versions. We try a small set of known shapes; on miss
 * we return null and the renderer just shows the XML guide without a known
 * default path.
 */
function parseXmlExportPath(raw: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>

  // Known shapes observed across Rekordbox 6.x:
  //   { "xml-import-export": { "export-path": "/Users/.../rekordbox.xml" } }
  //   { "options": { "exportXmlPath": "..." } }
  //   Top-level "exportXmlPath" or "xmlExportPath".
  const candidates: Array<string | undefined> = [
    pick(obj, ['xml-import-export', 'export-path']),
    pick(obj, ['xml-import-export', 'exportPath']),
    pick(obj, ['options', 'exportXmlPath']),
    typeof obj.exportXmlPath === 'string' ? (obj.exportXmlPath as string) : undefined,
    typeof obj.xmlExportPath === 'string' ? (obj.xmlExportPath as string) : undefined,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return null
}

function pick(obj: Record<string, unknown>, path: string[]): string | undefined {
  let cur: unknown = obj
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return typeof cur === 'string' ? cur : undefined
}

function findRekordboxApp(): string | null {
  try {
    const entries = readdirSync(APPLICATIONS_DIR)
    // Match "rekordbox.app", "rekordbox 6.app", "rekordbox 7.app", etc.
    const match = entries.find((name) => /^rekordbox.*\.app$/i.test(name))
    return match ? join(APPLICATIONS_DIR, match) : null
  } catch {
    return null
  }
}

function readAppVersion(appPath: string): string | null {
  try {
    const plistPath = join(appPath, 'Contents', 'Info.plist')
    if (!existsSync(plistPath)) return null
    const raw = readFileSync(plistPath, 'utf-8')
    // Info.plist may be binary or XML. We optimistically scan for the XML form;
    // a binary plist falls through (string match miss) and we return null.
    const m = raw.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/** Test hook — paths used by detect, exposed for fixture-based unit tests. */
export const _internals = {
  REKORDBOX_DIR,
  MASTER_DB,
  OPTIONS_JSON,
  parseXmlExportPath,
}
