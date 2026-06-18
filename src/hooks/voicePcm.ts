/**
 * Pure PCM helpers for voice capture (FR-705). Kept dependency-free (no React,
 * no window) so they can be unit-tested in the plain-Node runner and reused
 * without dragging renderer globals into other typecheck contexts.
 *
 * whisper expects 16 kHz mono Float32 PCM; the browser captures at the device
 * rate (often 44.1/48 kHz), so we decimate down to 16 kHz before transcribing.
 */
const TARGET_RATE = 16000

/** Linear-decimate a Float32 buffer from `inRate` to 16 kHz. */
export function downsample(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_RATE) return input
  const ratio = inRate / TARGET_RATE
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    out[i] = input[Math.floor(i * ratio)] ?? 0
  }
  return out
}

/** Concatenate captured chunks into a single 16 kHz mono buffer. */
export function buildPcm(chunks: Float32Array[], rate: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.length
  }
  return downsample(merged, rate)
}
