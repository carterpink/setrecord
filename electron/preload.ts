import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ArchitectParams,
  CDJModel,
  CuePoint,
  DiscoverSet,
  EnergySource,
  HotCue,
  ImportProgress,
  LibraryFilters,
  RememberedUSBDevice,
  Set as DJSet,
  TasteProfile,
  USBCopyResult,
  USBDevice,
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
import type { AppSettings } from './services/settingsService'

const setsense = {
  // ── Library ──────────────────────────────────────────────────────────────
  importLibrary: (xmlPath: string) =>
    ipcRenderer.invoke('library:import', xmlPath),

  getLibrary: (filters?: LibraryFilters) =>
    ipcRenderer.invoke('library:get-all', filters),

  getLibraryStats: () =>
    ipcRenderer.invoke('library:get-stats'),

  countTracks: () =>
    ipcRenderer.invoke('library:count'),

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

  // ── File system ───────────────────────────────────────────────────────────
  selectXmlFile: (): Promise<string | null> =>
    ipcRenderer.invoke('fs:select-xml'),

  checkFileExists: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:file-exists', path),

  selectSaveLocation: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:select-save', defaultName),

  // ── Sets (Phase 3) ────────────────────────────────────────────────────────
  getSets: (): Promise<DJSet[]> =>
    ipcRenderer.invoke('sets:get-all'),

  getSet: (id: string): Promise<DJSet | null> =>
    ipcRenderer.invoke('sets:get', id),

  saveSet: (set: DJSet): Promise<DJSet | null> =>
    ipcRenderer.invoke('sets:save', set),

  deleteSet: (id: string): Promise<void> =>
    ipcRenderer.invoke('sets:delete', id),

  // ── Algorithms (Phase 4-5) ────────────────────────────────────────────────
  getSuggestions: (trackId: string, setId: string, count: number, excludeIds: string[] = []) =>
    ipcRenderer.invoke('algo:suggestions', trackId, setId, count, excludeIds),

  scoreTransition: (fromId: string, toId: string) =>
    ipcRenderer.invoke('algo:score-transition', fromId, toId),

  buildSet: (params: ArchitectParams) =>
    ipcRenderer.invoke('algo:build-set', params),

  validateForExport: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('algo:validate', setId, hardware),

  // ── File health (Phase 6) ─────────────────────────────────────────────────
  triggerHealthCheck: (): Promise<void> =>
    ipcRenderer.invoke('library:health-check'),

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

  // ── Audio raw bytes for waveform decoding ────────────────────────────────
  readAudioFile: (filePath: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('audio:read-file', filePath),

  // ── Export (Phase 7) ──────────────────────────────────────────────────────
  exportSet: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('export:set', setId, hardware),

  // ── Settings (Phase 8) ────────────────────────────────────────────────────
  getSettings: () =>
    ipcRenderer.invoke('settings:get') as Promise<AppSettings>,

  setSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:set', partial) as Promise<AppSettings>,

  // ── Shell (Discover) ──────────────────────────────────────────────────────
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:open-external', url),

  // ── USB Detection (Phase 9) ───────────────────────────────────────────────
  usbList: (): Promise<USBDevice[]> =>
    ipcRenderer.invoke('usb:list'),

  usbGetRemembered: (): Promise<RememberedUSBDevice[]> =>
    ipcRenderer.invoke('usb:get-remembered'),

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

  usbTestSpeed: (
    mountPath: string
  ): Promise<{ readMBps: number; writeMBps: number } | null> =>
    ipcRenderer.invoke('usb:test-speed', mountPath),

  usbRecordExport: (id: string): Promise<void> =>
    ipcRenderer.invoke('usb:record-export', id),

  usbForget: (id: string): Promise<void> =>
    ipcRenderer.invoke('usb:forget', id),

  usbCopyToUSB: (
    srcPath: string,
    mountPath: string,
    filename: string
  ): Promise<USBCopyResult> =>
    ipcRenderer.invoke('usb:copy-to-usb', srcPath, mountPath, filename),

  onUsbDevicesChanged: (cb: (devices: USBDevice[]) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, devices: USBDevice[]): void => cb(devices)
    ipcRenderer.on('usb:devices-changed', handler)
    return () => ipcRenderer.removeListener('usb:devices-changed', handler)
  },

  // ── Discovery (Phase 2) ───────────────────────────────────────────────────
  discoverBrowse: (
    tasteProfile: TasteProfile,
    opts?: { genres?: string[]; pageToken?: string | null; forceRefresh?: boolean; pageSize?: number },
  ): Promise<{ sets: DiscoverSet[]; nextPageToken: string | null; hasMore: boolean; error?: { code: string; message: string } }> =>
    ipcRenderer.invoke('discover:browse', tasteProfile, opts ?? {}),

  discoverGetTracklist: (
    videoId: string,
  ): Promise<{ tracklist: import('../src/types').DiscoverTrack[]; confidence: number; source: string } | null> =>
    ipcRenderer.invoke('discover:get-tracklist', videoId),

  discoverRefreshSet: (
    videoId: string,
    tasteProfile: TasteProfile,
  ): Promise<DiscoverSet | null> =>
    ipcRenderer.invoke('discover:refresh-set', videoId, tasteProfile),
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
