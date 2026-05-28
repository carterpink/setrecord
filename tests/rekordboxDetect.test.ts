import { describe, it, expect } from 'vitest'
import { _internals } from '../electron/services/rekordbox/detect'

const { parseXmlExportPath } = _internals

describe('parseXmlExportPath', () => {
  it('finds the XML export path under xml-import-export.export-path', () => {
    const raw = JSON.stringify({
      'xml-import-export': { 'export-path': '/Users/dj/Music/rekordbox.xml' },
    })
    expect(parseXmlExportPath(raw)).toBe('/Users/dj/Music/rekordbox.xml')
  })

  it('falls back to options.exportXmlPath shape', () => {
    const raw = JSON.stringify({ options: { exportXmlPath: '/tmp/lib.xml' } })
    expect(parseXmlExportPath(raw)).toBe('/tmp/lib.xml')
  })

  it('falls back to the top-level exportXmlPath shape', () => {
    const raw = JSON.stringify({ exportXmlPath: '/a/b/c.xml' })
    expect(parseXmlExportPath(raw)).toBe('/a/b/c.xml')
  })

  it('returns null when the JSON is not valid', () => {
    expect(parseXmlExportPath('not json')).toBeNull()
  })

  it('returns null when none of the known shapes match', () => {
    expect(parseXmlExportPath('{"some":"other","shape":42}')).toBeNull()
  })

  it('returns null when the field is an empty string', () => {
    expect(parseXmlExportPath('{"exportXmlPath":""}')).toBeNull()
  })

  it('ignores non-string values in the expected slot', () => {
    expect(parseXmlExportPath('{"exportXmlPath":123}')).toBeNull()
  })
})
