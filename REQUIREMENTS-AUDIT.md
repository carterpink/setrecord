# SetRecord — Functional vs Non-Functional Requirements: A Plain-English Audit

*Written so a 6-year-old (and a PhD engineer) can both follow it. Last reviewed: 2026-06-03.*

This is a health-check of how SetRecord writes down what it's supposed to do. It looks at the
**docs**, not the code. Its sibling file, [`REQUIREMENTS.md`](REQUIREMENTS.md), is the actual
starter list of requirements that came out of this audit.

---

## 1. What even *are* these two things?

Think about a **car**. 🚗

- **Functional requirements (FRs)** = *the things it does.* It drives. It brakes. It plays music.
  If it can't drive, it's not a car. For SetRecord, an FR is "it can import your Rekordbox library"
  or "it can build a set for you."

- **Non-functional requirements (NFRs)** = *how well it does those things.* It's safe. It's quiet.
  It starts fast. It doesn't break down in the rain. Nobody buys a car that drives but bursts into
  flames — *how well* matters as much as *what*. For SetRecord, an NFR is "imports finish in under
  10 seconds," "it never sends your music to the internet," or "if the database breaks, it
  recovers instead of losing your work."

> **The one-line version:** FRs are the **verbs** (what it does). NFRs are the **adverbs** (how
> well, how fast, how safely it does them).

A good project writes both down as short, **testable** sentences — statements you could hand to
someone and they could tick "yes, it does that" or "no, it doesn't."

---

## 2. The scoreboard (at a glance)

Legend: ✅ written down properly · ⚠️ true in the code but not *written down* as a requirement ·
❌ missing / not really thought about.

### Functional side — *what it does*

| Area | Status | Where it lives |
|---|---|---|
| Library import (Rekordbox / Serato / Engine) | ⚠️ described, not enumerated | `PRD.md §7`, `README.md`, `electron/services/serato/` |
| Audio & energy analysis, auto-tagging | ⚠️ described, not enumerated | `PRD.md §7`, `electron/services/tagging/` |
| Set building / Set Architect | ⚠️ described, not enumerated | `PRD.md §7`, `electron/algorithms/setArchitect.ts` |
| Harmonic mixing & transition scoring | ⚠️ described, not enumerated | `PRD.md §6`, `electron/algorithms/transitionScore.ts` |
| Suggestions / smart crates | ⚠️ described, not enumerated | `PRD.md §6`, `electron/algorithms/memory/smartCrates.ts` |
| Memory / Recall / Uncover / Identity | ⚠️ described, not enumerated | `src/components/recall/` |
| Conversational Home box | ⚠️ described, not enumerated | `src/components/home/` |
| Export (CDJ / Engine / Beatport) | ⚠️ described, not enumerated | `PRD.md §7`, `electron/services/engine/`, `electron/services/beatport/` |
| Licensing & 7-day trial | ✅ documented well | `LICENSING.md`, `README.md` |
| Onboarding / settings | ⚠️ described, not enumerated | `PRD.md` Phase 8 |

> **The big FR finding:** the features are *all there and well-described*, but they're written as
> **stories and feature lists**, never as a single enumerated, testable checklist. There is no one
> document you can point at and say "these are SetRecord's functional requirements."

### Non-functional side — *how well it does it*

| Quality | Status | Where it lives |
|---|---|---|
| **Performance** (60fps, <100ms, <500ms, <10s, <3s) | ✅ real numbers | `PRD.md:658-664` |
| **Security** (code signing, hardened runtime, notarization) | ✅ documented | `README.md`, `electron-builder.yml` |
| **Privacy / offline-first** (audio never uploaded) | ✅ documented | `README.md`, `PRD.md §2` |
| **Licensing / anti-abuse** (Ed25519, device bind, clock-rollback) | ✅ documented well | `LICENSING.md` |
| **Reliability / recovery** (DB quarantine, safe migrations) | ✅ documented | `README.md`, `electron/db/migrations.ts` |
| **Compatibility** (macOS arm64, audio formats, CDJ models) | ✅ documented | `README.md:24-33`, `PRD.md §4` |
| **Testing / CI** (typecheck, lint, test, build on every push) | ✅ documented | `.github/workflows/ci.yml` |
| **Fault isolation** (per-panel error boundaries) | ⚠️ in code, not a requirement | `llmcouncilaudit.md`, `src/` |
| **Observability / logging** (Sentry is installed but unconfigured) | ⚠️ dependency only | `package.json` (`@sentry/electron`) |
| **Accessibility** (keyboard nav exists; no WCAG target) | ⚠️ partial | `PRD.md` Phase 8 — no standard set |
| **Data lifecycle** (cache size, cleanup, retention) | ❌ missing | — |
| **Auto-update** | ❌ absent (and honestly says so) | `README.md:179-182` |
| **Scalability / backend** | ➖ N/A by design (fully offline) | `llmcouncilaudit.md` |

---

## 3. What EXISTS — and is genuinely good

Credit where it's due. SetRecord is **unusually strong on the NFRs that matter for a DJ app that
has to work at a venue at 2am with no WiFi**:

- **Real performance budgets with numbers.** `PRD.md:658-664` doesn't say "make it fast" — it says
  10,000 tracks must scroll at **60fps**, suggestions recompute in **<100ms**, Set Architect builds
  in **<500ms**, import in **<10s**, cold start **<3s**. Those are testable. That's exactly how a
  good NFR is written.
- **Privacy as a hard rule.** "Audio is never uploaded; analysis is performed locally." It's a
  promise you can verify (the app has no network call on the critical path).
- **Licensing is documented like a grown-up product.** `LICENSING.md` is a full runbook —
  cryptographic signing (Ed25519), device binding, a defence against people winding their clock
  back to cheat the trial. Most solo apps never write this down.
- **It plans for things breaking.** A corrupt database gets quarantined to a timestamped file and a
  fresh one is created instead of crashing; database migrations are written to be safe to re-run.
- **There's a robot checking the homework.** Every push runs typecheck + lint + tests + a build
  (`.github/workflows/ci.yml`). That's a maintainability NFR being enforced automatically.

---

## 4. What's MISSING — the honest gaps

1. **No single requirements document.** This is the headline. Everything is *somewhere* — PRD,
   README, LICENSING, memory notes, audit reports — but nobody has ever written "here are the
   functional requirements" and "here are the non-functional requirements" in one place. That's
   what [`REQUIREMENTS.md`](REQUIREMENTS.md) now fixes.
2. **Functional requirements aren't testable sentences.** They're feature descriptions. "Set
   Architect assembles sets" is a feature; "FR: the user can generate a set of N tracks within a
   chosen BPM range and vibe" is a requirement you can verify.
3. **Accessibility has no target.** Keyboard shortcuts exist, but there's no stated goal like
   "meets WCAG 2.1 AA contrast" or "every control is reachable by keyboard and screen reader."
4. **Observability is bought but not wired.** `@sentry/electron` is in `package.json`, but there's
   no documented decision about *whether* crash reporting is on, what it collects, or how that
   squares with the strong privacy promise. (For a privacy-first app, that's an important call.)
5. **No data-lifecycle policy.** The artwork cache and the ~1.9 GB local AI model live on disk
   forever with no documented size limit, cleanup, or update strategy.

---

## 5. Considered vs. not considered

| ✅ Clearly thought about | ❌ Not really thought about (yet) |
|---|---|
| Speed / performance budgets | Accessibility standards (WCAG) |
| Security & code signing | Logging / crash-reporting strategy |
| Privacy / offline-first | Data retention & cache cleanup |
| Licensing & anti-abuse | Load-testing method (targets exist, no test proving them) |
| Reliability & recovery | AI-model versioning / updates |
| Compatibility (macOS, formats, CDJs) | Auto-update delivery |
| Scope discipline (`PRD.md §12` "what not to build") | — |

The pattern is clear: **anything that affects whether a paying DJ trusts the app at a gig is
well-handled.** The gaps are the "invisible plumbing" qualities (accessibility, logging, data
hygiene) that don't bite you on day one but matter as the product grows.

---

## 6. Why this matters — what "good" looks like

Five rules of thumb your dad would nod at:

1. **Every requirement should be testable.** If you can't write a yes/no test for it, it's a wish,
   not a requirement. ("Fast" ✗ → "scrolls 10k tracks at 60fps" ✓.)
2. **NFRs need numbers or they're just vibes.** A budget (<100ms) beats an adjective (snappy).
3. **Separate FR from NFR on purpose.** They're verified differently — FRs by "does the feature
   exist and work," NFRs by "measure it under load / attack / failure." Mixing them hides gaps.
4. **Write them down in one living place.** For a solo dev especially, an enumerated spec is how
   you keep yourself honest and notice when a quality (like accessibility) was never decided.
5. **Mark current-state vs. aspiration.** A good spec shows what's *done*, what's *partial*, and
   what's a *proposed gap* — so nobody mistakes a wish for a promise.

The companion file [`REQUIREMENTS.md`](REQUIREMENTS.md) puts these rules into practice: it turns
SetRecord's scattered, well-built features and qualities into one enumerated FR/NFR list, carries
over the real numbers from the PRD, and writes the missing pieces as clearly-labelled *proposed*
requirements you can accept, edit, or reject.
