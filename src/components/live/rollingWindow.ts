/**
 * Turns a continuous audio stream into fixed-length, hop-spaced probe windows.
 *
 * Live capture arrives as a stream of small frames (AudioWorklet hands over
 * ~128 samples at a time). The fingerprint matcher wants a few SECONDS of
 * contiguous audio every so often. RollingWindower keeps the most recent
 * `windowSize` samples in a ring buffer and emits a contiguous copy every
 * `hopSize` new samples — so the live detector gets a steady cadence of probes
 * without re-allocating per frame.
 *
 * Pure (no DOM/Web Audio) so the windowing logic is unit-testable in isolation.
 */
export class RollingWindower {
  private readonly ring: Float32Array
  private readonly windowSize: number
  private readonly hopSize: number
  private writePos = 0
  private totalWritten = 0
  private lastEmit = 0

  /**
   * @param windowSize samples per emitted window (e.g. 6s × sampleRate)
   * @param hopSize    new samples required between emissions (e.g. 1.5s × rate)
   * @param onWindow   receives a fresh contiguous Float32Array of windowSize
   */
  constructor(
    windowSize: number,
    hopSize: number,
    private readonly onWindow: (window: Float32Array) => void
  ) {
    if (windowSize <= 0 || hopSize <= 0) throw new Error('windowSize/hopSize must be > 0')
    this.windowSize = windowSize
    this.hopSize = hopSize
    this.ring = new Float32Array(windowSize)
  }

  /** Append a frame of mono samples; emits a window when the hop is reached. */
  push(chunk: Float32Array): void {
    for (let i = 0; i < chunk.length; i++) {
      this.ring[this.writePos] = chunk[i]
      this.writePos = (this.writePos + 1) % this.windowSize
      this.totalWritten++
    }
    // Emit at most once per push (chunks are small); catches up over hops.
    if (this.totalWritten >= this.windowSize && this.totalWritten - this.lastEmit >= this.hopSize) {
      this.lastEmit = this.totalWritten
      this.onWindow(this.snapshot())
    }
  }

  /** Contiguous, time-ordered copy of the current window (oldest → newest). */
  private snapshot(): Float32Array {
    const out = new Float32Array(this.windowSize)
    // The oldest sample sits at writePos (the next slot to overwrite).
    const tail = this.windowSize - this.writePos
    out.set(this.ring.subarray(this.writePos), 0)
    out.set(this.ring.subarray(0, this.writePos), tail)
    return out
  }

  reset(): void {
    this.ring.fill(0)
    this.writePos = 0
    this.totalWritten = 0
    this.lastEmit = 0
  }
}
