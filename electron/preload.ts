import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ArchitectParams,
  CDJModel,
  ComboResult,
  CrateWithCount,
  CuePoint,
  DiscoverSet,
  EnergySource,
  GemResult,
  HealthReport,
  HotCue,
  IdentitySnapshot,
  ImportResult,
  LifecycleCounts,
  ImportProgress,
  LibraryFilters,
  LibrarySearchParams,
  PlaySession,
  RecallAiStatus,
  RecallAskResult,
  RekordboxDetection,
  RekordboxStaleStatus,
  RememberedUSBDevice,
  SessionTrack,
  Set as DJSet,
  SmartCrate,
  TasteProfile,
  Track,
  USBCopyResult,
  USBDevice
} from '../src/types'

export interface EnergyProgress {
  processed: number
  total: number
  phase: 'analysing' | 'done'
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
import type { AppSettings } from './services/settingsService'
import type { ValidateApiKeyResult } from './services/discovery/youtubeClient'

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

  validateForExport: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('algo:validate', setId, hardware),

  // ── File health (Phase 6) ─────────────────────────────────────────────────
  triggerHealthCheck: (): Promise<void> => ipcRenderer.invoke('library:health-check'),

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

  setTrackEnergy: (trackId: string, energy: number): Promise<void> =>
    ipcRenderer.invoke('track:set-energy', trackId, energy),

  updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }): Promise<void> =>
    ipcRenderer.invoke('library:update-track-meta', trackId, fields),

  relinkTrackFile: (trackId: string): Promise<string | null> =>
    ipcRenderer.invoke('library:relink-file', trackId),

  // ── Audio raw bytes for waveform decoding ────────────────────────────────
  readAudioFile: (filePath: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('audio:read-file', filePath),

  // ── Export (Phase 7) ──────────────────────────────────────────────────────
  exportSet: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('export:set', setId, hardware),

  // ── Settings (Phase 8) ────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,

  setSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:set', partial) as Promise<AppSettings>,

  validateYoutubeApiKey: (key: string) =>
    ipcRenderer.invoke('settings:validate-youtube-key', key) as Promise<ValidateApiKeyResult>,

  // ── Shell (Discover) ──────────────────────────────────────────────────────
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:open-external', url),

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

  // ── Discovery (Phase 2) ───────────────────────────────────────────────────
  discoverBrowse: (
    tasteProfile: TasteProfile,
    opts?: {
      genres?: string[]
      pageToken?: string | null
      forceRefresh?: boolean
      pageSize?: number
    }
  ): Promise<{
    sets: DiscoverSet[]
    nextPageToken: string | null
    hasMore: boolean
    error?: { code: string; message: string }
  }> => ipcRenderer.invoke('discover:browse', tasteProfile, opts ?? {}),

  discoverGetTracklist: (
    videoId: string
  ): Promise<{
    tracklist: import('../src/types').DiscoverTrack[]
    confidence: number
    source: string
  } | null> => ipcRenderer.invoke('discover:get-tracklist', videoId),

  discoverRefreshSet: (videoId: string, tasteProfile: TasteProfile): Promise<DiscoverSet | null> =>
    ipcRenderer.invoke('discover:refresh-set', videoId, tasteProfile),

  // ── Play history (Phase 11) ────────────────────────────────────────────────
  historySessions: (): Promise<PlaySession[]> => ipcRenderer.invoke('history:get-sessions'),

  historySessionTracks: (sessionId: string): Promise<SessionTrack[]> =>
    ipcRenderer.invoke('history:get-session-tracks', sessionId),

  historyForTrack: (trackId: string): Promise<PlaySession[]> =>
    ipcRenderer.invoke('history:get-for-track', trackId),

  historyMarkPerformed: (
    setId: string,
    opts?: { performedAt?: string; venue?: string }
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

  recallSearch: (params: LibrarySearchParams): Promise<Track[]> =>
    ipcRenderer.invoke('recall:search', params),

  // ── Recall local-AI layer (Phase 13) ───────────────────────────────────────
  recallAiStatus: (): Promise<RecallAiStatus> => ipcRenderer.invoke('recall:ai-status'),

  recallAiEnable: (enabled: boolean): Promise<RecallAiStatus> =>
    ipcRenderer.invoke('recall:ai-enable', enabled),

  recallAiAsk: (question: string): Promise<RecallAskResult> =>
    ipcRenderer.invoke('recall:ai-ask', question),

  onRecallAiProgress: (cb: (s: RecallAiStatus) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: RecallAiStatus): void => cb(s)
    ipcRenderer.on('recall:ai-progress', handler)
    return () => ipcRenderer.removeListener('recall:ai-progress', handler)
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
