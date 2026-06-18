/**
 * setRecorder — the Flight Recorder's lo-fi audio temp-file sink. Verifies the
 * decide-after lifecycle: append chunks to a temp file, then either promote it to
 * a per-session file or discard it; a 0-byte capture yields nothing; and crash-left
 * temps are swept on launch (audio is never silently retained).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const USER_DATA = mkdtempSync(join(tmpdir(), 'setrecord-rec-'))

vi.mock('electron', () => ({
  app: { getPath: (): string => USER_DATA }
}))

import {
  beginRecording,
  appendChunk,
  finalizeRecording,
  promoteRecording,
  discardRecording,
  deleteRecordingFile,
  sweepOrphans
} from '../electron/services/live/setRecorder'

const tmpRecDir = join(USER_DATA, 'recordings', 'tmp')
const recDir = join(USER_DATA, 'recordings')

beforeEach(() => {
  // Clean slate between tests.
  if (existsSync(recDir)) rmSync(recDir, { recursive: true, force: true })
})

afterAll(() => {
  rmSync(USER_DATA, { recursive: true, force: true })
})

describe('setRecorder', () => {
  it('captures chunks to a temp file, then promotes it to a per-session file', () => {
    beginRecording()
    appendChunk(Buffer.from('webm-header'))
    appendChunk(Buffer.from('-more-audio'))
    const fin = finalizeRecording()
    expect(fin).not.toBeNull()
    expect(fin!.bytes).toBe(Buffer.from('webm-header').length + Buffer.from('-more-audio').length)
    expect(existsSync(fin!.tmpPath)).toBe(true)

    const promoted = promoteRecording(fin!.tmpPath, 'session-123')
    expect(promoted.filePath).toBe(join(recDir, 'session-123.webm'))
    expect(existsSync(promoted.filePath)).toBe(true)
    expect(existsSync(fin!.tmpPath)).toBe(false) // moved, not copied

    deleteRecordingFile(promoted.filePath)
    expect(existsSync(promoted.filePath)).toBe(false)
  })

  it('returns null and leaves no file for a 0-byte capture (recorder off)', () => {
    beginRecording()
    const fin = finalizeRecording()
    expect(fin).toBeNull()
    // No temp files left behind.
    expect(existsSync(tmpRecDir) ? readdirSync(tmpRecDir) : []).toEqual([])
  })

  it('discards a finalized temp file when the DJ chooses not to keep it', () => {
    beginRecording()
    appendChunk(Buffer.from('audio'))
    const fin = finalizeRecording()
    expect(existsSync(fin!.tmpPath)).toBe(true)
    discardRecording(fin!.tmpPath)
    expect(existsSync(fin!.tmpPath)).toBe(false)
  })

  it('beginRecording clears a prior in-flight temp (no orphan from re-arming)', () => {
    beginRecording()
    appendChunk(Buffer.from('first-set'))
    // Re-arm without finalizing (e.g. a new set started) — the old temp is dropped.
    beginRecording()
    appendChunk(Buffer.from('second'))
    const fin = finalizeRecording()
    expect(fin!.bytes).toBe(Buffer.from('second').length)
    // Exactly one temp existed; it's now finalized (still present until promote/discard).
    expect(readdirSync(tmpRecDir).filter((f) => f.endsWith('.webm'))).toHaveLength(1)
  })

  it('sweeps crash-left temp files on launch', () => {
    beginRecording()
    appendChunk(Buffer.from('orphaned-by-crash'))
    // Simulate a crash: never finalize. The temp file is still on disk.
    expect(readdirSync(tmpRecDir).filter((f) => f.endsWith('.webm')).length).toBeGreaterThan(0)
    sweepOrphans()
    expect(readdirSync(tmpRecDir).filter((f) => f.endsWith('.webm'))).toEqual([])
  })
})
