import { describe, it, expect } from 'vitest'
import { openNotationToCamelot, getKeyCompatibility, CAMELOT_KEYS } from '../electron/utils/camelot'

describe('openNotationToCamelot', () => {
  it('maps the canonical minor and major spellings from the PRD example', () => {
    expect(openNotationToCamelot('Am')).toBe('8A')
    expect(openNotationToCamelot('C')).toBe('8B')
  })

  it('treats enharmonic equivalents as the same Camelot slot', () => {
    expect(openNotationToCamelot('C#')).toBe(openNotationToCamelot('Db'))
    expect(openNotationToCamelot('A#m')).toBe(openNotationToCamelot('Bbm'))
  })

  it('returns undefined for unknown / empty input rather than throwing', () => {
    expect(openNotationToCamelot('')).toBeUndefined()
    expect(openNotationToCamelot('XYZ')).toBeUndefined()
  })
})

describe('getKeyCompatibility', () => {
  it('rates identical keys as perfect harmony', () => {
    const r = getKeyCompatibility('8A', '8A')
    expect(r.relationship).toBe('perfect')
    expect(r.scoreModifier).toBe(30)
  })

  it('rates same-number opposite-letter as a mood shift', () => {
    const r = getKeyCompatibility('8A', '8B')
    expect(r.relationship).toBe('compatible')
    expect(r.reason).toBe('Mood shift')
  })

  it('rates far-apart keys as a clash', () => {
    const r = getKeyCompatibility('1A', '7B')
    expect(r.relationship).toBe('clash')
    expect(r.scoreModifier).toBeLessThan(0)
  })

  it('exposes all 24 canonical Camelot slots', () => {
    expect(CAMELOT_KEYS).toHaveLength(24)
  })
})
