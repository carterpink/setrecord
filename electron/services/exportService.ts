import { writeFileSync, renameSync, unlinkSync, existsSync } from 'fs'
import { Builder } from 'xml2js'
import type { Set as DJSet, Track, ExportResult, TrackTag } from '../../src/types'
import { labelForSlug, orderTags } from '../../src/utils/tagging/taxonomy'

// Inlined from src/utils/constants.ts to avoid renderer-side import in main process
const HOT_CUE_COLORS: readonly string[] = [
  '#3B82F6', // A — blue
  '#EF4444', // B — red
  '#22C55E', // C — green
  '#EAB308', // D — yellow
  '#06B6D4', // E — cyan
  '#F97316', // F — orange
  '#A855F7', // G — purple
  '#FFFFFF' // H — white
]

function encodeFilePath(filePath: string): string {
  return (
    'file://localhost' +
    filePath
      .split('/')
      .map((seg) => (seg === '' ? '' : encodeURIComponent(seg)))
      .join('/')
  )
}

/**
 * Format a track's tags into Rekordbox's MyTag-in-comments syntax `/* a / b *​/`,
 * merged with any existing comment. Rekordbox shows these in the Comments column
 * and they survive XML import — the safe, non-destructive tag hand-off.
 */
export function formatTagsComment(tags: TrackTag[] | undefined, existing?: string): string {
  const labels = orderTags(tags ?? [])
    .filter((t) => t.value)
    .map((t) => labelForSlug(t.value))
  if (labels.length === 0) return existing ?? ''
  const block = `/* ${labels.join(' / ')} */`
  const base = (existing ?? '').replace(/\s*\/\*.*?\*\/\s*/g, '').trim()
  return base ? `${base} ${block}` : block
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  }
}

function buildPositionMarks(track: Track): object[] {
  const marks: object[] = []

  for (const cp of track.cuePoints) {
    marks.push({
      $: {
        Name: '',
        Type: '0',
        Start: (cp.position / 1000).toFixed(3),
        Num: '-1'
      }
    })
  }

  for (const hc of track.hotCues.slice(0, 8)) {
    const colorHex = hc.color ?? HOT_CUE_COLORS[hc.index] ?? '#FFFFFF'
    const { r, g, b } = hexToRgb(colorHex)
    marks.push({
      $: {
        Name: hc.label ?? '',
        Type: '1',
        Start: (hc.position / 1000).toFixed(3),
        Num: String(hc.index),
        Red: String(r),
        Green: String(g),
        Blue: String(b)
      }
    })
  }

  return marks
}

export async function exportSet(set: DJSet, filePath: string): Promise<ExportResult> {
  try {
    const tracks = set.tracks.map((st) => st.track)

    const collectionEntries = tracks.map((track, idx) => {
      const trackId = track.rekordboxId ?? String(idx + 1)
      const posMarks = buildPositionMarks(track)
      const entry: Record<string, unknown> = {
        $: {
          TrackID: trackId,
          Name: track.title,
          Artist: track.artist,
          Album: track.album ?? '',
          Genre: track.genre ?? '',
          TotalTime: String(Math.floor(track.duration)),
          BPM: (track.bpm ?? 0).toFixed(2),
          Location: encodeFilePath(track.filePath),
          Tonality: track.keyOpenNotation ?? track.key ?? '',
          BitRate: String(track.bitrate ?? 0),
          PlayCount: String(track.playCount ?? 0),
          Rating: String(track.rating ?? 0),
          Comments: track.comment ?? '',
          Label: track.label ?? ''
        }
      }
      if (posMarks.length > 0) {
        entry['POSITION_MARK'] = posMarks
      }
      return entry
    })

    const playlistTracks = tracks.map((track, idx) => ({
      $: { Key: track.rekordboxId ?? String(idx + 1) }
    }))

    const djPlaylists = {
      DJ_PLAYLISTS: {
        $: { Version: '1.0.0' },
        PRODUCT: {
          $: { Name: 'rekordbox', Version: '6.0.0', Company: 'Pioneer DJ' }
        },
        COLLECTION: {
          $: { Entries: String(tracks.length) },
          TRACK: collectionEntries
        },
        PLAYLISTS: {
          NODE: {
            $: { Type: '0', Name: 'ROOT', Count: '1' },
            NODE: {
              $: {
                Name: set.name,
                Type: '1',
                KeyType: '0',
                Entries: String(tracks.length)
              },
              TRACK: playlistTracks
            }
          }
        }
      }
    }

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    })
    const xml = builder.buildObject(djPlaylists)

    const tmpPath = `${filePath}.setrecord-tmp`
    try {
      writeFileSync(tmpPath, xml, 'utf-8')
      renameSync(tmpPath, filePath)
    } catch (writeErr) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
      } catch {
        // best-effort cleanup — swallow unlink errors
      }
      throw writeErr
    }

    return { success: true, filePath, trackCount: tracks.length }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Export the (tagged) library as a Rekordbox XML COLLECTION, with each track's
 * tags merged into its Comments field via {@link formatTagsComment}. This is the
 * safe, non-destructive tag hand-off: the user imports it into Rekordbox and the
 * tags show in the Comments column. master.db is never touched.
 */
export async function exportLibraryTagsXml(
  tracks: Track[],
  filePath: string
): Promise<ExportResult> {
  try {
    const tagged = tracks.filter((t) => (t.tags?.length ?? 0) > 0)
    const collectionEntries = tagged.map((track, idx) => ({
      $: {
        TrackID: track.rekordboxId ?? String(idx + 1),
        Name: track.title,
        Artist: track.artist,
        Album: track.album ?? '',
        Genre: track.genre ?? '',
        TotalTime: String(Math.floor(track.duration)),
        BPM: (track.bpm ?? 0).toFixed(2),
        Location: encodeFilePath(track.filePath),
        Tonality: track.keyOpenNotation ?? track.key ?? '',
        Comments: formatTagsComment(track.tags, track.comment),
        Label: track.label ?? ''
      }
    }))

    const djPlaylists = {
      DJ_PLAYLISTS: {
        $: { Version: '1.0.0' },
        PRODUCT: { $: { Name: 'rekordbox', Version: '6.0.0', Company: 'Pioneer DJ' } },
        COLLECTION: { $: { Entries: String(tagged.length) }, TRACK: collectionEntries },
        PLAYLISTS: {
          NODE: { $: { Type: '0', Name: 'ROOT', Count: '0' } }
        }
      }
    }

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: true, indent: '  ', newline: '\n' }
    })
    const xml = builder.buildObject(djPlaylists)

    const tmpPath = `${filePath}.setrecord-tmp`
    try {
      writeFileSync(tmpPath, xml, 'utf-8')
      renameSync(tmpPath, filePath)
    } catch (writeErr) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
      } catch {
        /* best-effort cleanup */
      }
      throw writeErr
    }

    return { success: true, filePath, trackCount: tagged.length }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
