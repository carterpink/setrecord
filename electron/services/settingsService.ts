import ElectronStore from 'electron-store'
import type { AppMode, CDJModel, ImportSource, LanguagePreference } from '../../src/types'

export interface AppSettings {
  targetHardware: CDJModel
  defaultBpmMin: number
  defaultBpmMax: number
  harmonicMixingDefault: boolean
  /**
   * UI language preference. `'system'` (the default) follows the OS locale on
   * launch; any other value pins the interface to that language. AI-generated
   * content is unaffected — it stays in whatever language the user types.
   */
  language: LanguagePreference
  learnModeEnabled: boolean
  hasSeenProficiencyAsk: boolean
  /**
   * The user self-identified as new to DJing during onboarding. Distinct from
   * `learnModeEnabled` (the Pro educational overlay): this gates the *free*
   * basic jargon explainers so beginners keep them after the trial lapses.
   */
  isBeginner: boolean
  /**
   * Set once the user finishes OR skips onboarding. Decouples "show onboarding"
   * from whether a library exists, so we never re-nag a returning user.
   */
  hasCompletedOnboarding: boolean
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
  /** One-time acknowledgement that SetRecord reads Rekordbox's database read-only. */
  rekordboxDbConsent: boolean
  /** Master toggle: when off, the Import flow skips detection and goes straight to XML picker. */
  autoDetectRekordbox: boolean
  /**
   * Opt-in anonymous crash reporting via Sentry.
   * Off by default. Never sends library contents, track titles, file paths, or personal data.
   * Changes take effect on the next app launch.
   */
  crashReportingEnabled: boolean
  /**
   * Opt-in to the Flight Recorder's lo-fi room-mic AUDIO capture while live. Off by
   * default: the auto-tracklist is always recorded, but capturing audio of the room
   * is privacy-sensitive and requires explicit consent. Local-only; never uploaded.
   */
  flightRecorderEnabled: boolean
  /**
   * EXPERIMENTAL — analyse the recorded room audio for per-track crowd reaction
   * (Black Box). Off by default and only meaningful when flightRecorderEnabled is
   * on. The DSP is validated on synthetic signals only; results are surfaced as
   * estimates with a confidence until a real-booth validation pass.
   */
  reactionCaptureEnabled: boolean
  // ── Display & motion ───────────────────────────────────────────────────────
  /** Key notation shown on track rows / chips. Source of truth (renderer keeps a fast cache). */
  keyNotation: 'camelot' | 'standard'
  /** Freeze decorative animation (aurora drift, etc.) for motion-sensitive users. */
  reducedMotion: boolean
  /** Which workspace SetRecord opens to. 'last' restores the previous session. */
  launchMode: 'last' | AppMode
  // ── Memory / input ─────────────────────────────────────────────────────────
  /** Enable the on-device push-to-talk voice input in the Home box. */
  voiceInputEnabled: boolean
  // ── Library / tagging ──────────────────────────────────────────────────────
  /** Allow the auto-tagger to generate plain-language tags. */
  autoTaggingEnabled: boolean
  /** Default route when writing tags back to Rekordbox. 'xml' never touches the live DB. */
  defaultTagExportRoute: 'xml' | 'native'
  // ── Updates / network ──────────────────────────────────────────────────────
  /** Check for new releases on launch. */
  updateAutoCheck: boolean
  /** How often to check when auto-check is on. */
  updateFrequency: 'daily' | 'weekly' | 'manual'
  /** Include pre-release builds when checking for updates. */
  updatePreRelease: boolean
  /** Block all outbound network (update checks, model self-download). */
  offlineMode: boolean
  // ── Playback ───────────────────────────────────────────────────────────────
  /** Max preview length in seconds before auto-stop. */
  previewMaxSeconds: number
  /** Default preview volume 0–1, restored each session. */
  previewVolume: number
  /** Short fade in/out on preview start/stop. */
  previewFade: boolean
  /** Audio output device id for previews. null = system default. Machine-specific. */
  outputDeviceId: string | null
  // ── Waveforms / export ─────────────────────────────────────────────────────
  /** Waveform render detail (bucket count). */
  waveformQuality: 'low' | 'standard' | 'high'
  /** Default format when opening the Export modal. 'ask' shows the chooser. */
  defaultExportFormat: 'engine' | 'beatport' | 'ask'
}

const DEFAULTS: AppSettings = {
  targetHardware: 'CDJ-2000NXS2',
  defaultBpmMin: 120,
  defaultBpmMax: 132,
  harmonicMixingDefault: true,
  language: 'system',
  learnModeEnabled: false,
  hasSeenProficiencyAsk: false,
  isBeginner: false,
  hasCompletedOnboarding: false,
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
  crashReportingEnabled: false,
  flightRecorderEnabled: false,
  reactionCaptureEnabled: false,
  keyNotation: 'camelot',
  reducedMotion: false,
  launchMode: 'last',
  voiceInputEnabled: true,
  autoTaggingEnabled: true,
  defaultTagExportRoute: 'xml',
  updateAutoCheck: true,
  updateFrequency: 'daily',
  updatePreRelease: false,
  offlineMode: false,
  previewMaxSeconds: 60,
  previewVolume: 1,
  previewFade: false,
  outputDeviceId: null,
  waveformQuality: 'standard',
  defaultExportFormat: 'ask'
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
    language: store.get('language') ?? 'system',
    learnModeEnabled: store.get('learnModeEnabled') ?? false,
    hasSeenProficiencyAsk: store.get('hasSeenProficiencyAsk') ?? false,
    isBeginner: store.get('isBeginner') ?? false,
    hasCompletedOnboarding: store.get('hasCompletedOnboarding') ?? false,
    memoryAiEnabled: store.get('memoryAiEnabled') ?? true,
    lastImportSource: store.get('lastImportSource') ?? null,
    lastImportPath: store.get('lastImportPath') ?? null,
    lastImportMtime: store.get('lastImportMtime') ?? null,
    lastImportAt: store.get('lastImportAt') ?? null,
    rekordboxDbConsent: store.get('rekordboxDbConsent') ?? false,
    autoDetectRekordbox: store.get('autoDetectRekordbox') ?? true,
    crashReportingEnabled: store.get('crashReportingEnabled') ?? false,
    flightRecorderEnabled: store.get('flightRecorderEnabled') ?? false,
    reactionCaptureEnabled: store.get('reactionCaptureEnabled') ?? false,
    keyNotation: store.get('keyNotation') ?? 'camelot',
    reducedMotion: store.get('reducedMotion') ?? false,
    launchMode: store.get('launchMode') ?? 'last',
    voiceInputEnabled: store.get('voiceInputEnabled') ?? true,
    autoTaggingEnabled: store.get('autoTaggingEnabled') ?? true,
    defaultTagExportRoute: store.get('defaultTagExportRoute') ?? 'xml',
    updateAutoCheck: store.get('updateAutoCheck') ?? true,
    updateFrequency: store.get('updateFrequency') ?? 'daily',
    updatePreRelease: store.get('updatePreRelease') ?? false,
    offlineMode: store.get('offlineMode') ?? false,
    previewMaxSeconds: store.get('previewMaxSeconds') ?? 60,
    previewVolume: store.get('previewVolume') ?? 1,
    previewFade: store.get('previewFade') ?? false,
    outputDeviceId: store.get('outputDeviceId') ?? null,
    waveformQuality: store.get('waveformQuality') ?? 'standard',
    defaultExportFormat: store.get('defaultExportFormat') ?? 'ask'
  }
}

/**
 * Settings that are machine-agnostic and safe to carry in a backup bundle.
 * Deliberately EXCLUDES path/import state (`lastImport*`), consent
 * (`rekordboxDbConsent`, `crashReportingEnabled`), and anything keychain-backed
 * (license/YouTube keys are per-machine credentials, never exported).
 */
export const PORTABLE_SETTINGS_KEYS = [
  'targetHardware',
  'defaultBpmMin',
  'defaultBpmMax',
  'harmonicMixingDefault',
  'language',
  'learnModeEnabled',
  'isBeginner',
  'memoryAiEnabled',
  'autoDetectRekordbox',
  'keyNotation',
  'reducedMotion',
  'launchMode',
  'voiceInputEnabled',
  'autoTaggingEnabled',
  'defaultTagExportRoute',
  'updateAutoCheck',
  'updateFrequency',
  'updatePreRelease',
  'previewMaxSeconds',
  'previewVolume',
  'previewFade',
  'waveformQuality',
  'defaultExportFormat'
] as const satisfies readonly (keyof AppSettings)[]

/** The whitelisted subset of settings for a backup bundle. */
export function getPortableSettings(): Partial<AppSettings> {
  const all = getSettings()
  const out: Partial<AppSettings> = {}
  for (const key of PORTABLE_SETTINGS_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(out as any)[key] = all[key]
  }
  return out
}

/**
 * Apply portable settings from a backup, FILL-ONLY: a value is written only if
 * the user hasn't explicitly set it on this machine. Never clobbers local config.
 */
export function applyPortableSettings(incoming: Partial<AppSettings> | undefined): void {
  if (!incoming) return
  for (const key of PORTABLE_SETTINGS_KEYS) {
    if (incoming[key] === undefined) continue
    if (store.has(key)) continue // respect the local choice
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.set(key, incoming[key] as any)
  }
}

/** The set of keys a caller may persist — every known AppSettings field. */
const SETTABLE_KEYS = Object.keys(DEFAULTS) as (keyof AppSettings)[]

export async function setSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  // Only write known keys (ignores any stray keys an IPC caller might include),
  // and only when the caller actually provided a value.
  for (const key of SETTABLE_KEYS) {
    const value = partial[key]
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.set(key, value as any)
    }
  }
  return getSettings()
}

/**
 * Wipe all settings back to DEFAULTS (Fresh Start). Uses the store's in-place
 * clear rather than deleting preferences.json, so the live process doesn't
 * rewrite a stale file before the app relaunches. Resetting `hasCompletedOnboarding`
 * to its default (false) is what re-arms the first-run onboarding flow.
 */
export function clearSettings(): void {
  store.clear()
}
