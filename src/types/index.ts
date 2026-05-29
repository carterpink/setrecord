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
export type EnergySource = 'pending' | 'rekordbox' | 'computed' | 'failed' | 'missing' | 'user'

/** State of embedded album-artwork extraction for a track. */
export type ArtworkSource = 'pending' | 'embedded' | 'none' | 'failed'

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

export type SetVibe = 'peak' | 'mixed' | 'club' | 'warmup' | 'closing' | 'festival' | 'underground'
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

export type MatchReasonType = 'key' | 'bpm' | 'energy' | 'genre' | 'texture' | 'combo'
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

export type ImportSource = 'rekordbox-db' | 'rekordbox-xml'

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
  /** Restrict the source pool to tracks in these Rekordbox playlists. Empty/undefined = whole library. */
  sourcePlaylistIds?: string[]
  /** Tracks pinned at fixed positions. Algorithm preserves these and bridges between them. */
  lockedTracks?: Array<{ position: number; trackId: string }>
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

export type AppMode = 'Prepare' | 'YouTubeDiscover' | 'Discover'
export type LibraryTab = 'Library' | 'Crates' | 'Sets'
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
  | 'rediscover'
  | 'crates'
  | 'identity'
  | 'combos'
  | 'health'

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
  /** Substring (case-insensitive) that must appear in any hot-cue or cue-point label. */
  cueLabel?: string
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
/** active = entitled now · expired = subscription lapsed · invalid = bad/forged key · none = no key. */
export type LicenseStatus = 'active' | 'expired' | 'invalid' | 'none'

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
}

export type LicenseActivationError = 'malformed' | 'bad-signature' | 'expired' | 'unknown'

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
  /** Duration in seconds (optional; populated when known). */
  duration?: number
  /** Links back to a SetSense set when source='setsense'. */
  setId?: string
  createdAt: string
  /** Derived from the session_tracks count — not stored in the sessions row itself. */
  trackCount: number
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
