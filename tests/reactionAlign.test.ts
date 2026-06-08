/**
 * bestLagSamples — the cross-correlation alignment that lets reactionPipeline line
 * up the reconstructed library reference with the recorded room segment before
 * NLMS echo-cancellation. Without it the reference is seconds off and isolation
 * fails (everything falls back to 'derived'); these tests prove it recovers a known
 * shift from the energy envelope.
 */
import { describe, it, expect } from 'vitest'
import { bestLagSamples } from '../electron/services/blackbox/reactionPipeline'

const RATE = 1000 // small rate keeps the test fast; envWin default 0.05s = 50 samples

/** A signal with a distinctive, non-periodic energy fingerprint per 50-sample block. */
function fingerprintSignal(length: number): Float64Array {
  const sig = new Float64Array(length)
  for (let i = 0; i < length; i++) {
    const block = Math.floor(i / 50)
    const amp = (((block * 7) % 11) + 1) / 12 // varies block-to-block, never zero
    sig[i] = amp * Math.sin(i * 0.5)
  }
  return sig
}

describe('bestLagSamples', () => {
  it('recovers a known lag of an exact sub-slice', () => {
    const reference = fingerprintSignal(3000)
    const trueLag = 700 // a multiple of the 50-sample envelope window
    const observed = reference.slice(trueLag, trueLag + 1000)
    expect(bestLagSamples(observed, reference, RATE)).toBe(trueLag)
  })

  it('returns 0 when the observed window starts at the reference start', () => {
    const reference = fingerprintSignal(3000)
    const observed = reference.slice(0, 1000)
    expect(bestLagSamples(observed, reference, RATE)).toBe(0)
  })

  it('returns 0 when the reference is not longer than the observed (no room to search)', () => {
    const reference = fingerprintSignal(1000)
    const observed = fingerprintSignal(1000)
    expect(bestLagSamples(observed, reference, RATE)).toBe(0)
  })
})
