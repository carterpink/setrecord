import { describe, it, expect } from 'vitest'
import { encodeSeed, decodeSeed, freshSeed } from '../src/utils/seed'

describe('seed codec', () => {
  it('round-trips representative seeds losslessly', () => {
    const samples = [0, 1, 42, 123456, 0x7fffffff, 0xffffffff, 4294967294]
    for (const n of samples) {
      expect(decodeSeed(encodeSeed(n))).toBe(n)
    }
  })

  it('round-trips a fresh random seed', () => {
    for (let i = 0; i < 200; i++) {
      const s = freshSeed()
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(0xffffffff)
      expect(decodeSeed(encodeSeed(s))).toBe(s)
    }
  })

  it('encodes to a short lowercase base36 string', () => {
    expect(encodeSeed(0)).toBe('0')
    expect(encodeSeed(123456)).toBe((123456).toString(36))
    expect(encodeSeed(0xffffffff)).toMatch(/^[0-9a-z]+$/)
  })

  it('tolerates surrounding whitespace and case on input', () => {
    const encoded = encodeSeed(123456)
    expect(decodeSeed(`  ${encoded.toUpperCase()}  `)).toBe(123456)
  })

  it('rejects malformed or out-of-range input', () => {
    expect(decodeSeed('')).toBeNull()
    expect(decodeSeed('   ')).toBeNull()
    expect(decodeSeed('not a seed!')).toBeNull()
    expect(decodeSeed('-1')).toBeNull()
    // 2^32 in base36 is out of the uint32 range and must be rejected.
    expect(decodeSeed((0x100000000).toString(36))).toBeNull()
  })
})
