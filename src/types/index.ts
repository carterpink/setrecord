/**
 * SetSense — shared TypeScript types (full PRD §4 model).
 * Phase 1 had a visual-only subset; Phase 2 expands to the full spec.
 */

// ───────── Music metadata ─────────

export interface CuePoint {
  position: number // ms from start
  type: 'cue' | 'memory'
}

export interface HotCue {
  index: number // 0-7 (A-H)
  position: number // ms from start
  color?: string
  label?: string
}

export type AudioFormat = 'mp3' | 'aiff' | 'wav' | 'flac' | 'm4a' | 'unknown'

/** Where the current `energy` value came from. */
export type EnergySource = 'pending' | 'computed' | 'failed' | 'missing'

// ───────── Track ─────────

export interface Track {
  id: string // UUID, generated on import
  rekordboxId?: string // Original Rekordbox TrackID
  title: string
  artist: string
  album?: string
  genre?: string
  bpm: number // stored as float, display 1dp
  /** Camelot notation: "9A", "11B", etc. */
  key: string
  keyOpenNotation?: string // e.g. "Am", "C#maj"
  energy: number // 1-10
  /** Continuous score from the auto analyser, kept for transparency / debugging. */
  energyRaw?: number
  /** Provenance: 'pending' until the background analyser writes 'computed' / 'failed' / 'missing'. */
  energySource?: EnergySource
  duration: number // seconds
  filePath: string // absolute path on disk
  fileSize?: number // bytes
  bitrate?: number // kbps
  format: AudioFormat
  albumArtPath?: string
  albumArtUrl?: string
  cuePoints: CuePoint[]
  hotCues: HotCue[]
  beatgridOffset?: number // ms
  playCount: number
  rating: number // 0-5 stars
  dateAdded: string // ISO string
  lastPlayed?: string // ISO string
  comment?: string
  label?: string
  color?: string // Rekordbox colour tag
  /** Phase 1 placeholder; deterministic gradient until real artwork loads. */
  artGradient?: string
  /** True when the file at filePath could not be found on disk at last check. */
  missingFile?: boolean
  /** True when this track was imported from Discover with no library match. */
  phantom?: boolean
  /** Populated for phantom tracks — links to buy/download and source set context. */
  discoverMeta?: {
    discoverSetId: string
    discoverSetTitle: string
    beatportUrl: string
    soundcloudUrl: string
    youtubeUrl: string
  }
}

// ───────── Set ─────────

export type SetVibe =
  | 'peak'
  | 'mixed'
  | 'club'
  | 'warmup'
  | 'closing'
  | 'festival'
  | 'underground'
export type VenueType = 'club' | 'festival' | 'bar' | 'private' | 'outdoor'
export type EnergyCurveType = 'rise' | 'peak-sustain' | 'wave' | 'drop-in' | 'custom'
export type CDJModel = 'CDJ-2000NXS2' | 'CDJ-3000' | 'XDJ-RX3' | 'XDJ-XZ' | 'CDJ-2000'

export interface SetTrack {
  id: string // UUID for this set slot
  trackId: string // references Track.id
  track: Track // denormalised for convenience
  position: number // 0-indexed
  transitionScore?: TransitionScore
  energyOverride?: number
  notes?: string
  playing?: boolean // UI-only: currently cued in the preview deck
}

export interface Set {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  tracks: SetTrack[]
  targetDuration?: number // minutes
  targetBpmMin?: number
  targetBpmMax?: number
  vibe?: SetVibe
  venue?: VenueType
  slotTime?: string // "peak" | "warm-up" | "closing"
  energyCurveType?: EnergyCurveType
  safetyScore?: number // 0-100
  targetHardware?: CDJModel
}

/** Lightweight set metadata for the timeline header (no tracks array). */
export interface SetMeta {
  id: string
  name: string
  durationMinutes: number
  trackCount: number
  bpmMin: number
  bpmMax: number
}

// ───────── Transition scoring ─────────

export type TransitionQuality = 'clean' | 'messy' | 'trainwreck'
export type KeyCompatibility = 'perfect' | 'compatible' | 'neutral' | 'clash'

/** Full PRD §4 model + UI helper fields. */
export interface TransitionScore {
  overall: TransitionQuality
  score: number // 0-100, higher = cleaner
  bpmDelta: number // absolute BPM difference
  keyCompatibility: KeyCompatibility
  energyDelta: number // -10 to +10
  reasons: string[] // ["Perfect harmony", "±2 BPM"]
  // UI helpers derived from `overall` at render time:
  dotKind: TransitionDotKind
  label: string // "Clean", "Messy · key clash", etc.
}

export type TransitionDotKind = 'success' | 'warning' | 'danger' | 'info' | 'trainwreck'

// ───────── Suggestions ─────────

export type MatchReasonType = 'key' | 'bpm' | 'energy' | 'genre' | 'texture'
export type MatchReasonQuality = 'positive' | 'neutral' | 'warning'

export interface MatchReason {
  label: string // "Perfect harmony", "Identical BPM", "+1 Energy"
  type: MatchReasonType
  quality: MatchReasonQuality
}

export interface Suggestion {
  track: Track
  transitionScore: TransitionScore
  rank: number
  matchReasons: MatchReason[]
  best?: boolean // UI-only: the single top result
}

// ───────── Library stats + filters ─────────

export interface LibraryStats {
  totalTracks: number
  totalDuration: number // seconds
  missingFiles: number
  unsupportedFormats: number
  tracksWithoutKey: number
  tracksWithoutBpm: number
}

export interface LibraryFilters {
  bpmMin?: number
  bpmMax?: number
  key?: string
  genre?: string
  searchQuery?: string
}

// ───────── Import / export ─────────

export interface ImportProgress {
  processed: number
  total: number
  phase: 'parsing' | 'writing' | 'done'
}

export interface ImportResult {
  total: number
  inserted: number
  errors: number
  missingFiles: number
  stats: LibraryStats
}

export interface ValidationIssue {
  trackId: string
  trackTitle: string
  type: 'missing_file' | 'unsupported_format' | 'bitrate' | 'no_bpm' | 'duration' | 'hot_cues'
  severity: 'blocking' | 'warning'
  message: string
}

export interface ValidationResult {
  score: number // 0-100
  issues: ValidationIssue[]
  isExportReady: boolean
}

export interface ExportResult {
  success: boolean
  filePath?: string
  trackCount?: number
  error?: string
}

// ───────── Architect ─────────

export interface ArchitectParams {
  targetDuration: number // minutes
  vibe: SetVibe
  slotTime: string
  crowdAge: 'young' | 'mixed' | 'mature'
  venueType: VenueType
  bpmMin: number
  bpmMax: number
  harmonicMixing: boolean
  followEnergyCurve: boolean
  energyCurveType: EnergyCurveType
  excludedTracks?: string[]
  seedTrack?: string
}

// ───────── App-shell UI state ─────────

export type AppMode = 'Prepare' | 'Discover'
export type LibraryTab = 'Library' | 'Sets'
export type TimelineCurveView = 'Energy' | 'BPM'

// ───────── Discover ─────────

export type DiscoverTab = 'following' | 'explore'
export type DiscoverSortMode = 'recommended' | 'newest' | 'mostViewed'

export interface DiscoverFilters {
  genres: string[]
  durationBuckets: Array<'<60' | '60-120' | '120-180' | '>180'>
  minViews: number
  uploadedSince: 'week' | 'month' | 'year' | 'all'
}

export type ClarityKind = 'following-dj' | 'plays-artist' | 'matches-genre' | 'trending'

export interface ClarityReason {
  kind: ClarityKind
  label: string
  tooltip: string
  matchedValue?: string
}

export interface DiscoverTrack {
  id: string
  position: number
  artist: string
  title: string
  rawText: string
  startSeconds?: number
  durationSeconds?: number
  confidence: number
}

export interface DiscoverSet {
  id: string
  videoId: string
  title: string
  djName: string
  eventName?: string
  description: string
  thumbnailUrl: string
  durationSeconds: number
  viewCount: number
  likeCount?: number
  uploadedAt: string
  tags: string[]
  tracklist: DiscoverTrack[]
  tracklistConfidence: number
  tracklistSource?: 'description' | 'comments' | 'mixed'
  clarity: ClarityReason
}

export interface TasteProfile {
  favouriteArtists: string[]
  favouriteGenres: string[]
  followedDJs: string[]
}

export interface DiscoverTrackMatch {
  discoverTrack: DiscoverTrack
  match: Track | null
  score: number
}

export interface BulkImportPreview {
  setName: string
  matches: DiscoverTrackMatch[]
  matchedCount: number
  unmatchedCount: number
  alreadyInSetCount: number
}

// ───────── USB Devices ─────────

export type USBSpeedConfidence = 'high' | 'medium' | 'low' | 'untested'
export type USBSpeedStatus = 'optimal' | 'acceptable' | 'slow'
export type USBFilesystemCompatibility = 'optimal' | 'compatible' | 'limited' | 'warning'

/** Live device info merged with persisted user prefs */
export interface USBDevice {
  id: string
  mountPath: string
  label: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  percentUsed: number
  filesystem: string
  protocol: string
  speedConfidence: USBSpeedConfidence
  // Persisted prefs (merged from DB)
  customName?: string
  isFavorite: boolean
  isExportTarget: boolean
  exportCount: number
  lastExport?: string
  lastSeen?: string
  readSpeedMBps?: number
  writeSpeedMBps?: number
  speedTestedAt?: string
}

/** A past device no longer connected but remembered in DB */
export interface RememberedUSBDevice {
  id: string
  label: string
  customName?: string
  isFavorite: boolean
  isExportTarget: boolean
  exportCount: number
  lastExport?: string
  lastSeen: string
  readSpeedMBps?: number
  writeSpeedMBps?: number
}

export interface USBCopyResult {
  success: boolean
  destPath?: string
  error?: string
}
