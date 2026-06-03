/**
 * NFR-107 — serialise a synthetic Track[] to a Rekordbox-format XML string that
 * importFromXml() can parse. Mirrors the exact attribute names the importer
 * reads (see libraryImport.ts mapping at ~line 540) so the import benchmark
 * exercises the real parse + field-mapping + SQLite-write path end-to-end.
 *
 *   Track.filePath  → Location  (file://localhost/<uri-encoded path>)
 *   Track.rating    ← Rating    (0–255; importer divides by 51)
 *   Track.key       ← Tonality  (open notation; openNotationToCamelot maps back)
 */

import type { Track } from '../../src/types'

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build a Rekordbox Location URL from an absolute POSIX path. */
function toLocation(filePath: string): string {
  // Rekordbox encodes each path segment; parseLocation() reverses this with
  // decodeURIComponent after stripping the file://localhost prefix.
  const encoded = filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `file://localhost${encoded}`
}

function trackXml(t: Track): string {
  const attrs: Array<[string, string | number | undefined]> = [
    ['TrackID', t.rekordboxId],
    ['Name', t.title],
    ['Artist', t.artist],
    ['Album', t.album],
    ['Genre', t.genre],
    ['Kind', `${t.format.toUpperCase()} File`],
    ['Size', t.fileSize],
    ['TotalTime', Math.round(t.duration)],
    ['AverageBpm', t.bpm.toFixed(2)],
    ['BitRate', t.bitrate],
    ['Tonality', t.keyOpenNotation ?? ''],
    ['Energy', t.energySource === 'rekordbox' ? t.energy : ''],
    ['PlayCount', t.playCount],
    ['Rating', t.rating * 51], // 0–5 → 0–255
    ['DateAdded', t.dateAdded.slice(0, 10)],
    ['Label', t.label],
    ['Location', toLocation(t.filePath)]
  ]

  const rendered = attrs
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${xmlEscape(String(v))}"`)
    .join(' ')

  // A couple of POSITION_MARK (cue) children so parseCuePoints has real work.
  const marks = t.hotCues
    .map(
      (c) =>
        `<POSITION_MARK Name="${xmlEscape(c.label ?? '')}" Type="0" Start="${(
          c.position / 1000
        ).toFixed(3)}" Num="${c.index}"/>`
    )
    .join('')

  return `<TRACK ${rendered}>${marks}</TRACK>`
}

/**
 * Serialise the whole library into a single DJ_PLAYLISTS document. The importer
 * reads parsed.DJ_PLAYLISTS.COLLECTION[0].TRACK as an array.
 */
export function tracksToRekordboxXml(tracks: Track[]): string {
  const body = tracks.map(trackXml).join('\n')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<DJ_PLAYLISTS Version="1.0.0">\n` +
    `<PRODUCT Name="rekordbox" Version="6.7.0" Company="AlphaTheta"/>\n` +
    `<COLLECTION Entries="${tracks.length}">\n${body}\n</COLLECTION>\n` +
    `<PLAYLISTS>\n<NODE Type="0" Name="ROOT" Count="0"/>\n</PLAYLISTS>\n` +
    `</DJ_PLAYLISTS>\n`
  )
}
