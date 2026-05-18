/**
 * Resolves the YouTube Data API key.
 *
 * Priority (highest → lowest):
 *  1. User-supplied override in Settings (lets power users or devs use their own quota)
 *  2. SETSENSE_YT_API_KEY env var (set at build time for production distribution)
 *  3. Hard-coded app key below (populated before shipping — never commit a real key here)
 *
 * The key is only ever accessed in the Electron main process — it is never sent
 * to the renderer. Electron's contextBridge isolation ensures web content can't
 * read it directly, making this meaningfully safer than embedding it in a web app.
 */

import { getSettings } from '../settingsService'

// Populate this before shipping. In CI/CD, inject via SETSENSE_YT_API_KEY env var.
const EMBEDDED_KEY = ''

export function getApiKey(): string {
  // 1. User override in Settings takes absolute precedence
  const userKey = getSettings().youtubeApiKey
  if (userKey) return userKey

  // 2. Build-time env var (set via electron-builder extraMetadata or .env injection)
  const envKey = process.env.SETSENSE_YT_API_KEY ?? ''
  if (envKey) return envKey

  // 3. Embedded key (populated before shipping)
  return EMBEDDED_KEY
}
