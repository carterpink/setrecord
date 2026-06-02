import ElectronStore from 'electron-store'
import type { CDJModel, ImportSource } from '../../src/types'

export interface AppSettings {
  targetHardware: CDJModel
  defaultBpmMin: number
  defaultBpmMax: number
  harmonicMixingDefault: boolean
  learnModeEnabled: boolean
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
  /**
   * Opt-in anonymous crash reporting via Sentry.
   * Off by default. Never sends library contents, track titles, file paths, or personal data.
   * Changes take effect on the next app launch.
   */
  crashReportingEnabled: boolean
}

const DEFAULTS: AppSettings = {
  targetHardware: 'CDJ-2000NXS2',
  defaultBpmMin: 120,
  defaultBpmMax: 132,
  harmonicMixingDefault: true,
  learnModeEnabled: false,
  hasSeenProficiencyAsk: false,
  // The language model ships in the app bundle, so extended understanding is on
  // by default — there's no download to gate it behind. Users can still turn it
  // off to skip loading the model into memory.
  memoryAiEnabled: true,
  lastImportSource: null,
  lastImportPath: null,
  lastImportMtime: null,
  lastImportAt: null,
  rekordboxDbConsent: false,
  autoDetectRekordbox: true,
  crashReportingEnabled: false
}

const store = new ElectronStore<AppSettings>({
  name: 'preferences',
  defaults: DEFAULTS
})

export function getSettings(): AppSettings {
  return {
    targetHardware: store.get('targetHardware'),
    defaultBpmMin: store.get('defaultBpmMin'),
    defaultBpmMax: store.get('defaultBpmMax'),
    harmonicMixingDefault: store.get('harmonicMixingDefault'),
    learnModeEnabled: store.get('learnModeEnabled') ?? false,
    hasSeenProficiencyAsk: store.get('hasSeenProficiencyAsk') ?? false,
    memoryAiEnabled: store.get('memoryAiEnabled') ?? true,
    lastImportSource: store.get('lastImportSource') ?? null,
    lastImportPath: store.get('lastImportPath') ?? null,
    lastImportMtime: store.get('lastImportMtime') ?? null,
    lastImportAt: store.get('lastImportAt') ?? null,
    rekordboxDbConsent: store.get('rekordboxDbConsent') ?? false,
    autoDetectRekordbox: store.get('autoDetectRekordbox') ?? true,
    crashReportingEnabled: store.get('crashReportingEnabled') ?? false
  }
}

export async function setSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  if (partial.targetHardware !== undefined) store.set('targetHardware', partial.targetHardware)
  if (partial.defaultBpmMin !== undefined) store.set('defaultBpmMin', partial.defaultBpmMin)
  if (partial.defaultBpmMax !== undefined) store.set('defaultBpmMax', partial.defaultBpmMax)
  if (partial.harmonicMixingDefault !== undefined)
    store.set('harmonicMixingDefault', partial.harmonicMixingDefault)
  if (partial.learnModeEnabled !== undefined)
    store.set('learnModeEnabled', partial.learnModeEnabled)
  if (partial.hasSeenProficiencyAsk !== undefined)
    store.set('hasSeenProficiencyAsk', partial.hasSeenProficiencyAsk)
  if (partial.memoryAiEnabled !== undefined) store.set('memoryAiEnabled', partial.memoryAiEnabled)
  if (partial.lastImportSource !== undefined)
    store.set('lastImportSource', partial.lastImportSource)
  if (partial.lastImportPath !== undefined) store.set('lastImportPath', partial.lastImportPath)
  if (partial.lastImportMtime !== undefined) store.set('lastImportMtime', partial.lastImportMtime)
  if (partial.lastImportAt !== undefined) store.set('lastImportAt', partial.lastImportAt)
  if (partial.rekordboxDbConsent !== undefined)
    store.set('rekordboxDbConsent', partial.rekordboxDbConsent)
  if (partial.autoDetectRekordbox !== undefined)
    store.set('autoDetectRekordbox', partial.autoDetectRekordbox)
  if (partial.crashReportingEnabled !== undefined)
    store.set('crashReportingEnabled', partial.crashReportingEnabled)
  return getSettings()
}
