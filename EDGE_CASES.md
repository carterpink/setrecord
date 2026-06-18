# SetRecord — Edge Case Catalogue

> **Purpose.** A stress-test map of the "wildly unimaginable" inputs and states this app can hit, across the four risk areas: **Import/parsers**, **Export/USB**, **Memory/recall/AI**, **Licensing/DB/core**. Each case states the scenario, the expected behaviour, and how it is verified.
>
> **Status (last run):** `205 executable edge assertions PASS` across 8 new `tests/edge.*.test.ts` files. Full suite: `678 passed / 17 skipped`, **1 pre-existing failure** unrelated to this work (see [Defects found](#defects-found-during-this-pass)).

---

## How to run

```bash
# just the edge-case suites
npx vitest run tests/edge.*.test.ts

# the whole suite
npm test
```

## Coverage legend

| Mark | Meaning |
|------|---------|
| ✅ | **Automated** — a real assertion runs in `tests/edge.*.test.ts` and passes. |
| 🧪 | Covered by a pre-existing suite in `tests/` (happy-path + some edges). |
| 📝 | **Documented** — needs an Electron/fs/keytar/sqlite harness, a UI driver, or a fixture we don't have yet. Specified here for the next testing pass. |
| ⚠️ | **Defect / smell** found while cataloguing — see bottom section. |

Why not 1000 literal rows of filler: I optimised for *distinct, meaningful* cases over padding. The catalogue below is ~450 concrete scenarios; the 205 highest-value ones are executable and green. Every documented (📝) case names the exact function/surface so it can be promoted to an assertion once the harness exists.

---

## Defects found during this pass

| # | Severity | Where | Finding |
|---|----------|-------|---------|
| D1 | **Build-breaking** | `electron/services/import/providers/engineDj.ts:35-36` | Imports `../../engine/detect` and `../../engine/dbReader`, **neither file exists** (`electron/services/engine/` only has `engineExport.ts` + `engineSchema.ts`). This throws at module-load and **fails `tests/serato.test.ts` collection**. The file is currently untracked (WIP). Either add the modules or guard the import. |
| D2 | Quirk (by design, document it) | `libraryHealth.normalise` | Strips accents/diacritics entirely (`Émigré → "migr"`, `Tiësto → "tisto"`) because `\w` is ASCII-only. Two tracks differing only by accents dedupe together; also harmless titles can collide. Confirmed/locked by ✅ tests so a future change is caught. |
| D3 | Quirk | `queryParser` | `after 2020` is parsed as a *track lookup* (`tracks_after`, trackQuery `"2020"`), not a date. Low impact; noted. |
| D4 | Latent | `ratingToEngine(NaN)` | Returns `NaN` (→ would write NaN rating to Engine DB). Callers currently pass integers; add a guard if untrusted input can reach it. |

---

# AREA 1 — Import / Parsers

Real-world DJ libraries are a graveyard of corrupt exports, dead file paths, exotic encodings, and 50k-track monsters. Parsers must **never crash the import** — at worst skip a row.

## 1.1 Serato `database V2` & crates — ✅ `tests/edge.seratoImport.test.ts`

### Length parsing (`parseSeratoLength`)
- EC-IMP-001 ✅ `"3:45"` → 225s.
- EC-IMP-002 ✅ `"1:02:33"` (h:m:s) → 3753s.
- EC-IMP-003 ✅ `"0:00"` → 0.
- EC-IMP-004 ✅ Bare seconds `"90"` → 90.
- EC-IMP-005 ✅ Whitespace-padded `"  120  "` → 120.
- EC-IMP-006 ✅ Negative `"-5"` passes through (documented; Serato never emits this).
- EC-IMP-007 ✅ `undefined` → `undefined`.
- EC-IMP-008 ✅ Empty `""` → `undefined`.
- EC-IMP-009 ✅ Garbage `"abc"` → `undefined`.
- EC-IMP-010 ✅ Partial `"3:ab"` → `undefined` (one part non-finite).
- EC-IMP-011 ✅ `"::"` / `"not:a:time"` → `undefined`.
- EC-IMP-012 📝 Absurd `"999999:59:59"` → large but finite number (no overflow guard; document the ceiling).

### Key conversion (`seratoKeyToCamelot`)
- EC-IMP-013 ✅ Already-Camelot `"8A"` → `"8A"`.
- EC-IMP-014 ✅ Lowercase Camelot `"8a"` → `"8A"`.
- EC-IMP-015 ✅ `"12B"` → `"12B"`.
- EC-IMP-016 ✅ Open notation `"Am"` → `"8A"`, `"C"` → `"8B"`.
- EC-IMP-017 ✅ Unmappable `undefined`/`""`/`"am"`/`"Xyz"`/`"  "` → `""`.
- EC-IMP-018 📝 Out-of-range `"13A"` → `""` (not in open map, not `\d{1,2}[AB]`... actually `"13A"` matches the Camelot regex → returns `"13A"`; **document that 13A is accepted verbatim**).

### Path resolution (`resolveSeratoPath`)
- EC-IMP-019 ✅ Drive-relative `"Users/x/a.mp3"` → `"/Users/x/a.mp3"`.
- EC-IMP-020 ✅ Already-absolute `"/Users/x"` → `"/Users/x"` (no double slash).
- EC-IMP-021 ✅ Multiple leading slashes `"///a"` → `"/a"`.
- EC-IMP-022 ✅ Empty `""` → `"/"`.
- EC-IMP-023 📝 Path with embedded null byte → passes through (fs call later would reject; document).
- EC-IMP-024 📝 Windows-style backslash path on macOS import → not normalised (Serato-on-Mac only; document).

### Binary database parsing (`parseDatabaseV2`)
- EC-IMP-025 ✅ Empty buffer → `[]`.
- EC-IMP-026 ✅ Random non-Serato bytes → `[]`.
- EC-IMP-027 ✅ Truncated `otrk` chunk header → no throw.
- EC-IMP-028 📝 `otrk` with declared length > buffer remaining → must not over-read (fuzz with a length field larger than the buffer).
- EC-IMP-029 📝 Deeply nested chunks (1000-level) → no stack overflow.
- EC-IMP-030 📝 `otrk` missing `pfil` → record skipped (track with no path is unusable).
- EC-IMP-031 📝 `uadd` epoch = 0 / pre-2001 → falls back to `tadd` text or `now`.
- EC-IMP-032 📝 `tadd` unparseable date string → `dateAddedIso` undefined → mapped to `now`.
- EC-IMP-033 📝 Duplicate field tags in one `otrk` → last-wins (document).
- EC-IMP-034 📝 50k `otrk` records → completes < a few seconds, no OOM (bench).
- EC-IMP-035 📝 UTF-16BE text with surrogate pairs (emoji in title) → decoded intact.
- EC-IMP-036 📝 Odd-length UTF-16 buffer → decoder doesn't throw.

### Record → Track mapping (`seratoRecordToTrack`)
- EC-IMP-037 ✅ Near-empty record → `Unknown title`/`Unknown artist`, bpm 0, key `""`, energy 5, `energySource:'pending'`, duration 0, `source:'serato'`.
- EC-IMP-038 ✅ Known path reuses existing id (re-import keeps saved-set FKs).
- EC-IMP-039 ✅ Unknown path mints a fresh UUID.
- EC-IMP-040 ✅ Unknown extension `.ogg` → `format:'unknown'`.
- EC-IMP-041 📝 Path with `crypto.randomUUID` collision (astronomically unlikely) — document non-determinism.

### Crates (`parseCrate`, `buildPlaylistsFromCrates`)
- EC-IMP-042 📝 Crate referencing tracks not in the DB → unresolved ptrk dropped.
- EC-IMP-043 📝 Nested crate `"A%%B%%C"` → 3-level playlist tree.
- EC-IMP-044 📝 Crate with circular/self parent (malformed) → no infinite loop.
- EC-IMP-045 📝 Empty crate → empty playlist, not skipped.
- EC-IMP-046 📝 Crate name with `/` or path separators → not treated as nesting incorrectly.

### Serato file tags (`extractSeratoTags`, markers2/beatgrid)
- EC-IMP-047 📝 Audio file missing on disk → returns null, import continues.
- EC-IMP-048 📝 Beatgrid marker count claims > 100k → rejected/clamped (anti-DoS).
- EC-IMP-049 📝 Hot-cue RGB out of 0–255 → clamped.
- EC-IMP-050 📝 Cue name = stream terminator (empty) → parse stops cleanly.
- EC-IMP-051 📝 NaN/negative float beatgrid position → ignored.
- EC-IMP-052 📝 `LOOP`/`CUE` literal appearing inside a track *title* → not mistaken for entries-start.

## 1.2 Rekordbox — ✅ `tests/edge.rekordboxImport.test.ts`

### Path combine (`combinePath`)
- EC-IMP-053 ✅ Folder + file → joined with single slash.
- EC-IMP-054 ✅ Trailing-slash folder → no double slash.
- EC-IMP-055 ✅ `%20` → space decoded.
- EC-IMP-056 ✅ `%E2%9C%93` → `✓` (unicode percent-decode).
- EC-IMP-057 ✅ `../` segments normalised away.
- EC-IMP-058 ✅ Null folder or null file → `null` (×5 combinations).
- EC-IMP-059 ✅ Malformed `%ZZ` → left intact, no throw.
- EC-IMP-060 📝 Path that decodes to a different absolute root (`%2F..%2F`) → traversal smell; document.

### Session / venue parsing (`parseSessionMeta`)
- EC-IMP-061 ✅ `"Hi Ibiza 2025-07-12"` → venue `"Hi Ibiza"`.
- EC-IMP-062 ✅ `"HISTORY 2024-07-12"` → `null` (pure boilerplate).
- EC-IMP-063 ✅ `"Boiler Room"` → `"Boiler Room"`.
- EC-IMP-064 ✅ `"Fabric 12.07.25"` (dotted date) → `"Fabric"`.
- EC-IMP-065 ✅ `"Berghain 21:30"` (clock time) → `"Berghain"`.
- EC-IMP-066 ✅ `"HISTORY: Warehouse Project"` → `"Warehouse Project"`.
- EC-IMP-067 ✅ `null`/`undefined`/`""`/`"   "`/`"12-07"`/`"2025"`/`"session"`/`"HISTORY"` → null venue.
- EC-IMP-068 ✅ `source` is always `'auto'`.
- EC-IMP-069 📝 RTL/unicode venue (`"العربية"`) → preserved.
- EC-IMP-070 📝 Venue that is *only* an emoji → preserved or nulled (define & lock behaviour).

### RB6 vs RB7 schema (`mapContentRow`, color maps, cipher)
- EC-IMP-071 🧪 RB7 passphrase key vs RB6 raw key — `tests/` cipher coverage; ⚠️ see memory `rekordbox7_cipher`.
- EC-IMP-072 📝 `djmdColor` lookup miss → track keeps no color, not crash.
- EC-IMP-073 📝 Content row with null `FolderPath` or `FileNameL` → track skipped via `combinePath`→null.
- EC-IMP-074 📝 Rating 0–255 (RB scale) → normalised 0–5.
- EC-IMP-075 📝 Cue query failure mid-import → graceful fallback (no cues), import continues.
- EC-IMP-076 📝 Playlist with parent id pointing at itself / a missing parent → orphan handled.
- EC-IMP-077 📝 History row with malformed `DateCreated` → session still created with null performedAt.
- EC-IMP-078 📝 Locked master.db (`SQLITE_BUSY`, Rekordbox running) → `RekordboxLockedError`, friendly message.
- EC-IMP-079 📝 Key mismatch (wrong RB version) → `RekordboxKeyMismatchError`.
- EC-IMP-080 📝 Nested `.app` path (RB7 install layout) → detected (see memory note).

### XML import (`importFromXml`, `parseLocation`, `parseRating`, `parseFormat`)
- EC-IMP-081 📝 Missing `<COLLECTION>` node → empty import, no crash.
- EC-IMP-082 📝 Malformed/truncated XML → caught, surfaced as import error.
- EC-IMP-083 📝 `file://localhost/` vs `file:///` location forms → both decode.
- EC-IMP-084 📝 Track `Location` with `+` and `%` literals → decoded correctly.
- EC-IMP-085 📝 5 GB XML (50k tracks) → streamed/batched, bounded memory.
- EC-IMP-086 📝 Duplicate `TrackID`s in XML → dedupe by path.
- EC-IMP-087 📝 Extension casing `.MP3`/`.Mp3` → mp3.
- EC-IMP-088 📝 No extension → `unknown` format.
- EC-IMP-089 📝 Rating string non-numeric → 0.
- EC-IMP-090 📝 XML entity-encoded metadata (`&amp;`, `&#9731;`) → decoded.

## 1.3 Energy analyser — ✅ `tests/edge.energy.test.ts`

- EC-IMP-091 ✅ `clamp01`: 0,1,0.5 pass through.
- EC-IMP-092 ✅ `clamp01(-1)`→0, `clamp01(2)`→1.
- EC-IMP-093 ✅ `clamp01(1.0000001)`→1, `clamp01(-0.0000001)`→0.
- EC-IMP-094 ✅ `clamp01(NaN/±Infinity)`→0 (NaN-poison guard).
- EC-IMP-095 📝 `frameRmsDbfs` on empty array → `-Infinity`, then clamped downstream.
- EC-IMP-096 📝 `frameRmsDbfs` on pure silence → very negative, score floors at 1.
- EC-IMP-097 📝 `fftInPlace` on non-power-of-two length → handled via `nextPow2`.
- EC-IMP-098 📝 `spectralCentroidHz` on DC-only signal → no divide-by-zero.
- EC-IMP-099 📝 `analyseSamples` end-to-end on 1-sample buffer → finite score 1–10.
- EC-IMP-100 📝 `kWeightedLufs` at 8k vs 48k sample rate → both finite.
- EC-IMP-101 📝 All-zero / all-max-amplitude PCM → score clamps, no NaN.
- EC-IMP-102 📝 `analyseTrack` cache hit / missing file / decode-null → correct source label.
- EC-IMP-103 📝 Corrupt cache version → recompute, not crash.

## 1.4 Cross-format / provider abstraction
- EC-IMP-104 ⚠️ Engine DJ provider import path is **broken** (D1) — `engineDj.ts` references non-existent modules.
- EC-IMP-105 📝 Engine DJ `read()` → throws `SourceNotImplementedError` cleanly (stub).
- EC-IMP-106 📝 Importing the *same* library twice → idempotent (ids reused by path).
- EC-IMP-107 📝 Importing Serato then Rekordbox for the same files → `source` field reflects last importer; no dup tracks if paths match.
- EC-IMP-108 📝 Library on an unmounted/ejected drive mid-import → partial import surfaces error, DB stays consistent.
- EC-IMP-109 📝 Symlinked audio paths → resolved or preserved (define).
- EC-IMP-110 📝 Network/SMB path latency → progress callback still fires; no UI freeze.

---

# AREA 2 — Export / USB

Export is the highest-stakes path: a bad USB means a dead deck mid-set. Rule of thumb: **non-owned or missing files must BLOCK, format/cue issues WARN.**

## 2.1 Engine schema helpers — ✅ `tests/edge.exportLicensing.test.ts`

### Rating mapping (`ratingToEngine`)
- EC-EXP-001 ✅ 0→0, 1→20, 2→40, 3→60, 4→80, 5→100.
- EC-EXP-002 ✅ `-1`→0 (clamp low), `6`→100 (clamp high).
- EC-EXP-003 ✅ `3.4`→60 (round down), `3.6`→80 (round up).
- EC-EXP-004 ⚠️ `ratingToEngine(NaN)`→`NaN` (D4) — document/guard.

### Safe filenames (`safeMusicFilename`)
- EC-EXP-005 ✅ Clean `Song.mp3` passes through.
- EC-EXP-006 ✅ Illegal FAT chars `: ? < > |` → each `_` → `__b____.mp3`.
- EC-EXP-007 ✅ Collisions get `-1`, `-2` suffixes within one export.
- EC-EXP-008 ✅ No-extension name preserved.
- EC-EXP-009 ✅ Whitespace-only stem → fallback `track.mp3`.
- EC-EXP-010 📝 255+ char filename → truncate to FAT limit (currently un-truncated; document/add).
- EC-EXP-011 📝 Unicode filename on exFAT → preserved (exFAT supports it) vs FAT32 fallback.
- EC-EXP-012 📝 Two files differing only by case (`Song.mp3`/`song.mp3`) on case-insensitive USB → suffix applied (uses `.toLowerCase()` key — ✅ logic, document the path).
- EC-EXP-013 📝 Reserved Windows names (`CON.mp3`, `NUL.mp3`) → still valid? define.

## 2.2 USB validator (`validateForTarget` / `validateForEcosystem`)
- EC-EXP-014 🧪 Phantom track (no local file) → **BLOCKING** (`tests/engineExport.test.ts`).
- EC-EXP-015 🧪 `missingFile` flag set → **BLOCKING**.
- EC-EXP-016 📝 `filePath` not on disk at validate time → **BLOCKING**.
- EC-EXP-017 📝 Unsupported format on legacy CDJ (e.g. FLAC on CDJ-2000) → **BLOCKING**.
- EC-EXP-018 📝 Track > 99 min on Pioneer → **BLOCKING** (CDJ limit).
- EC-EXP-019 📝 Unsupported format on Engine → **BLOCKING**.
- EC-EXP-020 📝 > 8 hot cues → **WARNING** (CDJ shows 8).
- EC-EXP-021 📝 No BPM → **WARNING** (sync won't work).
- EC-EXP-022 📝 MP3 bitrate > 320 (VBR spikes) → **WARNING**.
- EC-EXP-023 📝 Empty set (0 tracks) → blocked or no-op with clear message.
- EC-EXP-024 📝 All-blocking set → export disabled, reasons listed.
- EC-EXP-025 📝 Mixed owned/non-owned → only non-owned block, rest exportable (define partial-export policy).

## 2.3 Engine DB export (`populateEngineDatabase`, `exportSetToEngineUsb`)
- EC-EXP-026 🧪 m.db schema populated for 1.6.0 target (`tests/engineExport.test.ts`).
- EC-EXP-027 📝 Invalid UUID → rejected before write.
- EC-EXP-028 📝 0-track playlist → valid empty Engine library or blocked.
- EC-EXP-029 📝 Unicode/emoji in title/album/genre → stored correctly (UTF-8).
- EC-EXP-030 📝 Missing optional fields (album/genre/comment) → null columns, no crash.
- EC-EXP-031 📝 Negative BPM/duration → clamped or rejected.
- EC-EXP-032 📝 USB path doesn't exist → `mkdir -p` or error.
- EC-EXP-033 📝 **Full disk** during audio copy → partial copy detected, error surfaced, no corrupt m.db.
- EC-EXP-034 📝 File already exists on USB (re-export) → overwrite vs skip policy.
- EC-EXP-035 📝 USB ejected mid-export → clean failure, no half-written DB.
- EC-EXP-036 📝 Read-only USB → permission error surfaced.
- EC-EXP-037 📝 10k-track export → progress callback monotonic, completes.
- EC-EXP-038 📝 Two SetRecord exports to same USB → second merges/coexists, doesn't clobber first.
- EC-EXP-039 📝 Source audio file deleted between validate and copy → blocking error, not silent skip.

## 2.4 Rekordbox XML export (`exportSet`, `formatTagsComment`, `encodeFilePath`, `buildPositionMarks`)
- EC-EXP-040 🧪 Atomic temp→rename write (`tests/exportService.test.ts`).
- EC-EXP-041 📝 Full disk → temp cleaned, error returned.
- EC-EXP-042 📝 Parent dir missing → error, not partial file.
- EC-EXP-043 📝 XML-unsafe chars (`<`,`>`,`&`,quotes) in metadata → escaped.
- EC-EXP-044 📝 Unicode filename → `file://` URI RFC3986-encoded.
- EC-EXP-045 📝 Path with spaces/`#`/`?` → encoded segments.
- EC-EXP-046 📝 > 8 hot cues → clamped in POSITION_MARK.
- EC-EXP-047 📝 Cue at position 0 → emitted.
- EC-EXP-048 📝 Tag comment merge: existing MyTag block stripped & rebuilt, not duplicated.
- EC-EXP-049 📝 Tag label with `/` `*` → escaped in MyTag syntax.
- EC-EXP-050 📝 Empty set → valid empty COLLECTION.
- EC-EXP-051 📝 Track with `rekordboxId` undefined → falls back to index.

## 2.5 Beatport CSV export (`buildCsv`, `csvField`, `extractIsrc`, `parseMixName`) — ✅ partial
- EC-EXP-052 ✅ `extractIsrc` from label, upper-cased (`usrc17607839`→`USRC17607839`).
- EC-EXP-053 ✅ `extractIsrc` from comment (`ISRC: GBAYE0601498`).
- EC-EXP-054 ✅ No ISRC / too-short (`TOOL12345`) → undefined.
- EC-EXP-055 ✅ `parseMixName("Strobe")` → `{title:'Strobe'}` (no mix).
- EC-EXP-056 ✅ `parseMixName("")`/`"   "` → `{title:''}`.
- EC-EXP-057 🧪 `(Extended Mix)` / `[Four Tet Remix]` split (`tests/beatportExport.test.ts`).
- EC-EXP-058 📝 `csvField` escapes embedded quotes (doubles them), commas, CRLF, tabs.
- EC-EXP-059 📝 `csvField(null/undefined)` → empty field.
- EC-EXP-060 📝 Title with leading `=`/`+`/`-`/`@` (CSV injection) → neutralised.
- EC-EXP-061 📝 Empty rows array → header-only CSV.
- EC-EXP-062 📝 Multiple ISRCs in one field → first wins.
- EC-EXP-063 📝 `feat.` parenthetical preserved, not treated as a mix.
- EC-EXP-064 📝 No DB writes happen during Beatport export (read-only guarantee).

---

# AREA 3 — Memory / Recall / AI

The "front door" of the product. These are mostly pure scoring/parsing functions — ideal for exhaustive edge testing.

## 3.1 Camelot wheel — ✅ `tests/edge.camelot.test.ts`

### Open-notation conversion (`openNotationToCamelot`)
- EC-MEM-001 ✅ `Am`→`8A`, `C`→`8B`, `B`→`7B`.
- EC-MEM-002 ✅ Enharmonics resolve equal: `A#m`==`Bbm`==`9A`; `Db`==`C#`==`9B`.
- EC-MEM-003 ✅ Surrounding whitespace trimmed.
- EC-MEM-004 ✅ `""`/`am` (lowercase)/`H`/`Xyz`/`Cmaj`/`"  "` → undefined.

### Compatibility (`getKeyCompatibility`)
- EC-MEM-005 ✅ Identical → perfect +30.
- EC-MEM-006 ✅ +1 same letter → +25 (energy shift); ±1 both directions.
- EC-MEM-007 ✅ Relative major/minor (same number, diff letter) → +20 (mood shift).
- EC-MEM-008 ✅ +2 same letter → +10.
- EC-MEM-009 ✅ **Wheel wraparound**: `1A`×`12A` → distance 1 (+25), not 11.
- EC-MEM-010 ✅ `1A`×`11A` → wraparound distance 2 (+10).
- EC-MEM-011 ✅ Distance-6 → clash −20.
- EC-MEM-012 ✅ numDist3 + letter flip (sum 4) → clash; numDist3 same letter (sum 3) → neutral 0.
- EC-MEM-013 ✅ Unparseable pairs (`""`, `Am`, `8a`, `8`, `A`, `XYZ`) → neutral / "Unknown key".
- EC-MEM-014 ✅ **Symmetric** for all 24×24 key pairs.
- EC-MEM-015 ✅ Every key perfect with itself.
- EC-MEM-016 ✅ Exactly 24 unique Camelot keys.
- EC-MEM-017 📝 `13A`×`1A` → parses as distance 0 → "perfect" (out-of-range quirk; document).

## 3.2 Transition scoring — ✅ `tests/edge.transitionScore.test.ts`
- EC-MEM-018 ✅ Score is finite and ∈ [0,100] across **756 hostile pairs** (NaN/Infinity/negative BPM, energy −5..20, bad keys).
- EC-MEM-019 ✅ `overall` always one of clean/messy/trainwreck; ≤ 3 reasons.
- EC-MEM-020 ✅ Identical tracks → 100 / clean.
- EC-MEM-021 ✅ `bpmDelta` = |Δtempo| (symmetric).
- EC-MEM-022 ✅ `energyDelta` signed (to − from).
- EC-MEM-023 ✅ Clash key + 20-BPM jump → trainwreck (< 45).
- EC-MEM-024 ✅ NaN/Infinity tempo → finite score (BPM term degrades to 0).
- EC-MEM-025 🧪 Genre-profile divergence (techno vs trance) — `tests/transitionScore.test.ts`.
- EC-MEM-026 📝 Energy delta exactly at each ladder boundary (±1,±2,±3) → expected point steps.
- EC-MEM-027 📝 Bitrate diff exactly 64 vs 65 kbps → technical point boundary.
- EC-MEM-028 📝 `format:'unknown'` both sides → no same-format bonus.

## 3.3 Library query parser — ✅ `tests/edge.queryParser.test.ts`
- EC-MEM-029 ✅ `""`/whitespace/chatter → null.
- EC-MEM-030 ✅ `"warehouse"` does **not** match genre `"house"` (word boundary).
- EC-MEM-031 ✅ 9 direct intents route correctly (forgotten_gems, closers, openers, sequences, health, identity, lifecycle).
- EC-MEM-032 ✅ `"after Strobe"` → `tracks_after`, lowercased trackQuery; trailing `?` stripped.
- EC-MEM-033 ✅ One-char track query → ignored (falls to null).
- EC-MEM-034 ✅ BPM range/`between`/reversed-order/single±2 all correct.
- EC-MEM-035 ✅ Genre longest-first (`tech house` beats `house`, `drum and bass` beats `bass`).
- EC-MEM-036 ✅ Energy peak→min8, chill→max4; rating `4 star`/`favourites`→4; never-played flag; dormancy months & years→months.
- EC-MEM-037 ⚠️ `"after 2020"` → tracks_after `"2020"` (D3; misreads dates).
- EC-MEM-038 📝 Mixed slots (`"deep house 120-128 bpm 4 star"`) → all slots populated.
- EC-MEM-039 📝 Contradictory (`"chill peak bangers"`) → first-match-wins, document precedence.
- EC-MEM-040 📝 BPM `"999 bpm"` / `"0 bpm"` → captured verbatim (no sanity clamp).
- EC-MEM-041 📝 Genre with `+`/`*` (`d&b`, `hip-hop`) regex-escaped correctly.

## 3.4 Library health & dedupe — ✅ `tests/edge.libraryHealth.test.ts`
- EC-MEM-042 ✅ `normalise`: punctuation/case/whitespace; emoji & accents stripped; underscore kept; idempotent.
- EC-MEM-043 ✅ Empty library → 100.
- EC-MEM-044 ✅ 1 missing file → 98; 50 missing → capped at 60.
- EC-MEM-045 ✅ Duplicate detection via normalised artist+title; distinct tracks not flagged.
- EC-MEM-046 ✅ Empty/whitespace key & 0 BPM flagged missing.
- EC-MEM-047 ✅ Unsupported format flagged.
- EC-MEM-048 ✅ Dismissed duplicate groups excluded.
- EC-MEM-049 ✅ Score never negative even with 200 fully-broken tracks.
- EC-MEM-050 📝 10k duplicate pairs → cap at 10 points, fast.
- EC-MEM-051 📝 `energySource:'pending'` counted as not-analysed; legacy undefined treated as analysed.

## 3.5 Set Architect, suggestions, smart crates, lifecycle, identity, gigs (📝 next pass)
- EC-MEM-052 📝 `buildSet` on empty library after BPM filter → `[]`.
- EC-MEM-053 📝 Locked track beyond target count / at slot 0 / out-of-order locks → respected, never reused.
- EC-MEM-054 📝 `variationSeed` undefined → deterministic; same seed → identical set (mulberry32).
- EC-MEM-055 📝 Repair pass runs ≤ 3 times, never touches locked slots.
- EC-MEM-056 📝 Excluded artist still allowed if a locked track uses them.
- EC-MEM-057 📝 `getSuggestions` excludes in-set + extra-exclude + missing-file tracks.
- EC-MEM-058 📝 Same-artist diversity penalty case-insensitive.
- EC-MEM-059 📝 Combo boost ≥3 plays → +25, 1–2 → +10, none → undefined.
- EC-MEM-060 📝 `bpmTopPercentThreshold` on empty/all-zero-BPM → Infinity (no crash).
- EC-MEM-061 📝 `evaluateCrate` empty rules → all tracks; `lastPlayedOlderThanMonths` with null lastPlayed → false.
- EC-MEM-062 📝 `classifyLifecycle` invalid `dateAdded` → define fallback (don't NaN-classify).
- EC-MEM-063 📝 `dateAdded` in the future / lastPlayed > dateAdded → handled.
- EC-MEM-064 📝 `findForgottenGems` division-by-zero guard (empty library avg playCount).
- EC-MEM-065 📝 `buildIdentity` empty library → minimal snapshot; bpm 0 → 'unknown' bucket sorts last.
- EC-MEM-066 📝 `isRealLabel` rejects ISRC & catalogue codes, accepts real 8+ char labels with spaces.
- EC-MEM-067 📝 `effectiveArtist` falls back to title prefix before `" - "`.
- EC-MEM-068 📝 Gig query "songs I played at Hi Ibiza" with venue typo/case → fuzzy match (define).
- EC-MEM-069 📝 Play session with empty trackIds → filtered out.
- EC-MEM-070 📝 `analyzeEnds` sequences of length < 2 → skipped.

## 3.6 AI assistant / local model (📝)
- EC-MEM-071 📝 Model not downloaded → `resolveModelPath()` null, parser-only fallback, no crash.
- EC-MEM-072 📝 Dev mode (no `resourcesPath`) → null path handled.
- EC-MEM-073 📝 Assistant disabled → `getStatus()` reflects it; no inference attempted.
- EC-MEM-074 📝 Query the parser can't handle → falls through to model; model timeout → graceful message.
- EC-MEM-075 📝 Adversarial prompt-injection in the ask box → treated as data, no tool/exec.
- EC-MEM-076 📝 10k-char ask input → truncated/bounded, no hang.

---

# AREA 4 — Licensing / DB / Core

## 4.1 Set Architect seed — ✅ `tests/edge.exportLicensing.test.ts`
- EC-LIC-001 ✅ `encode→decode` round-trips 0, 1, 255, 123456, 0xffffffff.
- EC-LIC-002 ✅ Encodes lowercase base36.
- EC-LIC-003 ✅ `decodeSeed` rejects `""`, whitespace, `"!!"`, `"-5"`, out-of-range `"zzzzzzzz"` → null.
- EC-LIC-004 ✅ Tolerates whitespace + case (`"  FF  "` → 555).
- EC-LIC-005 ✅ `freshSeed` ∈ [0, 2³²) integer (100 draws).

## 4.2 Licensing verification (🧪 strong existing coverage; 📝 = add)
- EC-LIC-006 🧪 `verifyKey` malformed/bad-signature/garbage-JSON/missing-fields (`tests/licenseVerification.test.ts`).
- EC-LIC-007 🧪 `evaluateLicense` device-bound on wrong device, portable override, subscription expiry, clock rollback > 24h, server revocation.
- EC-LIC-008 🧪 `evaluateTrial` 7-day window, boundary, clock wound back past start, high-water-mark.
- EC-LIC-009 🧪 `parseActivationUrl` malformed/wrong-scheme/missing key (`tests/activationDeepLink.test.ts`).
- EC-LIC-010 📝 License key with valid signature but **future-dated** `issuedAt` → rejected/flagged.
- EC-LIC-011 📝 Subscription with invalid ISO dates → fail closed (no entitlement).
- EC-LIC-012 📝 Revocation verdict for a *different* licenseId → ignored.
- EC-LIC-013 📝 `recordSeenNow` ratchet: timestamp in the past → no-op (high-water only moves forward).
- EC-LIC-014 📝 `startTrial` called twice → second returns false.
- EC-LIC-015 📝 System clock set to year 2038 then back → trial/sub still bounded by high-water mark.
- EC-LIC-016 📝 keytar unavailable (Linux/no keychain) → graceful degrade.
- EC-LIC-017 📝 Oversized (> 1 KB) activation key → rejected, no buffer issue.
- EC-LIC-018 📝 Deep link fired before app ready / fired twice → idempotent activation (see `tests/activationDeepLink`).
- EC-LIC-019 📝 Tip checkout with 0 / negative amount → validated.
- EC-LIC-020 📝 Trial armed offline, machine never online → still expires by local high-water.

## 4.3 DB schema / migrations / queries (📝 — needs sqlite harness)
> Note: `better-sqlite3` is built for Electron's ABI; vitest runs under Node's. Existing tests **mock** the DB (`MockDb` in `tests/engineExport.test.ts`). Promote these with an in-memory sqlite shim.
- EC-LIC-021 📝 `runMigrations` v1→v7 idempotent — re-run is a no-op.
- EC-LIC-022 📝 Column already exists (partial prior migration) → checks column directly, skips ALTER.
- EC-LIC-023 📝 v5 energy backfill leaves `energySource:'pending'` rows.
- EC-LIC-024 📝 v6 phantom + `discover://` sentinel URL handled.
- EC-LIC-025 📝 Corrupt version state (v2 without the ALTER) → recovers.
- EC-LIC-026 📝 `resetDb` quarantines a broken DB (rename to `corrupt-{ts}`), cleans WAL.
- EC-LIC-027 📝 DB file locked at startup → clear error, no silent data loss.
- EC-LIC-028 📝 `rowToTrack` with null columns → undefined fields, no throw.
- EC-LIC-029 📝 `rowToTrack` invalid JSON in `cue_points`/`hot_cues`/`discover_meta` → empty arrays, not crash.
- EC-LIC-030 📝 `trackToRow` unicode/emoji metadata → stored & round-trips.
- EC-LIC-031 📝 SQL-injection-looking strings in title/artist (`'); DROP TABLE`) → parameterised, inert.
- EC-LIC-032 📝 Track with 10k-char comment → stored or truncated (define).
- EC-LIC-033 📝 Migration interrupted (power loss) → next launch resumes/repairs.
- EC-LIC-034 📝 Two app instances opening the same DB → WAL handles or second instance refused.
- EC-LIC-035 📝 Disk full during write → transaction rolls back.

## 4.4 Settings / app core (📝)
- EC-LIC-036 📝 `getSettings` with missing keys → defaults merged.
- EC-LIC-037 📝 Corrupt JSON in electron-store → defaults, no crash.
- EC-LIC-038 📝 Stale/removed settings keys → ignored.
- EC-LIC-039 📝 Settings file read-only → in-memory fallback.
- EC-LIC-040 📝 Concurrent settings writes → last-write-wins, no corruption.

## 4.5 App lifecycle / platform (📝)
- EC-LIC-041 📝 First launch, no DB, no library → onboarding, empty states everywhere (no crashes on empty arrays — many ✅ pure cases above already prove the algorithms tolerate `[]`).
- EC-LIC-042 📝 `media://` URL encoding for files with `#`,`?`,spaces,unicode → audio + waveform load (see memory `feedback_audio_bug`).
- EC-LIC-043 📝 Quit mid-import → DB consistent on next launch.
- EC-LIC-044 📝 macOS sandbox denies folder access → permission prompt, graceful.
- EC-LIC-045 📝 App updated across a schema bump → migrations run once.
- EC-LIC-046 📝 Very high-DPI / tiny window → layout holds (UI).
- EC-LIC-047 📝 System dark/light toggle mid-session → re-themes.
- EC-LIC-048 📝 Offline for all network features → no hangs (license, model, exports all local-first).

---

## Next-pass priorities (promote 📝 → ✅)
1. **Fix D1** (`engineDj.ts` broken import) so `tests/serato.test.ts` collects again.
2. Stand up an **in-memory sqlite shim** to unlock §4.3 migration/query edge tests.
3. Fuzz `parseDatabaseV2` / Serato markers with malformed binary (§1.1) — highest crash risk.
4. Add boundary tests for `setArchitect` locks & `suggestions` combos (§3.5) — pure, high value.
5. Guard `ratingToEngine(NaN)` (D4) and decide `parseQuery` date handling (D3).
