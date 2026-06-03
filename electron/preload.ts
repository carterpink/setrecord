import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LiveDataPayload } from './services/live/liveEngine'
import type {
  ExportResult as BackupExportResult,
  InspectResult as BackupInspectResult,
  ImportResult as BackupImportResult
} from './services/backupService'
import type {
  ArchitectParams,
  BeatportRow,
  CDJModel,
  ComboResult,
  Ecosystem,
  ExportResult,
  CrateWithCount,
  CuePoint,
  EnergySource,
  GemResult,
  HealthReport,
  HotCue,
  Loop,
  IdentitySnapshot,
  ImportResult,
  LifecycleCounts,
  ImportProgress,
  CheckoutPlan,
  LicenseActivationResult,
  LicenseState,
  LibraryFilters,
  LibrarySearchParams,
  PlaySession,
  SessionFilter,
  SessionMetadataPatch,
  SetSlot,
  VenueType,
  RecallAiStatus,
  RecallAskResult,
  RecallRoute,
  VoiceStatus,
  MicAccess,
  LibrarySourceId,
  PostImportProgress,
  RekordboxDetection,
  RekordboxStaleStatus,
  SourceDetection,
  RememberedUSBDevice,
  SessionTrack,
  Set as DJSet,
  SmartCrate,
  TagCategory,
  TagCoverage,
  RekordboxTagWriteResult,
  Track,
  TrackTag,
  USBCopyResult,
  USBDevice
} from '../src/types'

export interface EnergyProgress {
  processed: number
  total: number
  phase: 'analysing' | 'done'
}

export interface TagsProgress {
  processed: number
  total: number
  phase: 'tagging' | 'done'
}

export interface EnergyUpdate {
  trackId: string
  energy: number
  source: EnergySource
}

export interface ArtworkProgress {
  processed: number
  total: number
  phase: 'extracting' | 'done'
}

export interface ArtworkUpdate {
  trackId: string
  albumArtPath: string
}

export interface EngineExportProgress {
  processed: number
  total: number
  phase: 'copying' | 'writing' | 'done'
}
import type { AppSettings } from './services/settingsService'
import type { ProgressState, FirstEvent } from './services/progressService'

const setsense = {
  // ── Library ──────────────────────────────────────────────────────────────
  importLibrary: (xmlPath: string) => ipcRenderer.invoke('library:import', xmlPath),

  getLibrary: (filters?: LibraryFilters) => ipcRenderer.invoke('library:get-all', filters),

  getLibraryStats: () => ipcRenderer.invoke('library:get-stats'),

  countTracks: () => ipcRenderer.invoke('library:count'),

  getPlaylists: () => ipcRenderer.invoke('library:get-playlists'),

  // ── Progress events ───────────────────────────────────────────────────────
  onImportProgress: (cb: (p: ImportProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: ImportProgress): void => cb(p)
    ipcRenderer.on('library:import-progress', handler)
    return () => ipcRenderer.removeListener('library:import-progress', handler)
  },

  // ── Energy analysis (Phase 9) ─────────────────────────────────────────────
  onEnergyProgress: (cb: (p: EnergyProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: EnergyProgress): void => cb(p)
    ipcRenderer.on('library:energy-progress', handler)
    return () => ipcRenderer.removeListener('library:energy-progress', handler)
  },

  onEnergyUpdate: (cb: (u: EnergyUpdate) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, u: EnergyUpdate): void => cb(u)
    ipcRenderer.on('library:energy-update', handler)
    return () => ipcRenderer.removeListener('library:energy-update', handler)
  },

  // ── Album artwork extraction ──────────────────────────────────────────────
  onArtworkProgress: (cb: (p: ArtworkProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: ArtworkProgress): void => cb(p)
    ipcRenderer.on('library:artwork-progress', handler)
    return () => ipcRenderer.removeListener('library:artwork-progress', handler)
  },

  onArtworkUpdate: (cb: (u: ArtworkUpdate) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, u: ArtworkUpdate): void => cb(u)
    ipcRenderer.on('library:artwork-update', handler)
    return () => ipcRenderer.removeListener('library:artwork-update', handler)
  },

  // ── File system ───────────────────────────────────────────────────────────
  selectXmlFile: (): Promise<string | null> => ipcRenderer.invoke('fs:select-xml'),

  checkFileExists: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:file-exists', path),

  selectSaveLocation: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:select-save', defaultName),

  // ── Rekordbox auto-detect ────────────────────────────────────────────────
  detectRekordbox: (): Promise<RekordboxDetection> => ipcRenderer.invoke('rekordbox:detect'),

  importFromRekordboxDb: (path: string): Promise<ImportResult> =>
    ipcRenderer.invoke('rekordbox:import-db', path),

  checkRekordboxStale: (): Promise<RekordboxStaleStatus> =>
    ipcRenderer.invoke('rekordbox:check-stale'),

  // ── Cross-platform import sources (Rekordbox / Serato / Engine DJ) ─────────
  detectImportSources: (): Promise<SourceDetection[]> =>
    ipcRenderer.invoke('import:detect-sources'),

  /** Import any `payload`-routed source (Serato, Engine DJ). Rekordbox uses its own flow. */
  runImport: (sourceId: LibrarySourceId, libraryPath: string): Promise<ImportResult> =>
    ipcRenderer.invoke('import:run', sourceId, libraryPath),

  onPostImportProgress: (cb: (p: PostImportProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: PostImportProgress): void => cb(p)
    ipcRenderer.on('library:post-import-progress', handler)
    return () => ipcRenderer.removeListener('library:post-import-progress', handler)
  },

  // ── Sets (Phase 3) ────────────────────────────────────────────────────────
  getSets: (): Promise<DJSet[]> => ipcRenderer.invoke('sets:get-all'),

  getSet: (id: string): Promise<DJSet | null> => ipcRenderer.invoke('sets:get', id),

  saveSet: (set: DJSet): Promise<DJSet | null> => ipcRenderer.invoke('sets:save', set),

  deleteSet: (id: string): Promise<void> => ipcRenderer.invoke('sets:delete', id),

  // ── Algorithms (Phase 4-5) ────────────────────────────────────────────────
  getSuggestions: (
    trackId: string,
    setId: string,
    count: number,
    excludeIds: string[] = [],
    sourcePlaylistIds: string[] = []
  ) => ipcRenderer.invoke('algo:suggestions', trackId, setId, count, excludeIds, sourcePlaylistIds),

  scoreTransition: (fromId: string, toId: string) =>
    ipcRenderer.invoke('algo:score-transition', fromId, toId),

  buildSet: (params: ArchitectParams) => ipcRenderer.invoke('algo:build-set', params),

  genreProfiles: (sourcePlaylistIds: string[] = []) =>
    ipcRenderer.invoke('algo:genre-profiles', sourcePlaylistIds),

  validateForExport: (setId: string, hardware: CDJModel, ecosystem: Ecosystem = 'pioneer') =>
    ipcRenderer.invoke('algo:validate', setId, hardware, ecosystem),

  // Gig-ready Engine DJ (Denon) USB export — copies audio + writes the Engine Library.
  exportSetToEngineUsb: (setId: string, mountPath: string): Promise<ExportResult> =>
    ipcRenderer.invoke('export:engine-usb', setId, mountPath),

  onEngineExportProgress: (cb: (p: EngineExportProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: EngineExportProgress): void => cb(p)
    ipcRenderer.on('library:engine-export-progress', handler)
    return () => ipcRenderer.removeListener('library:engine-export-progress', handler)
  },

  // ── File health (Phase 6) ─────────────────────────────────────────────────
  triggerHealthCheck: (): Promise<void> => ipcRenderer.invoke('library:health-check'),

  analyseEnergy: (): Promise<{ running: boolean }> => ipcRenderer.invoke('library:analyse-energy'),

  energyPendingCount: (): Promise<number> => ipcRenderer.invoke('library:energy-pending-count'),

  onFileStatusUpdate: (
    cb: (changes: Array<{ id: string; missing: boolean }>) => void
  ): (() => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      changes: Array<{ id: string; missing: boolean }>
    ): void => cb(changes)
    ipcRenderer.on('library:file-status', handler)
    return () => ipcRenderer.removeListener('library:file-status', handler)
  },

  // ── Cue points (Phase 6) ─────────────────────────────────────────────────
  updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]): Promise<void> =>
    ipcRenderer.invoke('cues:update', trackId, cuePoints, hotCues),

  updateTrackBeatgrid: (trackId: string, bpm: number, beatgridOffset: number): Promise<void> =>
    ipcRenderer.invoke('beatgrid:update', trackId, bpm, beatgridOffset),

  updateTrackLoops: (trackId: string, loops: Loop[]): Promise<void> =>
    ipcRenderer.invoke('loops:update', trackId, loops),

  setTrackEnergy: (trackId: string, energy: number): Promise<void> =>
    ipcRenderer.invoke('track:set-energy', trackId, energy),

  updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }): Promise<void> =>
    ipcRenderer.invoke('library:update-track-meta', trackId, fields),

  relinkTrackFile: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke('library:relink-file', trackId),

  // ── Auto-tags ─────────────────────────────────────────────────────────────
  tagsCoverage: (): Promise<TagCoverage> => ipcRenderer.invoke('tags:coverage'),

  tagsForTrack: (trackId: string): Promise<TrackTag[]> =>
    ipcRenderer.invoke('tags:for-track', trackId),

  tagsRetag: (): Promise<{ running: boolean }> => ipcRenderer.invoke('tags:retag'),

  tagsSetOverride: (
    trackId: string,
    category: TagCategory,
    values: string[]
  ): Promise<TrackTag[] | null> =>
    ipcRenderer.invoke('tags:set-override', trackId, category, values),

  tagsResetToAuto: (trackId: string, category?: TagCategory): Promise<TrackTag[] | null> =>
    ipcRenderer.invoke('tags:reset', trackId, category),

  tagsExportXml: (): Promise<{
    success: boolean
    filePath?: string
    trackCount?: number
    error?: string
  }> => ipcRenderer.invoke('tags:export-xml'),

  tagsWriteMyTags: (): Promise<RekordboxTagWriteResult> => ipcRenderer.invoke('tags:write-mytags'),

  onTagsProgress: (cb: (p: TagsProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: TagsProgress): void => cb(p)
    ipcRenderer.on('library:tags-progress', handler)
    return () => ipcRenderer.removeListener('library:tags-progress', handler)
  },

  // ── Audio raw bytes for waveform decoding ────────────────────────────────
  readAudioFile: (filePath: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('audio:read-file', filePath),

  // ── Export (Phase 7) ──────────────────────────────────────────────────────
  exportSet: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('export:set', setId, hardware),

  exportBeatportCsv: (setName: string, rows: BeatportRow[]): Promise<ExportResult | null> =>
    ipcRenderer.invoke('beatport:export-csv', setName, rows),

  // ── Settings (Phase 8) ────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,

  setSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:set', partial) as Promise<AppSettings>,

  // ── Backup & migration ─────────────────────────────────────────────────────
  backupExport: (passphrase?: string): Promise<BackupExportResult> =>
    ipcRenderer.invoke('backup:export', passphrase),
  backupPick: (): Promise<string | null> => ipcRenderer.invoke('backup:pick'),
  backupInspect: (filePath: string, passphrase?: string): Promise<BackupInspectResult> =>
    ipcRenderer.invoke('backup:inspect', filePath, passphrase),
  backupImport: (
    filePath: string,
    mode: 'restore' | 'merge',
    passphrase?: string
  ): Promise<BackupImportResult> => ipcRenderer.invoke('backup:import', filePath, mode, passphrase),

  // ── Retention / activation progress (brief #22, Phase B) ───────────────────
  progressGet: () => ipcRenderer.invoke('progress:get') as Promise<ProgressState>,
  progressSet: (partial: Partial<ProgressState>) =>
    ipcRenderer.invoke('progress:set', partial) as Promise<ProgressState>,
  progressMarkFirst: (event: FirstEvent) =>
    ipcRenderer.invoke('progress:markFirst', event) as Promise<ProgressState>,
  progressClaimMilestone: (id: string) =>
    ipcRenderer.invoke('progress:claimMilestone', id) as Promise<boolean>,
  progressRecordActivity: () =>
    ipcRenderer.invoke('progress:recordActivity') as Promise<ProgressState>,

  // ── Licensing / SetSense Pro (Section 16) ──────────────────────────────────
  licenseGet: (): Promise<LicenseState> => ipcRenderer.invoke('license:get'),

  licenseActivate: (key: string): Promise<LicenseActivationResult> =>
    ipcRenderer.invoke('license:activate', key),

  licenseDeactivate: (): Promise<LicenseState> => ipcRenderer.invoke('license:deactivate'),

  licenseRefresh: (): Promise<LicenseState> => ipcRenderer.invoke('license:refresh'),

  licenseCheckout: (plan: CheckoutPlan, tipAmount?: number): Promise<boolean> =>
    ipcRenderer.invoke('license:checkout', plan, tipAmount),

  // Deep-link activation (setsense://activate?key=…). Called once on mount to
  // drain any key buffered during cold start.
  licenseConsumePendingActivation: (): Promise<string | null> =>
    ipcRenderer.invoke('license:consume-pending-activation'),

  // Live deep-links that arrive while the app is already running.
  onLicenseActivateDeepLink: (cb: (key: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, key: string): void => cb(key)
    ipcRenderer.on('license:activate-deeplink', handler)
    return () => ipcRenderer.removeListener('license:activate-deeplink', handler)
  },

  // ── Customer feedback ─────────────────────────────────────────────────────
  submitFeedback: (payload: {
    category: string
    rating: number
    message: string
    email?: string
    meta?: string
  }): Promise<boolean> => ipcRenderer.invoke('feedback:submit', payload),

  // ── USB Detection (Phase 9) ───────────────────────────────────────────────
  usbList: (): Promise<USBDevice[]> => ipcRenderer.invoke('usb:list'),

  usbGetRemembered: (): Promise<RememberedUSBDevice[]> => ipcRenderer.invoke('usb:get-remembered'),

  usbUpdatePrefs: (
    id: string,
    prefs: {
      customName?: string | null
      isFavorite?: boolean
      isExportTarget?: boolean
      readSpeedMBps?: number
      writeSpeedMBps?: number
      speedTestedAt?: string
    }
  ): Promise<void> => ipcRenderer.invoke('usb:update-prefs', id, prefs),

  usbTestSpeed: (mountPath: string): Promise<{ readMBps: number; writeMBps: number } | null> =>
    ipcRenderer.invoke('usb:test-speed', mountPath),

  usbRecordExport: (id: string): Promise<void> => ipcRenderer.invoke('usb:record-export', id),

  usbForget: (id: string): Promise<void> => ipcRenderer.invoke('usb:forget', id),

  usbCopyToUSB: (srcPath: string, mountPath: string, filename: string): Promise<USBCopyResult> =>
    ipcRenderer.invoke('usb:copy-to-usb', srcPath, mountPath, filename),

  onUsbDevicesChanged: (cb: (devices: USBDevice[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, devices: USBDevice[]): void => cb(devices)
    ipcRenderer.on('usb:devices-changed', handler)
    return () => ipcRenderer.removeListener('usb:devices-changed', handler)
  },

  // ── Play history (Phase 11) ────────────────────────────────────────────────
  historySessions: (): Promise<PlaySession[]> => ipcRenderer.invoke('history:get-sessions'),

  historySessionTracks: (sessionId: string): Promise<SessionTrack[]> =>
    ipcRenderer.invoke('history:get-session-tracks', sessionId),

  historyForTrack: (trackId: string): Promise<PlaySession[]> =>
    ipcRenderer.invoke('history:get-for-track', trackId),

  historyQuerySessions: (filter: SessionFilter = {}): Promise<PlaySession[]> =>
    ipcRenderer.invoke('history:query-sessions', filter),

  historyUpdateSession: (sessionId: string, patch: SessionMetadataPatch): Promise<void> =>
    ipcRenderer.invoke('history:update-session', sessionId, patch),

  historyBulkAssign: (filter: SessionFilter, patch: SessionMetadataPatch): Promise<number> =>
    ipcRenderer.invoke('history:bulk-assign', filter, patch),

  historyMarkPerformed: (
    setId: string,
    opts?: {
      performedAt?: string
      venue?: string
      eventType?: VenueType
      city?: string
      country?: string
      setSlot?: SetSlot
    }
  ): Promise<string | null> => ipcRenderer.invoke('history:mark-performed', setId, opts ?? {}),

  historyDelete: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('history:delete', sessionId),

  historyImportFile: (): Promise<{ sessions: number; tracks: number }> =>
    ipcRenderer.invoke('history:import-file'),

  setTrackLifecycle: (
    trackId: string,
    state: string | null,
    source: 'computed' | 'user'
  ): Promise<void> => ipcRenderer.invoke('track:set-lifecycle', trackId, state, source),

  // ── Lifecycle: flag-for-gig loop ───────────────────────────────────────────
  lifecycleFlagForGig: (trackIds: string[]): Promise<void> =>
    ipcRenderer.invoke('lifecycle:flag-for-gig', trackIds),

  lifecycleResolveGigFlag: (
    trackId: string,
    outcome: 'tested' | 'archive' | 'keep'
  ): Promise<void> => ipcRenderer.invoke('lifecycle:resolve-gig-flag', trackId, outcome),

  lifecycleGetFlagged: (): Promise<Track[]> => ipcRenderer.invoke('lifecycle:get-flagged'),

  lifecycleFlaggedInSession: (sessionId: string): Promise<Track[]> =>
    ipcRenderer.invoke('lifecycle:flagged-in-session', sessionId),

  // ── Recall / memory engine (Phase 12) ──────────────────────────────────────
  recallGems: (): Promise<GemResult[]> => ipcRenderer.invoke('recall:gems'),

  recallCrates: (): Promise<CrateWithCount[]> => ipcRenderer.invoke('recall:crates'),

  recallEvaluateCrate: (idOrCrate: string | SmartCrate): Promise<Track[]> =>
    ipcRenderer.invoke('recall:evaluate-crate', idOrCrate),

  recallSaveCrate: (crate: SmartCrate): Promise<void> =>
    ipcRenderer.invoke('recall:save-crate', crate),

  recallDeleteCrate: (id: string): Promise<void> => ipcRenderer.invoke('recall:delete-crate', id),

  recallLifecycle: (): Promise<LifecycleCounts> => ipcRenderer.invoke('recall:lifecycle'),

  recallCombos: (trackId: string): Promise<ComboResult[]> =>
    ipcRenderer.invoke('recall:combos', trackId),

  recallSequences: (): Promise<{ trackIds: string[]; tracks: Track[]; count: number }[]> =>
    ipcRenderer.invoke('recall:sequences'),

  recallDeadEnds: (): Promise<ComboResult[]> => ipcRenderer.invoke('recall:dead-ends'),

  recallIdentity: (): Promise<IdentitySnapshot> => ipcRenderer.invoke('recall:identity'),

  recallHealth: (): Promise<HealthReport> => ipcRenderer.invoke('recall:health'),

  recallDismissDuplicate: (normalisedKey: string): Promise<void> =>
    ipcRenderer.invoke('recall:dismiss-duplicate', normalisedKey),

  recallResolveDuplicateGroup: (normalisedKey: string, archiveIds: string[]): Promise<void> =>
    ipcRenderer.invoke('recall:resolve-duplicate-group', normalisedKey, archiveIds),

  recallSearch: (params: LibrarySearchParams): Promise<Track[]> =>
    ipcRenderer.invoke('recall:search', params),

  // ── Recall local-AI layer (Phase 13) ───────────────────────────────────────
  recallAiStatus: (): Promise<RecallAiStatus> => ipcRenderer.invoke('recall:ai-status'),

  recallAiEnable: (enabled: boolean): Promise<RecallAiStatus> =>
    ipcRenderer.invoke('recall:ai-enable', enabled),

  recallAiAsk: (question: string): Promise<RecallAskResult> =>
    ipcRenderer.invoke('recall:ai-ask', question),

  recallAiRoute: (question: string, contextJson?: string): Promise<RecallRoute> =>
    ipcRenderer.invoke('recall:ai-route', question, contextJson),

  recallSimilar: (trackId: string, count?: number): Promise<Track[]> =>
    ipcRenderer.invoke('recall:similar', trackId, count),

  recallEnds: (): Promise<{ openers: ComboResult[]; closers: ComboResult[] }> =>
    ipcRenderer.invoke('recall:ends'),

  onRecallAiProgress: (cb: (s: RecallAiStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: RecallAiStatus): void => cb(s)
    ipcRenderer.on('recall:ai-progress', handler)
    return () => ipcRenderer.removeListener('recall:ai-progress', handler)
  },

  // ── On-device voice ────────────────────────────────────────────────────────
  speechVoiceStatus: (): Promise<VoiceStatus> => ipcRenderer.invoke('speech:voice-status'),

  speechTranscribe: (pcm: Float32Array): Promise<string> =>
    ipcRenderer.invoke('speech:transcribe', pcm),

  speechEnsureMicAccess: (): Promise<MicAccess> => ipcRenderer.invoke('speech:ensure-mic-access'),

  speechPrepareVoice: (): Promise<VoiceStatus> => ipcRenderer.invoke('speech:prepare'),

  onVoiceProgress: (cb: (s: VoiceStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: VoiceStatus): void => cb(s)
    ipcRenderer.on('speech:voice-progress', handler)
    return () => ipcRenderer.removeListener('speech:voice-progress', handler)
  },

  // ── SetSense Live overlay ────────────────────────────────────────────────
  liveStart: (): Promise<void> => ipcRenderer.invoke('live:start'),
  liveStop: (): Promise<void> => ipcRenderer.invoke('live:stop'),
  /** Toggle overlay click-through (false = capture clicks over glass chrome). */
  liveSetIgnoreMouse: (ignore: boolean): void => ipcRenderer.send('live:set-ignore-mouse', ignore),
  /** Fires when the overlay window closes (e.g. its own End button). */
  onLiveOverlayClosed: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('live:overlay-closed', handler)
    return () => ipcRenderer.removeListener('live:overlay-closed', handler)
  },
  /** Captured probe window (mono f32 @ 22.05k) → main for identification. */
  liveAudioWindow: (samples: Float32Array): void => ipcRenderer.send('live:audio-window', samples),
  /** OCR'd text lines from the screen → main matches them to the library. */
  liveScreenText: (lines: string[]): void => ipcRenderer.send('live:screen-text', lines),
  /** Overlay subscribes to live deck data pushed by the engine. */
  onLiveData: (cb: (data: LiveDataPayload) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, d: LiveDataPayload): void => cb(d)
    ipcRenderer.on('live:data', handler)
    return () => ipcRenderer.removeListener('live:data', handler)
  },
  /** Index-build progress (main window + overlay). */
  onLiveIndexProgress: (cb: (p: { done: number; total: number }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: { done: number; total: number }): void =>
      cb(p)
    ipcRenderer.on('live:index-progress', handler)
    return () => ipcRenderer.removeListener('live:index-progress', handler)
  },
  /** Overlay subscribes: index ready → start listening. */
  onLiveReady: (cb: (s: { indexedTracks: number }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: { indexedTracks: number }): void => cb(s)
    ipcRenderer.on('live:ready', handler)
    return () => ipcRenderer.removeListener('live:ready', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('setsense', setsense)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error declared in preload.d.ts
  window.electron = electronAPI
  // @ts-expect-error declared in preload.d.ts
  window.setsense = setsense
}
