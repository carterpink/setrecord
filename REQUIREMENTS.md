# SetRecord — Requirements Specification (Starter)

*A lightweight, living first draft. Not exhaustive — a real foundation to build on.*
*Companion to the plain-English audit in [`REQUIREMENTS-AUDIT.md`](REQUIREMENTS-AUDIT.md).*
*Last reviewed: 2026-06-03 · Structure: loosely IEEE-830, qualities grouped per ISO/IEC 25010.*

## How to read this

- **Functional requirements (`FR-###`)** = *what the app does.*
- **Non-functional requirements (`NFR-###`)** = *how well it does it* (speed, safety, etc.).
- Each requirement is one **testable** sentence.
- **Status** legend:
  - **Implemented** — built and shipping today.
  - **Partial** — partly built / true in code but not guaranteed or measured.
  - **Planned** — intended, not yet built.
  - **Gap — proposed** — *not currently decided.* This is a best-practice **suggestion** for you
    to accept, edit, or reject. It is **not** a claim that the app does this today.
- **Source** points to where the behaviour is described or enforced today.

> IDs are stable handles — don't renumber them; mark retired ones as *Deprecated*.

---

## 1. Functional Requirements

### 1.1 Library & Import
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-101 | The user can import tracks, playlists and play history from a Rekordbox collection XML export. | Implemented | `README.md`, `PRD.md §7` |
| FR-102 | The user can import directly from the Rekordbox `master.db`, behind an explicit consent gate. | Implemented | `README.md`, `electron/services/rekordbox/dbReader.ts` |
| FR-103 | The user can import from a Serato library (V2 database, crates, per-file cues/beatgrids). | Implemented | `electron/services/serato/` |
| FR-104 | Imports are non-destructive: re-importing matches tracks by file path and preserves existing IDs, sets and cues. | Implemented | `README.md` |
| FR-105 | Playlist folder nesting is preserved and usable as a filter / Set Architect source pool. | Implemented | `PRD.md §7` |
| FR-106 | New DJ-software sources can be added via a pluggable provider abstraction (Engine DJ stubbed). | Partial | `electron/services/import/providers/` |

### 1.2 Analysis & Metadata
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-201 | The app analyses each track's energy locally (spectral features via bundled ffmpeg), with no upload. | Implemented | `PRD.md §2/§7`, `README.md` |
| FR-202 | Key and BPM are read from metadata; key is normalised to the Camelot wheel. | Implemented | `PRD.md §6` |
| FR-203 | Embedded album artwork is extracted and cached locally. | Implemented | `electron/services/energyAnalyser.ts` |
| FR-204 | The app generates plain-language tags (vibe, energy, best-for, vocals, genre) from spectral features. | Implemented | `electron/services/tagging/tagger.ts` |
| FR-205 | The user can write tags back to Rekordbox MyTags, guarded by a database backup. | Implemented | `electron/services/rekordbox/myTagWriter.ts` |

### 1.3 Set Building & Set Architect
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-301 | The user can build a set by drag-and-drop from the library onto a timeline. | Implemented | `PRD.md §7` |
| FR-302 | Set Architect can auto-generate a set from parameters: name, duration, BPM range, vibe, and source pool. | Implemented | `PRD.md §7`, `electron/algorithms/setArchitect.ts` |
| FR-303 | The user can describe a set in plain English and have it parsed into Set Architect parameters. | Implemented | `src/utils/homeQuery.ts` |
| FR-304 | The timeline shows a target energy curve vs. the actual curve for the set. | Implemented | `PRD.md §6/§7` |
| FR-305 | Set generation is regenerable for variation (optionally seeded for reproducibility). | Partial | `PRD.md §6` |

### 1.4 Harmonic & Transition Intelligence
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-401 | The app classifies key relationships on the Camelot wheel (perfect / energy / mood / compatible / clash). | Implemented | `PRD.md §6` |
| FR-402 | Each transition gets a 0–100 score combining BPM delta, key compatibility, energy flow and format. | Implemented | `PRD.md §6`, `electron/algorithms/transitionScore.ts` |
| FR-403 | Transitions are classified clean / messy / trainwreck with a human-readable reason. | Implemented | `PRD.md §6` |

### 1.5 Suggestions & Smart Crates
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-501 | The app suggests ranked next tracks using transition quality, diversity penalties and energy-curve fit. | Implemented | `PRD.md §6`, `electron/algorithms/suggestions.ts` |
| FR-502 | Each suggestion shows transparent match-reason chips (key, BPM, energy, genre). | Implemented | `PRD.md §6` |
| FR-503 | The app generates rule-based smart crates (energy/BPM/key/genre/vibe/dormancy). | Implemented | `electron/algorithms/memory/smartCrates.ts` |

### 1.6 Memory & Recall
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-601 | The app records gig sessions and track-level playback history. | Implemented | `src/components/recall/GigsSection.tsx`, `electron/services/memoryService.ts` |
| FR-602 | The user can rediscover overlooked tracks via a swipe deck ("Uncover"). | Implemented | `src/components/recall/UncoverSection.tsx` |
| FR-603 | The app surfaces a DJ identity profile (top genres, key distribution, energy, vocal preference). | Implemented | `src/components/recall/IdentitySection.tsx` |
| FR-604 | The app surfaces recurring multi-track combos that work well together. | Implemented | `src/components/recall/CombosSection.tsx` |

### 1.7 Conversational Home
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-701 | A single conversational box is the primary Library entry point for count/filter/build/similar queries. | Implemented | `src/components/home/HomeSurface.tsx`, `src/stores/homeStore.ts` |
| FR-702 | Structured queries resolve on a deterministic fast-path without the language model. | Implemented | `src/utils/homeQuery.ts` |
| FR-703 | Open-ended queries fall back to a local, grammar-constrained model (no cloud). | Implemented | `electron/services/memoryAssistant.ts` |
| FR-704 | The user can see and edit how their query was interpreted ("I read that as…") before re-running. | Implemented | `src/components/home/HomeTurn.tsx` |
| FR-705 | Voice input is available via offline transcription (bundled whisper.cpp model, on-device; mic capture + setup/permission UX). | Implemented | `src/hooks/useVoiceCapture.ts`, `electron/services/speech/transcribeService.ts` |

### 1.8 Export & Hardware
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-801 | The user can export a set as Rekordbox-compatible XML with metadata, cues and playlists. | Implemented | `PRD.md §7`, `electron/services/exportService.ts` |
| FR-802 | Before export, the app validates the set against a target CDJ model (format, bitrate, duration, hot-cue limits, missing files). | Implemented | `PRD.md §6.6`, `electron/services/usbValidator.ts` |
| FR-803 | The user can export a gig-ready Engine DJ library (SQLite + copied audio) to a USB drive. | Implemented | `electron/services/engine/engineExport.ts` |
| FR-804 | The user can export a set as a Beatport CSV using offline ISRC/title match-keys. | Implemented | `electron/services/beatport/`, `src/utils/beatportMatch.ts` |

### 1.9 Licensing, Trial & Onboarding
| ID | Requirement | Status | Source |
|---|---|---|---|
| FR-901 | A 7-day Pro trial arms on first library import and unlocks all features. | Implemented | `LICENSING.md §7` |
| FR-902 | The user can activate Pro via a one-click deep-link carrying an Ed25519-signed key. | Implemented | `LICENSING.md` |
| FR-903 | License keys are verified offline against an embedded public key (no network required). | Implemented | `LICENSING.md`, `README.md` |
| FR-904 | First launch presents a guided onboarding flow when no library exists yet. | Implemented | `PRD.md` Phase 8 |
| FR-905 | Settings let the user opt in/out of the Rekordbox DB consent gate and local AI features. | Implemented | `src/components/modals/SettingsModal.tsx` |

---

## 2. Non-Functional Requirements

### 2.1 Performance (ISO 25010: Performance efficiency)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-101 | A 10,000-track library scrolls at 60fps (via virtual scrolling). | Implemented | `PRD.md:659` |
| NFR-102 | Suggestions recompute in <100ms. | Implemented | `PRD.md:660` |
| NFR-103 | Set Architect completes a 20-track build in <500ms. | Implemented | `PRD.md:661` |
| NFR-104 | XML import of 10,000 tracks completes in <10s. | Implemented | `PRD.md:662` |
| NFR-105 | App cold-start to interactive is <3s. | Implemented | `PRD.md:663` |
| NFR-106 | Waveform rendering never blocks the UI thread. | Implemented | `PRD.md:664` |
| NFR-107 | The performance budgets above are verified by an automated benchmark / profiling harness. | Gap — proposed | targets exist; no proving test |

### 2.2 Security (ISO 25010: Security)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-201 | Release builds are code-signed and notarized with hardened runtime enabled. | Implemented | `README.md`, `electron-builder.yml` |
| NFR-202 | Renderer runs without Node integration; all main↔renderer traffic uses contextBridge IPC. | Implemented | `PRD.md:24` |
| NFR-203 | Secrets (license keys) are stored in the macOS Keychain, never in plain files or the database. | Implemented | `README.md`, `LICENSING.md` |
| NFR-204 | License authenticity is enforced cryptographically (Ed25519); forged/malformed keys are rejected. | Implemented | `LICENSING.md` |
| NFR-205 | The trial resists clock-rollback by judging expiry against the highest wall-clock time ever seen. | Implemented | `LICENSING.md §7` |
| NFR-206 | Pro keys may optionally be bound to an anonymous device ID. | Implemented | `LICENSING.md §6` |

### 2.3 Privacy (ISO 25010: Security / confidentiality)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-301 | Audio is never uploaded; all analysis runs locally. | Implemented | `README.md`, `PRD.md §2` |
| NFR-302 | Core features work fully offline (no network on the critical path). | Implemented | `README.md`, `LICENSING.md` |
| NFR-303 | Local audio is served via an internal `media://` protocol and never leaves the machine. | Implemented | `README.md` |
| NFR-304 | If crash/usage telemetry is enabled, the data it collects, its default on/off state, and user opt-out are documented and consistent with the privacy promise. | Implemented | `TELEMETRY.md`, `SettingsModal.tsx` (Privacy toggle) |

### 2.4 Reliability (ISO 25010: Reliability)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-401 | A corrupt database is quarantined (`library.db.corrupt-<timestamp>`) and a fresh DB is created instead of crashing. | Implemented | `README.md` |
| NFR-402 | Schema migrations are idempotent and safe to re-run on any startup. | Implemented | `electron/db/migrations.ts` |
| NFR-403 | A crash in one UI panel is isolated by an error boundary and does not take down the app. | Partial | `llmcouncilaudit.md`, `src/` |
| NFR-404 | Destructive operations (e.g. Rekordbox tag write-back) are guarded by a backup. | Implemented | `electron/services/rekordbox/myTagWriter.ts` |

### 2.5 Compatibility & Portability (ISO 25010: Compatibility / Portability)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-501 | The app runs on macOS Apple Silicon (arm64). | Implemented | `README.md:24-33` |
| NFR-502 | The app reads MP3, AIFF/AIF, WAV, FLAC and M4A audio. | Implemented | `README.md` |
| NFR-503 | Export validation is aware of per-model CDJ capabilities (CDJ-2000/NXS2/3000, XDJ-RX3/XZ). | Implemented | `PRD.md §4`, `electron/services/usbValidator.ts` |
| NFR-504 | Exported data round-trips back into Rekordbox / onto CDJ hardware. | Implemented | `electron/services/exportService.ts`, `electron/services/engine/engineExport.ts` |

### 2.6 Usability & Accessibility (ISO 25010: Usability)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-601 | Core actions are reachable by keyboard (⌘K search, Space preview, arrow navigation). | Implemented | `PRD.md` Phase 8 |
| NFR-602 | Loading and empty states are present across all panels. | Implemented | `PRD.md` Phase 8 |
| NFR-603 | The UI meets WCAG 2.1 AA colour-contrast, and every interactive control is keyboard- and screen-reader-reachable. | Gap — proposed | no standard set today |
| NFR-604 | Beginner users see reduced jargon (driven by an `isBeginner` flag). | Implemented | `src/components/onboarding/` |

### 2.7 Maintainability (ISO 25010: Maintainability)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-701 | Every push runs typecheck, lint, unit tests and a build in CI before merge. | Implemented | `.github/workflows/ci.yml` |
| NFR-702 | Build artifacts exclude source, tests, secrets (`*.pem`), docs and lockfiles. | Implemented | `electron-builder.yml` |
| NFR-703 | User data lives in a standard macOS location (`~/Library/Application Support/SetRecord/`). | Implemented | `README.md`, `PRD.md` |

### 2.8 Observability (ISO 25010: Maintainability / operability)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-801 | There is a documented logging strategy for diagnosing failures on a user's machine (what is logged, where, and for how long). | Gap — proposed | — |
| NFR-802 | Crash reporting (Sentry) has a documented configuration: enabled state, DSN ownership, sampling, and what is scrubbed. | Implemented | `TELEMETRY.md`, `electron/services/crashReporter.ts` |

### 2.9 Data Lifecycle (ISO 25010: Maintainability / capacity)
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-901 | The artwork cache and the bundled local AI models have a documented size bound and cleanup/update policy. | Implemented | Models: two ship in `resources/models` via `scripts/fetch-model.mjs` — Recall LLM (Qwen Q4_K_M, ~1.9 GB) and voice (whisper `ggml-base.en`, ~142 MB). Both load lazily; an absent bundled copy (dev/stripped install) self-heals via one download into `userData/models` (atomic temp→rename). Artwork cache (`electron/services/artworkExtractor.ts`): one ~10 KB JPEG per track (size bound = live library; a 4k-track library ≈ 30 MB), partial/failed extractions cleaned inline, and `pruneArtworkCache()` reclaims orphaned art for deleted/re-imported tracks on every startup. |

### 2.10 Delivery & Updates
| ID | Requirement | Status | Source |
|---|---|---|---|
| NFR-1001 | A mechanism exists to deliver updates to installed users. | Gap — proposed | absent today (manual) — `README.md:179-182` |

---

## 3. Constraints & Out of Scope (v1)

Explicitly **not** built in v1 (per `PRD.md §12`) — these are deliberate constraints, not gaps:
Spotify integration · external AI/cloud API calls · cloud sync or user accounts · Windows support ·
mobile version · collaboration features · beat detection from audio (metadata only) · automatic BPM
correction · social sharing.

Implication: **scalability/backend NFRs are N/A by design** — SetRecord is fully local and offline,
so it could have many users and run zero servers.

---

## 4. Open Questions (decisions you still own)

1. **Accessibility target** — do we commit to WCAG 2.1 AA (NFR-603), or a lighter "keyboard-complete"
   bar for v1?
2. **Telemetry** — is Sentry on by default, opt-in, or removed? This must be reconciled with the
   privacy promise (NFR-301/304, NFR-802).
3. **Data retention** — what's the cap and cleanup rule for the artwork cache and the AI model
   (NFR-901)?
4. **Updates** — is manual distribution acceptable for launch, or do we want `electron-updater`
   before GA (NFR-1001)?
5. **Performance proof** — do we want an automated benchmark that fails CI if a budget regresses
   (NFR-107), or is manual profiling enough for now?
