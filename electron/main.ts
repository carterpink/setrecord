import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, getDb } from './db/schema'
import { getAllTracks, getTrackById, getLibraryStats, countTracks, getAllSets, getSetById, saveSet as dbSaveSet, deleteSet as dbDeleteSet, updateTrackCues } from './db/queries'
import type { Set as DJSet, LibraryFilters, ArchitectParams, CuePoint, HotCue } from '../src/types'
import { importFromXml } from './services/libraryImport'
import { scoreTransition } from './algorithms/transitionScore'
import { getSuggestions } from './algorithms/suggestions'
import { buildSet } from './algorithms/setArchitect'

let mainWindow: BrowserWindow

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    backgroundColor: '#060309',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 20 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  // ── Library ──────────────────────────────────────────────────────────────

  ipcMain.handle('library:import', async (_event, xmlPath: string) => {
    return importFromXml(xmlPath, (progress) => {
      mainWindow.webContents.send('library:import-progress', progress)
    })
  })

  ipcMain.handle('library:get-all', (_event, filters?: LibraryFilters) => {
    return getAllTracks(getDb(), filters)
  })

  ipcMain.handle('library:get-stats', () => {
    return getLibraryStats(getDb())
  })

  ipcMain.handle('library:count', () => {
    return countTracks(getDb())
  })

  // ── File system ───────────────────────────────────────────────────────────

  ipcMain.handle('fs:select-xml', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Rekordbox XML export',
      filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }],
      properties: ['openFile']
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('fs:file-exists', (_event, filePath: string) => {
    return existsSync(filePath)
  })

  ipcMain.handle('fs:select-save', async (_event, defaultName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }]
    })
    return canceled ? null : filePath
  })

  // ── Sets ──────────────────────────────────────────────────────────────────

  ipcMain.handle('sets:get-all', () => getAllSets(getDb()))

  ipcMain.handle('sets:get', (_e, id: string) => getSetById(getDb(), id) ?? null)

  ipcMain.handle('sets:save', (_e, set: DJSet) => {
    dbSaveSet(getDb(), set)
    return getSetById(getDb(), set.id) ?? null
  })

  ipcMain.handle('sets:delete', (_e, id: string) => dbDeleteSet(getDb(), id))

  // ── Algorithms ────────────────────────────────────────────────────────────

  ipcMain.handle('algo:score-transition', (_e, fromId: string, toId: string) => {
    const from = getTrackById(getDb(), fromId)
    const to = getTrackById(getDb(), toId)
    if (!from || !to) return null
    return scoreTransition(from, to)
  })

  ipcMain.handle('algo:suggestions', (_e, trackId: string, setId: string, count: number, excludeIds: string[] = []) => {
    const track = getTrackById(getDb(), trackId)
    const set = getSetById(getDb(), setId)
    if (!track || !set) return []
    const library = getAllTracks(getDb())
    return getSuggestions(track, library, set, count, excludeIds)
  })

  // ── Set Architect (Phase 5) ───────────────────────────────────────────────

  ipcMain.handle('algo:build-set', (_e, params: ArchitectParams) => {
    const library = getAllTracks(getDb())
    return buildSet(params, library)
  })

  // ── Cue points (Phase 6) ─────────────────────────────────────────────────

  ipcMain.handle('cues:update', (_e, trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => {
    updateTrackCues(getDb(), trackId, cuePoints, hotCues)
  })

  // ── Stubs (Phase 7) ───────────────────────────────────────────────────────

  ipcMain.handle('algo:validate', () => null)
  ipcMain.handle('export:set', () => null)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.setsense.app')

  protocol.handle('media', (req) => {
    const path = decodeURIComponent(req.url.replace('media://', ''))
    return net.fetch(`file://${path}`)
  })

  initDb()
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
