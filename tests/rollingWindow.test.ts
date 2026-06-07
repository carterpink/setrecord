/**
 * RollingWindower — verifies hop-spaced emission and contiguous, time-ordered
 * window contents as small frames stream in.
 */
import { describe, it, expect } from 'vitest'
import { RollingWindower } from '../src/components/live/rollingWindow'

/** A ramp so we can assert ordering: sample value === its global index. */
function ramp(start: number, len: number): Float32Array {
  const a = new Float32Array(len)
  for (let i = 0; i < len; i++) a[i] = start + i
  return a
}

describe('RollingWindower', () => {
  it('emits nothing until the first full window is buffered', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(100, 25, (win) => windows.push(win))
    // Feed 99 samples in chunks — not enough for a window.
    for (let i = 0; i < 99; i++) w.push(ramp(i, 1))
    expect(windows).toHaveLength(0)
    // One more completes the window and (99→100 ≥ hop 25 since lastEmit 0) emits.
    w.push(ramp(99, 1))
    expect(windows).toHaveLength(1)
    expect(windows[0]).toHaveLength(100)
  })

  it('emits once per hop after warmup', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(100, 50, (win) => windows.push(win))
    // Push 300 samples one at a time. Emissions at totalWritten = 100, 150,
    // 200, 250, 300 → 5 windows.
    for (let i = 0; i < 300; i++) w.push(ramp(i, 1))
    expect(windows).toHaveLength(5)
  })

  it('emits the most recent windowSize samples, in order', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(10, 5, (win) => windows.push(win))
    // Feed 0..19 in one chunk → after 20 written, last window = [10..19].
    for (let i = 0; i < 20; i++) w.push(ramp(i, 1))
    const last = windows[windows.length - 1]
    expect(Array.from(last)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  })

  it('handles multi-sample chunks and ring wrap correctly', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(8, 8, (win) => windows.push(win))
    w.push(ramp(0, 5)) // 0..4
    w.push(ramp(5, 5)) // 5..9  → total 10 ≥ window 8 and hop 8 → emit [2..9]
    expect(windows).toHaveLength(1)
    expect(Array.from(windows[0])).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('returns independent copies, not views into the ring', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(4, 4, (win) => windows.push(win))
    w.push(ramp(0, 4)) // emit [0,1,2,3]
    w.push(ramp(4, 4)) // emit [4,5,6,7] — must not mutate the first window
    expect(Array.from(windows[0])).toEqual([0, 1, 2, 3])
    expect(Array.from(windows[1])).toEqual([4, 5, 6, 7])
  })

  it('reset() clears state', () => {
    const windows: Float32Array[] = []
    const w = new RollingWindower(10, 5, (win) => windows.push(win))
    for (let i = 0; i < 12; i++) w.push(ramp(i, 1))
    const before = windows.length
    w.reset()
    for (let i = 0; i < 4; i++) w.push(ramp(0, 1))
    expect(windows.length).toBe(before) // no new emit until a full window again
  })
})
