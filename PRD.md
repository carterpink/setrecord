SetSense — Product Requirements Document v1.0
For Claude Code. Read this entire document before writing a single line of code.

0. What This Document Is
This is the complete technical and product specification for SetSense v1.0 — a desktop DJ set planning application for macOS. Claude Code should treat this as the single source of truth. Every architectural decision, data model, feature spec, and build instruction is here. Do not improvise outside this document without flagging a conflict.
The companion design system artifact (generated in Claude Design) defines all visual tokens, components, and patterns. Every UI decision defers to that design system. If this PRD conflicts with the design system on a visual matter, the design system wins. If it conflicts on a functional matter, this PRD wins.

1. Product Vision
SetSense is a desktop-first DJ companion app for macOS that allows any DJ to intuitively build sets, reduce pre-gig anxiety, and guarantee their USB will work on Pioneer hardware without surprises.
Three core pillars:
	1	Reliability — USB export, library health validation, CDJ compatibility checks
	2	Intelligence — algorithmic track suggestions, Set Architect, transition risk scoring
	3	Clarity — simple, fast, zero confusion
What it is not: A Rekordbox competitor. A streaming app. An AI chatbot for music. SetSense fits inside the existing DJ workflow as a planning layer that sits between library management (Rekordbox) and performance (CDJs).

2. Tech Stack
Confirmed
	•	Runtime: Electron (macOS only, v1)
	•	Frontend: React 18 + Vite
	•	Language: TypeScript throughout — no plain JS files
	•	Styling: Tailwind CSS v3 with a custom design token config that maps 1:1 to the design system
	•	State: Zustand (lightweight, no Redux boilerplate)
	•	Database: SQLite via better-sqlite3 — runs in the Electron main process. Fast, local, no server, survives app restarts. This is where the parsed library lives permanently.
	•	IPC: Electron's contextBridge + ipcRenderer/ipcMain for all main↔renderer communication. No nodeIntegration: true. Security first.
Why SQLite and not flat JSON / localStorage
The DJ library can be 10,000+ tracks. JSON files in memory don't scale, localStorage is a browser toy, and IndexedDB is painful. SQLite gives you fast queries (BPM range filtering, key filtering, fuzzy search across 10k rows), persistent storage, and zero network dependency. It lives at ~/Library/Application Support/SetSense/library.db.
Why no AI APIs
All suggestion and scoring logic is deterministic, algorithmic, and runs locally. No network dependency for core features. This means the app works offline, at a venue with no WiFi, on a USB-C only MacBook Air at 2am. That's the target environment.
Key dependencies


electron
react + react-dom
typescript
vite + @vitejs/plugin-react
tailwindcss
zustand
better-sqlite3
@types/better-sqlite3
fast-fuzzy (fuzzy search)
fuse.js (backup fuzzy, battle-tested)
xml2js (Rekordbox XML parsing)
chroma-js (Camelot/key harmonic analysis)
wavesurfer.js (waveform rendering in track preview)
recharts (energy/BPM curve graph)
@dnd-kit/core + @dnd-kit/sortable (drag and drop in set timeline)
electron-store (app preferences, not library data)

3. Project Structure


setsense/
├── electron/
│   ├── main.ts              # Electron entry, window creation, IPC handlers
│   ├── preload.ts           # contextBridge API exposure
│   ├── db/
│   │   ├── schema.ts        # SQLite schema definitions
│   │   ├── migrations.ts    # Schema versioning
│   │   └── queries.ts       # All DB query functions (no raw SQL in handlers)
│   ├── services/
│   │   ├── libraryImport.ts # Rekordbox XML parser + DB writer
│   │   ├── audioAnalysis.ts # BPM/key reading from file metadata
│   │   ├── exportService.ts # Rekordbox XML export builder
│   │   └── usbValidator.ts  # CDJ compatibility checker
│   └── algorithms/
│       ├── transitionScore.ts   # Transition quality scoring engine
│       ├── suggestions.ts       # Next-track suggestion ranker
│       ├── setArchitect.ts      # Auto set builder
│       └── energyCurve.ts       # Energy curve fitting + deviation scoring
│
├── src/
│   ├── main.tsx             # React entry
│   ├── App.tsx              # Root component, layout shell
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # 3-panel layout wrapper
│   │   │   ├── TopBar.tsx           # Logo, mode toggle, set safety, actions
│   │   │   └── BottomDock.tsx       # Floating frosted dock
│   │   ├── library/
│   │   │   ├── LibraryPanel.tsx     # Left panel wrapper
│   │   │   ├── TrackRow.tsx         # Single library track row
│   │   │   ├── LibrarySearch.tsx    # Search input with ⌘K
│   │   │   └── LibraryTabs.tsx      # Library / Sets tab switcher
│   │   ├── timeline/
│   │   │   ├── TimelinePanel.tsx    # Center panel wrapper
│   │   │   ├── TimelineTrackCard.tsx # Individual track in set
│   │   │   ├── EnergyCurveGraph.tsx  # Recharts energy/BPM graph
│   │   │   ├── GhostTrackCard.tsx   # Suggested next track ghost element
│   │   │   └── TransitionIndicator.tsx # Clean/messy/trainwreck badge
│   │   ├── suggestions/
│   │   │   ├── SuggestionsPanel.tsx # Right panel wrapper
│   │   │   ├── SuggestionCard.tsx   # Individual suggestion card
│   │   │   └── MatchReasonChips.tsx # "Perfect harmony", "Energy match" etc
│   │   ├── modals/
│   │   │   ├── SetArchitectModal.tsx  # Full parameter modal
│   │   │   ├── ExportModal.tsx        # Export progress + validation
│   │   │   ├── ImportModal.tsx        # Library import progress
│   │   │   └── CuePointEditor.tsx     # Hot cue + default cue setter
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Toggle.tsx
│   │       ├── Slider.tsx
│   │       ├── Badge.tsx
│   │       ├── KeyChip.tsx          # Camelot key chip (9A, 11B etc)
│   │       ├── EnergyBar.tsx        # 4-segment vertical energy indicator
│   │       ├── Waveform.tsx         # WaveSurfer wrapper
│   │       └── SegmentedControl.tsx
│   ├── stores/
│   │   ├── libraryStore.ts    # Full track library, search state, filters
│   │   ├── setStore.ts        # Current set, track order, set metadata
│   │   ├── uiStore.ts         # Modal state, active panel, dock state
│   │   └── playbackStore.ts   # Preview playback state
│   ├── hooks/
│   │   ├── useLibrary.ts
│   │   ├── useSet.ts
│   │   ├── useSuggestions.ts
│   │   └── useKeyboard.ts     # ⌘K, Space, arrow key shortcuts
│   ├── types/
│   │   └── index.ts           # All shared TypeScript interfaces
│   ├── utils/
│   │   ├── camelot.ts         # Camelot wheel logic
│   │   ├── formatters.ts      # BPM display, time formatting
│   │   └── constants.ts
│   └── styles/
│       ├── globals.css        # Tailwind base + aurora gradient animation
│       └── tokens.css         # CSS custom properties from design system
│
├── tailwind.config.ts         # Maps design tokens to Tailwind classes
├── vite.config.ts
├── electron.vite.config.ts
├── tsconfig.json
└── package.json

4. Data Models
Define these in src/types/index.ts. Every feature references these types. Do not deviate.


typescript
export interface Track {
  id: string                    // UUID, generated on import
  rekordboxId?: string          // Original Rekordbox TrackID if imported
  title: string
  artist: string
  album?: string
  genre?: string
  bpm: number                   // Always stored as float, display as 1dp
  key: string                   // Camelot notation: "9A", "11B" etc
  keyOpenNotation?: string      // e.g. "Am", "C#maj" — stored alongside
  energy: number                // 1-10 scale, parsed from Rekordbox or estimated
  duration: number              // seconds
  filePath: string              // Absolute path on disk
  fileSize?: number             // bytes
  bitrate?: number              // kbps
  format: 'mp3' | 'aiff' | 'wav' | 'flac' | 'm4a' | 'unknown'
  albumArtPath?: string         // Cached extracted artwork path
  albumArtUrl?: string          // Spotify-fetched artwork URL (fallback)
  cuePoints: CuePoint[]
  hotCues: HotCue[]
  beatgridOffset?: number       // ms offset for beatgrid alignment
  playCount: number
  rating: number                // 0-5 stars
  dateAdded: string             // ISO string
  lastPlayed?: string           // ISO string
  comment?: string
  label?: string
  color?: string                // Rekordbox colour tag
}

export interface CuePoint {
  position: number              // ms from start
  type: 'cue' | 'memory'
}

export interface HotCue {
  index: number                 // 0-7 (hot cue A-H)
  position: number              // ms from start
  color?: string
  label?: string
}

export interface SetTrack {
  id: string                    // UUID for this set slot
  trackId: string               // References Track.id
  track: Track                  // Denormalized for convenience
  position: number              // 0-indexed order in set
  transitionScore?: TransitionScore  // Score INTO this track from previous
  energyOverride?: number       // User-adjusted energy for this slot
  notes?: string
}

export interface TransitionScore {
  overall: 'clean' | 'messy' | 'trainwreck'
  score: number                 // 0-100, higher = cleaner
  bpmDelta: number              // absolute BPM difference
  keyCompatibility: 'perfect' | 'compatible' | 'neutral' | 'clash'
  energyDelta: number           // -10 to +10
  reasons: string[]             // Human readable: ["Perfect harmony", "±2 BPM"]
}

export interface Set {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  tracks: SetTrack[]
  targetDuration?: number       // minutes
  targetBpmMin?: number
  targetBpmMax?: number
  vibe?: SetVibe
  venue?: VenueType
  slotTime?: string             // e.g. "peak", "warm-up", "closing"
  energyCurveType?: EnergyCurveType
  safetyScore?: number          // 0-100, computed on export
  targetHardware?: CDJModel
}

export type SetVibe = 'peak' | 'mixed' | 'club' | 'warmup' | 'closing' | 'festival' | 'underground'
export type VenueType = 'club' | 'festival' | 'bar' | 'private' | 'outdoor'
export type EnergyCurveType = 'rise' | 'peak-sustain' | 'wave' | 'drop-in' | 'custom'
export type CDJModel = 'CDJ-2000NXS2' | 'CDJ-3000' | 'XDJ-RX3' | 'XDJ-XZ' | 'CDJ-2000'

export interface Suggestion {
  track: Track
  transitionScore: TransitionScore
  rank: number
  matchReasons: MatchReason[]
}

export interface MatchReason {
  label: string                 // "Perfect harmony", "Identical BPM", "+1 Energy"
  type: 'key' | 'bpm' | 'energy' | 'genre' | 'texture'
  quality: 'positive' | 'neutral' | 'warning'
}

export interface LibraryStats {
  totalTracks: number
  totalDuration: number         // seconds
  missingFiles: number
  unsupportedFormats: number
  tracksWithoutKey: number
  tracksWithoutBpm: number
}

export interface ArchitectParams {
  targetDuration: number        // minutes
  vibe: SetVibe
  slotTime: string
  crowdAge: 'young' | 'mixed' | 'mature'
  venueType: VenueType
  bpmMin: number
  bpmMax: number
  harmonicMixing: boolean
  followEnergyCurve: boolean
  energyCurveType: EnergyCurveType
  excludedTracks?: string[]     // Track IDs to skip
  seedTrack?: string            // Track ID to build around
}

5. Database Schema
Lives in electron/db/schema.ts. Run on first launch, versioned via migrations.


sql
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  rekordbox_id TEXT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  bpm REAL NOT NULL DEFAULT 0,
  key TEXT,
  key_open TEXT,
  energy INTEGER DEFAULT 5,
  duration REAL NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  bitrate INTEGER,
  format TEXT DEFAULT 'unknown',
  album_art_path TEXT,
  album_art_url TEXT,
  play_count INTEGER DEFAULT 0,
  rating INTEGER DEFAULT 0,
  date_added TEXT,
  last_played TEXT,
  comment TEXT,
  label TEXT,
  color TEXT,
  cue_points TEXT DEFAULT '[]',   -- JSON stringified
  hot_cues TEXT DEFAULT '[]',     -- JSON stringified
  beatgrid_offset REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  target_duration INTEGER,
  target_bpm_min REAL,
  target_bpm_max REAL,
  vibe TEXT,
  venue TEXT,
  slot_time TEXT,
  energy_curve_type TEXT,
  target_hardware TEXT DEFAULT 'CDJ-2000NXS2'
);

CREATE TABLE IF NOT EXISTS set_tracks (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES tracks(id),
  position INTEGER NOT NULL,
  energy_override INTEGER,
  notes TEXT,
  transition_score TEXT DEFAULT '{}',  -- JSON stringified TransitionScore
  UNIQUE(set_id, position)
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  rekordbox_id TEXT,
  name TEXT NOT NULL,
  parent_id TEXT,               -- For nested playlists
  track_ids TEXT DEFAULT '[]'   -- JSON array of track IDs in order
);

CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);
CREATE INDEX IF NOT EXISTS idx_tracks_key ON tracks(key);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_energy ON tracks(energy);
CREATE INDEX IF NOT EXISTS idx_set_tracks_set_id ON set_tracks(set_id);

6. Algorithm Specs
These live in electron/algorithms/. They are the intelligence of the app. No API calls. Pure functions. Fully testable.
6.1 Camelot Compatibility (camelot.ts)
The Camelot Wheel defines harmonic compatibility between keys. Implement this as a lookup system.


Compatible relationships (from any key):
- Same key: "Perfect harmony" (+30 score)
- ±1 on same letter (e.g. 9A → 10A or 8A): "Energy shift" (+25 score)  
- Same number, opposite letter (e.g. 9A → 9B): "Mood shift" (+20 score)
- ±2 on same letter: "Compatible" (+10 score)
- Everything else: "Neutral" (0) or "Clash" (-20 if > 3 steps away)
Build a getKeyCompatibility(keyA: string, keyB: string): KeyCompatibility function that returns the relationship label, score modifier, and a human-readable reason string.
6.2 Transition Scoring (transitionScore.ts)
scoreTransition(from: Track, to: Track): TransitionScore
Scoring breakdown (total 100 points):
BPM compatibility (35 points):
	•	0 BPM delta: 35pts
	•	±1 BPM: 32pts
	•	±2 BPM: 28pts
	•	±3-4 BPM: 22pts
	•	±5-8 BPM: 14pts
	•	±9-16 BPM (double time possible): 8pts
	•	16 BPM delta: 0pts
Key compatibility (35 points):
	•	Use Camelot score from 6.1, normalized to 35pts max
Energy compatibility (20 points):
	•	0 delta: 20pts
	•	±1: 18pts
	•	±2: 14pts
	•	±3: 8pts
	•	±4+: 2pts
	•	Note: +1 energy (going up) gets a +2 bonus (crowd building = good)
	•	-2+ energy (dropping sharply) gets a -5 penalty
Format/technical (10 points):
	•	Same format: 5pts
	•	Compatible bitrates (within 64kbps): 3pts
	•	File exists on disk: 2pts
Overall classification:
	•	75-100: clean
	•	45-74: messy
	•	0-44: trainwreck
Generate reasons array from the top 3 contributing factors. Format: "Perfect harmony", "Identical BPM", "±2 energy drop".
6.3 Suggestion Engine (suggestions.ts)
getSuggestions(currentTrack: Track, library: Track[], set: Set, count: number): Suggestion[]
Steps:
	1	Filter out tracks already in the set
	2	Filter out tracks outside current BPM window (±16 BPM, or ±8 if strict mode)
	3	Score every remaining track with scoreTransition(currentTrack, candidate)
	4	Apply a diversity penalty — tracks by the same artist as any track already in the set get -15 score
	5	Apply a recency penalty — tracks played in last 3 sets get -10 score (if set history exists)
	6	Apply an energy curve bonus — if the set's energy curve target calls for higher energy next, tracks with energy+1 or +2 get +8 bonus
	7	Sort by final score descending
	8	Return top count results as Suggestion[] with full TransitionScore and MatchReason[]
The top result is the "Best Match" shown prominently in the suggestions panel. The rest are listed below it.
6.4 Set Architect (setArchitect.ts)
buildSet(params: ArchitectParams, library: Track[]): SetTrack[]
This is the most complex algorithm. It builds an entire set from scratch given parameters.
Steps:
	1	Filter library to tracks within BPM range, matching vibe/genre tags if available
	2	Define energy curve — based on params.energyCurveType, generate a target energy value for each position (e.g. for "rise": position 1=4, position 5=6, position 10=8, position 15=9)
	3	Select opener — pick a track that matches position 1's target energy, preferably with a long intro (duration > 5min), clean key
	4	Greedy build loop — for each subsequent position:
	◦	Get getSuggestions() from current last track
	◦	Filter to tracks whose energy is within ±1.5 of the curve target for this position
	◦	If harmonicMixing: true, filter to only clean or compatible key relationships
	◦	Pick the top scoring result
	◦	Add to set, mark as used
	5	Validate and patch — after building, run a full pass checking all transitions. If any trainwreck transitions exist, try to find a better track for that slot. Maximum 3 repair passes.
	6	Return final ordered SetTrack[]
6.5 Energy Curve (energyCurve.ts)
getTargetCurve(type: EnergyCurveType, trackCount: number): number[]
Returns an array of target energy values (1-10) for each position.


'rise': Start at 4, linear rise to 9 by end
'peak-sustain': Rise to 9 by 40%, sustain 8-9 through 80%, drop to 7 at end
'wave': Oscillate between 6-8 with a peak at 60%
'drop-in': Start at 8, brief dip to 6 at 20%, rise to peak at 70%, sustain
'custom': Return flat array of 5s as placeholder (user draws their own)
getActualCurve(tracks: SetTrack[]): number[] Returns actual energy values from the set as-is.
getCurveDeviation(target: number[], actual: number[]): number Returns 0-100 score where 100 = perfect match.
6.6 USB Validator (usbValidator.ts)
validateForHardware(set: Set, hardware: CDJModel): ValidationResult
Checks:
	•	All file formats supported by target hardware (CDJ-3000 supports FLAC, older models don't)
	•	No files exceed 320kbps MP3 or equivalent
	•	All file paths are valid and files exist on disk
	•	BPM data exists for all tracks (required for sync)
	•	No track exceeds hardware's max duration (99min for most CDJs)
	•	Hot cue indices are within hardware limits (CDJ-2000NXS2: 8 hot cues, CDJ-3000: 8)
Returns { score: number, issues: ValidationIssue[], isExportReady: boolean }

7. Feature Specs
7.1 Library Import
Trigger: User clicks Import in top bar, or on first launch if no library exists.
Flow:
	1	Open macOS file picker filtered to .xml files
	2	Parse XML using xml2js in the main process
	3	Extract all <TRACK> elements — map to Track interface
	4	Extract all <NODE> playlists — map to Playlist interface
	5	Write to SQLite in batches of 100 (show progress in ImportModal)
	6	After import: extract/cache album artwork from file metadata where possible
	7	Run library health check — surface LibraryStats in the modal on completion
	8	Close modal, library panel populates
Rekordbox XML field mapping:


TrackID → rekordboxId
Name → title
Artist → artist
Album → album
Genre → genre
AverageBpm → bpm
Tonality → key (convert from open notation to Camelot)
Energy → energy (if present, else default 5)
TotalTime → duration (convert from seconds)
Location → filePath (decode URI encoding)
Size → fileSize
Bitrate → bitrate
DateAdded → dateAdded
PlayCount → playCount
Rating → rating (Rekordbox uses 0-255, normalize to 0-5)
Comments → comment
Label → label
Colour → color
Key conversion (open notation → Camelot): implement a full lookup table. e.g. "Am" → "8A", "C#maj" → "12B" etc. This is a fixed 24-entry map, hardcode it.
Error handling: If a track's file path doesn't exist on the current machine, import it anyway but flag missingFile: true. Don't skip it — the DJ may be on a different machine temporarily.
7.2 Library Panel
Left panel, ~340px wide.
	•	Search input at top with ⌘K shortcut. Uses fast-fuzzy against title + artist + album fields. Debounced 150ms.
	•	Library / Sets tab switcher below search
	•	Library tab: Scrollable list of all tracks, sorted by artist by default. Columns: artwork thumbnail (32x32), title + artist (two lines), BPM (mono), key chip, energy bar. Click to select. Double-click to preview. Drag to add to set timeline.
	•	Sets tab: List of saved sets. Click to load into timeline.
	•	Track rows are NOT frosted glass (performance). Simple dark surface, 1px bottom border.
	•	Selected track row gets chartreuse left border (2px) + slightly lighter bg.
	•	Row height: 56px. Compact. This is a workhorse view.
7.3 Set Timeline (Center Panel)
The heart of the app.
Top section — Energy/BPM Graph:
	•	Recharts LineChart, ~200px tall
	•	Two datasets: target curve (dim white dashed line) and actual curve (chartreuse solid line)
	•	Toggle between Energy view and BPM view via segmented control (top right of graph)
	•	X-axis: track number (1, 2, 3...)
	•	Y-axis: energy (1-10) or BPM
	•	Hovering a point on the curve highlights that track card in the list below
	•	Set metadata shown above graph: set name (editable inline), duration, track count, BPM range
Bottom section — Track List:
	•	Vertical scrollable list of TimelineTrackCard components
	•	Each card shows: position number, play button (triggers preview), title + artist, BPM, key chip, duration, transition quality indicator (below each card, pointing to the one above)
	•	Cards are draggable via @dnd-kit/sortable. Drag handle on left side.
	•	Active/selected card is slightly elevated with chartreuse left accent
	•	Ghost track card: shown as the last card in the list, dimmed 40% opacity, non-interactive, representing the current top suggestion. Has a "+" button to add it to the set.
	•	When timeline is empty: centered empty state with "Add tracks from your library or let Set Architect build your set" + two CTAs
Transition indicators between cards:
	•	Small inline row between each card pair showing: quality dot (green/amber/red) + reason text ("Perfect harmony · ±1 BPM")
	•	Clicking a transition indicator opens a detail popover with full TransitionScore breakdown
7.4 Suggestions Panel
Right panel, ~340px wide.
	•	Header: "Suggested next" + refresh icon button
	•	Subtext: "Based on track [N] — [track name]" (updates as selection changes in timeline)
	•	Best Match card (first result): Glass 2, chartreuse border, "BEST MATCH" label chip at top, shows track title, artist, BPM, key chip, and up to 3 MatchReason chips. "+" button to add to set.
	•	Remaining suggestions (2-6 more): Slightly smaller cards, same structure but no chartreuse border, no "BEST MATCH" chip.
	•	When no track is selected in timeline: "Select a track in your set to see suggestions"
	•	Suggestions recompute every time the selected track or set changes. Debounced 200ms.
7.5 Set Architect Modal
Triggered from bottom dock icon.
Full-screen modal (Glass 3), dark overlay behind it.
Parameters UI:
	•	Set name — text input
	•	Target duration — slider (30min to 240min, step 15min)
	•	Vibe — multi-select chips (Peak / Mixed / Club / Warm-up / Closing / Festival / Underground)
	•	Slot time — segmented control (Early / Peak / Late / Closing)
	•	Crowd type — segmented control (Young / Mixed / Mature)
	•	Venue type — chips (Club / Festival / Bar / Private / Outdoor)
	•	BPM range — dual-handle slider (60-200 BPM range, default 120-132)
	•	Harmonic mixing — toggle (on by default)
	•	Follow energy curve — toggle (on by default)
	•	Energy curve type — shown if above toggle is on: segmented control (Rise / Peak-Sustain / Wave / Drop-In)
"Build Set" primary CTA button (chartreuse). Shows animated progress during build (it's fast, ~200ms, but show a brief 1s progress animation anyway for satisfaction). On complete, closes modal and populates timeline.
7.6 Cue Point Editor
Triggered by clicking a track card in the timeline (expanded view) or from bottom dock.
Shows:
	•	Mini waveform (WaveSurfer.js) of the selected track, full width
	•	Playback controls: play/pause (space), nudge ±100ms (arrow keys)
	•	Current position marker (draggable white line)
	•	Set default cue button (sets the green cue point)
	•	Hot cue buttons A-H (set/clear at current position, each gets a color)
	•	Cue points rendered as vertical markers on the waveform
	•	Changes are saved to SQLite immediately on set
7.7 Export
Triggered from "Export" button in top bar or bottom dock.
Flow:
	1	Run validateForHardware() for the selected target hardware
	2	If issues exist: show ExportModal with issue list. Issues are classified as "blocking" (won't export) or "warnings" (will export with caveats). User must acknowledge.
	3	If all clear: proceed to export
	4	Generate Rekordbox XML from current set using exportService.ts
	5	Open macOS save dialog, default filename: [SetName]_SetSense_[date].xml
	6	Write file, show success state in modal
	7	Optional: show "Copy to USB" shortcut if a USB drive is detected
Export format: Rekordbox XML v3 compatible. Include all track metadata, cue points, hot cues, playlist structure. This file can be imported directly into Rekordbox or loaded via a USB drive on supported CDJs.
7.8 Bottom Dock
Floating frosted dock, Glass 3, centered at bottom of viewport, 56px tall, 8px margin from bottom edge, border-radius: 28px.
Five icons (Lucide, 20px, stroke 1.5):
	1	Sparkles → Open Set Architect modal
	2	Layers → Quick-add mode (highlights library panel)
	3	Activity → Focus energy curve graph
	4	Smile → Cue point editor for selected track
	5	Download → Export
Each icon button: 44x44px hit target, Ghost button style, active state gets chartreuse accent dot below icon.

8. IPC Bridge API
Define in electron/preload.ts. These are all the calls the renderer can make to the main process.


typescript
window.setsense = {
  // Library
  importLibrary: (xmlPath: string) => Promise<ImportResult>,
  getLibrary: (filters?: LibraryFilters) => Promise<Track[]>,
  getLibraryStats: () => Promise<LibraryStats>,
  searchLibrary: (query: string) => Promise<Track[]>,
  updateTrackCues: (trackId: string, cues: CuePoint[], hotCues: HotCue[]) => Promise<void>,
  
  // Sets
  getSets: () => Promise<Set[]>,
  getSet: (setId: string) => Promise<Set>,
  saveSet: (set: Set) => Promise<Set>,
  deleteSet: (setId: string) => Promise<void>,
  
  // Algorithms (run in main process, return to renderer)
  getSuggestions: (trackId: string, setId: string, count: number) => Promise<Suggestion[]>,
  scoreTransition: (fromId: string, toId: string) => Promise<TransitionScore>,
  buildSet: (params: ArchitectParams) => Promise<SetTrack[]>,
  validateForExport: (setId: string, hardware: CDJModel) => Promise<ValidationResult>,
  
  // Export
  exportSet: (setId: string, hardware: CDJModel) => Promise<ExportResult>,
  
  // File system
  selectXmlFile: () => Promise<string | null>,
  selectSaveLocation: (defaultName: string) => Promise<string | null>,
  checkFileExists: (path: string) => Promise<boolean>,
}

9. Build Order
Build in this exact sequence. Do not jump ahead. Each phase produces something that can be shown to a user.
Phase 1 — Shell (no data, dummy content)
	•	Electron + Vite + React + TypeScript boilerplate
	•	Tailwind configured with design system tokens (colors, radius, fonts)
	•	Aurora gradient background with animation (globals.css)
	•	AppShell.tsx — 3-panel layout, correct proportions, gap between panels showing gradient
	•	TopBar.tsx — logo, mode toggle, center status, right actions
	•	BottomDock.tsx — floating frosted dock with 5 icons
	•	All shared components: Button, Input, Toggle, Slider, Badge, KeyChip, EnergyBar, SegmentedControl
	•	Static dummy data rendered in all 3 panels
	•	Goal: design system rendered, everything looks right
Phase 2 — Database + Import
	•	SQLite schema created on app start
	•	libraryImport.ts — Rekordbox XML parser
	•	ImportModal.tsx with progress
	•	IPC bridge for import + library fetch
	•	Library panel populated from real data
	•	Search working with fast-fuzzy
	•	Goal: real library visible in the app
Phase 3 — Set Building (manual)
	•	setStore.ts — current set state
	•	TimelinePanel.tsx with real track cards
	•	Drag from library → timeline working
	•	Drag to reorder in timeline working
	•	Set saves to SQLite
	•	EnergyCurveGraph.tsx showing actual curve from set
	•	Goal: user can manually build and save a set
Phase 4 — Algorithms + Suggestions
	•	transitionScore.ts implemented + tested
	•	suggestions.ts implemented
	•	Transition indicators showing between cards in timeline
	•	Suggestions panel populated with real suggestions
	•	Ghost track visible at bottom of timeline
	•	camelot.ts lookup table complete
	•	Goal: app is intelligent, not just a playlist builder
Phase 5 — Set Architect
	•	setArchitect.ts implemented
	•	energyCurve.ts implemented
	•	SetArchitectModal.tsx with all parameters
	•	Build set → populate timeline flow working
	•	Energy curve graph showing target vs actual
	•	Goal: one-click full set building works
Phase 6 — Cue Points + Preview
	•	WaveSurfer.js integrated for waveform rendering
	•	CuePointEditor.tsx with hot cues
	•	Preview playback in library rows
	•	Cue points saved to SQLite
	•	Goal: track preview and cue editing works
Phase 7 — Export + Validation
	•	usbValidator.ts — hardware compatibility checks
	•	exportService.ts — Rekordbox XML builder
	•	ExportModal.tsx — validation issues + progress
	•	Save file dialog working
	•	Set Safety score shown in top bar
	•	Goal: complete end-to-end flow, exportable set
Phase 8 — Polish
	•	Keyboard shortcuts (⌘K search, Space preview, arrow keys)
	•	Loading states and empty states everywhere
	•	Error boundaries on all panels
	•	App settings (preferences stored via electron-store)
	•	Onboarding flow for first launch (no library yet)
	•	Performance audit — 10k track library should scroll at 60fps
	•	Goal: shippable

10. Design Implementation Rules
Claude Code must follow these rules when implementing any UI component. These derive from the design system. Do not deviate.
	1	Aurora gradient lives in globals.css on the body element. It animates on a 70s loop. No other element has an animated background.
	2	Three glass surfaces only. Glass 1 (subtle panels), Glass 2 (suggestion cards, dropdowns), Glass 3 (modals, dock). Exact values are in the design system. Copy them verbatim.
	3	Chartreuse (#C8FF3D) is the only accent color. It appears on: primary CTA buttons, best match card border, active states, focus rings. Nowhere else. Semantic colors (green/amber/red) appear only on data-meaning elements (transition quality, validation issues).
	4	Typography: Stack Sans Headline loaded via Google Fonts for display and headings. JetBrains Mono for all BPM numbers, key notation, timecodes. Body text is system-ui fallback. Load fonts in index.html.
	5	Sentence case everywhere. No ALL CAPS except 2-letter Camelot keys. No Title Case.
	6	Border radius minimum 6px. No sharp corners anywhere in the UI.
	7	No shadows on flat surfaces. Shadows only on Glass 3 modals (box-shadow: 0 20px 60px rgba(0,0,0,0.4)).
	8	Icons: Lucide React, stroke 1.5, 16-20px. Never filled. Never emoji.
	9	Transitions: cubic-bezier(0.32, 0.72, 0, 1) for exits/hovers (150ms), cubic-bezier(0.4, 0, 0.2, 1) for entries (220ms). Never CSS ease or linear.
	10	Library rows are NOT glass. Plain dark surface. Glass on rows kills scroll performance with 10k tracks.

11. Performance Requirements
	•	Library of 10,000 tracks must scroll at 60fps — use virtual scrolling (react-window or @tanstack/virtual)
	•	Suggestions must recompute in <100ms
	•	Set Architect must complete in <500ms for a 20-track set
	•	XML import of 10,000 tracks must complete in <10 seconds
	•	App cold start to interactive: <3 seconds
	•	Waveform rendering must not block the UI thread — load WaveSurfer asynchronously

12. What Not to Build in v1
Do not implement any of the following — they are future features and adding them now adds complexity with zero user value at this stage:
	•	Spotify integration (removed)
	•	Groq / AI API calls (removed)
	•	Cloud sync or user accounts
	•	Windows support
	•	Mobile version
	•	Collaboration features
	•	Beat detection from audio (use metadata only)
	•	Automatic BPM correction
	•	Social sharing
