# `algorithms/memory` — the Intelligence engine

Pure, deterministic, offline aggregation functions that answer natural-language
library questions ("forgotten gems", "stats for July", "tracks that mix into X",
festival/b2b set building, etc.). No DB or Electron imports — every function
takes plain arrays and returns a normalized `{ kind, …, narration }` answer.

Each engine module here is paired with a detector in `src/utils/*Intent.ts`
(e.g. `stats.ts` ⇄ `statsIntent.ts`, `discovery.ts` ⇄ `discoveryIntent.ts`).

## Reachability — read this before "cleaning up dead code"

These modules **plus their `src/utils/*Intent.ts` detectors form a self-contained
island.** Verified import graph (2026-06-11): the only _external_ importer of the
island is **`tests/eval/driver.ts`** (the 211-case eval harness). The running app
does **not** route through it — `src/stores/homeStore.ts` produces the same answer
kinds (`kind: 'stats'`, `'discovery'`, …) through its own `resolveViaModel` /
`resolveViaText` path.

So this is **not dead code, but it is not yet wired into the live app either.** It
is the regression-tested *reference implementation* the eval scorecard grades
against (currently 210/210). Deleting it would silently gut the eval harness.

## Architecture decision (audit Q3) — canonical home

There are currently **two implementations** of "answer a library question": this
pure engine, and the logic embedded in `homeStore.ts`. The intended direction is:

> **This `algorithms/memory` engine is the canonical home.** `homeStore` should
> converge onto it (call these functions via IPC / a thin main-process handler)
> rather than maintaining a parallel renderer-side copy.

Rationale: the engine is pure and dependency-injected, so it is unit-testable and
already eval-gated; `homeStore`'s copy is only reachable with full Zustand + IPC
scaffolding and drifts from the tested version. Converging removes the split-brain
and lets the eval scorecard actually guard the shipping code path. This is a
deliberate, staged refactor — **not** something to rush; track it as a dedicated
task, not a drive-by change.
