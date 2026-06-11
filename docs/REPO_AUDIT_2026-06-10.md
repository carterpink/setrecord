# SetRecord — Repository Audit & Improvement Plan

**Date:** 2026-06-10 · **Branch audited:** `feat/grit-redesign` · **Method:** five parallel read-only audit passes (architecture, security, code quality, testing/performance, dependencies/DX/docs), evidence-cited. No code was modified.

---

## 1. Executive Summary

**Overall health grade: B+.** This is an unusually disciplined pre-launch codebase: security hardening is verifiably real (Electron fuses, hardened runtime, keychain-anchored anti-tamper licensing, zero SQL/command injection), 873 tests run green in 9.4 s, CI enforces performance budgets on every PR, and type hygiene is near-perfect (3 `as any` in 83k lines). What keeps it from an A is concentrated in three places: the *wiring* layers are God files (all 131 IPC handlers in one 1,289-line function; 2,112-line query module; 2,012-line settings modal), the error chain dies silently end-to-end (~130 swallowed-failure paths between unwrapped IPC handlers and `catch {}` stores), and CI green overstates reality — the data layer's 26 real-database integration tests are permanently skipped on every automated surface.

**Top 3 risks:**
1. **GPL compliance:** `ffmpeg-static` is GPL-3.0 and ships inside the paid, closed-source DMG with no license artifacts (High — legal exposure at launch).
2. **Silent data-layer regressions:** every `queries.ts` integration test is `skipIf(!dbAvailable)` and `dbAvailable` is false locally *and* in CI; the nightly job rebuilds the right ABI but never runs `npm test`.
3. **Silent failure UX:** destructive actions (delete crate, license refresh) can fail with no toast, no log, no telemetry — a main-process exception evaporates in a `catch { /* ignore */ }`.

**Top 3 opportunities:**
1. Split `registerIpcHandlers` by channel-prefix domain — directly de-conflicts the parallel-features worktree workflow the project relies on.
2. A single `handleSafe()` IPC wrapper + renderer error funnel converts ~130 invisible failure paths into observable ones for roughly a day of work.
3. A handful of S-effort quick wins (dead deps, stale docs, defeated memo, CDP gate) clear most of the Medium-severity list in under a day.

---

## 2. Repository Map

**Purpose.** SetRecord (formerly SetSense) — a macOS desktop DJ companion: imports Rekordbox/Serato/Engine libraries, plans sets with harmonic-mixing intelligence, validates CDJ-ready USB exports, records live sets ("flight recorder"), and answers natural-language questions about your library ("DJ's memory"). Commercial product approaching launch (Free / $79 yr / $199 lifetime), fully local-first — the only network egress is opt-in crash reporting and license activation.

**Maturity.** Pre-launch production product, single primary developer, ~83k lines of TypeScript across 448 files. Far beyond prototype: CI/CD with notarized release pipeline, i18n (5 locales), telemetry policy doc, security launch checklist.

**Stack.** Electron 39 (CLAUDE.md says 33 — stale) · Vite (electron-vite) · React 19 · TypeScript strict · Zustand (16 stores) · better-sqlite3 (+ SQLCipher available) · Vitest · ESLint · Tailwind. Native modules: better-sqlite3, keytar, @journeyapps/sqlcipher, smart-whisper, node-llama-cpp (bundled 1.9 GB on-device LLM for Recall).

**Architecture sketch.**
```
renderer (React)                    main process (Electron)
┌─────────────────────┐   typed    ┌──────────────────────────────┐
│ components/* (129)  │  preload   │ main.ts (2,383 ln)           │
│ stores/* (16)       │◄──bridge──►│  └ registerIpcHandlers()     │
│ utils/* (NL parsing)│  126 chan  │     131 handlers, 14 domains │
└─────────────────────┘            │ services/* (70+ files, good) │
                                   │ algorithms/* (pure, tested)  │
                                   │ db/{schema,migrations,       │
                                   │     queries.ts (2,112 ln)}   │
                                   └──────────────────────────────┘
```

**Key directories.**
| Path | What it is |
|---|---|
| `electron/main.ts` | Window mgmt, protocol, schedulers, **all** IPC wiring (God file) |
| `electron/services/` | 70+ files: import providers, licensing, live engine, logging, backup — healthy decomposition |
| `electron/algorithms/` | Pure set-building/suggestion/memory logic — well tested |
| `electron/db/` | schema + defensive migrations + monolithic `queries.ts` (contains a binary blob; needs `grep -a`) |
| `src/stores/` | 16 Zustand stores; `homeStore.ts` (893 ln) carries domain logic |
| `src/components/` | React UI; modals include 2,012- and 1,472-line God components |
| `tests/` + `tests/eval/` | 84 files, 873 tests + a 211-case NL-query eval harness (210/210) |
| `bench/` | PRD §11 perf budgets, Tier A gates every PR, Tier B nightly |
| `docs/` | Launch plan, security checklist (has open blockers), QA script |
| repo root | ~12 stray strategy/scratch .md files + `homedesignfiles/` (clutter) |

**Surprises found during mapping.**
- `wavesurfer.js` and `fuse.js` are production dependencies with **zero imports** anywhere.
- ~2,700 lines under `electron/algorithms/memory/` + `src/utils/*Intent.ts` are reachable **only** from the eval harness, not the app (likely intentional staging for the ai-eval-harness branch, but unlabeled).
- `console.*` in the main process is *sanctioned*: the logger hijacks console globally (`logger.ts:355-356`), so what looks like a CLAUDE.md violation isn't — worth documenting.
- `tsconfig.web.tsbuildinfo` (193 KB) is git-tracked despite being gitignored now.

**Lighter-review areas** (flagged, not deeply audited): collab/Yjs CRDT internals, blackbox DSP math, `server/`, `scripts/`, locale file contents, the separate landing-page and Cloudflare Worker repos.

---

## 3. Audit Report

Severity ordering within each dimension. Each finding labels FACT (verified in source) vs JUDGMENT (assessment).

### 3.1 Security — *healthiest dimension*

The 2026-06 hardening pass is real and verified: Ed25519 license verification over exact payload bytes with no cached entitlement (`licenseService.ts:127-133`); dev-Pro bypass gated on `app.isPackaged`, failing closed (`licenseService.ts:300-308`); keychain-anchored trial/clock anchors (`licenseAnchors.ts`, `trialStore.ts:44-50`); Electron fuses + hardened runtime + notarization (`electron-builder.yml:108-114`); navigation/window-open/permission guards (`main.ts:510-533`, `:2320-2338`); path-confined `media://` (`mediaAccess.ts`); parameterized SQL throughout; `spawn`/`execFile` array-args only; thorough Sentry PII redaction (`crashReporter.ts:36-77`).

| # | Finding | Where | Consequence | Sev | F/J |
|---|---|---|---|---|---|
| S1 | `SETSENSE_CDP` enables `remote-debugging-port` + `remote-allow-origins: *` with **no** `!app.isPackaged` guard | `electron/main.ts:266-271` | Env var in a shipped app exposes CDP to local origins; fuses don't cover this app-level switch | **Medium** | FACT (switch) / JUDGMENT (exploitability) |
| S2 | Unused generic `electronAPI` bridge exposed alongside the curated API | `electron/preload.ts:651`; zero `window.electron` usages in `src/` | Renderer XSS could invoke any of 131 channels, bypassing the typed surface; one-line removal | **Medium** | FACT exposed/unused; toolkit bridge contents to verify |
| S3 | `sandbox: false` on both windows | `main.ts:480-481`, `:575-576` | Compromised renderer keeps unsandboxed Chromium privileges; preload imports no Node builtins, so likely enableable | **Medium** | FACT (flag) / JUDGMENT (enableable) |
| S4 | `fs:file-exists` accepts arbitrary renderer paths; `logs:reveal` opens arbitrary path in Finder | `main.ts:1252-1254`, `:1666-1668` | Filesystem-existence oracle / Finder reveal from a compromised renderer | Low | FACT |
| S5 | No sender/origin validation on IPC handlers (mitigated by nav guards) | grep: no `senderFrame` checks | Defense-in-depth gap only | Low | JUDGMENT |
| S6 | Meta CSP allows `connect-src` to `cdn.jsdelivr.net`/`tessdata.projectnaptha.com` (tesseract model fetch?) | `index.html:19` | Possible runtime supply-chain fetch; prod header CSP drops `unsafe-inline` but not this | Low | FACT (CSP) / **unverified** (whether fetch happens) |
| S7 | xml2js 0.6.2 on untrusted Rekordbox XML — sax defaults block XXE/entity expansion | `libraryImport.ts:352,495` | Residual risk is large-file DoS only | Low | JUDGMENT (no PoC run) |

**Not verifiable here:** Lemon Squeezy webhook HMAC (separate Worker repo — still the #1 open blocker per `docs/SECURITY_LAUNCH_CHECKLIST.md` §0); fuses in