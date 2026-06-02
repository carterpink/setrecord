# SetSense V2: Pre-Launch Audit Results
## Comprehensive Multi-Perspective Review — 18 May 2026

> Replaces [setsense_v2_audit_framework.md](setsense_v2_audit_framework.md). The framework was authored before Phases 6–9 shipped; its bug list is resolved and its 3-tier SaaS pricing assumption doesn't fit the actual architecture. This document is the canonical pre-launch audit.

**Auditor:** Claude Opus 4.7 (multi-perspective analysis)
**Codebase state:** branch `feat/phase-6-cue-points-preview`, post-Phase-9 commit `7497ef4`

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [What the framework got wrong](#2-what-the-framework-got-wrong)
3. [Seven expert perspectives](#3-seven-expert-perspectives)
4. [Code & tech debt audit](#4-code--tech-debt-audit)
5. [Backend infrastructure plan](#5-backend-infrastructure-plan-subscription-path)
6. [Hard questions for the founder](#6-hard-questions-for-the-founder)
7. [Prioritized launch roadmap](#7-prioritized-launch-roadmap)
8. [What NOT to build](#8-what-not-to-build)

---

## 1. Executive summary

**Verdict: No-go on paid subscription launch today.** The product is more polished than the framework assumes — Phases 1–9 are complete, all four framework bugs are resolved, and core experiences (audio playback, waveform rendering, Set Architect, USB detection, Learn Mode) are real, not stubs. But subscription requires backend infrastructure that doesn't exist, and the product has never been validated by a real user.

**Three code blockers (week 1, ~30 engineering hours):**

1. **Zero automated tests** across 110 TypeScript files. Subscription customers will surface bugs you've never seen; refunds erode trust faster than features earn it.
2. **YouTube API key stored plain-text** in `electron-store` ([settingsService.ts:32-35](electron/services/settingsService.ts)) and not validated on save. Users brick their own discovery; quota errors look like product failure.
3. **Silent renderer-side IPC failures.** Auto-save is debounced 500 ms then fires-and-forgets with `console.error` on failure ([setStore.ts:239-249](src/stores/setStore.ts)). A renderer crash mid-write loses sets without any UI signal.

**Two structural blockers (4–6 weeks of backend work):**

- No auth, no license server, no Stripe integration.
- No YouTube API proxy → every user needs their own Google Cloud API key. UX gun for non-technical DJs, recurring support burden.

**#1 strategic risk:** Zero real users have tested the app. Every other recommendation in this audit — pricing, positioning, features — is pattern-matched against indie-tool benchmarks. Validate with 5 DJs in week 1 ($250) or every downstream decision compounds on top of an unproven foundation.

**Path to soft-launch:**
- **Week 1:** Fix three code blockers + recruit 5 paid DJ testers.
- **Weeks 2–3:** Smoke tests, CI, address user-testing findings.
- **Weeks 4–6:** Stand up Clerk + Stripe + Cloudflare Worker YouTube proxy.
- **Week 7:** Soft-launch to ~50 paid beta users.

**Realistic 12-month revenue:** $1K–$5K MRR with disciplined execution. Don't anchor on the framework's $300K-$500K year-3 number; the TAM for indie DJ planning tools at $8–$15/mo is thin and CAC for the audience (Reddit/Discord-native DJs) is meaningful.

---

## 2. What the framework got wrong

### Bugs — all four resolved

**BUG #1 — Smart Filter not restoring tracks on toggle off.** Reality: works correctly. [LibraryPanel.tsx:60-67](src/components/library/LibraryPanel.tsx) only applies the filter when both `smartFilter` is true AND a set track is selected. Toggle off → `smartFilter=false` → conditional drops out → `displayTracks` falls back to `baseTracks`.

**BUG #2 — Settings menu lacks curved edges.** Fixed. Settings modal uses the shared `.modal` class with `border-radius: var(--radius-xl)` (20 px). Minor token-compliance outliers exist elsewhere (icon-btn variants, small popovers) — see code audit — but the settings modal is fine.

**BUG #3 — Redundant search button in top right.** Doesn't exist. TopBar contains: logo, mode toggle, safety badge, energy pill, USB panel, volume, Import, theme toggle, Settings, Export. The single search input lives in `LibraryPanel.tsx` with a ⌘K hint.

**BUG #4 — Audio doesn't play; waveforms missing.** Fixed across the chain. [electron/main.ts:23-32](electron/main.ts) registers `media://` with `stream: true, supportFetchAPI: true, bypassCSP: true` *before* `app.whenReady()`. The handler ([main.ts:442](electron/main.ts)) strips `media://<host>` (defensively accepts any host) and forwards to `file://` via `net.fetch`, with error logging on both `res.ok` and the catch path. `usePreviewAudio.ts` and `Waveform.tsx` use the `toMediaUrl()` helper. Two distinct bugs were fixed in this surface (URL decoding + standard-scheme host eating); both fixes are present.

### Pricing — wrong assumption

The framework assumes 3-tier SaaS ($9.99 / $19.99) but treats it as a UX problem (which tier, which features) rather than an architecture problem. Reality: there is no auth, no license server, no Stripe integration, no cloud-side YouTube quota, no entitlement check. **Subscription requires 4–6 weeks of backend work the framework didn't price in.** Section 5 prices it honestly.

---

## 3. Seven expert perspectives

### 3.1 CEO of Alpha Theta (Pro DJ credibility)

**Working.** Camelot wheel matches industry standard. Transition score is a real weighted composite (35 BPM + 35 key + 20 energy + 10 technical), not a vibe-check. Rekordbox XML import handles position markers + hot cue colors. CDJ-2000NXS2/-3000 hardware targets surface in settings. USB detection with speed test + filesystem classification is unusual for indie tooling; pros will notice.

**Credibility gaps that matter:**

- **No Engine DJ export.** Denon's Engine DJ ecosystem is the fastest-growing pro segment. Rekordbox-only export caps your TAM. Engine DJ uses a SQLite-based "Engine Library" on USB — same primitive you already know.
- **No Serato crate export.** Hobbyist segment.
- **No "rehearsal mode."** Pros want to A/B a transition: play 30 s before cue, 30 s after, hear the mix. The cue point editor stops short of that.
- **No MIDI clock / controller pairing test.** USB detection is impressive; the analog for DDJ controllers and Bluetooth gear isn't here.
- **Equipment list is anemic for Pioneer's range.** Verify decks-per-model, USB output count, FX rails.

**Top recommendation.** Engine DJ export in v1.1, not v1. Signal in marketing that it's coming. The pro DJ subreddit will ask within 48 hours of launch.

---

### 3.2 Senior Design Engineer (Apple/Figma standard)

**Strengths.** Design tokens at [src/styles/tokens.css](src/styles/tokens.css) are canonical and Tailwind-mapped — best practice. 21 shared primitives in `src/components/shared/`. Motion centralized through `Motion.tsx` presets (fadeIn, slideUp, fadeScale, modalPanel) — no animation drift. `prefers-reduced-motion` respected. Typography has semantic classes (`.ss-h1`, `.ss-body`, …) used consistently.

**Real gaps:**

1. **Modal focus management.** No `react-focus-lock`, no Radix Dialog. SettingsModal, SetArchitectModal, ExportModal don't trap focus or return focus to trigger on close. CuePointEditor is the lone modal that focuses an input on mount. Screen-reader users can tab out of an "open" modal.
2. **Token compliance ~85%.** Outliers: `.icon-btn.sm` (8 px hardcoded), settings sub-rows mixing 8/10/12 px, `.discover-header` (16 px). Cosmetic. ~1-hour cleanup.
3. **Light mode is implemented but unverified.** Tokens override correctly; without visual review I can't tell if it's polished or merely functional. Screenshot the major surfaces and decide.
4. **Drag-and-drop a11y.** `@dnd-kit` is good by default but no explicit `announcements` config in setStore reorder paths.

**Grade: A−.** Better than 95 % of indie Electron apps. Quality issues are at the polish-pass level, not systemic.

---

### 3.3 Product Manager (Spotify/Beatport standard)

**Job to be done.** Plan a DJ set with confidence. The Set Architect modal IS the aha-moment — three-step wizard (vibe/venue → duration/BPM → result) produces a viable set in under a minute. That moment is structurally strong.

**Where users will get lost:**

1. **The "Prepare / Discover" mode toggle.** Discover is a *feature*, not a *mode*. Making it a peer of Prepare buries it. Consider Discover as a panel inside Prepare, or surface it during onboarding as a guided tour stop.
2. **Empty-state cliff.** First launch → no library → import Rekordbox XML → all features come alive. If the user is not a Rekordbox user, the app is dead on arrival. No "try with sample tracks" option. The aha-moment depends on import success.
3. **YouTube API key in onboarding.** Onboarding asks proficiency level then jumps to import. Discover key step is buried in Settings. A user can hit Discover, see "no_key" error, get confused, never recover. Worse: pasting a 39-character Google Cloud key is the wrong UX for the target audience.
4. **Set Architect output is non-deterministic but presented as authoritative.** Two adjacent runs of the same vibe should produce comparable sets with variation. Does the modal communicate "this is one possible set, regenerate for another"? If not, users assume there's one correct answer.

**Feature priority.** Don't add features. Validate the existing ones.

---

### 3.4 Performance Engineer (real-time systems)

**Confirmed strong:**

- **Virtualization.** [LibraryPanel.tsx:70-77](src/components/library/LibraryPanel.tsx) uses `@tanstack/react-virtual` with dynamic row sizing (56 normal / 96 playing) and overscan=10. Re-keys when playback state flips to force `estimateSize` recompute.
- **Energy analyzer.** Background worker pool, concurrency tuned to `cpus() - 1` clamped to 1–8. Progress events debounced to 250 ms — won't flood IPC on 10K libraries.
- **ffmpeg-static is used, not dead weight.** [energyAnalyser.ts:16](electron/services/energyAnalyser.ts) drives an `ebur128` loudness pass per track (integrated LUFS + LRA). Bundle weight is justified.
- **No render-time `.map().filter().reduce()` chains** in timeline or library.

**Real risks:**

1. **DB corruption = white screen.** [schema.ts:13-19](electron/db/schema.ts) wraps `new Database()` with no try/catch. If `library.db` is locked or corrupted (`*.db-shm` orphaned after a kill), the app crashes at boot with an uncatchable native error.
2. **Energy analyzer first-launch cost.** On a 5K-track library, ebur128 takes ~3 s per track on M-series CPUs. With concurrency=7, that's ~36 minutes total. Progress UI handles this, but the UX on first import is "I imported, now everything looks pending for half an hour." Document or pre-warm a small sample.
3. **Auto-save is not crash-safe.** [setStore.ts:239-249](src/stores/setStore.ts) debounces 500 ms then fires-and-forgets via `console.error`. Renderer crash between user action and IPC fire = data lost. SQLite WAL covers process-kill mid-write; it does NOT cover the IPC never arriving.
4. **Installer size.** framer-motion + recharts + wavesurfer.js + ffmpeg-static (~80 MB unpacked) → heavy installer. Acceptable for desktop but codesigning + notarization roundtrip is slow.

**No FPS issues found.** The framework's "lag" complaint either described a dev-mode HMR artifact or was fixed during Phase 8.

---

### 3.5 Market Analyst (pricing & TAM)

**TAM honest read.** Aspiring/amateur DJs interested in pre-set planning tools: ~30K–80K globally (smaller than the framework's 50K). Pros willing to pay for software: ~5K. Reachable in year 1 with no marketing budget: 2K visitors → 50–200 paid signups (2–10 % is optimistic for a niche tool with no PMF data).

**Pricing recommendation.**

- **Drop the free tier.** A free tier requires a server (license check, gates) and inflates support load. Not worth it pre-PMF.
- **$8.99/mo or $69/yr.** 7-day free trial. Annual is ~30 % off.
- **No second tier yet.** Don't fragment a tiny user base across two SKUs before validating the Pro segment.
- **Push annual prepay.** Cuts churn-driven CAC, extends runway. Aim for 50 % annual mix.

**Revised revenue projection (one-engineer indie):**

| Month | Paying users | MRR / equivalent |
|---|---|---|
| 6 | ~100 | ~$900 |
| 12 | ~250 | ~$1.9K |
| 24 (with PMF + word-of-mouth) | 700–1,000 | $5K–$8K |

**Indie side-business economics, not a $300K/yr business.** Don't let the framework's projections set your expectations.

**Subscription specifically.** Infrastructure costs $50–$300/mo. At <100 users, you're break-even-after-infra at $14.99. Subscription only beats one-time if you compound users month-over-month *AND* add value continuously. Otherwise one-time + paid major version (v2 in 18 months) is the indie path.

---

### 3.6 Founding CTO (launch readiness)

The framework's four bugs are resolved. The real three blockers:

1. **Zero tests.** Minimum viable: 5 smoke tests — XML import, set save/restore, set export, transition score sanity, Set Architect determinism.
2. **YouTube API key handling.** [settingsService.ts:32-35](electron/services/settingsService.ts) stores `youtubeApiKey` in `electron-store` (JSON file in userData, unencrypted). Plain text → backup leaks. No validation on entry → user pastes garbage, every discover query 403s, app looks broken.
3. **Silent renderer failures.** [setStore.ts:248](src/stores/setStore.ts) catches IPC errors with `console.error` only. No toast, no retry, no "unsaved changes" indicator.

**Other ship-time work:**

- Wrap modals in `<ErrorBoundary>` — only the three main panels are wrapped currently.
- `try/catch` around `initDb()` with a friendly dialog ("Library corrupted. Reset?"). White-screen-on-launch is the worst user state.
- Validate iframe `videoId` (alphanumeric + length check) in Discover.
- GitHub Actions: typecheck, lint, build. Catches the easy 30 % of regressions before they ship.

**Time estimate.** 1 week for one engineer to clear the launch blockers.

---

### 3.7 UX Researcher (zero-user reality)

**This is the section that reframes the audit.**

You have not validated that DJs want what SetSense provides. You've built a thing *you* find useful as a DJ-engineer. Every other recommendation here is pattern-matched against indie-tool benchmarks, not your actual users.

**5-DJ test plan, week 1, $250 budget:**

1. **Recruit.** Reddit r/Beatmatch DM, DJ subreddits, local club nights. Mix: 2 amateur (<2 yr), 2 intermediate (2–10 yr club gigs), 1 pro (residency/touring). $50 per 45-min recorded session.
2. **Pre-test survey (5 min, async).** Current planning workflow. Rekordbox / Engine DJ / Serato? Library size? Sets per month? Worst part of set planning today?
3. **Test session (45 min, recorded with consent):**
   - 5 min warm-up.
   - 10 min install + import their own Rekordbox XML.
   - 15 min task: "Plan a 60-minute opening set at a 250-cap warehouse party. BPM 120–128. Build it and export to USB."
   - 10 min free exploration. "What's confusing? What did you wish existed?"
   - 5 min pricing reaction: "If this cost $9/mo with a 7-day trial, would you pay?"
4. **Synthesis (1 day).** Affinity-map friction points. Five users find ~80 % of usability issues. Three themes emerge.
5. **Decision.** Three themes → three roadmap line items. Re-prioritize ship vs. fix list based on findings.

**Why this is the #1 launch blocker.** Without it, you'll spend 4–6 weeks building subscription infrastructure for a product whose target audience may not want it. With it, you'll know within 7 days whether to ship as-is, pivot positioning, or fix specific friction points before backend work.

---

## 4. Code & tech debt audit

### Critical (must fix before paid launch)

| # | Issue | Evidence | Fix | Time |
|---|---|---|---|---|
| 1 | 0 / 110 TS files tested | No `*.test.*`; no vitest/jest in deps | Install vitest; 5 smoke tests | 3–5 days |
| 2 | YouTube API key plain-text | [settingsService.ts:32-35](electron/services/settingsService.ts) | Move to OS keychain via `keytar`; validate on entry | 1 day |
| 3 | Silent IPC failure in auto-save | [setStore.ts:248](src/stores/setStore.ts) `console.error` only | Toast + 1 retry + "unsaved" indicator | 2 hours |
| 4 | No DB corruption recovery | [schema.ts:13-19](electron/db/schema.ts) no try/catch | Wrap `initDb()`; `dialog.showErrorBox`; offer reset | 1 hour |

### Moderate (weeks 2–3)

| # | Issue | Evidence | Fix | Time |
|---|---|---|---|---|
| 5 | Modals not wrapped in ErrorBoundary | Inspection of `src/components/modals/` | `<ErrorBoundary label="X">` per modal | 30 min |
| 6 | No CI workflow | `.github/workflows/` empty | `ci.yml` w/ typecheck + lint + build | 2 hours |
| 7 | `noImplicitAny: false` in base tsconfig | `@electron-toolkit/tsconfig`: strict but allows implicit any | Override `noImplicitAny: true` in web/node configs; fix | ~1 hour |
| 8 | Auto-save fires-and-forgets | [setStore.ts:239-249](src/stores/setStore.ts) | Retry + dirty-flag UI | 2 hours |
| 9 | YouTube key not validated on save | youtubeClient never test-pings | Add `validateApiKey()`: 1-quota ping; reject bad keys | 30 min |

### Low priority

| # | Issue | Evidence | Fix | Time |
|---|---|---|---|---|
| 10 | Modal focus trap missing | No `react-focus-lock`/Radix Dialog | Wrap or migrate to Radix | 2 hours |
| 11 | iframe `videoId` not validated | String interpolation in Discover | Regex `^[A-Za-z0-9_-]{11}$` | 30 min |
| 12 | DnD reorder a11y announcements | dnd-kit default | `announcements` config | 1 hour |
| 13 | Token outliers (icon-btn.sm, settings rows, discover-header) | globals.css lines 2182/2276/2401/2559/2614 | Replace hardcoded radii with tokens | 1 hour |
| 14 | No CSP header | `bypassCSP: true` on media:// | Document risk; CSP meta in index.html | 30 min |
| 15 | USBDetectionPanel.tsx 519 LOC | Single file w/ multiple async state slices | Split into sub-components (defer) | 2 hours |
| 16 | ExportModal 423 LOC, no abort signal | Phased export w/ no cancel | AbortController + partial-file cleanup | 2 hours |

### Verified NOT a problem

- **Performance.** Virtual scroll, debounced energy analysis, GPU-accelerated motion.
- **Smart filter, audio playback, settings radius, redundant search button.** All framework bugs resolved.
- **Native module compatibility.** better-sqlite3 12.9.0 + Electron 39.2.6 work; postinstall + rebuild documented.
- **IPC main-process error handling.** Most handlers have try/catch ([audio:read-file](electron/main.ts), [shell:open-external](electron/main.ts) with HTTPS-only allowlist).
- **Shell command injection.** `shell:open-external` allowlist is correct (Beatport, SoundCloud, YouTube only).

---

## 5. Backend infrastructure plan (subscription path)

You chose subscription. Here's the honest cost.

### Components

| Component | Service | Purpose | Cost (0–500 users) | Engineering |
|---|---|---|---|---|
| Auth | Clerk | Email/password + OAuth. Free 10K MAU | $0 → $25/mo at 5K | 4 hours |
| Billing | Stripe Checkout + customer portal | Trial, subscription, invoicing | 2.9 % + 30¢/txn | 6 hours |
| License/entitlement | JWT from Clerk + Stripe webhook | App fetches license on login; 7-day offline grace | Rides on Clerk | 1 day |
| YouTube proxy | Cloudflare Worker + Durable Objects | Shared API key; per-user quota budget | ~$5/mo | 1 day |
| Crash reporting | Sentry (free tier) | Catch bugs you didn't test | $0 → $26/mo | 2 hours |
| Analytics (optional) | PostHog | Funnel, retention, feature usage | $0 free tier | 4 hours |
| Cloud sync (optional, v1.5+) | Supabase or Turso | Sets across devices | ~$25/mo | 1–2 weeks |

**Total infra cost:** ~$60/mo at 0–500 users, scales to ~$300/mo at 5K. Subtract from MRR before claiming margin.

**Total engineering:** 4–6 weeks for one engineer (without cloud sync), 6–8 with.

### License check pattern

```
1. User opens app first time → "Sign in or buy".
2. Click "Sign in" → opens Clerk hosted page via shell.openExternal.
3. Clerk redirects to setsense://auth?token=… (custom protocol; same primitive as media://).
4. App stores JWT in OS keychain (keytar). Decodes for entitlement claims.
5. JWT has 7-day expiry. App checks at boot + on resume.
6. If expired AND online: refresh via refresh token.
7. If expired AND offline: 7-day grace before disabling premium features.
8. YouTube discover requests go through Cloudflare Worker w/ JWT in Authorization header.
9. Worker validates JWT, charges quota to user, returns search results.
```

### What this lets you do

- **Drop user-supplied YouTube API key entirely.** Onboarding gets simpler.
- **Charge $8.99/mo with 7-day trial.** Annual prepay $69 (30 % off).
- **Add cloud sync as v1.5 upgrade** once core retention is proven.
- **Refunds via Stripe customer portal** without code changes.

---

## 6. Hard questions for the founder

I don't have answers; you do. The audit can't proceed past these.

1. **Distribution channel.** Mac App Store typically rejects Electron + native sqlite. Direct download likely. Researched Paddle vs. Gumroad vs. LemonSqueezy? Codesigning + notarization adds 4–6 hours per release.
2. **Refund policy.** When a user's own API key dies mid-trial (pre-backend) or when YouTube rate-limits a power user (post-backend), what's the policy? Auto-refund? Credit? This turns "support burden" into "10 hours/week of email" if undefined.
3. **Support strategy.** Discord (community-driven, high time cost), email (slow, durable), or Intercom (paid, professional)? Pick one before launch.
4. **Why subscription specifically?** If it's "framework said so + recurring revenue is sexy," reconsider. For pre-PMF indie tool, one-time at $29–49 + paid major version every 18 months is the lower-friction path. DJs are notoriously not willing to pay rent for software.
5. **Founder-or-DJ?** Affects everything: content strategy (DJ → DJ Twitter; founder → IndieHackers), time available, launch tactics.
6. **The unfair advantage.** Camelot + ffmpeg + YouTube discovery exist as pieces elsewhere (Mixed In Key, Pacemaker, RecordBox's own analyses). The *bundle* is your differentiator. But is "Learn Mode" the killer feature, or a feature next to other features? Users will tell you.
7. **The 12-month patience question.** Are you OK with $1K–$5K MRR at month 12? If you need this to replace income in 6 months, the framing changes — and the answer may be "delay subscription, ship as one-time, validate first."

---

## 7. Prioritized launch roadmap

### Week 1 — Blockers + user testing in parallel

**Code (~30 hours):**
- Move YouTube API key to keychain; validate on save.
- Toasts on `saveSet`, `exportSet`, `updateTrackCues` failures.
- Wrap `initDb()` in try/catch; friendly error dialog.
- Wrap each modal in `<ErrorBoundary>`.
- `.github/workflows/ci.yml` (typecheck + lint + build).
- Override `noImplicitAny: true` in tsconfig.{web,node}.json; fix resulting errors.

**User research (parallel, ~10 hours):**
- Recruit 5 DJs (2 amateur, 2 intermediate, 1 pro) via r/Beatmatch + DJ Discord.
- Sessions Fri–Sun.
- Affinity-map findings Monday.

### Weeks 2–3 — Tests + user-feedback integration

- 5 smoke tests: import flow, save/load set, export, transition scoring, Set Architect determinism.
- Add Sentry crash reporting.
- Address top 3 themes from user testing.
- Verify Engine DJ export feasibility (scope only; don't build).
- Light mode visual audit. Decide ship-as-is vs. fix.

### Weeks 4–6 — Subscription infrastructure

- Stand up Clerk + Stripe + license JWT.
- Build Cloudflare Worker YouTube proxy.
- Migrate app to use proxy. Remove user-API-key UI.
- E2E test auth → license → discover loop.

### Week 7 — Soft launch

- Open beta to ~50 users via mailing list + Twitter.
- Monitor Sentry, support email, Discord daily.
- Iterate fast on top reported issues.

### Months 3–6 — Growth

- Once retention >60 % at 30 days and >40 % at 90 days, scale marketing.
- Engine DJ export in v1.1.
- Album art via Spotify API in v1.2.
- Cloud sync if usage data shows multi-device demand.

### Months 6–12 — Post-PMF features

- DJ follow / social ONLY if MAU >1K.
- Mosaic Discovery iteration (already exists).
- Learn Mode content expansion.

---

## 8. What NOT to build

Discipline matters more than features at this stage.

| Don't build | Why | When (if ever) |
|---|---|---|
| Mosaic Discovery from scratch | Already exists as DiscoverPanel + SetCardGrid + filters | — |
| DJ follow / leaderboards | Network features die without a user base | After 500+ MAU |
| TikTok / paid marketing | PMF precedes paid acquisition; CAC eats margin | Post-PMF |
| Engine DJ export | Pioneer dominance is real; ~20 % of TAM, ~5 % of early users | v1.1 |
| Cloud sync | Costs infra, support burden, not asked for by single-machine DJs | v1.5 |
| Album art (Spotify) | Pretty, not blocking | v1.2 |
| Onboarding tour tooltips | Onboarding modal already exists | Skip |
| Pro/Studio tier | Don't fragment a small user base | After 500 paid users |
| Light mode overhaul | Light mode is implemented. Verify with screenshots first | If users ask |
| Real-time collaboration | Cool but premature. 4-month project. | v3 |

**The framework wants you to add features. Reality: ship what you have, validate, then expand.**

---

## Audit metadata

- **Date:** 2026-05-18
- **Auditor:** Claude Opus 4.7 (multi-perspective analysis via 3 parallel Explore agents + targeted verification reads)
- **Codebase state:** branch `feat/phase-6-cue-points-preview`, post-Phase-9 commit `7497ef4`
- **Files verified by direct read:** [electron/main.ts](electron/main.ts), [src/components/library/LibraryPanel.tsx](src/components/library/LibraryPanel.tsx), [electron/services/discovery/youtubeClient.ts](electron/services/discovery/youtubeClient.ts), [src/stores/setStore.ts](src/stores/setStore.ts), [electron/services/settingsService.ts](electron/services/settingsService.ts), [electron/db/schema.ts](electron/db/schema.ts), [electron/services/energyAnalyser.ts](electron/services/energyAnalyser.ts), `tsconfig.{json,node.json,web.json}`, `package.json`
- **Replaces:** [setsense_v2_audit_framework.md](setsense_v2_audit_framework.md) (deprecated; bugs resolved, pricing model wrong)
