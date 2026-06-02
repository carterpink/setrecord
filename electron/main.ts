import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { existsSync, createReadStream, promises as fsp } from 'fs'
import { Readable } from 'node:stream'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, getDb, resetDb, getDbPath } from './db/schema'
import {
  getAllTracks,
  getTrackById,
  getLibraryStats,
  countTracks,
  getAllSets,
  getSetById,
  saveSet as dbSaveSet,
  deleteSet as dbDeleteSet,
  updateTrackCues,
  updateTrackBeatgrid,
  updateTrackLoops,
  updateTrackEnergy,
  updateTrackMeta,
  updateTrackFilePath,
  runFileHealthCheck,
  getUSBDevice,
  getAllRememberedUSBDevices,
  upsertUSBDevice,
  updateUSBPrefs,
  updateUSBSpeedResult,
  recordUSBExport,
  forgetUSBDevice,
  getAllPlaylists,
  getTrackIdsForPlaylists,
  getSessions,
  getSessionTracks,
  getSessionsForTrack,
  markSetAsPerformed,
  deleteSession,
  setTrackLifecycle,
  flagTracksForGig,
  resolveGigFlag,
  getTracksFlaggedForGig,
  getFlaggedTracksInSession,
  pruneDuplicateSetsenseSessions
} from './db/queries'
import type {
  Set as DJSet,
  LibraryFilters,
  ArchitectParams,
  CuePoint,
  HotCue,
  Loop,
  CDJModel,
  USBDevice
} from '../src/types'
import { importFromXml, importHistoryFile } from './services/libraryImport'
import {
  detectRekordbox,
  importFromMasterDb,
  RekordboxLockedError,
  RekordboxKeyMismatchError
} from './services/rekordbox'
import { statSync } from 'fs'
import {
  runAnalysisQueue,
  isAnalysisRunning,
  pendingCount as pendingEnergyCount
} from './services/energyAnalyser'
import { runArtworkQueue, isArtworkRunning } from './services/artworkExtractor'
import { scoreTransition } from './algorithms/transitionScore'
import { getSuggestions } from './algorithms/suggestions'
import { buildSet } from './algorithms/setArchitect'
import * as memoryService from './services/memoryService'
import * as memoryAssistant from './services/memoryAssistant'
import type { SmartCrate, LibrarySearchParams } from '../src/types'
import { validateForHardware } from './services/usbValidator'
import { exportSet } from './services/exportService'
import { getSettings, setSettings } from './services/settingsService'
import type { AppSettings } from './services/settingsService'
import { initCrashReporter } from './services/crashReporter'
import { loadSecretsFromKeychain } from './services/secretStore'
import {
  getLicenseState,
  activateLicense,
  deactivateLicense,
  refreshLicenseOnline,
  isProEntitled
} from './services/licenseService'
import { loadDeviceId } from './services/licensing/deviceId'
import { startTrial } from './services/licensing/trialStore'
import {
  COMMERCE_HOST,
  checkoutUrl,
  ACTIVATION_SCHEME,
  parseActivationUrl
} from './services/licensing/signingKey'
import {
  listUSBDevices,
  watchUSBDevices,
  testUSBSpeed,
  copyFileToUSB,
  speedConfidenceFromAge
} from './services/usbDetector'

/** MIME type for the media:// handler, by file extension. */
function mediaMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'aif':
    case 'aiff':
      return 'audio/aiff'
    case 'flac':
      return 'audio/flac'
    case 'm4a':
    case 'mp4':
      return 'audio/mp4'
    case 'aac':
      return 'audio/aac'
    case 'ogg':
    case 'oga':
      return 'audio/ogg'
    case 'opus':
      return 'audio/opus'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

// Dev-only: expose the Chromium DevTools Protocol when SETSENSE_CDP=<port> is set,
// so automated tooling can attach to the renderer. Inert in normal/production runs.
if (process.env.SETSENSE_CDP) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.SETSENSE_CDP)
  app.commandLine.appendSwitch('remote-allow-origins', '*')
}

// Must be called synchronously before app.whenReady() for custom schemes to work
// with media elements. Without stream:true the renderer rejects media:// for <audio>.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow

// ── License activation deep-links (setsense://activate?key=…) ────────────────
// A deep-link can arrive three ways: cold start (queued before the window
// exists), while the app is already running (open-url on macOS), or as a launch
// arg on Windows/Linux. We buffer the key until the renderer signals it has
// mounted and attached its listener, then either flush it (cold start) or push
// it live (running app). The key is untrusted here — licenseService re-verifies
// the Ed25519 signature before it can grant Pro.
let pendingActivationKey: string | null = null
let rendererReady = false

function deliverActivationKey(key: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('license:activate-deeplink', key)
  } else {
    pendingActivationKey = key
  }
}

/**
 * Scan a process-argv array for an activation deep-link. Windows/Linux deliver
 * the URL as a launch argument; our dev harness also accepts
 * `--activate-url=setsense://activate?key=…` so cold-start can be exercised
 * without OS-level scheme registration.
 */
function handleActivationArgv(argv: string[]): void {
  for (const arg of argv) {
    const candidate = arg.startsWith('--activate-url=') ? arg.slice('--activate-url='.length) : arg
    if (!candidate.startsWith(`${ACTIVATION_SCHEME}://`)) continue
    const key = parseActivationUrl(candidate)
    if (key) {
      deliverActivationKey(key)
      return
    }
  }
}

// Single-instance lock: a second launch (e.g. clicking a setsense:// link while
// the app is open on Windows/Linux) routes its argv to the running instance
// instead of spawning a duplicate.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    handleActivationArgv(argv)
  })
}

// macOS delivers deep-links through open-url (both cold start and while running).
app.on('open-url', (event, url) => {
  event.preventDefault()
  const key = parseActivationUrl(url)
  if (key) deliverActivationKey(key)
})

// Register as the OS handler for the scheme. In dev (running via the electron
// binary) we must pass the script path so the relaunch resolves to our app.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(ACTIVATION_SCHEME, process.execPath, [resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(ACTIVATION_SCHEME)
}

/**
 * Try to open the library DB. If the file is corrupt or locked, surface a
 * dialog before any window exists — a white screen is the worst first
 * impression after an upgrade goes wrong. The user can quarantine the old DB
 * and start fresh, or quit and recover the file manually.
 */
async function initDbWithRecovery(): Promise<void> {
  try {
    initDb()
    return
  } catch (err) {
    console.error('[initDb] first attempt failed', err)
    const message = err instanceof Error ? err.message : String(err)
    const choice = await dialog.showMessageBox({
      type: 'error',
      title: 'SetSense library couldn’t load',
      message: 'Your set library file is corrupted or locked.',
      detail:
        `The file at:\n${getDbPath()}\n\ncouldn’t be opened. ` +
        'You can start fresh (your tracks stay where they are — only the SetSense index resets, ' +
        'and you’ll re-import your Rekordbox XML), or quit and try to recover it manually.' +
        `\n\nTechnical detail: ${message}`,
      buttons: ['Reset library and continue', 'Quit'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    if (choice.response === 1) {
      app.quit()
      throw new Error('User chose to quit after DB load failure')
    }

    resetDb()
    try {
      initDb()
    } catch (resetErr) {
      console.error('[initDb] reset also failed', resetErr)
      await dialog.showMessageBox({
        type: 'error',
        title: 'SetSense couldn’t recover',
        message: 'A fresh library still failed to open.',
        detail:
          `This usually means SetSense can’t write to:\n${getDbPath()}\n\n` +
          'Check that the parent folder is writable, then relaunch the app.',
        buttons: ['Quit']
      })
      app.quit()
      throw resetErr
    }
  }
}

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
    // macOS gets the dock icon from the bundle's .icns; this `icon` is
    // primarily for dev mode + Windows/Linux taskbar.
    icon: join(__dirname, '../../resources/icon.png'),
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
    // Resume background artwork extraction for any tracks still pending.
    scheduleArtworkExtraction()
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
/**
 * Record where the just-completed import came from so re-sync + stale detection
 * have a baseline to compare against. Idempotent — safe to call multiple times.
 */
function recordImport(source: 'rekordbox-db' | 'rekordbox-xml', path: string): void {
  try {
    const mtime = statSync(path).mtimeMs
    void setSettings({
      lastImportSource: source,
      lastImportPath: path,
      lastImportMtime: mtime,
      lastImportAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('[main] recordImport failed', err)
  }
}

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
            phase: total === 0 ? 'done' : 'analysing'
          })
        }
      },
      onItem: (result, processed, total) => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send('library:energy-update', {
          trackId: result.trackId,
          energy: result.energy,
          source: result.source
        })
        const now = Date.now()
        if (now - lastProgressEmit >= 250 || processed === total) {
          lastProgressEmit = now
          mainWindow.webContents.send('library:energy-progress', {
            processed,
            total,
            phase: processed === total ? 'done' : 'analysing'
          })
        }
      },
      onComplete: (processed, total) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:energy-progress', {
            processed,
            total,
            phase: 'done'
          })
        }
      }
    }).catch((err) => {
      console.error('[energy] analyser queue crashed', err)
    })
  })
}

/**
 * Kick the background album-artwork extractor (idempotent — no-op if already
 * running). Mirrors scheduleEnergyAnalysis: progress events are throttled to
 * one per ~250ms, but per-item updates fire on every track so library rows
 * swap their gradient for real cover art in real time.
 */
function scheduleArtworkExtraction(): void {
  if (isArtworkRunning()) return
  setImmediate(() => {
    let lastProgressEmit = 0
    void runArtworkQueue({
      onStart: (total) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:artwork-progress', {
            processed: 0,
            total,
            phase: total === 0 ? 'done' : 'extracting'
          })
        }
      },
      onItem: (result, processed, total) => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        // Only notify the renderer when we actually have art to show.
        if (result.source === 'embedded' && result.albumArtPath) {
          mainWindow.webContents.send('library:artwork-update', {
            trackId: result.trackId,
            albumArtPath: result.albumArtPath
          })
        }
        const now = Date.now()
        if (now - lastProgressEmit >= 250 || processed === total) {
          lastProgressEmit = now
          mainWindow.webContents.send('library:artwork-progress', {
            processed,
            total,
            phase: processed === total ? 'done' : 'extracting'
          })
        }
      },
      onComplete: (processed, total) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:artwork-progress', {
            processed,
            total,
            phase: 'done'
          })
        }
      }
    }).catch((err) => {
      console.error('[artwork] extractor queue crashed', err)
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
      speedTestedAt: prefs?.speedTestedAt ?? device.speedTestedAt
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
      speedConfidence: speedConfidenceFromAge(speedTestedAt)
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
    // Persist source metadata so re-sync / stale detection has something to compare against.
    recordImport('rekordbox-xml', xmlPath)
    // First real import arms the free 7-day Pro trial (set-once; later imports are a no-op).
    if (result.total > 0) startTrial()
    // Run health check after import to immediately flag any missing files
    scheduleHealthCheck()
    // Auto-analyse energy for every newly-imported track (background, no UI block)
    scheduleEnergyAnalysis()
    // Extract embedded album artwork for newly-imported tracks (background)
    scheduleArtworkExtraction()
    return result
  })

  // ── Rekordbox auto-detect ────────────────────────────────────────────────

  ipcMain.handle('rekordbox:detect', async () => {
    return detectRekordbox()
  })

  ipcMain.handle('rekordbox:import-db', async (_event, path: string) => {
    try {
      const result = await importFromMasterDb(path, (progress) => {
        mainWindow.webContents.send('library:import-progress', progress)
      })
      recordImport('rekordbox-db', path)
      // First real import arms the free 7-day Pro trial (set-once; later imports are a no-op).
      if (result.total > 0) startTrial()
      scheduleHealthCheck()
      scheduleEnergyAnalysis()
      scheduleArtworkExtraction()
      return result
    } catch (err) {
      // Re-throw with a structured code so the renderer can route to the right fallback UI.
      if (err instanceof RekordboxLockedError) {
        throw Object.assign(new Error(err.message), { code: 'REKORDBOX_LOCKED' })
      }
      if (err instanceof RekordboxKeyMismatchError) {
        throw Object.assign(new Error(err.message), { code: 'REKORDBOX_KEY_MISMATCH' })
      }
      throw err
    }
  })

  ipcMain.handle('rekordbox:check-stale', async () => {
    const settings = getSettings()
    if (!settings.lastImportSource || !settings.lastImportPath) {
      return { stale: false, currentMtime: null, lastImportMtime: settings.lastImportMtime ?? null }
    }
    try {
      const st = statSync(settings.lastImportPath)
      const currentMtime = st.mtimeMs
      const lastMtime = settings.lastImportMtime ?? 0
      return {
        stale: currentMtime > lastMtime + 1000, // 1s slop tolerates fs precision quirks
        currentMtime,
        lastImportMtime: settings.lastImportMtime ?? null
      }
    } catch {
      // Source file no longer exists at the recorded path — treat as not-stale (nothing to compare).
      return { stale: false, currentMtime: null, lastImportMtime: settings.lastImportMtime ?? null }
    }
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

  ipcMain.handle('library:get-playlists', () => {
    return getAllPlaylists(getDb())
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

  ipcMain.handle(
    'algo:suggestions',
    async (
      _e,
      trackId: string,
      setId: string,
      count: number,
      excludeIds: string[] = [],
      sourcePlaylistIds: string[] = []
    ) => {
      // Pro gate (Section 16): the suggestion engine is a paid feature. The UI
      // also hides it for free users — this is defence-in-depth so a tampered
      // renderer can't pull suggestions without entitlement.
      if (!isProEntitled()) return []
      const db = getDb()
      const track = getTrackById(db, trackId)
      if (!track) return []
      // setId may be empty when the user is browsing the library without an active set.
      // In that case use a stub set with no tracks so the diversity/recency penalties
      // are not applied but the harmonic + BPM scoring still runs normally.
      const set = (setId ? getSetById(db, setId) : null) ?? {
        id: '',
        name: '',
        createdAt: '',
        updatedAt: '',
        tracks: [],
        targetHardware: 'CDJ-2000NXS2' as const
      }
      let library = getAllTracks(db)
      if (sourcePlaylistIds.length > 0) {
        const allowed = getTrackIdsForPlaylists(db, sourcePlaylistIds)
        // Always include the source track itself so the algorithm can score relative to it.
        library = library.filter((t) => allowed.has(t.id) || t.id === trackId)
      }
      // Consult the transition graph — tracks the DJ has played after `track`
      // before get a scoring boost and a "you've played this N times" chip.
      const comboLookup = await memoryService.getComboLookupFor(trackId)
      return getSuggestions(track, library, set, count, excludeIds, comboLookup)
    }
  )

  // ── Set Architect (Phase 5) ───────────────────────────────────────────────

  ipcMain.handle('algo:build-set', (_e, params: ArchitectParams) => {
    if (!isProEntitled()) return [] // Pro gate — Set Architect is a paid feature.
    const db = getDb()
    const fullLibrary = getAllTracks(db)
    let library = fullLibrary
    // Narrow the source pool to selected Rekordbox playlists (union of their tracks).
    // Resolving here keeps the algorithm renderer-agnostic and avoids shipping the
    // full playlist index across IPC.
    if (params.sourcePlaylistIds && params.sourcePlaylistIds.length > 0) {
      const allowed = getTrackIdsForPlaylists(db, params.sourcePlaylistIds)
      library = library.filter((t) => allowed.has(t.id))
      // Locked tracks bypass the source-playlist filter — re-add any that got dropped.
      if (params.lockedTracks && params.lockedTracks.length > 0) {
        const present = new Set(library.map((t) => t.id))
        for (const { trackId } of params.lockedTracks) {
          if (!present.has(trackId)) {
            const t = fullLibrary.find((x) => x.id === trackId)
            if (t) library.push(t)
          }
        }
      }
    }
    return buildSet(params, library)
  })

  // ── File health (Phase 6) ────────────────────────────────────────────────

  // Renderer can trigger a manual re-check (e.g. after mounting a USB drive)
  ipcMain.handle('library:health-check', () => {
    scheduleHealthCheck()
  })

  // Manually start the energy analysis queue (Recall Health "Analyse all" button).
  // No-op if a queue is already running.
  ipcMain.handle('library:analyse-energy', () => {
    scheduleEnergyAnalysis()
    return { running: isAnalysisRunning() }
  })

  // Pending count for the "Not yet analysed" stat tile and the analyse-all button.
  ipcMain.handle('library:energy-pending-count', () => {
    return pendingEnergyCount()
  })

  // Edit a track's BPM / key from the Recall Health resolve workflow.
  ipcMain.handle(
    'library:update-track-meta',
    (_e, trackId: string, fields: { bpm?: number; key?: string }) => {
      updateTrackMeta(getDb(), trackId, fields)
    }
  )

  // Relink a missing file: pick a replacement on disk, repoint the track.
  ipcMain.handle('library:relink-file', async (_e, trackId: string) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Locate audio file',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'aiff', 'aif', 'wav', 'flac', 'm4a'] }]
    })
    if (canceled || !filePaths[0]) return null
    updateTrackFilePath(getDb(), trackId, filePaths[0])
    return filePaths[0]
  })

  // ── Cue points (Phase 6) ─────────────────────────────────────────────────

  ipcMain.handle('cues:update', (_e, trackId: string, cuePoints: CuePoint[], hotCues: HotCue[]) => {
    updateTrackCues(getDb(), trackId, cuePoints, hotCues)
  })

  ipcMain.handle('beatgrid:update', (_e, trackId: string, bpm: number, beatgridOffset: number) => {
    updateTrackBeatgrid(getDb(), trackId, bpm, beatgridOffset)
  })

  ipcMain.handle('loops:update', (_e, trackId: string, loops: Loop[]) => {
    updateTrackLoops(getDb(), trackId, loops)
  })

  ipcMain.handle('track:set-energy', (_e, trackId: string, energy: number) => {
    updateTrackEnergy(getDb(), trackId, Math.max(1, Math.min(10, Math.round(energy))), null, 'user')
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

  // ── Licensing / SetSense Pro (Section 16) ─────────────────────────────────
  ipcMain.handle('license:get', () => getLicenseState())

  ipcMain.handle('license:activate', (_e, key: string) => activateLicense(key))

  ipcMain.handle('license:deactivate', () => deactivateLicense())

  // Best-effort online revocation/expiry refresh. Resolves to the (possibly
  // updated) state; an unreachable gateway leaves the offline entitlement intact.
  ipcMain.handle('license:refresh', () => refreshLicenseOnline())

  // The renderer calls this once on mount: it marks the renderer ready (so later
  // deep-links are pushed live) and drains any key buffered during cold start.
  ipcMain.handle('license:consume-pending-activation', (): string | null => {
    rendererReady = true
    const key = pendingActivationKey
    pendingActivationKey = null
    return key
  })

  // Open the external checkout / support page in the user's browser. Restricted
  // to the commerce host so a renderer compromise can't launch arbitrary URLs.
  ipcMain.handle(
    'license:checkout',
    async (_e, plan: 'subscription' | 'lifetime' | 'tip', tipAmount?: number): Promise<boolean> => {
      try {
        const url = checkoutUrl(plan, tipAmount)
        if (new URL(url).host.toLowerCase() !== COMMERCE_HOST) return false
        await shell.openExternal(url)
        return true
      } catch (err) {
        console.error('[license:checkout] failed', err)
        return false
      }
    }
  )

  // ── Customer feedback ─────────────────────────────────────────────────────
  ipcMain.handle(
    'feedback:submit',
    async (
      _e,
      payload: { category: string; rating: number; message: string; email?: string; meta?: string }
    ): Promise<boolean> => {
      try {
        const to = 'carterpinkmusic@gmail.com'
        const stars = payload.rating > 0 ? ` (${payload.rating}/5)` : ''
        const subject = `SetSense feedback — ${payload.category}${stars}`
        const body = [
          payload.message,
          '',
          payload.email ? `Reply to: ${payload.email}` : '',
          payload.meta ? `\n— ${payload.meta}` : ''
        ]
          .filter(Boolean)
          .join('\n')
        const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        await shell.openExternal(url)
        return true
      } catch (err) {
        console.error('[feedback:submit] failed:', err)
        return false
      }
    }
  )

  ipcMain.handle('export:set', async (_e, setId: string, _hardware: CDJModel) => {
    if (!isProEntitled()) return { success: false, error: 'pro_required' } // Pro gate — export is paid.
    const set = getSetById(getDb(), setId)
    if (!set) return { success: false, error: 'Set not found' }
    const safeName = set.name.replace(/[/\\?%*:|"<>]/g, '-')
    const date = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${safeName}_SetSense_${date}.xml`,
      filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }]
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

  ipcMain.handle(
    'usb:update-prefs',
    (
      _e,
      id: string,
      prefs: {
        customName?: string | null
        isFavorite?: boolean
        isExportTarget?: boolean
        readSpeedMBps?: number
        writeSpeedMBps?: number
        speedTestedAt?: string
      }
    ) => {
      const db = getDb()
      if (prefs.readSpeedMBps !== undefined && prefs.writeSpeedMBps !== undefined) {
        updateUSBSpeedResult(db, id, prefs.readSpeedMBps, prefs.writeSpeedMBps)
      }
      const userPrefs: Parameters<typeof updateUSBPrefs>[2] = {}
      if ('customName' in prefs) userPrefs.customName = prefs.customName ?? null
      if (prefs.isFavorite !== undefined) userPrefs.isFavorite = prefs.isFavorite
      if (prefs.isExportTarget !== undefined) userPrefs.isExportTarget = prefs.isExportTarget
      if (Object.keys(userPrefs).length > 0) updateUSBPrefs(db, id, userPrefs)
    }
  )

  ipcMain.handle('usb:test-speed', async (_e, mountPath: string) => {
    return testUSBSpeed(mountPath)
  })

  ipcMain.handle('usb:record-export', (_e, id: string) => {
    recordUSBExport(getDb(), id)
  })

  ipcMain.handle('usb:forget', (_e, id: string) => {
    forgetUSBDevice(getDb(), id)
  })

  ipcMain.handle(
    'usb:copy-to-usb',
    async (_e, srcPath: string, mountPath: string, filename: string) => {
      return copyFileToUSB(srcPath, mountPath, filename)
    }
  )

  // ── Play history (Phase 11) ───────────────────────────────────────────────

  ipcMain.handle('history:get-sessions', () => {
    return getSessions(getDb())
  })

  ipcMain.handle('history:get-session-tracks', (_e, sessionId: string) => {
    return getSessionTracks(getDb(), sessionId)
  })

  ipcMain.handle('history:get-for-track', (_e, trackId: string) => {
    return getSessionsForTrack(getDb(), trackId)
  })

  ipcMain.handle(
    'history:mark-performed',
    (_e, setId: string, opts: { performedAt?: string; venue?: string } = {}) => {
      return markSetAsPerformed(getDb(), setId, opts)
    }
  )

  ipcMain.handle('history:delete', (_e, sessionId: string) => {
    deleteSession(getDb(), sessionId)
  })

  ipcMain.handle('history:import-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Rekordbox history XML',
      filters: [{ name: 'Rekordbox XML', extensions: ['xml'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { sessions: 0, tracks: 0 }
    return importHistoryFile(filePaths[0])
  })

  ipcMain.handle(
    'track:set-lifecycle',
    (_e, trackId: string, state: string | null, source: 'computed' | 'user') => {
      setTrackLifecycle(getDb(), trackId, state, source)
    }
  )

  // ── Lifecycle: flag-for-gig loop ───────────────────────────────────────────

  ipcMain.handle('lifecycle:flag-for-gig', (_e, trackIds: string[]) => {
    flagTracksForGig(getDb(), trackIds)
  })

  ipcMain.handle(
    'lifecycle:resolve-gig-flag',
    (_e, trackId: string, outcome: 'tested' | 'archive' | 'keep') => {
      resolveGigFlag(getDb(), trackId, outcome)
    }
  )

  ipcMain.handle('lifecycle:get-flagged', () => getTracksFlaggedForGig(getDb()))

  ipcMain.handle('lifecycle:flagged-in-session', (_e, sessionId: string) =>
    getFlaggedTracksInSession(getDb(), sessionId)
  )

  // ── Recall / memory engine (Phase 12) ─────────────────────────────────────

  ipcMain.handle('recall:gems', () => memoryService.getGems())
  ipcMain.handle('recall:crates', () => memoryService.listCrates())
  ipcMain.handle('recall:evaluate-crate', (_e, idOrCrate: string | SmartCrate) =>
    memoryService.evaluateCrateById(idOrCrate)
  )
  ipcMain.handle('recall:save-crate', (_e, crate: SmartCrate) => memoryService.saveCrate(crate))
  ipcMain.handle('recall:delete-crate', (_e, id: string) => memoryService.deleteCrateById(id))
  ipcMain.handle('recall:lifecycle', () => memoryService.getLifecycleCounts())
  ipcMain.handle('recall:combos', (_e, trackId: string) => memoryService.getCombosFor(trackId))
  ipcMain.handle('recall:sequences', () => memoryService.getTopSequences())
  ipcMain.handle('recall:dead-ends', () => memoryService.getDeadEnds())
  ipcMain.handle('recall:identity', () => memoryService.getIdentity())
  ipcMain.handle('recall:health', () => memoryService.getHealth())
  ipcMain.handle('recall:dismiss-duplicate', (_e, normalisedKey: string) =>
    memoryService.dismissDuplicate(normalisedKey)
  )
  ipcMain.handle(
    'recall:resolve-duplicate-group',
    (_e, normalisedKey: string, archiveIds: string[]) =>
      memoryService.resolveDuplicateGroup(normalisedKey, archiveIds)
  )
  ipcMain.handle('recall:search', (_e, params: LibrarySearchParams) => memoryService.search(params))

  // ── Recall local-AI layer (Phase 13) ──────────────────────────────────────

  ipcMain.handle('recall:ai-status', () => memoryAssistant.getStatus())

  ipcMain.handle('recall:ai-enable', async (_e, enabled: boolean) => {
    await setSettings({ memoryAiEnabled: enabled })
    memoryAssistant.setEnabled(enabled)
    if (enabled) {
      // Download + load in the background, streaming progress to the renderer.
      void memoryAssistant
        .ensureModel((p) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('recall:ai-progress', memoryAssistant.getStatus())
            void p
          }
        })
        .then(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('recall:ai-progress', memoryAssistant.getStatus())
          }
        })
        .catch(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('recall:ai-progress', memoryAssistant.getStatus())
          }
        })
    }
    return memoryAssistant.getStatus()
  })

  ipcMain.handle('recall:ai-ask', async (_e, question: string) => {
    return memoryAssistant.ask(question)
  })
}

app.whenReady().then(async () => {
  // Bail if another instance owns the lock — this process is on its way out.
  if (!gotSingleInstanceLock) return

  electronApp.setAppUserModelId('com.setsense.app')

  // Init crash reporting before anything else so errors during startup are captured.
  // Only runs when the user has explicitly opted in; default is off.
  if (getSettings().crashReportingEnabled) {
    initCrashReporter()
  }

  // Windows/Linux cold start: the deep-link (or our dev --activate-url flag)
  // rides in on this process's argv. Buffer it now; the renderer drains it on mount.
  handleActivationArgv(process.argv)

  // Pull the YouTube API key out of the OS keychain into our in-process cache
  // before any IPC handler can ask for it. Also migrates legacy electron-store
  // values on first run after the keychain upgrade.
  await loadSecretsFromKeychain()

  // Load (or mint on first run) the anonymous device id before any license read,
  // so device-binding checks have a stable id to compare against.
  await loadDeviceId()

  // Reflect the persisted opt-in so getStatus() is accurate before any ask.
  // We do NOT auto-load the model here — that stays lazy (first ask / enable).
  memoryAssistant.setEnabled(getSettings().memoryAiEnabled)

  protocol.handle('media', async (req) => {
    // media://local/<encoded-path> → absolute fs path. host is always `local`
    // (see src/utils/mediaUrl.ts); each path segment is encodeURIComponent'd.
    let filePath: string
    try {
      filePath = decodeURIComponent(new URL(req.url).pathname)
    } catch {
      return new Response(null, { status: 400 })
    }

    try {
      const stat = await fsp.stat(filePath)
      const size = stat.size
      const type = mediaMimeType(filePath)
      // Honour HTTP Range so <audio> can seek and stream. Without this,
      // Electron's file fetch returns 200/no-range → seekable is empty and any
      // seek snaps back to 0 (the old "scrub restarts the song" bug).
      const rangeHeader = req.headers.get('range')

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
        let start = match && match[1] ? parseInt(match[1], 10) : 0
        let end = match && match[2] ? parseInt(match[2], 10) : size - 1
        if (!Number.isFinite(start) || start < 0) start = 0
        if (!Number.isFinite(end) || end >= size) end = size - 1
        if (start > end || start >= size) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' }
          })
        }
        const body = Readable.toWeb(
          createReadStream(filePath, { start, end })
        ) as unknown as ReadableStream
        return new Response(body, {
          status: 206,
          headers: {
            'Content-Type': type,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(end - start + 1)
          }
        })
      }

      const body = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': type,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(size)
        }
      })
    } catch (err) {
      console.error('[media://] failed', filePath, err)
      return new Response(null, { status: 404 })
    }
  })

  await initDbWithRecovery()

  // Clean up duplicate setsense sessions created by rapid UI clicks or tests.
  // Runs once on every launch — fast (indexed query), never touches rekordbox sessions.
  try {
    const pruned = pruneDuplicateSetsenseSessions(getDb())
    if (pruned > 0) console.log(`[startup] pruned ${pruned} duplicate setsense session(s)`)
  } catch (err) {
    console.error('[startup] pruneDuplicateSetsenseSessions failed', err)
  }

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
