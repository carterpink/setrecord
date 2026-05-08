import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ArchitectParams,
  CDJModel,
  CuePoint,
  HotCue,
  ImportProgress,
  LibraryFilters,
  Set as DJSet
} from '../src/types'

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

  // ── Cue points (Phase 6) ─────────────────────────────────────────────────
  updateTrackCues: (trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]): Promise<void> =>
    ipcRenderer.invoke('cues:update', trackId, cuePoints, hotCues),

  // ── Export (Phase 7) ──────────────────────────────────────────────────────
  exportSet: (setId: string, hardware: CDJModel) =>
    ipcRenderer.invoke('export:set', setId, hardware),
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
