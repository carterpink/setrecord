/**
 * EDGE CASES — Rekordbox import path handling + session/venue parsing.
 * Covers EC-IMP-081..140. Pure: combinePath, parseSessionMeta.
 */
import { describe, it, expect } from 'vitest'
import { combinePath } from '../electron/services/rekordbox/dbReader'
import { parseSessionMeta } from '../electron/services/rekordbox/sessionMeta'

describe('edge: combinePath', () => {
  it.each([
    ['/Users/Music', 'a.mp3', '/Users/Music/a.mp3'],
    ['/Users/Music/', 'a.mp3', '/Users/Music/a.mp3'], // no double slash
    ['/m', 'Bicep%20-%20Glue.mp3', '/m/Bicep - Glue.mp3'], // %20 decoded
    ['/m', '%E2%9C%93.mp3', '/m/✓.mp3'], // unicode percent-decode
    ['/a/b', '../c.mp3', '/a/c.mp3'] // path normalised
  ])('combinePath(%j, %j) === %j', (folder, file, expected) => {
    expect(combinePath(folder, file)).toBe(expected)
  })

  it.each([
    [null, 'a.mp3'],
    ['/m', null],
    [null, null],
    ['', 'a.mp3'], // empty folder is falsy → null
    ['/m', '']
  ])('returns null when a part is missing (%j, %j)', (folder, file) => {
    expect(combinePath(folder, file)).toBeNull()
  })

  it('leaves a malformed percent-sequence intact rather than throwing', () => {
    expect(combinePath('/m', 'bad%ZZ.mp3')).toBe('/m/bad%ZZ.mp3')
  })
})

describe('edge: parseSessionMeta (venue extraction)', () => {
  it.each([
    ['Hi Ibiza 2025-07-12', 'Hi Ibiza'],
    ['HISTORY 2024-07-12', null], // pure boilerplate
    ['Boiler Room', 'Boiler Room'],
    ['Fabric 12.07.25', 'Fabric'],
    ['Berghain 21:30', 'Berghain'], // 24h clock time stripped, venue kept
    ['HISTORY: Warehouse Project', 'Warehouse Project']
  ])('parseSessionMeta(%j).venue === %j', (input, venue) => {
    expect(parseSessionMeta(input).venue).toBe(venue)
  })

  it.each([[null], [undefined], [''], ['   '], ['12-07'], ['2025'], ['session'], ['HISTORY']])(
    'returns null venue for empty/generic/numeric %j',
    (input) => {
      const r = parseSessionMeta(input as string | null | undefined)
      expect(r.venue).toBeNull()
      expect(r.source).toBe('auto')
    }
  )

  it('always tags the source as auto', () => {
    expect(parseSessionMeta('Printworks').source).toBe('auto')
  })
})
