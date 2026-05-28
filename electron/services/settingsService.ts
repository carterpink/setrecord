import ElectronStore from 'electron-store'
import type { CDJModel, ImportSource } from '../../src/types'
import { getYoutubeApiKey, setYoutubeApiKey } from './secretStore'

export interface AppSettings {
  targetHardware: CDJModel
  defaultBpmMin: number
  defaultBpmMax: number
  harmonicMixingDefault: boolean
  youtubeApiKey: string
  favouriteArtists: string[]
  favouriteGenres: string[]
  followedDJs: string[]
  learnModeEnabled: boolean
  isPro: boolean
  hasSeenProficiencyAsk: boolean
  /** Opt-in to the bundled local LLM that powers natural-language Recall search. */
  memoryAiEnabled: boolean
  // ── Library source (Rekordbox auto-detect) ─────────────────────────────────
  /** Where the user's library was last loaded from. null = no import yet. */
  lastImportSource: ImportSource | null
  /** Absolute path to the source file (master.db or .xml) we last imported from. */
  lastImportPath: string | null
  /** Mtime (epoch ms) of the source file at import time — drives stale detection. */
  lastImportMtime: number | null
  /** ISO timestamp of when the last import completed. */
  lastImportAt: string | null
  /** One-time acknowledgement that SetSense reads Rekordbox's database read-only. */
  rekordboxDbConsent: boolean
  /** Master toggle: when off, the Import flow skips detection and goes straight to XML picker. */
  autoDetectRekordbox: boolean
}

// `youtubeApiKey` lives in the OS keychain, not electron-store — see secretStore.ts.
// Defaults here apply to everything else.
type PersistedSettings = Omit<AppSettings, 'youtubeApiKey'>

const DEFAULTS: PersistedSettings = {
  targetHardware: 'CDJ-2000NXS2',
  defaultBpmMin: 120,
  defaultBpmMax: 132,
  harmonicMixingDefault: true,
  favouriteArtists: [],
  favouriteGenres: [],
  followedDJs: [],
  learnModeEnabled: false,
  isPro: true,
  hasSeenProficiencyAsk: false,
  memoryAiEnabled: false,
  lastImportSource: null,
  lastImportPath: null,
  lastImportMtime: null,
  lastImportAt: null,
  rekordboxDbConsent: false,
  autoDetectRekordbox: true,
}

const store = new ElectronStore<PersistedSettings>({
  name: 'preferences',
  defaults: DEFAULTS,
})

export function getSettings(): AppSettings {
  return {
    targetHardware: store.get('targetHardware'),
    defaultBpmMin: store.get('defaultBpmMin'),
    defaultBpmMax: store.get('defaultBpmMax'),
    harmonicMixingDefault: store.get('harmonicMixingDefault'),
    youtubeApiKey: getYoutubeApiKey(),
    favouriteArtists: store.get('favouriteArtists') ?? [],
    favouriteGenres: store.get('favouriteGenres') ?? [],
    followedDJs: store.get('followedDJs') ?? [],
    learnModeEnabled: store.get('learnModeEnabled') ?? false,
    isPro: store.get('isPro') ?? true,
    hasSeenProficiencyAsk: store.get('hasSeenProficiencyAsk') ?? false,
    memoryAiEnabled: store.get('memoryAiEnabled') ?? false,
    lastImportSource: store.get('lastImportSource') ?? null,
    lastImportPath: store.get('lastImportPath') ?? null,
    lastImportMtime: store.get('lastImportMtime') ?? null,
    lastImportAt: store.get('lastImportAt') ?? null,
    rekordboxDbConsent: store.get('rekordboxDbConsent') ?? false,
    autoDetectRekordbox: store.get('autoDetectRekordbox') ?? true,
  }
}

export async function setSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  if (partial.targetHardware !== undefined) store.set('targetHardware', partial.targetHardware)
  if (partial.defaultBpmMin !== undefined) store.set('defaultBpmMin', partial.defaultBpmMin)
  if (partial.defaultBpmMax !== undefined) store.set('defaultBpmMax', partial.defaultBpmMax)
  if (partial.harmonicMixingDefault !== undefined) store.set('harmonicMixingDefault', partial.harmonicMixingDefault)
  if (partial.favouriteArtists !== undefined) store.set('favouriteArtists', partial.favouriteArtists)
  if (partial.favouriteGenres !== undefined) store.set('favouriteGenres', partial.favouriteGenres)
  if (partial.followedDJs !== undefined) store.set('followedDJs', partial.followedDJs)
  if (partial.learnModeEnabled !== undefined) store.set('learnModeEnabled', partial.learnModeEnabled)
  if (partial.isPro !== undefined) store.set('isPro', partial.isPro)
  if (partial.hasSeenProficiencyAsk !== undefined) store.set('hasSeenProficiencyAsk', partial.hasSeenProficiencyAsk)
  if (partial.memoryAiEnabled !== undefined) store.set('memoryAiEnabled', partial.memoryAiEnabled)
  if (partial.lastImportSource !== undefined) store.set('lastImportSource', partial.lastImportSource)
  if (partial.lastImportPath !== undefined) store.set('lastImportPath', partial.lastImportPath)
  if (partial.lastImportMtime !== undefined) store.set('lastImportMtime', partial.lastImportMtime)
  if (partial.lastImportAt !== undefined) store.set('lastImportAt', partial.lastImportAt)
  if (partial.rekordboxDbConsent !== undefined) store.set('rekordboxDbConsent', partial.rekordboxDbConsent)
  if (partial.autoDetectRekordbox !== undefined) store.set('autoDetectRekordbox', partial.autoDetectRekordbox)
  if (partial.youtubeApiKey !== undefined) {
    await setYoutubeApiKey(partial.youtubeApiKey)
  }
  return getSettings()
}
