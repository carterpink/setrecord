/**
 * updateChecker.ts — Stage-1 update delivery (NFR-1001, "Auto-update").
 *
 * SetRecord has NO in-app installer: electron-updater is intentionally not wired.
 * The ~1.9 GB Recall model is bundled by design (offline from first launch), so
 * a full self-replacing update would be a ~2 GB download per release on macOS.
 * Decision (NFR-901): keep the model 100% bundled and distribute updates
 * manually — this notice IS the permanent delivery mechanism, not a stopgap.
 *
 * This module is the lightweight safety net so a manually-distributed build is
 * never fully dark: on launch we ask GitHub for the latest *published* release,
 * compare it to the running version, and — if newer — show a native dialog that
 * links to the download page. We never download or install anything ourselves.
 *
 * Everything here is best-effort and silent on failure: a flaky network, an API
 * rate-limit, or being offline must never block startup or surface an error.
 */
import { app, dialog, shell, type BrowserWindow } from 'electron'
import ElectronStore from 'electron-store'
import { getSettings } from './settingsService'

// Update feed source. Matches the `publish` provider in electron-builder.yml.
const REPO_OWNER = 'carterpink'
// MUST stay in sync with the `publish.repo` in electron-builder.yml — a mismatch
// makes the update API 404 silently, leaving every installed build unable to
// learn about new releases (incl. security patches). Guarded by a test.
const REPO_NAME = 'setrecord'
const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
const RELEASES_LIST_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=10`
const RELEASES_PAGE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`

// Default cadence (Settings → Privacy can switch this to weekly or manual-only).
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
// Give up quietly if GitHub is slow — this is a background courtesy, not critical.
const NETWORK_TIMEOUT_MS = 8000
// Release notes shown in the dialog are capped so the prompt stays readable.
const NOTES_MAX_CHARS = 500

interface UpdateState {
  /** A release the user explicitly chose to skip; we won't prompt for it again. */
  skippedVersion: string | null
  /** Epoch ms of the last check (throttles the once-a-day cadence). */
  lastCheckAt: number
}

// Namespaced store of its own (update-state.json) so this never has to touch the
// AppSettings schema in settingsService.ts.
const store = new ElectronStore<UpdateState>({
  name: 'update-state',
  defaults: { skippedVersion: null, lastCheckAt: 0 }
})

/** Parse a `1.2.3` / `v1.2.3` / `1.2.3-beta` tag into [major, minor, patch]. */
function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** True when `remote` is a strictly higher release than `local`. */
export function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote)
  const l = parseVersion(local)
  if (!r || !l) return false
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true
    if (r[i] < l[i]) return false
  }
  return false
}

interface LatestRelease {
  version: string
  url: string
  notes: string
}

interface GhRelease {
  tag_name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  body?: string
}

function toRelease(data: GhRelease): LatestRelease {
  return {
    version: data.tag_name as string,
    url: data.html_url || RELEASES_PAGE,
    notes: (data.body || '').trim()
  }
}

/**
 * Ask GitHub for the newest release. With `allowPrerelease`, we scan the releases
 * list and pick the highest-versioned non-draft (pre-releases included); otherwise
 * we use the stable `/releases/latest` endpoint. Null on any failure.
 */
async function fetchLatestRelease(allowPrerelease = false): Promise<LatestRelease | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
  try {
    const res = await fetch(allowPrerelease ? RELEASES_LIST_API : LATEST_RELEASE_API, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `SetRecord/${app.getVersion()}`
      }
    })
    if (!res.ok) return null
    const data = await res.json()
    if (allowPrerelease && Array.isArray(data)) {
      const top = (data as GhRelease[])
        .filter((d) => d && d.tag_name && !d.draft)
        .sort((a, b) => (isNewer(a.tag_name as string, b.tag_name as string) ? -1 : 1))[0]
      return top ? toRelease(top) : null
    }
    const single = data as GhRelease
    // Only offer finished, public releases — never drafts or pre-releases.
    if (!single.tag_name || single.draft || single.prerelease) return null
    return toRelease(single)
  } catch {
    // Offline, aborted (timeout), or rate-limited — all non-events. Stay silent.
    return null
  } finally {
    clearTimeout(timer)
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

async function promptUser(
  latest: LatestRelease,
  current: string,
  window?: BrowserWindow | null
): Promise<void> {
  const detail =
    `You're running ${current}. ${latest.version} is available to download.` +
    (latest.notes ? `\n\n${truncate(latest.notes, NOTES_MAX_CHARS)}` : '')

  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'Update available',
    message: `SetRecord ${latest.version} is available`,
    detail,
    buttons: ['Download', 'Remind Me Later', 'Skip This Version'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }

  const { response } =
    window && !window.isDestroyed()
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)

  if (response === 0) {
    await shell.openExternal(latest.url)
  } else if (response === 2) {
    store.set('skippedVersion', latest.version)
  }
  // response === 1 ("Remind Me Later"): do nothing; the daily throttle re-asks.
}

/**
 * Check GitHub for a newer release and, if found, prompt the user to download it.
 * Best-effort: skips in dev/unpackaged builds, throttled to once a day, and never
 * throws. Safe to fire-and-forget from startup with `void`.
 *
 * @param window optional parent window so the dialog attaches to the app.
 */
export async function checkForUpdatesAndNotify(window?: BrowserWindow | null): Promise<void> {
  // Dev runs and tests never "update" — only packaged installs do.
  if (!app.isPackaged) return

  const s = getSettings()
  // Honour the user's update preferences (Settings → Privacy & data).
  if (s.offlineMode || !s.updateAutoCheck || s.updateFrequency === 'manual') return

  const interval = s.updateFrequency === 'weekly' ? WEEK_MS : CHECK_INTERVAL_MS
  const now = Date.now()
  if (now - store.get('lastCheckAt') < interval) return

  const latest = await fetchLatestRelease(s.updatePreRelease)
  // Stamp the attempt regardless of outcome so a flaky network can't make us
  // hammer the API on every launch.
  store.set('lastCheckAt', now)
  if (!latest) return

  const current = app.getVersion()
  if (!isNewer(latest.version, current)) return
  if (store.get('skippedVersion') === latest.version) return

  await promptUser(latest, current, window)
}

/**
 * Manual "Check now" trigger (Settings → Privacy & data). Ignores the auto-check
 * and frequency throttle — and a prior "skip" — but still respects offline mode.
 * Returns a short status for renderer feedback. Never throws.
 */
export async function checkForUpdatesNow(
  window?: BrowserWindow | null
): Promise<'updated' | 'up-to-date' | 'offline' | 'unavailable'> {
  if (!app.isPackaged) return 'unavailable'
  if (getSettings().offlineMode) return 'offline'

  const latest = await fetchLatestRelease(getSettings().updatePreRelease)
  store.set('lastCheckAt', Date.now())
  if (!latest) return 'offline'

  const current = app.getVersion()
  if (!isNewer(latest.version, current)) return 'up-to-date'
  await promptUser(latest, current, window)
  return 'updated'
}
