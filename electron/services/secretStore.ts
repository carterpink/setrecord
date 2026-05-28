/**
 * Secrets — anything that should never sit in electron-store's plain-text JSON.
 *
 * Storage: the OS keychain via keytar (macOS Keychain on darwin).
 * Cache: keytar.getPassword is async; we read once at startup and keep a copy
 * in-memory so synchronous callers (e.g. discovery/apiKey.getApiKey()) stay sync.
 *
 * Migration: pre-keychain installs stored youtubeApiKey in electron-store. On
 * first launch after upgrade we copy it across and clear the plaintext value.
 */

import keytar from 'keytar'
import ElectronStore from 'electron-store'

const SERVICE = 'SetSense'
const YT_ACCOUNT = 'youtubeApiKey'

interface LegacyStore {
  youtubeApiKey?: string
}

const legacyStore = new ElectronStore<LegacyStore>({ name: 'preferences' })

let _youtubeApiKey = ''

export async function loadSecretsFromKeychain(): Promise<void> {
  try {
    const stored = await keytar.getPassword(SERVICE, YT_ACCOUNT)
    if (stored) {
      _youtubeApiKey = stored
    }
  } catch (err) {
    console.error('[secretStore] keychain read failed', err)
  }

  // One-shot migration from electron-store. The legacy value lived at
  // preferences.json:youtubeApiKey; copy across (only if keychain was empty)
  // and clear the plaintext entry either way.
  const legacy = legacyStore.get('youtubeApiKey')
  if (legacy) {
    if (!_youtubeApiKey) {
      try {
        await keytar.setPassword(SERVICE, YT_ACCOUNT, legacy)
        _youtubeApiKey = legacy
      } catch (err) {
        console.error('[secretStore] migration write failed', err)
      }
    }
    try {
      legacyStore.delete('youtubeApiKey')
    } catch (err) {
      console.error('[secretStore] legacy delete failed', err)
    }
  }
}

export function getYoutubeApiKey(): string {
  return _youtubeApiKey
}

export async function setYoutubeApiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  if (trimmed === '') {
    await clearYoutubeApiKey()
    return
  }
  await keytar.setPassword(SERVICE, YT_ACCOUNT, trimmed)
  _youtubeApiKey = trimmed
}

export async function clearYoutubeApiKey(): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE, YT_ACCOUNT)
  } catch (err) {
    console.error('[secretStore] keychain delete failed', err)
  }
  _youtubeApiKey = ''
}
