import type { ElectronAPI } from '@electron-toolkit/preload'
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
  LifecycleCounts,
  ImportProgress,
  ImportResult,
  CheckoutPlan,
  LicenseActivationResult,
  LicenseState,
  LibraryFilters,
  LibrarySearchParams,
  LibraryStats,
  Playlist,
  PlaySession,
  RecallAiStatus,
  RecallAskResult,
  RekordboxDetection,
  RekordboxStaleStatus,
  RememberedUSBDevice,
  SessionTrack,
  Set as DJSet,
  SetTrack,
  SmartCrate,
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
import type { ValidateApiKeyResult } from './services/discovery/youtubeClient'

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

declare global {
  interface Window {
    electron: ElectronAPI
    setsense: {
      // Library
      importLibrary: (xmlPath: string) => Promise<ImportResult>
      getLibrary: (filters?: LibraryFilters) => Promise<Track[]>
      getLibraryStats: () => Promise<LibraryStats>
      countTracks: () => Promise<number>
      getPlaylists: () => Promise<Playlist[]>
      // Progress events
      onImportProgress: (cb: (p: ImportProgress) => void) => () => void
      // Energy analysis (Phase 9)
      onEnergyProgress: (cb: (p: EnergyProgress) => void) => () => void
      onEnergyUpdate: (cb: (u: EnergyUpdate) => void) => () => void
      // Album artwork extraction
      onArtworkProgress: (cb: (p: ArtworkProgress) => void) => () => void
      onArtworkUpdate: (cb: (u: ArtworkUpdate) => void) => () => void
      // File system
      selectXmlFile: () => Promise<string | null>
      checkFileExists: (path: string) => Promise<boolean>
      selectSaveLocation: (defaultName: string) => Promise<string | null>
      // Rekordbox auto-detect
      detectRekordbox: () => Promise<RekordboxDetection>
      importFromRekordboxDb: (path: string) => Promise<ImportResult>
      checkRekordboxStale: () => Promise<RekordboxStaleStatus>
      // Sets (Phase 3)
      getSets: () => Promise<DJSet[]>
      getSet: (id: string) => Promise<DJSet | null>
      saveSet: (set: DJSet) => Promise<DJSet | null>
      deleteSet: (id: string) => Promise<void>
      // Algorithms (Phase 4-5)
      getSuggestions: (trackId: string, setId: string, count: number, excludeIds?: string[], sourcePlaylistIds?: string[]) => Promise<Suggestion[]>
      scoreTransition: (fromId: string, toId: string) => Promise<TransitionScore | null>
      buildSet: (params: ArchitectParams) => Promise<SetTrack[]>
      validateForExport: (setId: string, hardware: CDJModel) => Promise<ValidationResult | null>
      // File health (Phase 6)
      triggerHealthCheck: () => Promise<void>
      analyseEnergy: () => Promise<{ running: boolean }>
      energyPendingCount: () => Promise<number>
      onFileStatusUpdate: (cb: (changes: Array<{ id: string; missing: boolean }>) => void) => () => void
      // Cue points (Phase 6)
      updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => Promise<void>
      setTrackEnergy: (trackId: string, energy: number) => Promise<void>
      updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }) => Promise<void>
      relinkTrackFile: (trackId: string) => Promise<string | null>
      // Audio raw bytes for waveform decoding
      readAudioFile: (filePath: string) => Promise<ArrayBuffer | null>
      // Export (Phase 7)
      exportSet: (setId: string, hardware: CDJModel) => Promise<ExportResult | null>
      // Settings (Phase 8)
      getSettings: () => Promise<AppSettings>
      setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
      validateYoutubeApiKey: (key: string) => Promise<ValidateApiKeyResult>
      // Licensing / SetSense Pro (Section 16)
      licenseGet: () => Promise<LicenseState>
      licenseActivate: (key: string) => Promise<LicenseActivationResult>
      licenseDeactivate: () => Promise<LicenseState>
      licenseCheckout: (plan: CheckoutPlan, tipAmount?: number) => Promise<boolean>
      // Shell — Discover (open Beatport/SoundCloud/YouTube links)
      openExternal: (url: string) => Promise<boolean>
      // Customer feedback (opens a pre-filled mail draft)
      submitFeedback: (payload: {
        category: string
        rating: number
        message: string
        email?: string
        meta?: string
      }) => Promise<boolean>
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
      // Play history (Phase 11)
      historySessions: () => Promise<PlaySession[]>
      historySessionTracks: (sessionId: string) => Promise<SessionTrack[]>
      historyForTrack: (trackId: string) => Promise<PlaySession[]>
      historyMarkPerformed: (setId: string, opts?: { performedAt?: string; venue?: string }) => Promise<string | null>
      historyDelete: (sessionId: string) => Promise<void>
      historyImportFile: () => Promise<{ sessions: number; tracks: number }>
      setTrackLifecycle: (trackId: string, state: string | null, source: 'computed' | 'user') => Promise<void>
      // Flag-for-gig loop (Phase 14)
      lifecycleFlagForGig: (trackIds: string[]) => Promise<void>
      lifecycleResolveGigFlag: (trackId: string, outcome: 'tested' | 'archive' | 'keep') => Promise<void>
      lifecycleGetFlagged: () => Promise<Track[]>
      lifecycleFlaggedInSession: (sessionId: string) => Promise<Track[]>
      // Recall / memory engine (Phase 12)
      recallGems: () => Promise<GemResult[]>
      recallCrates: () => Promise<CrateWithCount[]>
      recallEvaluateCrate: (idOrCrate: string | SmartCrate) => Promise<Track[]>
      recallSaveCrate: (crate: SmartCrate) => Promise<void>
      recallDeleteCrate: (id: string) => Promise<void>
      recallLifecycle: () => Promise<LifecycleCounts>
      recallCombos: (trackId: string) => Promise<ComboResult[]>
      recallSequences: () => Promise<{ trackIds: string[]; tracks: Track[]; count: number }[]>
      recallDeadEnds: () => Promise<ComboResult[]>
      recallIdentity: () => Promise<IdentitySnapshot>
      recallHealth: () => Promise<HealthReport>
      recallDismissDuplicate: (normalisedKey: string) => Promise<void>
      recallResolveDuplicateGroup: (
        normalisedKey: string,
        archiveIds: string[]
      ) => Promise<void>
      recallSearch: (params: LibrarySearchParams) => Promise<Track[]>
      // Recall local-AI layer (Phase 13)
      recallAiStatus: () => Promise<RecallAiStatus>
      recallAiEnable: (enabled: boolean) => Promise<RecallAiStatus>
      recallAiAsk: (question: string) => Promise<RecallAskResult>
      onRecallAiProgress: (cb: (s: RecallAiStatus) => void) => () => void
    }
  }
}

export {}
