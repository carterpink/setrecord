import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ArchitectParams,
  CDJModel,
  CuePoint,
  DiscoverSet,
  EnergySource,
  HotCue,
  ImportProgress,
  ImportResult,
  LibraryFilters,
  LibraryStats,
  RememberedUSBDevice,
  Set as DJSet,
  SetTrack,
  TasteProfile,
  Track,
  TransitionScore,
  Suggestion,
  USBCopyResult,
  USBDevice,
  ValidationResult,
  ExportResult
} from '../src/types'
import type { AppSettings } from './services/settingsService'

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

declare global {
  interface Window {
    electron: ElectronAPI
    setsense: {
      // Library
      importLibrary: (xmlPath: string) => Promise<ImportResult>
      getLibrary: (filters?: LibraryFilters) => Promise<Track[]>
      getLibraryStats: () => Promise<LibraryStats>
      countTracks: () => Promise<number>
      // Progress events
      onImportProgress: (cb: (p: ImportProgress) => void) => () => void
      // Energy analysis (Phase 9)
      onEnergyProgress: (cb: (p: EnergyProgress) => void) => () => void
      onEnergyUpdate: (cb: (u: EnergyUpdate) => void) => () => void
      // File system
      selectXmlFile: () => Promise<string | null>
      checkFileExists: (path: string) => Promise<boolean>
      selectSaveLocation: (defaultName: string) => Promise<string | null>
      // Sets (Phase 3)
      getSets: () => Promise<DJSet[]>
      getSet: (id: string) => Promise<DJSet | null>
      saveSet: (set: DJSet) => Promise<DJSet | null>
      deleteSet: (id: string) => Promise<void>
      // Algorithms (Phase 4-5)
      getSuggestions: (trackId: string, setId: string, count: number, excludeIds?: string[]) => Promise<Suggestion[]>
      scoreTransition: (fromId: string, toId: string) => Promise<TransitionScore | null>
      buildSet: (params: ArchitectParams) => Promise<SetTrack[]>
      validateForExport: (setId: string, hardware: CDJModel) => Promise<ValidationResult | null>
      // File health (Phase 6)
      triggerHealthCheck: () => Promise<void>
      onFileStatusUpdate: (cb: (changes: Array<{ id: string; missing: boolean }>) => void) => () => void
      // Cue points (Phase 6)
      updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => Promise<void>
      // Audio raw bytes for waveform decoding
      readAudioFile: (filePath: string) => Promise<ArrayBuffer | null>
      // Export (Phase 7)
      exportSet: (setId: string, hardware: CDJModel) => Promise<ExportResult | null>
      // Settings (Phase 8)
      getSettings: () => Promise<AppSettings>
      setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
      // Shell — Discover (open Beatport/SoundCloud/YouTube links)
      openExternal: (url: string) => Promise<boolean>
      // USB Detection (Phase 9)
      usbList: () => Promise<USBDevice[]>
      usbGetRemembered: () => Promise<RememberedUSBDevice[]>
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
      ) => Promise<void>
      usbTestSpeed: (mountPath: string) => Promise<{ readMBps: number; writeMBps: number } | null>
      usbRecordExport: (id: string) => Promise<void>
      usbForget: (id: string) => Promise<void>
      usbCopyToUSB: (srcPath: string, mountPath: string, filename: string) => Promise<USBCopyResult>
      onUsbDevicesChanged: (cb: (devices: USBDevice[]) => void) => () => void
      // Discovery (Phase 2)
      discoverBrowse: (
        tasteProfile: TasteProfile,
        opts?: { genres?: string[]; pageToken?: string | null; forceRefresh?: boolean; pageSize?: number },
      ) => Promise<{ sets: DiscoverSet[]; nextPageToken: string | null; hasMore: boolean; error?: { code: string; message: string } }>
      discoverGetTracklist: (
        videoId: string,
      ) => Promise<{ tracklist: import('../src/types').DiscoverTrack[]; confidence: number; source: string } | null>
      discoverRefreshSet: (videoId: string, tasteProfile: TasteProfile) => Promise<DiscoverSet | null>
    }
  }
}

export {}
