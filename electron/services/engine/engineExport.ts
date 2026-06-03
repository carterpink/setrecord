/**
 * Export a set to a USB drive as an Engine DJ "Engine Library", gig-ready:
 * copies the set's audio files onto the drive and writes the Engine Library
 * SQLite database referencing the on-USB (relative) paths, so the drive plays
 * on Denon hardware / imports cleanly into Engine DJ Desktop.
 *
 * On-USB layout:
 *   <usb>/Engine Library/m.db          (library: tracks + playlist + metadata)
 *   <usb>/Engine Library/p.db          (performance db — Information only)
 *   <usb>/Engine Library/Music/<file>  (copied audio; Track.path is "Music/<file>")
 *
 * Beatgrids / hot cues / loops / key are intentionally not written — Denon
 * re-analyses on load (see engineSchema.ts).
 */

import { existsSync, renameSync, rmSync } from 'fs'
import { mkdir, copyFile } from 'fs/promises'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'
import type { Set as DJSet, ExportResult } from '../../../src/types'
import {
  M_DB_SCHEMA,
  P_DB_SCHEMA,
  ENGINE_SCHEMA_VERSION,
  MetaDataType,
  MetaDataIntegerType,
  TRACK_TYPE_AUDIO,
  ratingToEngine,
  safeMusicFilename
} from './engineSchema'

export interface EngineExportProgress {
  processed: number
  total: number
  phase: 'copying' | 'writing' | 'done'
}

/** One track's data, already resolved to its on-USB relative path. */
export interface EngineTrackInput {
  title: string
  artist: string
  album?: string
  genre?: string
  comment?: string
  bpm: number
  durationSec: number
  bitrate?: number
  rating: number
  year?: number
  /** Path relative to the Engine Library directory, e.g. "Music/track.mp3". */
  relPath: string
  filename: string
  /** Lowercase extension without the dot, e.g. "mp3". */
  extension: string
}

/** Write the Engine Library m.db tables + rows into an open database. */
export function populateEngineDatabase(
  db: Database.Database,
  payload: { uuid: string; playlistTitle: string; tracks: EngineTrackInput[] }
): void {
  for (const stmt of M_DB_SCHEMA) db.exec(stmt)

  db.prepare(
    `INSERT INTO Information (uuid, schemaVersionMajor, schemaVersionMinor, schemaVersionPatch, currentPlayedIndicator)
     VALUES (?, ?, ?, ?, 0)`
  ).run(
    payload.uuid,
    ENGINE_SCHEMA_VERSION.major,
    ENGINE_SCHEMA_VERSION.minor,
    ENGINE_SCHEMA_VERSION.patch
  )

  // A default AlbumArt row every Track points at (we don't export art yet).
  db.prepare('INSERT INTO AlbumArt (id, hash, albumArt) VALUES (1, ?, NULL)').run('')

  const playlistId = Number(
    db.prepare('INSERT INTO Playlist (title) VALUES (?)').run(payload.playlistTitle).lastInsertRowid
  )

  const insTrack = db.prepare(
    `INSERT INTO Track
       (playOrder, length, lengthCalculated, bpm, year, path, filename, bitrate,
        bpmAnalyzed, trackType, isExternalTrack, uuidOfExternalDatabase,
        idTrackInExternalDatabase, idAlbumArt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1)`
  )
  const insMeta = db.prepare('INSERT INTO MetaData (id, type, text) VALUES (?, ?, ?)')
  const insMetaInt = db.prepare('INSERT INTO MetaDataInteger (id, type, value) VALUES (?, ?, ?)')
  const insEntry = db.prepare(
    `INSERT INTO PlaylistTrackList
       (playlistId, trackId, trackIdInOriginDatabase, databaseUuid, trackNumber)
     VALUES (?, ?, ?, ?, ?)`
  )

  const writeAll = db.transaction((tracks: EngineTrackInput[]) => {
    tracks.forEach((t, i) => {
      const lengthSec = Math.round(t.durationSec)
      const bpmInt = Math.round(t.bpm)
      const trackId = Number(
        insTrack.run(
          i + 1,
          lengthSec,
          lengthSec,
          bpmInt,
          t.year ?? 0,
          t.relPath,
          t.filename,
          t.bitrate ?? 0,
          t.bpm || 0,
          TRACK_TYPE_AUDIO
        ).lastInsertRowid
      )

      const text: Array<[number, string | undefined]> = [
        [MetaDataType.Title, t.title],
        [MetaDataType.Artist, t.artist],
        [MetaDataType.Album, t.album],
        [MetaDataType.Genre, t.genre],
        [MetaDataType.Comment, t.comment],
        [MetaDataType.FileExtension, t.extension]
      ]
      for (const [type, value] of text) {
        if (value) insMeta.run(trackId, type, value)
      }

      if (t.rating > 0) {
        insMetaInt.run(trackId, MetaDataIntegerType.Rating, ratingToEngine(t.rating))
      }

      insEntry.run(playlistId, trackId, trackId, payload.uuid, i + 1)
    })
  })
  writeAll(payload.tracks)
}

/** Write the minimal performance database (pairs with m.db by uuid). */
export function populatePerformanceDatabase(db: Database.Database, uuid: string): void {
  for (const stmt of P_DB_SCHEMA) db.exec(stmt)
  db.prepare(
    `INSERT INTO Information (uuid, schemaVersionMajor, schemaVersionMinor, schemaVersionPatch, currentPlayedIndicator)
     VALUES (?, ?, ?, ?, 0)`
  ).run(uuid, ENGINE_SCHEMA_VERSION.major, ENGINE_SCHEMA_VERSION.minor, ENGINE_SCHEMA_VERSION.patch)
}

/** Create a SQLite file at `path` via a temp file + atomic rename. */
function writeDatabaseFile(path: string, populate: (db: Database.Database) => void): void {
  const tmp = `${path}.setsense-tmp`
  try {
    if (existsSync(tmp)) rmSync(tmp)
  } catch {
    /* best-effort */
  }
  const db = new Database(tmp)
  try {
    populate(db)
  } finally {
    db.close()
  }
  renameSync(tmp, path)
}

/**
 * Copy the set's audio onto the USB and write the Engine Library. Assumes the
 * caller has already validated (no missing/non-owned tracks); we still guard
 * each copy and abort cleanly rather than leave a half-written, surprising USB.
 */
export async function exportSetToEngineUsb(
  set: DJSet,
  usbRoot: string,
  onProgress: (p: EngineExportProgress) => void
): Promise<ExportResult> {
  try {
    const tracks = set.tracks.map((st) => st.track)
    const total = tracks.length
    const engineLibDir = join(usbRoot, 'Engine Library')
    const musicDir = join(engineLibDir, 'Music')
    await mkdir(musicDir, { recursive: true })

    const uuid = randomUUID()
    const taken = new Set<string>()
    const inputs: EngineTrackInput[] = []

    onProgress({ processed: 0, total, phase: 'copying' })
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]
      // Defence in depth: never produce a USB that references a track that isn't there.
      if (t.phantom || !existsSync(t.filePath)) {
        return {
          success: false,
          error: `Can’t export — "${t.title}" has no local file. Fix blocking issues and try again.`
        }
      }
      const filename = safeMusicFilename(t.filePath, taken)
      await copyFile(t.filePath, join(musicDir, filename))
      inputs.push({
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre,
        comment: t.comment,
        bpm: t.bpm ?? 0,
        durationSec: t.duration ?? 0,
        bitrate: t.bitrate,
        rating: t.rating ?? 0,
        relPath: `Music/${filename}`,
        filename,
        extension: extname(filename).replace('.', '').toLowerCase()
      })
      onProgress({ processed: i + 1, total, phase: 'copying' })
    }

    onProgress({ processed: total, total, phase: 'writing' })
    writeDatabaseFile(join(engineLibDir, 'm.db'), (db) =>
      populateEngineDatabase(db, { uuid, playlistTitle: set.name, tracks: inputs })
    )
    writeDatabaseFile(join(engineLibDir, 'p.db'), (db) => populatePerformanceDatabase(db, uuid))

    onProgress({ processed: total, total, phase: 'done' })
    return { success: true, filePath: engineLibDir, trackCount: total }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
