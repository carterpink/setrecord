/**
 * Tests for the on-device speech-to-text service (FR-705). Covers the pure /
 * near-pure logic that doesn't need the native whisper binding or a real model:
 *   - sanitizeTranscript: strips whisper.cpp's non-speech annotations
 *   - friendlyError: maps raw errors to actionable, type-still-works messages
 *   - ensureMicAccess: OS mic-permission decision per platform
 *   - getVoiceStatus: status shape when no model is present
 *
 * The model download/load + transcribe paths require the native module and a
 * network fetch, so they're exercised manually / in an Electron smoke run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'os'

const getMediaAccessStatus = vi.fn()
const askForMediaAccess = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => tmpdir()) },
  systemPreferences: {
    getMediaAccessStatus: (...a: unknown[]) => getMediaAccessStatus(...a),
    askForMediaAccess: (...a: unknown[]) => askForMediaAccess(...a)
  }
}))

import {
  sanitizeTranscript,
  friendlyError,
  ensureMicAccess,
  getVoiceStatus
} from '../electron/services/speech/transcribeService'

describe('sanitizeTranscript', () => {
  it('strips bracketed non-speech annotations', () => {
    expect(sanitizeTranscript('[BLANK_AUDIO]')).toBe('')
    expect(sanitizeTranscript('hello [ Silence ] world')).toBe('hello world')
    expect(sanitizeTranscript('play [Music] something')).toBe('play something')
    expect(sanitizeTranscript('find [no speech] tracks')).toBe('find tracks')
  })

  it('strips parenthesised annotations and asterisk actions', () => {
    expect(sanitizeTranscript('warm up (music) set')).toBe('warm up set')
    expect(sanitizeTranscript('build *laughs* a set')).toBe('build a set')
  })

  it('strips whisper special tokens like [_BEG_]', () => {
    expect(sanitizeTranscript('[_BEG_]find me songs')).toBe('find me songs')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeTranscript('  hello   there  ')).toBe('hello there')
  })

  it('leaves real speech untouched', () => {
    expect(sanitizeTranscript('what do I play after this')).toBe('what do I play after this')
  })
})

describe('friendlyError', () => {
  it('detects out-of-disk-space', () => {
    expect(friendlyError(new Error('ENOSPC: no space left on device'))).toMatch(/disk space/i)
  })

  it('detects network failures', () => {
    expect(friendlyError(new Error('getaddrinfo ENOTFOUND huggingface.co'))).toMatch(
      /internet connection/i
    )
    expect(friendlyError(new Error('fetch failed'))).toMatch(/internet connection/i)
  })

  it('detects native-binding / ABI failures', () => {
    expect(friendlyError(new Error('Cannot find module smart-whisper'))).toMatch(/couldn’t start/i)
    expect(friendlyError(new Error('was compiled against a different Node.js version'))).toMatch(
      /couldn’t start/i
    )
  })

  it('falls back to a generic but reassuring message', () => {
    const msg = friendlyError(new Error('something weird'))
    expect(msg).toMatch(/still type/i)
  })

  it('always tells the user they can still type', () => {
    for (const e of ['ENOSPC', 'fetch failed', 'dlopen failed', 'mystery']) {
      expect(friendlyError(new Error(e))).toMatch(/type/i)
    }
  })
})

describe('ensureMicAccess', () => {
  const realPlatform = process.platform
  const setPlatform = (p: NodeJS.Platform): void => {
    Object.defineProperty(process, 'platform', { value: p, configurable: true })
  }

  beforeEach(() => {
    getMediaAccessStatus.mockReset()
    askForMediaAccess.mockReset()
  })
  afterEach(() => setPlatform(realPlatform))

  it('darwin: granted → granted (no prompt)', async () => {
    setPlatform('darwin')
    getMediaAccessStatus.mockReturnValue('granted')
    await expect(ensureMicAccess()).resolves.toBe('granted')
    expect(askForMediaAccess).not.toHaveBeenCalled()
  })

  it('darwin: not-determined → prompts; granted', async () => {
    setPlatform('darwin')
    getMediaAccessStatus.mockReturnValue('not-determined')
    askForMediaAccess.mockResolvedValue(true)
    await expect(ensureMicAccess()).resolves.toBe('granted')
    expect(askForMediaAccess).toHaveBeenCalledWith('microphone')
  })

  it('darwin: not-determined → prompts; declined', async () => {
    setPlatform('darwin')
    getMediaAccessStatus.mockReturnValue('not-determined')
    askForMediaAccess.mockResolvedValue(false)
    await expect(ensureMicAccess()).resolves.toBe('denied')
  })

  it('darwin: denied/restricted → denied (no re-prompt)', async () => {
    setPlatform('darwin')
    getMediaAccessStatus.mockReturnValue('denied')
    await expect(ensureMicAccess()).resolves.toBe('denied')
    expect(askForMediaAccess).not.toHaveBeenCalled()
  })

  it('darwin: thrown API → unavailable (never blocks)', async () => {
    setPlatform('darwin')
    getMediaAccessStatus.mockImplementation(() => {
      throw new Error('no such API')
    })
    await expect(ensureMicAccess()).resolves.toBe('unavailable')
  })

  it('win32: denied → denied, otherwise granted', async () => {
    setPlatform('win32')
    getMediaAccessStatus.mockReturnValue('denied')
    await expect(ensureMicAccess()).resolves.toBe('denied')
    getMediaAccessStatus.mockReturnValue('granted')
    await expect(ensureMicAccess()).resolves.toBe('granted')
  })

  it('linux: unavailable (no mic-permission concept)', async () => {
    setPlatform('linux')
    await expect(ensureMicAccess()).resolves.toBe('unavailable')
    expect(getMediaAccessStatus).not.toHaveBeenCalled()
  })
})

describe('getVoiceStatus', () => {
  it('reports a well-formed status with no model present', () => {
    const s = getVoiceStatus()
    expect(s).toMatchObject({ downloaded: false })
    expect(typeof s.state).toBe('string')
    expect(typeof s.progress).toBe('number')
  })
})
