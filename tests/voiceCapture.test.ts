/**
 * Tests for the audio resampling math behind voice capture (FR-705). The whisper
 * model expects 16 kHz mono PCM; the browser captures at the device rate (often
 * 44.1/48 kHz), so downsample/buildPcm must decimate correctly. A bug here would
 * silently feed whisper wrong-pitch audio and wreck transcription accuracy.
 *
 * Pure functions — no DOM, so they run in the plain-Node vitest runner.
 */
import { describe, it, expect } from 'vitest'
import { downsample, buildPcm } from '../src/hooks/voicePcm'

describe('downsample', () => {
  it('returns the input untouched when already at 16 kHz', () => {
    const input = new Float32Array([1, 2, 3, 4])
    expect(downsample(input, 16000)).toBe(input)
  })

  it('decimates 2:1 from 32 kHz, picking every other sample', () => {
    const input = new Float32Array([10, 20, 30, 40, 50, 60, 70, 80])
    expect(Array.from(downsample(input, 32000))).toEqual([10, 30, 50, 70])
  })

  it('decimates 3:1 from 48 kHz', () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(Array.from(downsample(input, 48000))).toEqual([0, 3, 6])
  })

  it('handles 44.1 kHz (non-integer ratio) without overruns', () => {
    const input = new Float32Array(441)
    for (let i = 0; i < input.length; i++) input[i] = i
    const out = downsample(input, 44100)
    expect(out.length).toBe(Math.floor(441 / (44100 / 16000)))
    expect(out.every((v: number) => Number.isFinite(v))).toBe(true)
  })
})

describe('buildPcm', () => {
  it('concatenates chunks then downsamples to 16 kHz', () => {
    const chunks = [new Float32Array([1, 2]), new Float32Array([3, 4])]
    // merged [1,2,3,4] at 32 kHz → 2:1 → [1, 3]
    expect(Array.from(buildPcm(chunks, 32000))).toEqual([1, 3])
  })

  it('passes through merged audio unchanged at 16 kHz', () => {
    const chunks = [new Float32Array([5, 6]), new Float32Array([7])]
    expect(Array.from(buildPcm(chunks, 16000))).toEqual([5, 6, 7])
  })

  it('handles an empty capture', () => {
    expect(buildPcm([], 48000).length).toBe(0)
  })
})
