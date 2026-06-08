/**
 * setRecorder — main-process sink for the Flight Recorder's lo-fi reference audio.
 *
 * The renderer's MediaRecorder streams webm/opus chunks over IPC while a set is
 * live; we append them straight to a temp file (so RAM stays flat regardless of
 * set length). On stop the DJ decides: SAVE promotes the temp into
 * `userData/recordings/<sessionId>.webm`, DISCARD unlinks it. Audio is LOCAL-ONLY
 * and never leaves the device.
 *
 * Writes are SYNCHRONOUS (openSync/writeSync/closeSync): chunks arrive only every
 * few seconds, so the cost is negligible, and it guarantees the file is fully on
 * disk before promoteRecording renames it — an async WriteStream could rename a
 * half-flushed file and lose the tail of the set.
 *
 * Crash safety: a temp file left behind by a crash (no save/discard ever ran) is
 * swept on next launch — we never silently retain audio the DJ didn't choose to keep.
 */
import { app } from 'electron'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync
} from 'fs'
import { join } from 'path'

/**
 * Hard disk cap (~5h at 32 kbps ≈ 72 MB). A webm container can't be trimmed from
 * the front without a remux, so we cap-and-stop rather than ring-overwrite: past
 * the cap we stop appending and flag it, keeping the earliest hours.
 */
const MAX_BYTES = 80 * 1024 * 1024

function recordingsDir(): string {
  return join(app.getPath('userData'), 'recordings')
}
function tmpDir(): string {
  return join(recordingsDir(), 'tmp')
}
function ensureDirs(): void {
  mkdirSync(tmpDir(), { recursive: true })
}

let fd: number | null = null
let tmpPath: string | null = null
let bytes = 0
let capped = false

/** Drop the in-flight temp file (close fd + unlink), best effort. */
function discardActive(): void {
  if (fd != null) {
    try {
      closeSync(fd)
    } catch {
      /* already closed */
    }
  }
  if (tmpPath && existsSync(tmpPath)) {
    try {
      unlinkSync(tmpPath)
    } catch {
      /* best effort */
    }
  }
  fd = null
  tmpPath = null
  bytes = 0
  capped = false
}

/** Open a fresh temp file for a new live session. Clears any prior in-flight temp. */
export function beginRecording(): void {
  discardActive()
  ensureDirs()
  tmpPath = join(tmpDir(), `${crypto.randomUUID()}.webm`)
  fd = openSync(tmpPath, 'w')
  bytes = 0
  capped = false
}

/** Append one encoded chunk from the renderer. No-op if not recording or capped. */
export function appendChunk(chunk: Buffer): void {
  if (fd == null || capped) return
  if (bytes + chunk.length > MAX_BYTES) {
    capped = true
    return
  }
  try {
    writeSync(fd, chunk)
    bytes += chunk.length
  } catch {
    /* disk error — stop recording rather than crash the set */
    capped = true
  }
}

export interface PendingAudio {
  tmpPath: string
  bytes: number
}

/**
 * Close the temp file and hand back its path + size, or null if nothing was
 * captured (recorder off, or a 0-byte file — which we unlink). Idempotent.
 */
export function finalizeRecording(): PendingAudio | null {
  const p = tmpPath
  const b = bytes
  if (fd != null) {
    try {
      closeSync(fd)
    } catch {
      /* already closed */
    }
  }
  fd = null
  tmpPath = null
  bytes = 0
  capped = false
  if (!p) return null
  if (b === 0) {
    try {
      if (existsSync(p)) unlinkSync(p)
    } catch {
      /* best effort */
    }
    return null
  }
  return { tmpPath: p, bytes: b }
}

export interface PromotedRecording {
  filePath: string
  bytes: number
}

/** Move a finalized temp file to its permanent per-session path. */
export function promoteRecording(tmp: string, sessionId: string): PromotedRecording {
  ensureDirs()
  const finalPath = join(recordingsDir(), `${sessionId}.webm`)
  renameSync(tmp, finalPath)
  return { filePath: finalPath, bytes: statSync(finalPath).size }
}

/** Delete a finalized temp file the DJ chose not to keep. */
export function discardRecording(tmp: string): void {
  try {
    if (existsSync(tmp)) unlinkSync(tmp)
  } catch {
    /* best effort */
  }
}

/** Delete the permanent audio file for a session (on session delete). */
export function deleteRecordingFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch {
    /* best effort */
  }
}

/** On launch, remove any temp files a crash left behind (never silently retained). */
export function sweepOrphans(): void {
  try {
    const dir = tmpDir()
    if (!existsSync(dir)) return
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.webm')) {
        try {
          unlinkSync(join(dir, f))
        } catch {
          /* best effort */
        }
      }
    }
  } catch {
    /* best effort */
  }
}
