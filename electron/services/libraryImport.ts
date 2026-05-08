import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { parseStringPromise } from 'xml2js'
import type { AudioFormat, ImportProgress, ImportResult, Track } from '../../src/types'
import { openNotationToCamelot } from '../utils/camelot'
import { getDb } from '../db/schema'
import { getLibraryStats } from '../db/queries'

// ───────── Field mapping helpers ─────────

function parseLocation(raw: string): string {
  // Rekordbox encodes paths as file://localhost/… or file:///…
  return decodeURIComponent(
    raw
      .replace(/^file:\/\/localhost/, '')
      .replace(/^file:\/\/\//, '/')
  )
}

function parseFormat(filePath: string): AudioFormat {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, AudioFormat> = {
    '.mp3': 'mp3',
    '.aiff': 'aiff',
    '.aif': 'aiff',
    '.wav': 'wav',
    '.flac': 'flac',
    '.m4a': 'm4a',
  }
  return map[ext] ?? 'unknown'
}

function parseRating(raw: string | undefined): number {
  if (!raw) return 0
  // Rekordbox uses 0-255; normalise to 0-5
  return Math.round(parseInt(raw, 10) / 51)
}

function parseCuePoints(marks: unknown[]): { cuePoints: Track['cuePoints']; hotCues: Track['hotCues'] } {
  const cuePoints: Track['cuePoints'] = []
  const hotCues: Track['hotCues'] = []

  for (const mark of marks ?? []) {
    const m = (mark as { $: Record<string, string> }).$
    if (!m) continue
    const position = parseFloat(m.Start ?? '0') * 1000 // seconds → ms
    const type = m.Type ?? '0'

    if (type === '0') {
      // Memory cue
      cuePoints.push({ position, type: 'memory' })
    } else if (type === '1') {
      // Default cue
      cuePoints.push({ position, type: 'cue' })
    } else {
      // Hot cue (type "3" in Rekordbox XML, index from Num attr)
      const index = parseInt(m.Num ?? '0', 10)
      hotCues.push({
        index,
        position,
        color: m.Red && m.Green && m.Blue
          ? `rgb(${m.Red},${m.Green},${m.Blue})`
          : undefined,
      })
    }
  }

  return { cuePoints, hotCues }
}

// ───────── Main export ─────────

export async function importFromXml(
  xmlPath: string,
  onProgress: (p: ImportProgress) => void
): Promise<ImportResult> {
  const db = getDb()
  let errors = 0
  let missingFiles = 0

  // 1. Read + parse XML
  const xml = readFileSync(xmlPath, 'utf-8')
  const parsed = await parseStringPromise(xml, { explicitArray: true })

  const collection =
    parsed?.DJ_PLAYLISTS?.COLLECTION?.[0]?.TRACK ?? []

  const total: number = collection.length
  onProgress({ processed: 0, total, phase: 'parsing' })

  if (total === 0) {
    const stats = getLibraryStats(db)
    return { total: 0, inserted: 0, errors: 0, missingFiles: 0, stats }
  }

  // 2. Map Rekordbox fields → Track objects
  const tracks: Track[] = []

  for (let i = 0; i < total; i++) {
    try {
      const t = collection[i].$
      if (!t?.Location) continue

      const filePath = parseLocation(t.Location)
      const { cuePoints, hotCues } = parseCuePoints(collection[i].POSITION_MARK ?? [])

      if (!existsSync(filePath)) missingFiles++

      const track: Track = {
        id: crypto.randomUUID(),
        rekordboxId: t.TrackID,
        title: t.Name ?? 'Unknown title',
        artist: t.Artist ?? 'Unknown artist',
        album: t.Album || undefined,
        genre: t.Genre || undefined,
        bpm: parseFloat(t.AverageBpm ?? '0'),
        key: openNotationToCamelot(t.Tonality ?? '') ?? '',
        keyOpenNotation: t.Tonality || undefined,
        energy: parseInt(t.Energy ?? '5', 10) || 5,
        duration: parseFloat(t.TotalTime ?? '0'),
        filePath,
        fileSize: t.Size ? parseInt(t.Size, 10) : undefined,
        bitrate: t.BitRate ? parseInt(t.BitRate, 10) : undefined,
        format: parseFormat(filePath),
        cuePoints,
        hotCues,
        beatgridOffset: undefined,
        playCount: parseInt(t.PlayCount ?? '0', 10),
        rating: parseRating(t.Rating),
        dateAdded: t.DateAdded ? new Date(t.DateAdded).toISOString() : new Date().toISOString(),
        comment: t.Comments || undefined,
        label: t.Label || undefined,
        color: t.Colour || undefined,
      }

      tracks.push(track)
    } catch {
      errors++
    }
  }

  // 3. Batch write with progress events every 100 tracks
  const BATCH = 100
  const insert = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, rekordbox_id, title, artist, album, genre, bpm, key, key_open,
      energy, duration, file_path, file_size, bitrate, format,
      album_art_path, album_art_url, play_count, rating, date_added,
      last_played, comment, label, color, cue_points, hot_cues, beatgrid_offset
    ) VALUES (
      @id, @rekordbox_id, @title, @artist, @album, @genre, @bpm, @key, @key_open,
      @energy, @duration, @file_path, @file_size, @bitrate, @format,
      @album_art_path, @album_art_url, @play_count, @rating, @date_added,
      @last_played, @comment, @label, @color, @cue_points, @hot_cues, @beatgrid_offset
    )
  `)

  const insertBatch = db.transaction((batch: Track[]) => {
    for (const track of batch) {
      insert.run({
        id: track.id,
        rekordbox_id: track.rekordboxId ?? null,
        title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        genre: track.genre ?? null,
        bpm: track.bpm,
        key: track.key,
        key_open: track.keyOpenNotation ?? null,
        energy: track.energy,
        duration: track.duration,
        file_path: track.filePath,
        file_size: track.fileSize ?? null,
        bitrate: track.bitrate ?? null,
        format: track.format,
        album_art_path: null,
        album_art_url: null,
        play_count: track.playCount,
        rating: track.rating,
        date_added: track.dateAdded,
        last_played: null,
        comment: track.comment ?? null,
        label: track.label ?? null,
        color: track.color ?? null,
        cue_points: JSON.stringify(track.cuePoints),
        hot_cues: JSON.stringify(track.hotCues),
        beatgrid_offset: track.beatgridOffset ?? 0,
      })
    }
  })

  for (let i = 0; i < tracks.length; i += BATCH) {
    insertBatch(tracks.slice(i, i + BATCH))
    onProgress({ processed: Math.min(i + BATCH, tracks.length), total, phase: 'writing' })
  }

  onProgress({ processed: total, total, phase: 'done' })

  const stats = getLibraryStats(db)
  return { total, inserted: tracks.length, errors, missingFiles, stats }
}
