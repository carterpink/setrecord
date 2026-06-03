/**
 * Engine DJ "Engine Library" SQLite schema (m.db) — the export target.
 *
 * ⚠️ SCHEMA IS LOAD-CRITICAL. Engine DJ rejects a database whose schema doesn't
 * conform, so the DDL here is kept isolated, exact, and version-labelled. We
 * target the documented, stable **Engine Library 1.6.0** format (the SC5000 /
 * Engine Prime layout: `/Engine Library/m.db` + `p.db`). Engine DJ Desktop
 * imports and converts this to the current Database2 format for newer standalone
 * hardware — the same "import into the desktop app" flow the Rekordbox XML
 * export relies on.
 *
 * Reference: mixxxdj/mixxx wiki "Engine Library Format".
 *
 * Track metadata is stored EAV-style across MetaData (text) + MetaDataInteger
 * (numeric), keyed by track id + a type enum — NOT as columns on Track.
 *
 * NOT WRITTEN (Denon re-analyses on load — see the export's documented limits):
 * beatgrids, hot cues, loops and musical key. Those live in proprietary
 * performance blobs we deliberately don't fabricate.
 */

export const ENGINE_SCHEMA_VERSION = { major: 1, minor: 6, patch: 0 } as const

/** MetaData (text) type enum. */
export const MetaDataType = {
  Title: 1,
  Artist: 2,
  Album: 3,
  Genre: 4,
  Comment: 5,
  FileExtension: 13
} as const

/** MetaDataInteger (numeric) type enum. */
export const MetaDataIntegerType = {
  /** 0–120 in steps of 20 (0–5 stars × 20). */
  Rating: 5
} as const

/** Track.trackType for a normal local audio file. */
export const TRACK_TYPE_AUDIO = 1

/**
 * DDL for the main library database (m.db). Order matters: referenced tables
 * (AlbumArt, Track, Playlist) are created before the tables that reference them.
 */
export const M_DB_SCHEMA: readonly string[] = [
  `CREATE TABLE Information (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    schemaVersionMajor INTEGER,
    schemaVersionMinor INTEGER,
    schemaVersionPatch INTEGER,
    currentPlayedIndicator INTEGER
  )`,
  `CREATE TABLE AlbumArt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT,
    albumArt BLOB
  )`,
  `CREATE TABLE Track (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playOrder INTEGER,
    length INTEGER,
    lengthCalculated INTEGER,
    bpm INTEGER,
    year INTEGER,
    path TEXT,
    filename TEXT,
    bitrate INTEGER,
    bpmAnalyzed REAL,
    trackType INTEGER,
    isExternalTrack NUMERIC,
    uuidOfExternalDatabase TEXT,
    idTrackInExternalDatabase INTEGER,
    idAlbumArt INTEGER,
    FOREIGN KEY (idAlbumArt) REFERENCES AlbumArt (id)
  )`,
  `CREATE TABLE MetaData (
    id INTEGER,
    type INTEGER,
    text TEXT,
    PRIMARY KEY (id, type),
    FOREIGN KEY (id) REFERENCES Track (id)
  )`,
  `CREATE TABLE MetaDataInteger (
    id INTEGER,
    type INTEGER,
    value INTEGER,
    PRIMARY KEY (id, type),
    FOREIGN KEY (id) REFERENCES Track (id)
  )`,
  `CREATE TABLE Playlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT
  )`,
  `CREATE TABLE PlaylistTrackList (
    playlistId INTEGER,
    trackId INTEGER,
    trackIdInOriginDatabase INTEGER,
    databaseUuid TEXT,
    trackNumber INTEGER,
    FOREIGN KEY (playlistId) REFERENCES Playlist (id),
    FOREIGN KEY (trackId) REFERENCES Track (id)
  )`
]

/**
 * DDL for the performance database (p.db). We don't fabricate per-track
 * performance data (beatgrids/cues) — Denon re-analyses — so this carries only
 * the matching Information row that pairs it with m.db.
 */
export const P_DB_SCHEMA: readonly string[] = [
  `CREATE TABLE Information (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    schemaVersionMajor INTEGER,
    schemaVersionMinor INTEGER,
    schemaVersionPatch INTEGER,
    currentPlayedIndicator INTEGER
  )`
]

/** Map a 0–5 star rating to Engine's 0–120 scale (steps of 20). */
export function ratingToEngine(rating: number): number {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)))
  return clamped * 20
}

/**
 * Make a filesystem-safe, collision-free filename for the USB's Music folder.
 * `taken` tracks names already used in this export so duplicates get a suffix.
 */
export function safeMusicFilename(original: string, taken: Set<string>): string {
  // Strip directory, replace characters illegal on FAT/exFAT USB drives.
  const base = original.split('/').pop() ?? 'track'
  const dot = base.lastIndexOf('.')
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[\\/:*?"<>|]/g, '_').trim() || 'track'
  const ext = dot > 0 ? base.slice(dot) : ''

  let candidate = `${stem}${ext}`
  let n = 1
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${stem}-${n}${ext}`
    n++
  }
  taken.add(candidate.toLowerCase())
  return candidate
}
