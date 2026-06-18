import { describe, it, expect } from 'vitest'
import { getTargetCurve, getCurveDeviation } from '../electron/algorithms/energyCurve'

describe('getTargetCurve', () => {
  it('rise: ascends from a low opener to a high closer', () => {
    const curve = getTargetCurve('rise', 10)
    expect(curve).toHaveLength(10)
    expect(curve[0]).toBeLessThanOrEqual(curve[curve.length - 1])
    expect(curve[0]).toBeLessThan(6)
    expect(curve[curve.length - 1]).toBeGreaterThanOrEqual(8)
  })

  it('peak-sustain: plateaus at 9 in the middle of the set', () => {
    const curve = getTargetCurve('peak-sustain', 10)
    // Mid-set positions (40-80%) should sit at the sustain plateau
    const midIdx = Math.floor(curve.length * 0.6)
    expect(curve[midIdx]).toBe(9)
  })
})

describe('getCurveDeviation', () => {
  it('returns 100 when actual matches target exactly', () => {
    expect(getCurveDeviation([4, 6, 8], [4, 6, 8])).toBe(100)
  })

  it('returns lower scores as deviation grows', () => {
    const close = getCurveDeviation([5, 5, 5], [5, 6, 5])
    const far = getCurveDeviation([5, 5, 5], [1, 9, 1])
    expect(close).toBeGreaterThan(far)
  })
})
