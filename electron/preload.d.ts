import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ArchitectParams,
  CDJModel,
  CuePoint,
  HotCue,
  ImportProgress,
  ImportResult,
  LibraryFilters,
  LibraryStats,
  Set as DJSet,
  SetTrack,
  Track,
  TransitionScore,
  Suggestion,
  ValidationResult,
  ExportResult
} from '../src/types'

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
      // Cue points (Phase 6)
      updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => Promise<void>
      // Export (Phase 7)
      exportSet: (setId: string, hardware: CDJModel) => Promise<ExportResult | null>
    }
  }
}

export {}
