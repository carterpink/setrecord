import { describe, it, expect } from 'vitest'
import { analyzeEnds } from '../electron/algorithms/memory/closers'

describe('analyzeEnds', () => {
  it('returns empty lists for empty input', () => {
    const { openers, closers } = analyzeEnds([])
    expect(openers).toHaveLength(0)
    expect(closers).toHaveLength(0)
  })

  it('ignores single-track sequences', () => {
    const { openers, closers } = analyzeEnds([['a'], ['b']])
    expect(openers).toHaveLength(0)
    expect(closers).toHaveLength(0)
  })

  it('counts opener and closer for a 2-track sequence', () => {
    const { openers, closers } = analyzeEnds([['x', 'y']])
    expect(openers[0]).toEqual({ trackId: 'x', count: 1 })
    expect(closers[0]).toEqual({ trackId: 'y', count: 1 })
  })

  it('accumulates opener counts across multiple sessions', () => {
    const seqs = [
      ['a', 'b', 'c'],
      ['a', 'd', 'e'],
      ['f', 'g', 'c'],
    ]
    const { openers } = analyzeEnds(seqs)
    expect(openers[0]).toEqual({ trackId: 'a', count: 2 })
    expect(openers.find((o) => o.trackId === 'f')?.count).toBe(1)
  })

  it('accumulates closer counts', () => {
    const seqs = [
      ['a', 'b', 'c'],
      ['d', 'e', 'c'],
      ['f', 'g', 'h'],
    ]
    const { closers } = analyzeEnds(seqs)
    expect(closers[0]).toEqual({ trackId: 'c', count: 2 })
    expect(closers.find((c) => c.trackId === 'h')?.count).toBe(1)
  })

  it('returns openers and closers ranked descending by count', () => {
    const seqs = [
      ['z', 'a'],
      ['z', 'b'],
      ['z', 'c'],
      ['y', 'a'],
    ]
    const { openers, closers } = analyzeEnds(seqs)
    // z appears 3 times as opener, y once
    expect(openers[0].trackId).toBe('z')
    expect(openers[0].count).toBe(3)
    // a appears 2 times as closer
    expect(closers[0].trackId).toBe('a')
    expect(closers[0].count).toBe(2)
  })

  it('handles the same track being both opener and closer in different sessions', () => {
    const seqs = [
      ['pivot', 'x'],  // pivot = opener
      ['pivot', 'y'],  // pivot = opener again → count 2
      ['z', 'pivot'],  // pivot = closer → count 1
      ['z', 'q'],      // q = closer (count 1, z is opener again)
    ]
    const { openers, closers } = analyzeEnds(seqs)
    // pivot should top openers (count 2)
    expect(openers[0].trackId).toBe('pivot')
    // pivot should appear in closers list
    expect(closers.some((c) => c.trackId === 'pivot')).toBe(true)
  })

  it('long sequences — only first and last are counted', () => {
    const seqs = [['a', 'b', 'c', 'd', 'e']]
    const { openers, closers } = analyzeEnds(seqs)
    expect(openers[0].trackId).toBe('a')
    expect(closers[0].trackId).toBe('e')
    // middle tracks should NOT appear
    expect(openers.map((o) => o.trackId)).not.toContain('c')
    expect(closers.map((c) => c.trackId)).not.toContain('c')
  })
})
