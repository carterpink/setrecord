/**
 * transcribeService.ts — on-device speech-to-text for the conversational Home.
 *
 * Mirrors memoryAssistant's model lifecycle: a whisper.cpp ggml model ships in
 * the app bundle (electron-builder `extraResources` → Contents/Resources/models)
 * and is loaded lazily on first use; if the bundled copy is missing (a dev run,
 * or an install where it was stripped) we self-heal by downloading it once into
 * userData/models. Everything runs locally — audio never leaves the machine.
 *
 * The native binding (`smart-whisper`, a whisper.cpp wrapper) is imported
 * dynamically so the app builds and runs even when it isn't installed; in that
 * case transcription reports a friendly error and typed input keeps working.
 */

import { app, systemPreferences } from 'electron'
import { join } from 'path'
import { existsSync, createWriteStream } from 'fs'
import { mkdir, rename } from 'fs/promises'
import { Readable } from 'stream'
import type { MicAccess, VoiceState, VoiceStatus } from '../../../src/types'

// MUST stay in sync with scripts/fetch-model.mjs (VOICE_MODEL_*), which bundles
// this model into resources/models at build time so voice works offline from
// first launch. The runtime download below is a self-heal fallback only.
const MODEL_FILENAME = 'ggml-base.en.bin'
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'

// Loosely typed to avoid leaking the optional native dep's internals.
interface WhisperInstance {
  transcribe: (
    pcm: Float32Array,
    opts?: { language?: string }
  ) =>
    | Promise<{ result: Promise<Array<{ text: string }>> }>
    | { result: Promise<Array<{ text: string }>> }
  free?: () => void
}

let _whisper: WhisperInstance | null = null
let _loadPromise: Promise<void> | null = null
let _state: VoiceState = 'absent'
let _progress = 0
let _error: string | undefined
let _lock: Promise<unknown> = Promise.resolve()

// Push channel so the renderer can show a one-time "Setting up voice…" chip with
// live download progress (mirrors recall:ai-progress for the language model).
let _onProgress: ((status: VoiceStatus) => void) | null = null

/** Register a listener for voice model state/progress changes (main process). */
export function setVoiceProgressListener(cb: ((status: VoiceStatus) => void) | null): void {
  _onProgress = cb
}

/** Move to a new state (optionally with progress) and notify any listener. */
function emit(state: VoiceState, progress = _progress): void {
  _state = state
  _progress = progress
  _onProgress?.(getVoiceStatus())
}

function downloadDir(): string {
  return join(app.getPath('userData'), 'models')
}
function downloadedModelPath(): string {
  return join(downloadDir(), MODEL_FILENAME)
}
function bundledModelPath(): string {
  return join(process.resourcesPath, 'models', MODEL_FILENAME)
}
function resolveModelPath(): string | null {
  try {
    if (process.resourcesPath && existsSync(bundledModelPath())) return bundledModelPath()
  } catch {
    /* resourcesPath unavailable (tests) — fall through */
  }
  if (existsSync(downloadedModelPath())) return downloadedModelPath()
  return null
}

/**
 * Ask the OS for microphone access before the renderer opens a capture stream.
 * On macOS this surfaces the one-time TCC prompt (when undetermined) and reports
 * a hard 'denied' so the UI can point the user at System Settings instead of
 * failing getUserMedia with a generic error. Windows reports its own status;
 * platforms without a mic-permission concept return 'unavailable' (proceed).
 */
export async function ensureMicAccess(): Promise<MicAccess> {
  if (process.platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone')
      if (status === 'granted') return 'granted'
      if (status === 'not-determined') {
        const ok = await systemPreferences.askForMediaAccess('microphone')
        return ok ? 'granted' : 'denied'
      }
      // 'denied' or 'restricted' (e.g. MDM) — the OS prompt won't reappear.
      return 'denied'
    } catch {
      return 'unavailable'
    }
  }
  if (process.platform === 'win32') {
    try {
      return systemPreferences.getMediaAccessStatus('microphone') === 'denied'
        ? 'denied'
        : 'granted'
    } catch {
      return 'unavailable'
    }
  }
  return 'unavailable'
}

export function getVoiceStatus(): VoiceStatus {
  return {
    state: _state,
    downloaded: resolveModelPath() !== null,
    progress: _progress,
    error: _error
  }
}

export function friendlyError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)) || ''
  const m = raw.toLowerCase()
  if (/enospc|no space left/.test(m))
    return 'Not enough free disk space to set up voice (~150 MB). Free up space and try again. You can still type.'
  if (/enotfound|getaddrinfo|econnrefused|etimedout|network|fetch failed|socket hang/.test(m))
    return 'Couldn’t download the voice model — check your internet connection. You can still type.'
  if (/cannot find module|dlopen|bindings|\.node|was compiled against|smart-whisper/.test(m))
    return 'Voice input couldn’t start on this Mac. You can still type your request.'
  return `Voice input couldn’t start (${raw.slice(0, 100)}). You can still type.`
}

async function downloadModel(): Promise<void> {
  emit('downloading', 0)
  await mkdir(downloadDir(), { recursive: true })
  const res = await fetch(MODEL_URL)
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  let lastEmit = 0
  // Stream to a temp path, then rename — an interrupted download must never
  // leave a truncated file that resolveModelPath() would treat as "present".
  const finalPath = downloadedModelPath()
  const tmpPath = `${finalPath}.partial`
  const file = createWriteStream(tmpPath)
  const reader = res.body.getReader()
  // Stream chunks to disk, tracking progress.
  await new Promise<void>((resolve, reject) => {
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read()
      if (done) {
        file.end(() => resolve())
        return
      }
      received += value.length
      if (total > 0) {
        const next = received / total
        // Throttle pushes to whole-percent steps to avoid flooding the renderer.
        if (next - lastEmit >= 0.01) {
          lastEmit = next
          emit('downloading', next)
        }
      }
      if (!file.write(Buffer.from(value))) {
        file.once('drain', () => void pump())
      } else {
        void pump()
      }
    }
    file.on('error', reject)
    void pump()
  })
  await rename(tmpPath, finalPath)
  // Touch Readable so the import isn't tree-shaken in some bundlers.
  void Readable
}

async function ensureModel(): Promise<void> {
  if (_whisper) return
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    try {
      _error = undefined
      let path = resolveModelPath()
      if (!path) {
        await downloadModel()
        path = downloadedModelPath()
      }
      emit('loading')
      // Indirect specifier so the bundler/typechecker doesn't hard-require the
      // optional native dep — it's resolved at runtime once installed.
      const pkg = 'smart-whisper'
      const mod = (await import(/* @vite-ignore */ pkg)) as unknown as {
        Whisper: new (modelPath: string, opts?: { gpu?: boolean }) => WhisperInstance
      }
      _whisper = new mod.Whisper(path, { gpu: true })
      emit('ready', 1)
    } catch (err) {
      _error = friendlyError(err)
      _whisper = null
      emit('error')
      throw err
    } finally {
      _loadPromise = null
    }
  })()
  return _loadPromise
}

/**
 * Eagerly ensure the model is downloaded and loaded, without transcribing —
 * lets the renderer kick off (and show progress for) the one-time setup the
 * moment the user reaches for voice, rather than stalling the first utterance.
 * Resolves with the final status; never throws (errors surface via the status).
 */
export async function prepareModel(): Promise<VoiceStatus> {
  try {
    await ensureModel()
  } catch {
    /* state/error already captured by ensureModel via emit('error') */
  }
  return getVoiceStatus()
}

/**
 * Strip whisper.cpp's non-speech annotations ([BLANK_AUDIO], [ Silence ],
 * (music), *laughs*, [_BEG_]…) that otherwise leak into the transcript.
 */
export function sanitizeTranscript(text: string): string {
  return text
    .replace(
      /\[\s*(?:blank[_ ]?audio|silence|music|noise|inaudible|applause|laughter|sound|no speech)\s*\]/gi,
      ' '
    )
    .replace(/\(\s*(?:blank[_ ]?audio|silence|music|noise|inaudible|applause|laughter)\s*\)/gi, ' ')
    .replace(/\*[^*]{0,40}\*/g, ' ')
    .replace(/\[_[a-z0-9]*_?\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Transcribe 16 kHz mono Float32 PCM to text. Calls are serialized so the single
 * whisper context isn't entered concurrently. Returns '' on failure (the caller
 * keeps the typed-input path working and can surface getVoiceStatus().error).
 */
export async function transcribe(pcm: Float32Array): Promise<string> {
  const run = _lock.then(async () => {
    await ensureModel()
    if (!_whisper) return ''
    const task = await _whisper.transcribe(pcm, { language: 'en' })
    const segments = await task.result
    return sanitizeTranscript(segments.map((s) => s.text).join(' '))
  })
  _lock = run.catch(() => undefined)
  return run
}
