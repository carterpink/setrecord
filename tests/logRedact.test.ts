/**
 * NFR-801 Phase 1 — redaction helpers. These guarantee that absolute home-dir
 * paths, media file directory trees, and email-shaped tokens never reach disk.
 */
import { describe, it, expect } from 'vitest'
import { homedir } from 'os'
import { frameBasename, redactPath, scrubString } from '../electron/services/logging/redact'

const HOME = homedir().replace(/\\/g, '/').replace(/\/+$/, '')

describe('frameBasename', () => {
  it('reduces a POSIX path to its last segment', () => {
    expect(frameBasename('/Users/sam/app/electron/main.ts')).toBe('main.ts')
  })

  it('reduces a Windows path to its last segment', () => {
    expect(frameBasename('C:\\Users\\sam\\app\\main.ts')).toBe('main.ts')
  })

  it('returns a bare filename unchanged', () => {
    expect(frameBasename('main.ts')).toBe('main.ts')
  })
})

describe('redactPath', () => {
  it('collapses the home dir to ~', () => {
    expect(redactPath(`${HOME}/Documents/SetSense/app.db`)).toBe('~/Documents/SetSense/app.db')
  })

  it('reduces a media file under home to basename only', () => {
    expect(redactPath(`${HOME}/Music/Crates/House/Track Title.mp3`)).toBe('Track Title.mp3')
  })

  it('reduces a media file outside home to basename only', () => {
    expect(redactPath('/Volumes/USB DRIVE/My Set/song.flac')).toBe('song.flac')
  })

  it('leaves a non-home, non-media path unchanged', () => {
    expect(redactPath('/opt/app/config.json')).toBe('/opt/app/config.json')
  })

  it('returns empty input unchanged', () => {
    expect(redactPath('')).toBe('')
  })
})

describe('scrubString', () => {
  it('replaces a home-dir absolute path with ~', () => {
    const s = `failed to read ${HOME}/Library/Application Support/foo`
    expect(scrubString(s)).toContain('~/Library/Application Support/foo')
    expect(scrubString(s)).not.toContain(HOME)
  })

  it('redacts an email-shaped token', () => {
    expect(scrubString('user carter.pink@gmail.com signed in')).toBe(
      'user [redacted-email] signed in'
    )
  })

  it('leaves a clean string unchanged', () => {
    expect(scrubString('import complete: 412 tracks')).toBe('import complete: 412 tracks')
  })
})
