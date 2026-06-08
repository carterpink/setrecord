import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ExportResult as BackupExportResult,
  InspectResult as BackupInspectResult,
  ImportResult as BackupImportResult
} from './services/backupService'
import type {
  ArchitectParams,
  CDJModel,
  ComboResult,
  CrateWithCount,
  CuePoint,
  Ecosystem,
  EnergySource,
  GemResult,
  GenreProfileInfo,
  GraphData,
  GraphRequest,
  HealthReport,
  HotCue,
  Loop,
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
  RecallRoute,
  RecordedSetSummary,
  SetRecording,
  VoiceStatus,
  MicAccess,
  LibrarySourceId,
  PostImportProgress,
  RekordboxDetection,
  RekordboxStaleStatus,
  SourceDetection,
  RememberedUSBDevice,
  SessionTrack,
  SessionFilter,
  SessionMetadataPatch,
  SetSlot,
  VenueType,
  BriefAnswer,
  TrackResume,
  SoundMirrorResult,
  CourageResult,
  ShazamAnswer,
  Set as DJSet,
  SetTrack,
  SmartCrate,
  TagCategory,
  TagCoverage,
  RekordboxTagWriteResult,
  Track,
  TrackTag,
  TransitionScore,
  Suggestion,
  USBCopyResult,
  USBDevice,
  ValidationResult,
  ExportResult,
  BeatportRow
} from '../src/types'
import type { AppSettings } from './services/settingsService'
import type { ProgressState, FirstEvent } from './services/progressService'
import type { ShazamHit } from '../src/utils/reverseShazamIntent'

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

export interface TagsProgress {
  processed: number
  total: number
  phase: 'tagging' | 'done'
}

export interface EngineExportProgress {
  processed: number
  total: number
  phase: 'copying' | 'writing' | 'done'
}

declare global {
  interface Window {
    electron: ElectronAPI
    setrecord: {
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
      // Cross-platform import sources (Rekordbox / Serato / Engine DJ)
      detectImportSources: () => Promise<SourceDetection[]>
      runImport: (sourceId: LibrarySourceId, libraryPath: string) => Promise<ImportResult>
      onPostImportProgress: (cb: (p: PostImportProgress) => void) => () => void
      // Sets (Phase 3)
      getSets: () => Promise<DJSet[]>
      getSet: (id: string) => Promise<DJSet | null>
      saveSet: (set: DJSet) => Promise<DJSet | null>
      deleteSet: (id: string) => Promise<void>
      // Algorithms (Phase 4-5)
      getSuggestions: (
        trackId: string,
        setId: string,
        count: number,
        excludeIds?: string[],
        sourcePlaylistIds?: string[]
      ) => Promise<Suggestion[]>
      scoreTransition: (fromId: string, toId: string) => Promise<TransitionScore | null>
      buildSet: (params: ArchitectParams) => Promise<SetTrack[]>
      genreProfiles: (sourcePlaylistIds?: string[]) => Promise<GenreProfileInfo>
      validateForExport: (
        setId: string,
        hardware: CDJModel,
        ecosystem?: Ecosystem
      ) => Promise<ValidationResult | null>
      exportSetToEngineUsb: (setId: string, mountPath: string) => Promise<ExportResult>
      onEngineExportProgress: (cb: (p: EngineExportProgress) => void) => () => void
      // File health (Phase 6)
      triggerHealthCheck: () => Promise<void>
      analyseEnergy: () => Promise<{ running: boolean }>
      energyPendingCount: () => Promise<number>
      onFileStatusUpdate: (
        cb: (changes: Array<{ id: string; missing: boolean }>) => void
      ) => () => void
      // Cue points (Phase 6)
      updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => Promise<void>
      updateTrackBeatgrid: (trackId: string, bpm: number, beatgridOffset: number) => Promise<void>
      updateTrackLoops: (trackId: string, loops: Loop[]) => Promise<void>
      setTrackEnergy: (trackId: string, energy: number) => Promise<void>
      updateTrackMeta: (trackId: string, fields: { bpm?: number; key?: string }) => Promise<void>
      relinkTrackFile: (trackId: string) => Promise<string | null>
      // Auto-tags
      tagsCoverage: () => Promise<TagCoverage>
      tagsForTrack: (trackId: string) => Promise<TrackTag[]>
      tagsRetag: () => Promise<{ running: boolean }>
      tagsSetOverride: (
        trackId: string,
        category: TagCategory,
        values: string[]
      ) => Promise<TrackTag[] | null>
      tagsResetToAuto: (trackId: string, category?: TagCategory) => Promise<TrackTag[] | null>
      tagsExportXml: () => Promise<{
        success: boolean
        filePath?: string
        trackCount?: number
        error?: string
      }>
      tagsWriteMyTags: () => Promise<RekordboxTagWriteResult>
      onTagsProgress: (cb: (p: TagsProgress) => void) => () => void
      // Audio raw bytes for waveform decoding
      readAudioFile: (filePath: string) => Promise<ArrayBuffer | null>
      // Export (Phase 7)
      exportSet: (setId: string, hardware: CDJModel) => Promise<ExportResult | null>
      exportBeatportCsv: (setName: string, rows: BeatportRow[]) => Promise<ExportResult | null>
      // Settings (Phase 8)
      getSettings: () => Promise<AppSettings>
      setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
      // Artwork cache management
      artworkCacheStats: () => Promise<{ files: number; bytes: number }>
      artworkClearCache: () => Promise<{ removed: number; bytesFreed: number }>
      // Manual update check
      checkForUpdatesNow: () => Promise<'updated' | 'up-to-date' | 'offline' | 'unavailable'>
      // Fresh Start — wipe to first-launch and relaunch
      freshStart: () => Promise<void>
      // Backup & migration (backendless export/import)
      backupExport: (passphrase?: string) => Promise<BackupExportResult>
      backupPick: () => Promise<string | null>
      backupInspect: (filePath: string, passphrase?: string) => Promise<BackupInspectResult>
      backupImport: (
        filePath: string,
        mode: 'restore' | 'merge',
        passphrase?: string
      ) => Promise<BackupImportResult>
      // Diagnostic log export (NFR-801 Phase 2)
      exportLogs: () => Promise<{ success: boolean; path?: string; error?: string }>
      revealLogBundle: (path: string) => Promise<void>
      logSessionInfo: () => Promise<{ sid: string; version: string }>
      // Retention / activation progress (brief #22, Phase B)
      progressGet: () => Promise<ProgressState>
      progressSet: (partial: Partial<ProgressState>) => Promise<ProgressState>
      progressMarkFirst: (event: FirstEvent) => Promise<ProgressState>
      progressClaimMilestone: (id: string) => Promise<boolean>
      progressRecordActivity: () => Promise<ProgressState>
      // Licensing / SetRecord Pro (Section 16)
      licenseGet: () => Promise<LicenseState>
      licenseActivate: (key: string) => Promise<LicenseActivationResult>
      licenseDeactivate: () => Promise<LicenseState>
      licenseRefresh: () => Promise<LicenseState>
      licenseCheckout: (plan: CheckoutPlan, tipAmount?: number) => Promise<boolean>
      licenseConsumePendingActivation: () => Promise<string | null>
      onLicenseActivateDeepLink: (cb: (key: string) => void) => () => void
      // Customer feedback (opens a pre-filled mail draft)
      submitFeedback: (payload: {
        category: string
        rating: number
        message: string
        email?: string
        meta?: string
        diagnostics?: { sid: string; version: string }
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
      // Play history (Phase 11)
      historySessions: () => Promise<PlaySession[]>
      historySessionTracks: (sessionId: string) => Promise<SessionTrack[]>
      historyGetRecording: (sessionId: string) => Promise<SetRecording | null>
      historyForTrack: (trackId: string) => Promise<PlaySession[]>
      historyBrief: (venue: string, eventType?: VenueType) => Promise<BriefAnswer>
      historyTrackResume: (trackId: string) => Promise<TrackResume | null>
      historySoundMirror: () => Promise<SoundMirrorResult>
      historyCourage: (trackId: string) => Promise<CourageResult | null>
      historyReverseShazam: (hit: ShazamHit) => Promise<ShazamAnswer>
      historyQuerySessions: (filter?: SessionFilter) => Promise<PlaySession[]>
      historyUpdateSession: (sessionId: string, patch: SessionMetadataPatch) => Promise<void>
      historyBulkAssign: (filter: SessionFilter, patch: SessionMetadataPatch) => Promise<number>
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
      ) => Promise<string | null>
      historyDelete: (sessionId: string) => Promise<void>
      historyImportFile: () => Promise<{ sessions: number; tracks: number }>
      setTrackLifecycle: (
        trackId: string,
        state: string | null,
        source: 'computed' | 'user'
      ) => Promise<void>
      // Flag-for-gig loop (Phase 14)
      lifecycleFlagForGig: (trackIds: string[]) => Promise<void>
      lifecycleResolveGigFlag: (
        trackId: string,
        outcome: 'tested' | 'archive' | 'keep'
      ) => Promise<void>
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
      recallResolveDuplicateGroup: (normalisedKey: string, archiveIds: string[]) => Promise<void>
      recallSearch: (params: LibrarySearchParams) => Promise<Track[]>
      // Recall local-AI layer (Phase 13)
      recallAiStatus: () => Promise<RecallAiStatus>
      recallAiEnable: (enabled: boolean) => Promise<RecallAiStatus>
      recallAiAsk: (question: string) => Promise<RecallAskResult>
      recallAiRoute: (question: string, contextJson?: string) => Promise<RecallRoute>
      recallSimilar: (trackId: string, count?: number) => Promise<Track[]>
      recallEnds: () => Promise<{ openers: ComboResult[]; closers: ComboResult[] }>
      // Constellation graph view
      buildGraph: (req: GraphRequest) => Promise<GraphData>
      onRecallAiProgress: (cb: (s: RecallAiStatus) => void) => () => void
      // On-device voice (Phase 13)
      speechVoiceStatus: () => Promise<VoiceStatus>
      speechTranscribe: (pcm: Float32Array) => Promise<string>
      speechEnsureMicAccess: () => Promise<MicAccess>
      speechPrepareVoice: () => Promise<VoiceStatus>
      onVoiceProgress: (cb: (s: VoiceStatus) => void) => () => void
      // Live collaboration (Back-to-Back)
      collabHostStart: () => Promise<{ port: number; secret: string; host: string }>
      collabHostStop: () => Promise<void>
      // SetRecord Live overlay
      liveStart: () => Promise<void>
      liveStop: () => Promise<void>
      liveSetIgnoreMouse: (ignore: boolean) => void
      onLiveOverlayClosed: (cb: () => void) => () => void
      liveAudioWindow: (samples: Float32Array) => void
      liveRecChunk: (chunk: ArrayBuffer) => void
      liveRecordingActive: (active: boolean) => void
      onLiveRecordingState: (cb: (active: boolean) => void) => () => void
      liveScreenText: (lines: string[]) => void
      liveSetVenue: (venue: string | null) => Promise<void>
      onLiveVenue: (cb: (venue: string | null) => void) => () => void
      onLiveData: (
        cb: (data: import('./services/live/liveEngine').LiveDataPayload) => void
      ) => () => void
      onLiveIndexProgress: (cb: (p: { done: number; total: number }) => void) => () => void
      onLiveReady: (cb: (s: { indexedTracks: number }) => void) => () => void
      onLiveRecordingReady: (cb: (rec: RecordedSetSummary) => void) => () => void
      liveSaveSession: (meta?: { venue?: string | null }) => Promise<string | null>
      liveDiscardSession: () => Promise<void>
    }
  }
}

export {}
