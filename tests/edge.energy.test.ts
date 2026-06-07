/**
 * EDGE CASES — energy DSP numeric robustness.
 * Covers EC-IMP-141..160. Pure: clamp01.
 */
import { describe, it, expect } from 'vitest'
import { clamp01 } from '../electron/services/energy/spectralFeatures'

describe('edge: clamp01', () => {
  it.each([
    [0, 0],
    [1, 1],
    [0.5, 0.5],
    [-1, 0],
    [2, 1],
    [1.0000001, 1],
    [-0.0000001, 0],
    [NaN, 0], // non-finite → 0 (prevents NaN poisoning downstream scores)
    [Infinity, 0],
    [-Infinity, 0]
  ])('clamp01(%j) === %j', (input, expected) => {
    expect(clamp01(input)).toBe(expected)
  })
})
