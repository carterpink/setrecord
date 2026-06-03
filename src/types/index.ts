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

/** A saved loop region (Rekordbox-style). */
export interface Loop {
  startMs: number
  endMs: number
  /** Optional length in beats, when the loop was set as a beat-loop. */
  beats?: number
  name?: string
  color?: string
}

export type AudioFormat = 'mp3' | 'aiff' | 'wav' | 'flac' | 'm4a' | 'unknown'

/** Where the current `energy` value came from. */
export type EnergySource = 'pending' | 'rekordbox' | 'computed' | 'failed' | 'missing' | 'user'

/** State of embedded album-artwork extraction for a track. */
export type ArtworkSource = 'pending' | 'embedded' | 'none' | 'failed'

// ───────── Auto-tagging ─────────

/** Plain-language tag categories inferred from audio + metadata. */
export type TagCategory = 'vibe' | 'energy' | 'bestFor' | 'time' | 'vocals' | 'genreBlend'

/** Where a tag came from. 'user' locks its category against re-inference. */
export type TagSource = 'auto' | 'user'

/**
 * A single tag on a track. `value` is a stable taxonomy slug — see
 * src/utils/tagging/taxonomy.ts, the single source of truth for tag identities.
 */
export interface TrackTag {
  category: TagCategory
  value: string
  source: TagSource
}

/** Normalised 0..1 audio features persisted per track; the input to tag inference. */
export interface TrackAnalysisFeatures {
  rms: number
  brightness: number
  loudness: number
  vocalness: number
}

/** One tag value with how many tracks carry it — for the Tags view facets. */
export interface TagCoverageCount {
  category: TagCategory
  value: string
  count: number
}

/** Aggregate tag coverage across the library. */
export interface TagCoverage {
  totalTracks: number
  taggedTracks: number
  counts: TagCoverageCount[]
}

/** Result of writing native MyTags into the Rekordbox master.db. */
export interface RekordboxTagWriteResult {
  success: boolean
  /** Where the pre-write backup of master.db was saved. */
  backupPath?: string
  tagsCreated?: number
  associations?: number
  error?: string
}

// ───────── Lifecycle state ─────────

/**
 * Lifecycle state for a track (Phase 12a).
 * Thresholds documented in electron/algorithms/memory/lifecycle.ts
 */
export type LifecycleState =
  | 'new' // added ≤30 days, never played
  | 'untested' // added >30 days, never played
  | 'testing' // 1–3 plays
  | 'active' // 4–9 plays, played recently
  | 'peak' // 10+ plays, played within 90 days
  | 'occasional' // has plays, last played 90–365 days ago
  | 'archive' // last played 1–3 years ago
  | 'forgotten' // last played >3 years ago

// ───────── Track ─────────

export interface Track {
  id: string // UUID, generated on import
  rekordboxId?: string // Original Rekordbox TrackID
  /** Which DJ-software source this track was last imported from. undefined = legacy/Rekordbox. */
  source?: 'rekordbox' | 'serato' | 'engine'
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
  /** Provenance: 'pending' until the background extractor writes 'embedded' / 'none' / 'failed'. */
  albumArtSource?: ArtworkSource
  cuePoints: CuePoint[]
  hotCues: HotCue[]
  loops?: Loop[]
  /** ms position of the first downbeat (beat 1 of bar 1). Anchors the beatgrid. */
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
  /** Computed or user-overridden lifecycle state (Phase 12a). */
  lifecycleState?: LifecycleState
  /** Where lifecycleState came from: 'computed' by the engine or 'user' override. */
  lifecycleSource?: 'computed' | 'user'
  /** ISO timestamp of when the user flagged this track to be tested at their next gig. */
  flaggedForGigAt?: string
  /** Normalised audio features (0..1) used to infer tags. Written by the analyser. */
  analysisFeatures?: TrackAnalysisFeatures
  /** Plain-language tags (auto-inferred + user overrides). Populated on library load. */
  tags?: TrackTag[]
  /** Stored in DB for phantom tracks imported from the old YouTube Discover feature. No longer rendered in UI. */
  discoverMeta?: {
    discoverSetId: string
    discoverSetTitle: string
    beatportUrl: string
    soundcloudUrl: string
    youtubeUrl: string
  }
}

// ───────── Set ─────────

export type SetVibe = 'peak' | 'mixed' | 'club' | 'warmup' | 'closing' | 'festival' | 'underground'
export type VenueType = 'club' | 'festival' | 'bar' | 'private' | 'outdoor'
/** The role a set played within a night — used as gig metadata on a PlaySession. */
export type SetSlot = 'opener' | 'peak' | 'closer' | 'b2b' | 'other'
export type EnergyCurveType = 'rise' | 'peak-sustain' | 'wave' | 'drop-in' | 'custom'
export type CDJModel = 'CDJ-2000NXS2' | 'CDJ-3000' | 'XDJ-RX3' | 'XDJ-XZ' | 'CDJ-2000'

/** Which DJ-hardware ecosystem an export targets. */
export type Ecosystem = 'pioneer' | 'engine'

/**
 * Where an export is headed. Pioneer/Rekordbox writes an XML; Engine/Denon
 * writes an Engine Library straight to a USB drive. `hardware` only applies to
 * the Pioneer ecosystem (CDJ format/era differences); Engine OS gear shares one
 * broad format set, so a single 'engine' target covers all current Denon units.
 */
export interface ExportTarget {
  ecosystem: Ecosystem
  hardware?: CDJModel
}

export interface SetTrack {
  id: string // UUID for this set slot
  trackId: string // references Track.id
  track: Track // denormalised for convenience
  position: number // 0-indexed
  transitionScore?: TransitionScore
  energyOverride?: number
  notes?: string
  playing?: boolean // UI-only: currently cued in the preview deck
  /** When true, Set Architect preserves this track at its position and cannot move or replace it. */
  locked?: boolean
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
  /**
   * The variation seed Set Architect used to generate this set. Lets a saved
   * set be reproduced: same seed + same params + unchanged library ⇒ same set.
   * Absent for hand-built sets or sets that pre-date seeded generation.
   */
  architectSeed?: number
  /**
   * The Set Architect engine version that produced this set (see
   * ARCHITECT_ALGORITHM_VERSION). Reproduction is only guaranteed within the
   * same version — bump the constant whenever buildSet's selection logic
   * changes so we never promise identical reproduction across engine revisions.
   */
  algorithmVersion?: number
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

export type MatchReasonType = 'key' | 'bpm' | 'energy' | 'genre' | 'texture' | 'combo' | 'tags'
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
  /** Raw count of times this track has been played after the current track in history. */
  comboCount?: number
}

// ───────── Library stats + filters ─────────

export interface LibraryStats {
  totalTracks: number
  totalDuration: number // seconds
  missingFiles: number // tracks flagged missing_file = 1 (unavailable on disk)
  unknownSize: number // tracks with no file_size recorded (metadata gap, not a missing file)
  unsupportedFormats: number
  tracksWithoutKey: number
  tracksWithoutBpm: number
  tracksWithPendingEnergy: number // energy not yet analysed (energy_source = 'pending')
}

/** Activation funnel events; each maps to a write-once timestamp in ProgressState. */
export type FirstEvent = 'import' | 'suggestion' | 'set' | 'export'

/** Retention / activation progress (brief #22, Phase B). Persisted in the main process. */
export interface ProgressState {
  firstImportAt: string | null
  firstSuggestionSeenAt: string | null
  firstSetStartedAt: string | null
  firstExportAt: string | null
  /** Milestone ids already celebrated, so a toast never repeats. */
  milestonesSeen: string[]
  /** Monday-based week ordinal of the last active week (internal). */
  lastActiveWeek: number | null
  /** Consecutive active weeks, including the current one. */
  currentStreak: number
  longestStreak: number
  /** User dismissed the onboarding checklist on Home. */
  checklistDismissed: boolean
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

export type ImportSource = 'rekordbox-db' | 'rekordbox-xml' | 'serato' | 'engine'

/**
 * Progress for a provider's deferred post-import enrichment pass (e.g. Serato's
 * file-tag cue/beatgrid extraction). Streamed on `library:post-import-progress`
 * after the main import finishes; the renderer reloads the library on `done`.
 */
export interface PostImportProgress {
  sourceId: LibrarySourceId
  processed: number
  total: number
  phase: 'extracting' | 'done'
}

// ───────── Cross-platform import sources ─────────

/** Stable id for each supported DJ-software library source. */
export type LibrarySourceId = 'rekordbox' | 'serato' | 'engine-dj'

/** Why a source's library couldn't be read, surfaced to the picker UI. */
export type SourceReadError = 'locked' | 'unsupported' | 'unknown' | null

/**
 * Result of probing one DJ-software source's install. Aggregated across all
 * registered sources to drive the import source-picker. Source-specific extras
 * live in `meta` (e.g. Rekordbox version + the full RekordboxDetection).
 */
export interface SourceDetection {
  sourceId: LibrarySourceId
  label: string
  installed: boolean
  libraryPath: string | null
  trackCount: number | null
  playlistCount: number | null
  readError: SourceReadError
  meta?: Record<string, unknown>
}

/**
 * Snapshot of what we found in the user's Rekordbox install. All fields are
 * optional except `installed` because Rekordbox may be partially configured
 * (app installed but never opened, or master.db deleted manually, etc.).
 */
export interface RekordboxDetection {
  /** True when ~/Library/Pioneer/rekordbox exists. */
  installed: boolean
  /** Absolute path to master.db when present and readable. */
  dbPath: string | null
  /** Epoch ms of master.db at the time of detection. */
  dbMtime: number | null
  /** Size of master.db in bytes (0 = empty library). */
  dbSize: number | null
  /** True when SetSense could not open master.db because Rekordbox is running. */
  dbLocked: boolean
  /** Absolute path to options.json when present (plaintext JSON). */
  optionsJsonPath: string | null
  /** User's configured XML export path if it was parsed out of options.json. */
  xmlExportPath: string | null
  /** True when a recent XML export exists at xmlExportPath. */
  xmlExportExists: boolean
  /** Rekordbox CFBundleShortVersionString when /Applications/rekordbox*.app is found. */
  appVersion: string | null
  /** Track count read from master.db when readable. null = not attempted or read failed. */
  trackCount: number | null
  /** Playlist count read from master.db when readable. */
  playlistCount: number | null
  /** Why the master.db couldn't be opened (only set when we tried and failed). */
  dbReadError: 'locked' | 'key-mismatch' | 'unknown' | null
}

export interface RekordboxStaleStatus {
  /** True when the on-disk master.db is newer than our last import (lastImportMtime). */
  stale: boolean
  /** Current master.db mtime (epoch ms) or null when the file is missing. */
  currentMtime: number | null
  /** Mtime of the source file the last time we imported. */
  lastImportMtime: number | null
}

export interface ValidationIssue {
  trackId: string
  trackTitle: string
  type: 'missing_file' | 'unsupported_format' | 'bitrate' | 'no_bpm' | 'duration' | 'hot_cues'
  severity: 'blocking' | 'warning'
  message: string
}

export interface CueSummaryEntry {
  trackTitle: string
  hotCueCount: number
  cuePointCount: number
}

export interface ValidationResult {
  score: number // 0-100
  issues: ValidationIssue[]
  isExportReady: boolean
  /** Per-track cue counts included in the export (P2 verification). */
  cueSummary?: CueSummaryEntry[]
}

export interface ExportResult {
  success: boolean
  filePath?: string
  trackCount?: number
  error?: string
}

// ───────── Beatport playlist export ─────────

export type BeatportConfidence = 'high' | 'medium' | 'low'

/**
 * One track resolved into the match keys Beatport's importer (and third-party
 * tools like Soundiiz / TuneMyMusic) use to find the catalog entry. Derived
 * from existing library metadata at export time — never persisted, never
 * written back to the library.
 */
export interface BeatportRow {
  trackId: string
  position: number // 1-indexed order in the set
  title: string
  mix?: string // e.g. "Extended Mix", "Someone's Remix"
  artist: string
  remixers?: string
  label?: string
  catalog?: string
  isrc?: string
  bpm: number
  key: string // open-key notation preferred for readability
  genre?: string
  duration: number // seconds
  searchUrl: string // Beatport search fallback for unmatched tracks
  confidence: BeatportConfidence
  reasons: string[] // human-readable notes shown in the manual-fix UI
}

// ───────── Architect ─────────

/**
 * Set Architect engine version, stamped onto every generated Set
 * (Set.algorithmVersion). A given `variationSeed` only reproduces the same set
 * within the same version. **Bump this whenever buildSet's track-selection
 * logic changes** (scoring, candidate pools, RNG wiring) so reproduction across
 * engine revisions is treated as best-effort rather than guaranteed.
 */
export const ARCHITECT_ALGORITHM_VERSION = 1

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
  /**
   * Opt-in variation seed. When undefined the builder is fully deterministic
   * (top-scored picks). When set, the opener and candidate selection draw
   * pseudo-randomly from the strongest matches so "Regenerate" yields a
   * different — but still constraint-valid — arrangement.
   */
  variationSeed?: number
  /** Restrict the source pool to tracks in these Rekordbox playlists. Empty/undefined = whole library. */
  sourcePlaylistIds?: string[]
  /** Tracks pinned at fixed positions. Algorithm preserves these and bridges between them. */
  lockedTracks?: Array<{ position: number; trackId: string }>
  /**
   * Manual genre mixing-profile override (e.g. 'tech-house'). Undefined = auto:
   * the engine detects the dominant style from the source library. See
   * electron/algorithms/genreProfiles.ts.
   */
  genreProfileId?: string
}

/**
 * Renderer-facing summary of a genre mixing profile. Full profile params live
 * in electron/algorithms/genreProfiles.ts; the UI only needs label + blurb.
 */
export interface GenreProfileSummary {
  id: string
  label: string
  /** Plain fragment for "This set follows {blurb}." copy. */
  blurb: string
}

/** Result of genre auto-detection: the detected default + all selectable styles. */
export interface GenreProfileInfo {
  detected: GenreProfileSummary
  profiles: GenreProfileSummary[]
}

// ───────── Playlists (imported from Rekordbox) ─────────

export interface Playlist {
  id: string
  rekordboxId?: string
  name: string
  /** null = root-level. Folders nest playlists; leaves carry track ids. */
  parentId: string | null
  /** Internal track UUIDs. Empty array for folders. */
  trackIds: string[]
  /** True for Rekordbox NODE Type="0" (folder containing other playlists). */
  isFolder: boolean
}

// ───────── App-shell UI state ─────────

export type AppMode = 'Home' | 'Library' | 'Build'
export type LibraryTab = 'Collection' | 'Crates' | 'Sets'
export type TimelineCurveView = 'Energy' | 'BPM'

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

// ───────── Memory engine result types (Phase 12a) ─────────

/** A track surfaced by the "forgotten gems" engine. */
export interface GemResult {
  track: Track
  score: number
  reason: string
  monthsDormant: number
}

/**
 * JSON-serialisable condition for a SmartCrate rule.
 * All fields are optional; omitted fields are not tested.
 */
export interface CrateRule {
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  /** Exact Camelot key match, e.g. "8A". */
  keyExact?: string
  /** Track key must be compatible-with (not clash) this Camelot key. */
  keyCompatibleWith?: string
  /** Track genre must include this string (case-insensitive). */
  genreIncludes?: string
  playCountOp?: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  playCountValue?: number
  /** Track's lastPlayed must be older than N months. */
  lastPlayedOlderThanMonths?: number
  ratingMin?: number
  /** true = only tracks with playCount===0 and no lastPlayed */
  neverPlayed?: boolean
  /** true = key is empty or bpm===0; false = both are present */
  missingMetadata?: boolean
  format?: AudioFormat
  /** true = no hot cues set AND no cue points set (proxy for "never auditioned"). */
  noCuePoints?: boolean
  /** Track duration in seconds, lower bound (inclusive). */
  durationMinSec?: number
  /** Track duration in seconds, upper bound (inclusive). */
  durationMaxSec?: number
  /** Track BPM must sit in the top N percentile of the supplied library's BPM distribution. */
  bpmTopPercentOfLibrary?: number
  /** Track must carry ALL of these tag slugs (any category). */
  tagsInclude?: string[]
  /** Track must carry NONE of these tag slugs (any category). */
  tagsExclude?: string[]
}

/** A complete smart crate definition. */
export interface SmartCrate {
  id: string
  name: string
  rules: CrateRule[]
  match: 'all' | 'any'
  /** One-line human description of the rules — shown as a subtitle on crate cards. */
  description?: string
}

/** A track with an aggregated count (used in transition graph, closers, bridges). */
export interface RankedTrack {
  trackId: string
  count: number
}

/**
 * Directed adjacency graph of track→next-track transition counts.
 * adjacency: Map<fromTrackId, Map<toTrackId, count>>
 */
export interface TransitionGraph {
  adjacency: Map<string, Map<string, number>>
}

/** "Wrapped for DJs" — aggregate identity snapshot for a library. */
export interface IdentitySnapshot {
  genreDistribution: Array<{ label: string; count: number }>
  bpmHistogram: Array<{ range: string; count: number }>
  keyDistribution: Array<{ label: string; count: number }>
  energyDistribution: Array<{ level: number; count: number }>
  topArtists: Array<{ label: string; count: number }>
  topLabels: Array<{ label: string; count: number }>
  tasteTimeline: Array<{ period: string; count: number; performedCount: number }>
  /**
   * Key composition per 10-BPM zone. One entry per BPM bucket that has tracks,
   * with a `keys` map showing the count of every Camelot key in that bucket.
   * Lets the UI render "Sarah's typical 128 BPM key palette" charts.
   */
  keyByBpmZone: Array<{ range: string; total: number; keys: Record<string, number> }>
  /** Total tracks counted for the snapshot — used by the share card. */
  totalTracks: number
}

/** Library health analysis result. */
export interface HealthReport {
  totalTracks: number
  missingFiles: number
  missingFileIds: string[]
  missingKey: number
  missingKeyIds: string[]
  missingBpm: number
  missingBpmIds: string[]
  unsupportedFormats: number
  unsupportedFormatIds: string[]
  /** Tracks where the auto-energy analyser hasn't yet written a result. */
  notAnalysed: number
  notAnalysedIds: string[]
  duplicateGroups: Array<{ ids: string[]; normalisedKey: string }>
  /** 0–100 composite health score. */
  healthScore: number
  /** Per-issue contribution to the score, for the explainer tooltip. */
  scoreBreakdown: HealthScoreBreakdown
}

/** Per-issue contribution to the health score. Positive values are penalties. */
export interface HealthScoreBreakdown {
  /** Points each issue type subtracted from 100. */
  missingFiles: number
  missingKey: number
  missingBpm: number
  unsupportedFormats: number
  duplicates: number
  /** Per-unit penalty + cap, surfaced for the tooltip copy. */
  weights: {
    missingFilesPerTrack: number
    missingFilesCap: number
    missingKeyPerTrack: number
    missingKeyCap: number
    missingBpmPerTrack: number
    missingBpmCap: number
    unsupportedFormatsPerTrack: number
    unsupportedFormatsCap: number
    duplicatesPerGroup: number
    duplicatesCap: number
  }
}

/** A smart crate plus its live-evaluated track count (for the Discover crates grid). */
export interface CrateWithCount extends SmartCrate {
  trackCount: number
  /** true for built-in presets (not user-deletable). */
  isSeed: boolean
}

/** A track that follows another, with how many times it has (transition combos). */
export interface ComboResult {
  track: Track
  count: number
}

/** Count of tracks in each lifecycle state. */
export interface LifecycleCounts {
  new: number
  untested: number
  testing: number
  active: number
  peak: number
  occasional: number
  archive: number
  forgotten: number
}

/** State of the optional bundled local LLM that powers natural-language Discover search. */
export interface RecallAiStatus {
  /** User has opted in to the local AI (settings toggle). */
  enabled: boolean
  /** absent = not loaded yet; downloading/loading = in progress; ready = usable. */
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'error'
  /** Whether the model file exists on disk (loaded lazily on first ask). */
  downloaded: boolean
  /** 0–1 download progress when state==='downloading'. */
  progress?: number
  error?: string
}

/** Lifecycle of the optional on-device speech-to-text model. */
export type VoiceState = 'absent' | 'downloading' | 'loading' | 'ready' | 'error'

/** State of the on-device voice model that powers spoken requests in Home. */
export interface VoiceStatus {
  state: VoiceState
  /** Whether the model file exists on disk (bundled or self-healed). */
  downloaded: boolean
  /** 0–1 download progress while state==='downloading'. */
  progress?: number
  error?: string
}

/**
 * Outcome of asking the OS for microphone access before capture.
 * - 'granted'     — proceed with getUserMedia.
 * - 'denied'      — user/MDM has blocked the mic; the renderer points them at
 *                   System Settings rather than failing with a generic error.
 * - 'unavailable' — no mic-permission concept on this platform (proceed).
 */
export type MicAccess = 'granted' | 'denied' | 'unavailable'

/**
 * Structured routing output from the local model — a plain-English request
 * mapped to ONE intent plus any slots it could extract. The renderer executes
 * the intent against the deterministic engines, so this carries data only.
 */
export type RecallRouteIntent =
  | 'smart_filter'
  | 'similar_to'
  | 'build_set'
  | 'forgotten_gems'
  | 'tracks_after'
  | 'best_closers'
  | 'best_openers'
  | 'top_sequences'
  | 'dead_ends'
  | 'lifecycle'
  | 'health'
  | 'identity'
  | 'duplicates'
  | 'count'
  | 'unknown'

export interface RecallRoute {
  intent: RecallRouteIntent
  /** A named track (for tracks_after / similar_to). */
  trackQuery?: string
  /** Free text title/artist/album contains. */
  text?: string
  artist?: string
  genre?: string
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  keyExact?: string
  minRating?: number
  maxRating?: number
  neverPlayed?: boolean
  dormantMonths?: number
  durationMinSec?: number
  durationMaxSec?: number
  /** Relative "added in the last N days" — converted to addedAfter by the caller. */
  addedWithinDays?: number
  /** Plain-language auto-tag values to match (e.g. "punchy", "dark", "vocal"). */
  tags?: string[]
  /** Gig filters — a venue/city/date-range/event-type the track was PLAYED at. */
  performedVenue?: string
  performedCity?: string
  /** ISO date bounds for when the track was played live. */
  performedAfter?: string
  performedBefore?: string
  performedEventType?: VenueType
  sort?: LibrarySearchParams['sort']
  limit?: number
  /** build_set: target peak BPM, set length, ramp shape, optional genre blend. */
  targetBpm?: number
  lengthMinutes?: number
  shape?: 'slow burn' | 'steady'
  genreBlend?: string[]
}

/** Result of a natural-language Discover query, routed to a deterministic engine intent. */
export interface RecallAskResult {
  /** The engine intent the question was routed to. */
  intent: string
  /** One-sentence human summary of what was found. */
  narration: string
  kind: 'tracks' | 'combos' | 'sequences' | 'stats'
  tracks?: Track[]
  combos?: ComboResult[]
  sequences?: { trackIds: string[]; tracks: Track[]; count?: number }[]
  stats?: Array<{ label: string; value: string }>
}

/** Active section within the Discover tab. */
export type RecallSection =
  | 'conversations'
  | 'uncover'
  | 'rediscover'
  | 'tags'
  | 'crates'
  | 'identity'
  | 'combos'
  | 'gigs'
  | 'health'

/** Where an Uncover card was sourced from — drives its pill colour + label. */
export type UncoverSource = 'heater' | 'gem' | 'untested' | 'audition'

/** A single swipeable card in the Uncover deck. */
export interface UncoverCard {
  track: Track
  source: UncoverSource
  /** One-line, human reason this track surfaced ("dormant 9 months", etc.). */
  reason: string
}

// ───────── Discover conversations (SetSense Intelligence) ─────────

/**
 * Deterministic library-search parameters. The conversation engine builds these
 * from plain-English turns and refines them across a chat; the engine returns
 * matching tracks instantly with no model.
 */
export interface LibrarySearchParams {
  /** Free-text title/artist/album contains. */
  text?: string
  /** Genre token (expanded to synonyms by the engine). */
  genre?: string
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  keyExact?: string
  minRating?: number
  neverPlayed?: boolean
  dormantMonths?: number
  /** Track duration in seconds, lower bound (inclusive). */
  durationMinSec?: number
  /** Track duration in seconds, upper bound (inclusive). */
  durationMaxSec?: number
  /** ISO timestamp; only tracks added on or after this date pass. */
  addedAfter?: string
  /** ISO timestamp; only tracks added on or before this date pass. */
  addedBefore?: string
  /** Venue name (case-insensitive contains) the track must have been PLAYED at. */
  performedVenue?: string
  /** City (case-insensitive contains) the track must have been PLAYED in. */
  performedCity?: string
  /** ISO date; only tracks played in a session on/after this date pass. */
  performedAfter?: string
  /** ISO date; only tracks played in a session on/before this date pass. */
  performedBefore?: string
  /** Event type of the session the track was played in (club | festival | …). */
  performedEventType?: VenueType
  /** Set slot of the session the track was played in (opener | peak | …). */
  performedSetSlot?: SetSlot
  /** Substring (case-insensitive) that must appear in any hot-cue or cue-point label. */
  cueLabel?: string
  /** Plain-language auto-tag values; a track matches if it carries ANY of them. */
  tags?: string[]
  sort?:
    | 'mostPlayed'
    | 'leastPlayed'
    | 'recent'
    | 'oldest'
    | 'rating'
    | 'bpmAsc'
    | 'bpmDesc'
    | 'energyAsc'
    | 'energyDesc'
    | 'random'
  limit?: number
}

export type RecallResultKind = 'tracks' | 'combos' | 'sequences' | 'stats'

/** One message in a Discover conversation. Track-heavy payloads are stored as ids and rehydrated. */
export interface RecallMessage {
  id: string
  role: 'user' | 'assistant'
  /** User input, or the assistant's one-line narration. */
  text: string
  kind?: RecallResultKind
  /** Ordered result track ids (kind==='tracks'). */
  trackIds?: string[]
  combos?: { trackId: string; count: number }[]
  sequences?: { trackIds: string[]; count: number }[]
  stats?: { label: string; value: string }[]
}

/** A saved chat thread with SetSense Intelligence. */
export interface RecallConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: RecallMessage[]
  /** Running search filter, refined turn-by-turn. */
  params: LibrarySearchParams
}

// ───────── Licensing / SetSense Pro (Section 16) ─────────

export type LicenseTier = 'free' | 'pro'
export type LicensePlan = 'lifetime' | 'subscription'
/**
 * active = entitled now · expired = subscription lapsed · invalid = bad/forged key ·
 * device-mismatch = valid key bound to another machine · revoked = killed by the
 * online gateway (refund/charge-back) · none = no key · trial = inside the free
 * post-import Pro trial · trial-expired = trial used up, no paid key.
 */
export type LicenseStatus =
  | 'active'
  | 'expired'
  | 'invalid'
  | 'none'
  | 'device-mismatch'
  | 'revoked'
  | 'trial'
  | 'trial-expired'

/**
 * The renderer-facing entitlement snapshot. Derived in the main process by
 * re-verifying the stored signed key on every read, so expiry is always current.
 * The full key never crosses to the renderer — only a masked form for display.
 */
export interface LicenseState {
  tier: LicenseTier
  plan: LicensePlan | null
  status: LicenseStatus
  /** Masked key for display, e.g. "SES1·••••·A1B2". null when no key is stored. */
  keyMasked: string | null
  /** Buyer email embedded in the signed key, for the "manage" UI. */
  buyerEmail: string | null
  /** ISO timestamp the key was activated on this machine. */
  activatedAt: string | null
  /** ISO expiry for subscription plans. null = perpetual (lifetime). */
  expiresAt: string | null
  /** True when the key is locked to a specific device (v2, non-portable). */
  deviceBound: boolean
  /** True when the key is explicitly transferable across devices. */
  portable: boolean
  /** True when the system clock appears to have jumped backwards — surfaced softly, never bricks. */
  clockWarning: boolean
  /** ISO end of the free post-import Pro trial. Set whenever a trial has ever started (active or expired). */
  trialEndsAt: string | null
  /** Whole days left in the trial (≥1 while active, 0 once expired). null when no trial has started. */
  trialDaysRemaining: number | null
}

export type LicenseActivationError =
  | 'malformed'
  | 'bad-signature'
  | 'expired'
  | 'device-mismatch'
  | 'revoked'
  | 'unknown'

export interface LicenseActivationResult {
  ok: boolean
  state: LicenseState
  error?: LicenseActivationError
}

/** What the user is buying — drives the external checkout URL. */
export type CheckoutPlan = 'subscription' | 'lifetime' | 'tip'

// ───────── Play history (Phase 11) ─────────

/** A gig/performance session grouping an ordered tracklist. */
export interface PlaySession {
  id: string
  name: string
  /** Where this session record came from. */
  source: 'rekordbox' | 'setsense' | 'manual'
  /** ISO date the gig happened (may be null for manually-created sessions without a known date). */
  performedAt?: string
  venue?: string
  /** How `venue` (and other derived metadata) was set: 'auto' = parsed from a
   * Rekordbox history-session name; 'user' = edited by the DJ. Auto never clobbers user. */
  venueSource?: 'auto' | 'user'
  /** Kind of event — reuses the VenueType vocabulary (club | festival | …). */
  eventType?: VenueType
  /** City the gig took place in (free-text). */
  city?: string
  /** Country the gig took place in (free-text). */
  country?: string
  /** The role this set played within the night. */
  setSlot?: SetSlot
  /** Duration in seconds (optional; populated when known). */
  duration?: number
  /** Links back to a SetSense set when source='setsense'. */
  setId?: string
  createdAt: string
  /** Derived from the session_tracks count — not stored in the sessions row itself. */
  trackCount: number
}

/** Editable gig-metadata fields on a session (used by update + bulk-assign). */
export interface SessionMetadataPatch {
  venue?: string | null
  eventType?: VenueType | null
  city?: string | null
  country?: string | null
  setSlot?: SetSlot | null
}

/** Filter for session-oriented queries ("sets I played in July 2025 at Hi Ibiza"). */
export interface SessionFilter {
  /** Venue name, case-insensitive contains. */
  venue?: string
  /** City, case-insensitive contains. */
  city?: string
  /** ISO date lower bound (inclusive) on performed_at. */
  after?: string
  /** ISO date upper bound (inclusive) on performed_at. */
  before?: string
  eventType?: VenueType
  setSlot?: SetSlot
}

/** A single track position within a PlaySession. */
export interface SessionTrack {
  id: string
  sessionId: string
  trackId: string
  playOrder: number
  playedAt?: string
  /** Full track object, joined from the tracks table. */
  track: Track
}
