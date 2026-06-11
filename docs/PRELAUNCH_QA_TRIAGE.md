# Pre-Launch QA — Triage (what's already proven vs what you must hand-test)

Companion to `PRELAUNCH_QA_SCRIPT.md`. Generated 2026-06-11 by verifying each QA
item against the code + the (green: 912 passed) test suite.

**The point:** ~21 items are already proven by passing tests — pre-checked below,
you can skip them. ~33 need a quick glance. ~33 genuinely need your hands/eyes.
That turns a 2–3 hour cold pass into a focused ~1 hour run.

---

## ✅ A. PRE-VERIFIED — proven by passing tests/code. You may skip these.

- [x] **1.6 Single-instance focus** — `requestSingleInstanceLock` / `second-instance` handler (`electron/main.ts:415,419`).
- [x] **1.9 `__setTheme('aurora')` is dev-only, not user-exposed** — registered as a dev helper (`src/utils/theme.ts:30`); aurora gated by `[data-theme='aurora']`; no user toggle.
- [x] **2.3 Trial arms on first import & can't be farmed** — `trialStore.startTrial()`; `licenseAnchors.test.ts` (wipe-JSON / Fresh-Start can't re-arm). *(Seeing the banner = quick glance, item 2.3 in §C.)*
- [x] **3.8 Malformed/empty XML → friendly error** — import wrapped in try/catch (`import/registry.ts:40`); non-throwing parse test (`edge.rekordboxImport.test.ts:30`).
- [x] **4.5 Engine DJ stub fails gracefully** — flag-gated off (`launchProfile.test.ts:19`), filtered from picker, `SourceNotImplementedError` guard.
- [x] **7.3 MyTag write-back backs up FIRST** — mandatory `copyFileSync` (incl. -wal/-shm) before any write (`myTagWriter.ts:86-92`). Feature also launch-gated off.
- [x] **8.6 Recorder crash recovery** — sweeps crash-left temp files; 0-byte capture yields nothing (`setRecorder.test.ts:88,76`).
- [x] **11.3 Engine export validator blocks missing/non-owned** — explicit blocking tests (`engineExport.test.ts:49,60`).
- [x] **11.6 Engine export Pro-gated** — entitlement-gated (`edge.exportLicensing.test.ts`).
- [x] **12.1 Beatport CSV: offline match-keys, no network** — pure-function exporter, no fetch (`beatportExport.test.ts`). Launch-gated off.
- [x] **12.2 Beatport: no DB writes** — exporter holds no DB handle (pure string build).
- [x] **12.3 Beatport Pro-gated** — `edge.exportLicensing.test.ts`.
- [x] **13.1 Correct pricing tiers** — `entitlements.ts PRO_PRICING` = $9 decoy / $79yr / $199 lifetime; tip pills hidden.
- [x] **13.4 Tampered/forged license rejected (Ed25519 fail-closed)** — 19 cases: malformed, wrong authority, tampered payload→`bad-signature`, wrong device, revoked (`licenseVerification.test.ts`).
- [x] **13.6 Clock-rollback trial defense** — keychain high-water-mark; "clock cannot roll back / can't be farmed" (`licenseAnchors.test.ts`).
- [x] **13.7 Offline Pro stays unlocked** — network never on critical path; verify is fully local (`gateway.ts:10`, `offlineGateway`). *(One offline-launch eyeball still wise.)*
- [x] **14.2 i18n key parity (no missing keys)** — `{missing:[], extra:[]}` asserted for every language (`i18n.test.ts:64`).
- [x] **14.3 Reduced-motion respected (mechanism)** — `prefers-reduced-motion` CSS + `matchMedia` gate (`Bloom.tsx:123`) + persisted toggle.
- [x] **14.4 Log redaction holds** — home→`~`, media→basename, emails stripped (`logRedact.test.ts`, 13 passing); sid-correlated bug export (`logExport.test.ts`).
- [x] **14.5 External links open in system browser** — `setWindowOpenHandler` allow-list, `shell.openExternal` only (`main.ts:538`).
- [x] **15.6 Clean relaunch after crash** — temp sweep + launch smoke test asserts clean boot, no uncaught error (`tests/smoke/launch.smoke.mjs`).
- [x] **15.7 Auto-update non-blocking / silent-degrade** — no-op in dev, never prompts on bad input (`updateChecker.test.ts:81,68`).

---

## 👁️ B. MUST HAND-TEST — visual / audio / hardware / real purchase. No shortcut.

**Launch & shell:** 1.1 splash + no FOUC · 1.2 resize reflow · 1.3 fullscreen · 1.4 minimize/restore/hide · 1.7 **native menu bar (see caveat ⚠️)** · 1.8 grain CPU (Activity Monitor).
**Onboarding:** 2.1 first-run flow + CTA · 2.4/2.5 skip & no re-nag.
**Imports:** 3.1 file dialog + progress · 3.3 album art renders · 3.6 Unicode/emoji no mojibake · 3.9 huge-library responsiveness · 4.3 crates in sidebar · 4.6 cross-check vs Serato app.
**Library:** 5.1 smooth scroll · 5.3 tags-bar filter · 5.4 **audio + waveform on a path-with-spaces** (encoding fix is in code, but you must HEAR it).
**Uncover:** 6.1 cards deal/swipe · 6.2 actions persist.
**Recorder (privacy-critical):** 8.2 **consent prompt + REC indicator + audio** · 8.3 playback seek · 8.5 no network upload · 8.7 deny-consent path · 8.8 long-session size.
**Home:** 9.4 streak numbers (no NaN) · 9.5 first-run empty state.
**Build:** 10.2 drag-reorder persists.
**Engine export (hardware):** 11.1 real USB write · 11.2 load in Engine · 11.4 USB full/read-only · 11.5 eject mid-export.
**Payment (real LS):** 13.2 checkout opens correct product · 13.3 **test purchase unlocks Pro** · 13.5 restore on fresh profile · 13.8 cancelled/failed payment.
**Native sweep:** 15.2 drag-and-drop · 15.3 **sleep/wake audio recovery** · 15.4 **external monitor / DPI**.
**Go/no-go:** no red console errors · no data loss · privacy holds.

---

## 🟡 C. QUICK GLANCE — code is correct; just confirm the UX once.

2.2 beginner copy · 3.2 playlist tree · 3.4 MyTag/color · 3.5 re-import dedupe · 3.7 missing-file flag · 4.1/4.2/4.4 Serato (also needs real-file pass) · 5.2 search · 5.5 recall + "I read that as" · 5.6 gig recall · 5.7/5.8 empty/no-result states · 6.3/6.4 small/empty deck · 7.1 tags appear · 7.2 tags filterable · 8.1 always-armed tracklist · 8.4 reactions gated · 9.1/9.2 conversational box · 9.3 voice · 10.1/10.3 source pool + suggestions · 10.4 save/reopen set · 10.5/10.6 empty pool / missing-file track · 14.1 settings persist · 15.1 dialog paths w/ spaces · 15.5 quit with unsaved work.

---

## ⚠️ Caveats before you skip anything

1. **1.7 Native menu bar** — no `setApplicationMenu` / `Menu.buildFromTemplate` found in `electron/`; the app appears to use Electron's **default** menu. If you expect custom items (About, etc.), that's a real gap — verify by hand or decide the default is fine.
2. **DB-backed tests skipped in this run** — items leaning on `setPersistence`, `gigQueries`, `bulkQueries`, `liveSession`, `markPerformedDedup`, `provenanceMigration` were skipped because the native `better-sqlite3` ABI isn't loaded under vitest. They're listed in §C (glance), not §A. To promote them to "proven," run those tests in an environment with the rebuilt native module.
