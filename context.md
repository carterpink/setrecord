# SetSense — Agent Context

Memory file for the Claude Code agent building SetSense. Update at the end of every meaningful step.

---

## Project status

**Current phase:** 5 ✅ COMPLETE — Set Architect fully wired. One-click set building from ArchitectParams, energy curve target line live in graph, dual-handle BPM range slider, all modal UI. Ready for Phase 6 (Cue Points + Preview) on go-ahead.
**Last updated:** 2026-05-08
**Plan file:** `/Users/samcarter/.claude/plans/prd-md-read-this-splendid-goblet.md`

## What SetSense is

A desktop‑first DJ companion app for macOS that helps DJs build sets and reliably export them to Pioneer CDJ hardware. Three pillars: reliability (USB export, library health), intelligence (algorithmic suggestions, Set Architect), clarity. Built with Electron + Vite + React + TypeScript + Tailwind v3 + SQLite (later phases).

## Sources of truth

| Concern | Source |
|---|---|
| Functional spec | `/Users/samcarter/Documents/SetSenseV2/PRD.md` |
| Visual spec | Claude Design handoff bundle, extracted to `/tmp/setsense-design/setsense-design-system/` |
| Design tokens | `/tmp/setsense-design/setsense-design-system/project/colors_and_type.css` |
| Component CSS | `/tmp/setsense-design/setsense-design-system/project/ui_kits/setsense-app/index.html` (`<style>` block) |
| Component shapes | `/tmp/setsense-design/setsense-design-system/project/ui_kits/setsense-app/*.jsx` |
| Brand voice + anti‑patterns | `/tmp/setsense-design/setsense-design-system/project/README.md` |
| Icon set used | `/tmp/setsense-design/setsense-design-system/project/icons.js` (24 Lucide names; production uses `lucide-react`) |

**Conflict rule (from PRD §0):** design system wins on visual matters; PRD wins on functional matters.

## Resolved discrepancies (Phase 1)

| Item | PRD said | Design said | Using |
|---|---|---|---|
| Left panel width | ~340px | 320px | 320px |
| Aurora animation | 70s | 75s ease‑in‑out alternate | 75s |
| Mode toggle | Organise | Play | Prepare / Play |
| Top bar | (no Import) | Import button | Has Import button |
| Dock 4th icon | smile (cue editor) | disc‑3 (Waveform) | disc‑3 |
| Track row "selected" | 2px chartreuse left border | accent‑dim‑12 background | accent‑dim‑12 bg |

## Phase 1 user-confirmed decisions

- Project root: `/Users/samcarter/Documents/SetSenseV2/` (no nested `setsense/`).
- Build setup: **electron‑vite**.
- macOS window chrome: **hiddenInset** traffic lights (`trafficLightPosition: { x: 16, y: 20 }`).
- Token strategy: CSS variables in `tokens.css` are the source of truth; `tailwind.config.ts` references them via `theme.extend`.
- Fonts: copy 6 Stack Sans Headline `.ttf` files into `src/styles/fonts/`. JetBrains Mono via Google Fonts `@import`.
- Icons: `lucide-react` (NOT the `<i class="l">` shim from the prototype).
- Design bundle: stays in `/tmp` as reference; only fonts get copied into the project.

## Phase 1 dependencies (only)

`tailwindcss@^3 postcss autoprefixer lucide-react clsx`. Everything else (better-sqlite3, recharts, @dnd-kit, zustand, fast-fuzzy, wavesurfer.js, xml2js, chroma-js, electron-store, fuse.js) is deferred to later phases.

## Project structure (target — PRD §3 + scaffolding decisions)

```
SetSenseV2/
├── PRD.md                          # functional spec
├── context.md                      # this file
├── package.json
├── electron.vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json (+ tsconfig.node.json)
├── electron/
│   ├── main.ts                     # Electron entry
│   └── preload.ts                  # contextBridge stub for now
├── index.html                      # Vite renderer entry
└── src/
    ├── main.tsx                    # React 18 createRoot
    ├── App.tsx                     # renders <AppShell />
    ├── styles/
    │   ├── tokens.css              # @font-face + :root vars (from colors_and_type.css)
    │   ├── globals.css             # Tailwind layers + component CSS
    │   └── fonts/                  # 6 Stack Sans Headline .ttf
    ├── types/
    │   └── index.ts                # Track / SetTrack / Suggestion / etc.
    ├── utils/
    │   └── dummyData.ts            # LIBRARY_TRACKS / SET_TRACKS / SUGGESTIONS
    └── components/
        ├── layout/                 # AppShell, TopBar, BottomDock
        ├── library/                # LibraryPanel, TrackRow
        ├── timeline/               # TimelinePanel, TimelineTrackCard, EnergyCurveGraph
        ├── suggestions/            # SuggestionsPanel, SuggestionCard, MatchReasonChips
        └── shared/                 # Button, IconButton, Glass, Logo, KeyChip,
                                    # SegmentedControl, Toggle, Slider, Input,
                                    # Badge, Chip, EnergyBar, TransitionDot
```

## Phase 1 acceptance (must pass before Phase 2)

See plan file Verification section. Highlights:
- Electron window 1440×900, hiddenInset traffic lights, `#060309` background.
- Aurora drifts ~75s. Three glass surfaces look correct over it.
- Top bar Logo + Prepare/Play + Set safety badge + Import/Search/Settings/Export.
- Library panel: search + Library/Sets tabs + 9 dummy track rows.
- Timeline panel: "Friday — peak hour", energy curve SVG, 6 dummy timeline cards.
- Suggestions panel: best‑match Glass 3 card + 3 alternates.
- Bottom dock: 5 icons, two groups separated by divider.
- Stack Sans + JetBrains Mono load. No console errors. `tsc --noEmit` clean.

## Build commands

- `npm run dev` — full Electron + Vite dev (boots an Electron window with HMR)
- `npm run rebuild` — rebuild better-sqlite3 against Electron's Node ABI (run after any npm install that adds native deps, or after Electron version bump)
- `npm run build` — typecheck then build all three bundles (main / preload / renderer) into `out/`
- `npm run typecheck` — runs both `typecheck:node` (electron/) and `typecheck:web` (src/)
- `npm run lint` — ESLint over the project
- `npm run start` — preview the production build inside Electron

There is also a renderer-only `vite.config.ts` for in-browser preview without
booting Electron (used by Claude Preview / the harness). Run via `npx vite`
or via the `renderer-preview` config in `.claude/launch.json` (port 5174).

## Phase 1 deviations from PRD (notes for future phases)

- React 19 (scaffold default) instead of React 18 — PRD §2 lists 18, but R19 is the current stable in 2026 and API-compatible. No code changes needed.
- Renderer's preload `window.setsense` is typed as `Record<string, never>` until Phase 2 IPC methods land.
- Added `@fontsource/jetbrains-mono` (4xx, 5xx weights) for offline JBM rendering — replaces the design system's Google Fonts `@import` for the offline-at-the-venue use case the PRD calls out.
- Added a renderer-only `vite.config.ts` and `.claude/launch.json` for in-browser preview (does not affect production Electron build).
- `postcss.config.mjs` rather than `.js` to silence the ESM module-type warning.

## Open questions / things to ask before deviating

- Any conflict between PRD and design system not in the table above → PAUSE and ask.
- Adding visual tokens not present in `colors_and_type.css` → PAUSE and ask.
- Functional behaviors beyond Phase 1 scope → PAUSE and ask.

## Change log

- 2026-05-08: Phase 5 complete. electron/algorithms/energyCurve.ts (getTargetCurve/getActualCurve/getCurveDeviation), electron/algorithms/setArchitect.ts (greedy build loop via getSuggestions(), energy curve targeting, opener selection, 3-pass repair for trainwrecks, final transition scoring). suggestions.ts refactored to import getTargetAt from energyCurve.ts (removed inline duplicate). main.ts algo:build-set stub replaced with real handler. src/utils/energyCurve.ts (frontend mirror, no IPC). Slider.tsx made interactive (min/max/step/onChange). RangeSlider.tsx created (true dual-handle via overlapping <input type=range> technique, chartreuse fill between thumbs, 120-132 BPM default). setStore.ts gains populateFromArchitect(). EnergyCurveGraph.tsx target line now computed from set.energyCurveType via getTargetCurve (was hardcoded to 5). SetArchitectModal.tsx — all PRD §7.5 fields, 1s build animation, error state. BottomDock Sparkles+Layers icons wired to showModal('architect'). AppShell renders SetArchitectModal. Button.tsx template literal bug fixed (btn-${variant} → static record lookup so Tailwind does not purge btn-primary/btn-secondary/btn-ghost). typecheck clean.

- 2026-05-07: Phase 4 complete. electron/algorithms/ created with transitionScore.ts (BPM/key/energy/technical scoring, 0-100 scale, clean/messy/trainwreck classification) and suggestions.ts (BPM-window filter, diversity penalty, energy curve bonus, ranked Suggestion[] with MatchReasons). electron/utils/camelot.ts extended with getKeyCompatibility() (Camelot wheel math: perfect/energy-shift/mood-shift/compatible/neutral/clash). IPC handlers for algo:score-transition + algo:suggestions replace stubs in main.ts. preload.d.ts return types tightened (Promise<unknown> → Promise<Suggestion[]> / Promise<TransitionScore|null>). setStore gains computeAllTransitions() (parallel Promise.all over consecutive pairs, race-safe state check, fired from addTrack + reorderTracks). src/hooks/useSuggestions.ts hook (200ms debounce, isLoading, refresh()). SuggestionsPanel wired to live hook. GhostTrackCard.tsx renders top suggestion at 40% opacity at end of timeline. typecheck clean.
- 2026-05-07: Phase 3 complete. @dnd-kit/core + @dnd-kit/sortable + recharts installed. Set CRUD queries added to electron/db/queries.ts (getAllSets, getSetById, saveSet, deleteSet with atomic transaction). IPC handlers wired in main.ts. setStore.ts fully implemented with createSet/addTrack/removeTrack/reorderTracks/renameCurrentSet/loadSets/loadCurrentSet/deleteCurrentSet + 500ms auto-save debounce. TimelinePanel wired to store with useDroppable zone + SortableContext + inline set name editing. TimelineTrackCard upgraded with useSortable + grip handle + remove button + select state. EnergyCurveGraph replaced with live Recharts LineChart (chartreuse actual + dim white dashed target). Library TrackRow has useDraggable. LibraryPanel Sets tab lists savedSets. AppShell wraps in DndContext. savedSets syncs optimistically on every mutation. typecheck clean, no console errors.
- 2026-05-07: Plan written, approved. Beginning Phase 1 execution. Design bundle inspected at `/tmp/setsense-design`.
- 2026-05-07: Phase 2 complete. SQLite schema (5 tables + 5 indexes) created at ~/Library/Application Support/setsense/library.db on first launch. Rekordbox XML parser (electron/services/libraryImport.ts) maps all 21 PRD §7.1 fields including Camelot key conversion (electron/utils/camelot.ts). IPC bridge has 6 implemented channels (library:import, library:get-all, library:get-stats, library:count, fs:select-xml, fs:file-exists, fs:select-save) + stubs for Phase 3-7. Zustand stores: libraryStore (import/search/load), uiStore (modal routing), setStore/playbackStore (stubs). LibraryPanel reads from store with empty state + loading skeleton + debounced fast-fuzzy search. ImportModal shows progress bar + stats on completion. TopBar Import button opens modal. NOTE: better-sqlite3 requires `npm run rebuild` after any Electron version bump.
- 2026-05-07: Phase 1 complete. electron-vite scaffolded, reorganised to PRD §3 layout (`electron/main.ts` + `electron/preload.ts` + `src/` for renderer + `index.html` at root). Tokens + globals.css lifted from `colors_and_type.css` and the prototype's `<style>` block. All 17 components built (3 layout + 9 shared + 2 library + 3 timeline + 3 suggestions). Dummy data lifted from JSX. `npm run typecheck` passes (both web and node configs). Renderer preview at localhost:5174 confirms: aurora + 3 glass panels, top bar (Prepare/Play, Set safety badge, Import/Search/Settings/Export), library with 9 track rows + Camelot keys, timeline with "Friday — peak hour" + energy curve SVG + 6 cards (track 04 has the playing ring, track 05 shows messy/key clash), suggestions with chartreuse-ringed best-match card + 3 alternates, bottom dock with 5 icons in two groups. No console errors.
