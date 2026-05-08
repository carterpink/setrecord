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

export type AppMode = 'Prepare' | 'Play'
export type LibraryTab = 'Library' | 'Sets'
export type TimelineCurveView = 'Energy' | 'BPM'
