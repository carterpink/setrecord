import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { existsSync, promises as fsp } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, getDb } from './db/schema'
import { getAllTracks, getTrackById, getLibraryStats, countTracks, getAllSets, getSetById, saveSet as dbSaveSet, deleteSet as dbDeleteSet, updateTrackCues, runFileHealthCheck, getUSBDevice, getAllRememberedUSBDevices, upsertUSBDevice, updateUSBPrefs, updateUSBSpeedResult, recordUSBExport, forgetUSBDevice } from './db/queries'
import type { Set as DJSet, LibraryFilters, ArchitectParams, CuePoint, HotCue, CDJModel, USBDevice } from '../src/types'
import { importFromXml } from './services/libraryImport'
import { runAnalysisQueue, isAnalysisRunning } from './services/energyAnalyser'
import { scoreTransition } from './algorithms/transitionScore'
import { getSuggestions } from './algorithms/suggestions'
import { buildSet } from './algorithms/setArchitect'
import { validateForHardware } from './services/usbValidator'
import { exportSet } from './services/exportService'
import { getSettings, setSettings } from './services/settingsService'
import type { AppSettings } from './services/settingsService'
import { browseDiscoverySets, refreshDiscoverySet, getSetTracklist } from './services/discovery/discoveryService'
import type { TasteProfile } from '../src/types'
import { listUSBDevices, watchUSBDevices, testUSBSpeed, copyFileToUSB, speedConfidenceFromAge } from './services/usbDetector'

// Must be called synchronously before app.whenReady() for custom schemes to work
// with media elements. Without stream:true the renderer rejects media:// for <audio>.
protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: {
    secure: true,
    standard: true,
    supportFetchAPI: true,
    stream: true,
    bypassCSP: true,
  },
}])

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
    // Background file health check on every launch — catches moved/deleted files
    scheduleHealthCheck()
    // Resume background energy analysis if any tracks are still pending from a
    // previous launch (or were just imported).
    scheduleEnergyAnalysis()
    // Start watching for USB mount/unmount events
    startUSBWatcher()
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

/**
 * Run the file-existence health check in the background (next tick so it
 * doesn't delay the caller) and push any status changes to the renderer.
 */
function scheduleHealthCheck(): void {
  setImmediate(() => {
    try {
      const changed = runFileHealthCheck(getDb())
      if (changed.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library:file-status', changed)
      }
    } catch {
      // Non-fatal — health check is best-effort
    }
  })
}

/**
 * Kick the background energy analyser (idempotent — no-op if already running).
 * Throttles progress events to one per ~250ms so we don't flood IPC on 10k
 * libraries; per-item energy patches still fire on every track so rows light
 * up in real time.
 */
function scheduleEnergyAnalysis(): void {
  if (isAnalysisRunning()) return
  setImmediate(() => {
    let lastProgressEmit = 0
    void runAnalysisQueue({
      onStart: (total) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:energy-progress', {
            processed: 0,
            total,
            phase: total === 0 ? 'done' : 'analysing',
          })
        }
      },
      onItem: (result, processed, total) => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send('library:energy-update', {
          trackId: result.trackId,
          energy: result.energy,
          source: result.source,
        })
        const now = Date.now()
        if (now - lastProgressEmit >= 250 || processed === total) {
          lastProgressEmit = now
          mainWindow.webContents.send('library:energy-progress', {
            processed,
            total,
            phase: processed === total ? 'done' : 'analysing',
          })
        }
      },
      onComplete: (processed, total) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:energy-progress', {
            processed,
            total,
            phase: 'done',
          })
        }
      },
    }).catch((err) => {
      console.error('[energy] analyser queue crashed', err)
    })
  })
}

let stopUSBWatcher: (() => void) | null = null

/**
 * Merge live USB device data with persisted user prefs from the DB.
 * This is called both on initial load and when the watcher fires.
 */
async function mergeUSBDevices(): Promise<USBDevice[]> {
  const live = await listUSBDevices()
  const db = getDb()
  const now = new Date().toISOString()

  return live.map((device) => {
    const prefs = getUSBDevice(db, device.id)

    // Upsert so the device is remembered even after unmounting
    upsertUSBDevice(db, {
      id: device.id,
      label: device.label,
      customName: prefs?.customName,
      isFavorite: prefs?.isFavorite ?? false,
      isExportTarget: prefs?.isExportTarget ?? false,
      lastSeen: now,
      exportCount: prefs?.exportCount ?? 0,
      lastExport: prefs?.lastExport,
      readSpeedMBps: prefs?.readSpeedMBps ?? device.readSpeedMBps,
      writeSpeedMBps: prefs?.writeSpeedMBps ?? device.writeSpeedMBps,
      speedTestedAt: prefs?.speedTestedAt ?? device.speedTestedAt,
    })

    const speedTestedAt = prefs?.speedTestedAt ?? device.speedTestedAt
    return {
      ...device,
      customName: prefs?.customName,
      isFavorite: prefs?.isFavorite ?? false,
      isExportTarget: prefs?.isExportTarget ?? false,
      exportCount: prefs?.exportCount ?? 0,
      lastExport: prefs?.lastExport,
      lastSeen: now,
      readSpeedMBps: prefs?.readSpeedMBps ?? device.readSpeedMBps,
      writeSpeedMBps: prefs?.writeSpeedMBps ?? device.writeSpeedMBps,
      speedTestedAt,
      speedConfidence: speedConfidenceFromAge(speedTestedAt),
    }
  })
}

function startUSBWatcher(): void {
  stopUSBWatcher?.()
  stopUSBWatcher = watchUSBDevices(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      const devices = await mergeUSBDevices()
      mainWindow.webContents.send('usb:devices-changed', devices)
    } catch (err) {
      console.error('[usb] watcher update failed', err)
    }
  })
}

function registerIpcHandlers(): void {
  // ── Library ──────────────────────────────────────────────────────────────

  ipcMain.handle('library:import', async (_event, xmlPath: string) => {
    const result = await importFromXml(xmlPath, (progress) => {
      mainWindow.webContents.send('library:import-progress', progress)
    })
    // Run health check after import to immediately flag any missing files
    scheduleHealthCheck()
    // Auto-analyse energy for every newly-imported track (background, no UI block)
    scheduleEnergyAnalysis()
    return result
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

  // ── File health (Phase 6) ────────────────────────────────────────────────

  // Renderer can trigger a manual re-check (e.g. after mounting a USB drive)
  ipcMain.handle('library:health-check', () => {
    scheduleHealthCheck()
  })

  // ── Cue points (Phase 6) ─────────────────────────────────────────────────

  ipcMain.handle('cues:update', (_e, trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => {
    updateTrackCues(getDb(), trackId, cuePoints, hotCues)
  })

  // ── Audio raw bytes (for waveform decoding) ──────────────────────────────
  // Reads an audio file as a Buffer so the renderer can feed it to WaveSurfer
  // via loadBlob(). Avoids relying on the `media://` scheme's renderer-side
  // fetch path, which is inconsistent for custom schemes — `<audio>` works,
  // `fetch()` does not.
  ipcMain.handle('audio:read-file', async (_e, filePath: string): Promise<ArrayBuffer | null> => {
    try {
      const buf = await fsp.readFile(filePath)
      // Slice produces a clean ArrayBuffer (not SharedArrayBuffer) for structured clone
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    } catch (err) {
      console.error('[audio:read-file] failed', filePath, err)
      return null
    }
  })

  // ── Export + Validation (Phase 7) ────────────────────────────────────────

  ipcMain.handle('algo:validate', async (_e, setId: string, hardware: CDJModel) => {
    const set = getSetById(getDb(), setId)
    if (!set) return null
    const result = validateForHardware(set, hardware)
    dbSaveSet(getDb(), { ...set, safetyScore: result.score, targetHardware: hardware })
    return result
  })

  // ── Settings ───────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:set', (_e, partial: Partial<AppSettings>) => setSettings(partial))

  // ── Shell (Discover external links) ──────────────────────────────────────
  // Open URLs in the user's default browser, but only those matching our allowlist
  // (Beatport / SoundCloud / YouTube). Anything else is refused — protects against
  // a renderer compromise turning into an arbitrary URL launcher.
  const SHELL_HOST_ALLOWLIST = new Set([
    'beatport.com',
    'www.beatport.com',
    'soundcloud.com',
    'www.soundcloud.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
  ])
  ipcMain.handle('shell:open-external', async (_e, url: string): Promise<boolean> => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') return false
      if (!SHELL_HOST_ALLOWLIST.has(parsed.host.toLowerCase())) return false
      await shell.openExternal(url)
      return true
    } catch (err) {
      console.error('[shell:open-external] refused:', err)
      return false
    }
  })

  ipcMain.handle('export:set', async (_e, setId: string, _hardware: CDJModel) => {
    const set = getSetById(getDb(), setId)
    if (!set) return { success: false, error: 'Set not found' }
    const safeName = set.name.replace(/[/\\?%*:|"<>]/g, '-')
    const date = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${safeName}_SetSense_${date}.xml`,
      filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }],
    })
    if (canceled || !filePath) return { success: false }
    return exportSet(set, filePath)
  })

  // ── USB Detection (Phase 9) ───────────────────────────────────────────────────

  ipcMain.handle('usb:list', async () => {
    return mergeUSBDevices()
  })

  ipcMain.handle('usb:get-remembered', () => {
    return getAllRememberedUSBDevices(getDb())
  })

  ipcMain.handle('usb:update-prefs', (_e, id: string, prefs: {
    customName?: string | null
    isFavorite?: boolean
    isExportTarget?: boolean
    readSpeedMBps?: number
    writeSpeedMBps?: number
    speedTestedAt?: string
  }) => {
    const db = getDb()
    if (prefs.readSpeedMBps !== undefined && prefs.writeSpeedMBps !== undefined) {
      updateUSBSpeedResult(db, id, prefs.readSpeedMBps, prefs.writeSpeedMBps)
    }
    const userPrefs: Parameters<typeof updateUSBPrefs>[2] = {}
    if ('customName' in prefs) userPrefs.customName = prefs.customName ?? null
    if (prefs.isFavorite !== undefined) userPrefs.isFavorite = prefs.isFavorite
    if (prefs.isExportTarget !== undefined) userPrefs.isExportTarget = prefs.isExportTarget
    if (Object.keys(userPrefs).length > 0) updateUSBPrefs(db, id, userPrefs)
  })

  ipcMain.handle('usb:test-speed', async (_e, mountPath: string) => {
    return testUSBSpeed(mountPath)
  })

  ipcMain.handle('usb:record-export', (_e, id: string) => {
    recordUSBExport(getDb(), id)
  })

  ipcMain.handle('usb:forget', (_e, id: string) => {
    forgetUSBDevice(getDb(), id)
  })

  ipcMain.handle('usb:copy-to-usb', async (_e, srcPath: string, mountPath: string, filename: string) => {
    return copyFileToUSB(srcPath, mountPath, filename)
  })

  // ── Discovery (Phase 2) ───────────────────────────────────────────────────
  ipcMain.handle(
    'discover:browse',
    async (
      _e,
      tasteProfile: TasteProfile,
      opts: { genres?: string[]; pageToken?: string | null; forceRefresh?: boolean; pageSize?: number },
    ) => {
      return browseDiscoverySets(getDb(), tasteProfile, opts)
    },
  )

  ipcMain.handle('discover:get-tracklist', async (_e, videoId: string) => {
    return getSetTracklist(videoId, getDb())
  })

  ipcMain.handle('discover:refresh-set', async (_e, videoId: string, tasteProfile: TasteProfile) => {
    return refreshDiscoverySet(videoId, getDb(), tasteProfile)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.setsense.app')

  protocol.handle('media', async (req) => {
    // URLs come in as media://<host>/<encoded-path>. Strip scheme + host and
    // emit file:///<encoded-path>. The renderer always uses host=`local`
    // (see src/utils/mediaUrl.ts) but we accept any host defensively.
    const fileUrl = req.url.replace(/^media:\/\/[^/]+/, 'file://')
    try {
      const res = await net.fetch(fileUrl)
      if (!res.ok) {
        console.error('[media://] fetch returned', res.status, fileUrl)
      }
      return res
    } catch (err) {
      console.error('[media://] fetch threw', fileUrl, err)
      return new Response(null, { status: 500 })
    }
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
  stopUSBWatcher?.()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
