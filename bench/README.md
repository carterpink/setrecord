# NFR-107 — Performance benchmark harness

Proves the **PRD §11** budgets stay met as the code changes:

| Budget                        | Target                       | Where measured                                          | Tier   |
| ----------------------------- | ---------------------------- | ------------------------------------------------------- | ------ |
| Live suggestions @10k         | < 100 ms (p95)               | `getSuggestions` — `electron/algorithms/suggestions.ts` | A      |
| 20-track Architect build @10k | < 500 ms (p95)               | `buildSet` — `electron/algorithms/setArchitect.ts`      | A      |
| 10k-track import              | < 10 s                       | `importFromXml` — `electron/services/libraryImport.ts`  | A-full |
| 10k-track scroll              | 60 fps (≤ 1% dropped frames) | `LibraryPanel` (`@tanstack/react-virtual`)              | B      |
| Cold start                    | < 3 s                        | Electron boot → first library paint                     | B      |

Budgets live in one place — [`budgets.ts`](./budgets.ts) — imported by every bench and the reporter, so the gate can never drift from the spec.

## Two tiers, by measurement cost

**Tier A — headless micro-benchmarks** (`npm run bench:node`). Pure functions + import,
run under Vitest/Node. Deterministic, ~4 s, **gates every PR** in `ci.yml`. Each bench
times the real function over a 10k synthetic library and asserts `p95 ≤ budget`.

**Tier B — runtime benchmarks** (`npm run bench:app`). Real Electron + Playwright driving
the built app. Needs a display + GPU, so it's noisy — it runs **nightly / on release / locally**,
never on a PR.

### The import wrinkle

`better-sqlite3` is built for the **Electron ABI** (`postinstall` → `install-app-deps`),
so it can't load under plain Vitest. The full end-to-end import therefore **auto-skips**
on a PR (same `skipIf(!dbAvailable)` pattern as the repo's DB tests) and runs in the nightly
job, which first does `npm rebuild better-sqlite3`. A pure-JS **parse canary** (`importParse`,
< 4 s) always runs on PRs as early warning for the dominant phase of import.

## The synthetic fixture

[`fixtures/generateLibrary.ts`](./fixtures/generateLibrary.ts) — `generateLibrary(seed, count)`
returns a deterministic `Track[]`. Same seed → identical library, so a regression is always
the code, never the data. BPM is **multi-modally clustered** (124–128 dense), not uniform —
a flat spread would shrink post-filter candidate pools and understate the scoring cost the
budgets exist to protect. One generator feeds three forms:

- in-memory `Track[]` — Tier A
- `tracksToRekordboxXml()` → `library-10000.xml` — drives the real import
- `library-10000.json` — reference

Emit the on-disk forms with `npm run bench:fixtures` (kept out of the PR gate; ~4 MB XML).

## Commands

```bash
npm run bench:node       # Tier A — PR gate (suggestions, build, import-parse canary)
npm run bench:fixtures   # write bench/results/library-10000.{xml,json}
npm run bench:app        # Tier B — cold start + scroll (needs `npm run build` first)

# Full end-to-end import locally:
npm rebuild better-sqlite3 && npm run bench:node   # runs the SQLite import bench
npm run rebuild                                    # restore the Electron ABI afterwards
```

Results land in `bench/results/node-latest.json` (Tier A) and `app-latest.json` (Tier B),
uploaded as CI artifacts for trend history.

> **Where the 10k list lives.** The virtualized track list (carrying the
> `data-bench-library-ready` marker) renders in the **Build** workspace — the
> "Library" tab renders `RecallPanel`, not the list. `run.mjs` persists
> `setrecord-mode=Build` into the seeded profile so cold launches boot straight
> into that view. The scroll metric estimates the frame budget from the median
> interval (refresh-rate-agnostic: 60Hz vs 120Hz ProMotion) and counts a frame
> as _dropped_ only when it overruns 1.5× that budget — a genuinely skipped
> vsync, not sub-ms jitter.

### Verified baselines (local, M-series mac)

| Budget                | Measured                     | Target   |
| --------------------- | ---------------------------- | -------- |
| suggestions p95       | ~5 ms                        | < 100 ms |
| build p95             | ~80 ms                       | < 500 ms |
| import (incl. SQLite) | ~360 ms                      | < 10 s   |
| cold start (median)   | ~1.1 s                       | < 3 s    |
| scroll dropped frames | 0% (60 fps, longest 17.7 ms) | ≤ 1%     |

## How it fails on regression

- **Tier A**: each bench `expect(p95).toBeLessThanOrEqual(budget)` → non-zero exit → red PR.
  A `WARN_FRACTION` (80%) early-warning line is recorded in the JSON before a hard breach.
- **Tier B**: `run.mjs` exits non-zero when cold start > 3 s or dropped frames > 1%.
  Advisory nightly; **blocking** on release tags.

## Rollout status

- [x] **Phase 0** — fixture generator + `budgets.ts` + measurement primitives
- [x] **Phase 1** — Tier A benches wired, measure + record JSON
- [x] **Phase 2** — Tier A enforcement (hard `p95 ≤ budget` gate) in `ci.yml`
- [x] **Phase 3** — Tier B local: `data-bench` marker + `run.mjs` (cold start + scroll), verified end-to-end against the built app
- [x] **Phase 4** — nightly workflow + release-tag (`v*`) gating wired in `bench-nightly.yml`
