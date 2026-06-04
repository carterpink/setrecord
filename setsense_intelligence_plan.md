# SetSense Intelligence & Play-History Plan

Status: **DRAFT FOR APPROVAL** · Date: 2026-06-04 · Branch base: `main`

Goal: make the in-app assistant reliably answer the 210 prompts in
[`setsense_ai_eval_matrix.md`](setsense_ai_eval_matrix.md), regardless of wording,
**100% on-device** (no external APIs), and ship a much richer Rekordbox-backed
play-history view in Gigs.

---

## 1 · Constraints & decisions (locked with founder)

- **On-device only.** No cloud APIs. The local model (`node-llama-cpp`, Qwen) is
  the only model. We query only local data, so the model never needs to *know*
  facts — it only **translates language → a structured query**, and the
  deterministic engine produces real results. Hallucinated tracks are impossible
  by construction.
- **Tiered by hardware, decided by data.** 3B is the floor (works on Intel Macs);
  a stronger ~7–8B model is offered on capable Apple Silicon. We do **not** assume
  which is needed — the eval harness measures 3B's real pass-rate first. Rule of
  thumb agreed: if 3B reaches ~90–95%, ship 3B only; if it stalls at ~70–80%,
  wire the larger tier.
- **Phased, eval-gated.** Build the engine + harness, measure, then drive the
  pass-rate up category by category. Nothing regresses silently.
- **Curated knowledge base** for DJ-theory (`[KNOW]`) prompts. Vetted answers,
  model only selects + phrases. Never trusts model recall for theory.

---

## 2 · Root-cause diagnosis (today)

The assistant is a brittle rule-based parser with a rarely-used local model bolted
on as a fallback. Concrete defects, all confirmed in code:

| # | Defect | Location |
|---|--------|----------|
| D1 | Local model is **opt-in / off by default**, so most queries never reach it | `memoryAssistant.ts:38` (`_enabled=false`), `homeStore.ts:798` |
| D2 | Deterministic `smart_filter` execution **drops free-text/artist** (crate rule has no text slot) so artist/title searches return "unknown" | `memoryAssistant.ts:470-483` |
| D3 | Last-resort fallback searches the **entire raw sentence** as a literal substring → guaranteed miss for conversational phrasing | `homeStore.ts:691-705` |
| D4 | `execIntent` **doesn't handle** `similar_to`, `build_set`, `dead_ends`, `count`, `duplicates` (declared intents fall to `unknownResult`) | `memoryAssistant.ts:371-541` |
| D5 | Intent/slot schema **misses whole matrix categories**: stats/analytics, gig-history Qs (last Saturday, longest set, avg length), harmonic-compatible search, knowledge, actions, clarification | `memoryAssistant.ts:194-261` |
| D6 | Two competing routers (deterministic-first `interpretHome` vs model) create the fall-through hole; no single source of truth | `homeStore.ts:713-722` |
| D7 | Conversation context = **only the previous turn's params**; no full-thread or cross-conversation memory | `homeStore.ts:730-731` |
| D8 | `DJPlayCount` (CDJ plays) imported as a **flat aggregate, not linked to sessions**; per-track play timeline not built or shown | `dbReader.ts:320`, `GigsSection.tsx` |

---

## 3 · Target architecture

One pipeline, one entry point. Replace the dual-router fall-through with:

```
query
  └─► UNDERSTAND  (translator)
        ├─ fast deterministic pre-pass for unambiguous intents (instant, offline)
        │    — but NEVER falls through to literal full-sentence search
        └─ model pass (grammar-constrained) → structured QueryPlan
  └─► PLAN        (QueryPlan: intent + slots + optional clarify/knowledge)
  └─► EXECUTE     (deterministic engine → REAL rows from SQLite; no invention)
  └─► GROUND      (results are real data; narration may only describe them)
  └─► NARRATE     (template, or model phrasing constrained to real result fields)
```

### 3.1 QueryPlan DSL (expanded grammar schema)
Extend `INTENT_SCHEMA` to cover every matrix category. New/!changed intents:

- `search` (was smart_filter) — must carry `text`/`artist`/`title` into the
  engine (fixes D2). Add slots: `year`, `yearMin/yearMax`, `label`, `flatKeys`,
  `minorOnly`, `harmonicWith` (Camelot seed), `missingField`, `brokenPath`.
- `build_set` — slots: `targetBpm`, `bpmStart/bpmEnd` (arc), `lengthMinutes`,
  `arc` (slow-burn/steady/story:dark→euphoric→down), `genreBlend`, `venueContext`,
  `neverPlayed`, `b2bSplit`, `count`, `mysterySet` (hide titles).
- `stats` — `metric` enum: most_played_genre/artist, key_breakdown,
  bpm_breakdown, library_size, total_duration, avg_bpm, pct_played,
  pct_key_analyzed, imports_per_month, listening_this_month, etc.
- `gig_history` — `metric`: last_session, sessions_this_year, longest_set,
  avg_set_length, venues_played, last_played_track, play_count_track,
  setlist_for, played_at_venue.
- `similar_to` — `trackQuery` seed → BPM/key/genre proximity.
- `transition` — `trackQuery` (after X) or knowledge (how to go 128→140).
- `knowledge` — `topic` enum → curated KB (see §3.3).
- `action` — `op` enum: export_csv/export_rekordbox/export_engine/backup/
  remove_broken/dedupe/import_folder; **all gated behind explicit confirmation**.
- `clarify` — model returns a `question` when the request is underspecified or
  adversarial (covers 195/196/201/202/205) instead of guessing.

### 3.2 Execution engine (deterministic, grounded)
Fill every `execIntent` branch (fixes D4) and add DB queries (fixes D5/D8):

- **Search**: text/artist/title flow into `searchLibrary` (fix D2); add year,
  label, duration, missing-field, broken-path, duplicates, harmonic-compatible
  (Camelot adjacency: ±1 number same letter, + relative major/minor), flat/minor
  key filters, harmonic-of-seed-track.
- **Stats/analytics**: aggregation queries over tracks + sessions (genre/key/BPM
  histograms, %s, monthly import/listening rollups).
- **Gig history**: per-track timeline from `session_tracks` (date+venue per
  appearance), longest/avg session length, venues list, last-played, setlist by
  date/venue, "played > N times in last year".
- **Set building**: arc-aware sequencer (reuse `setArchitect`) with BPM ramp,
  energy arc, story arc, b2b split, mystery mode, "n one-hour sets" diversity.
- **Similarity**: BPM±, key-compatible, genre/tag overlap ranking.
- **Honesty rails**: when data is absent (no tags, no gig history, no source
  tracking), return the matrix-required honest message — never fabricate.

### 3.3 Curated DJ knowledge base (offline)
`electron/algorithms/memory/knowledge/` — vetted markdown/TS entries for the
matrix's `[KNOW]` concepts: harmonic mixing, Camelot wheel, beatmatching, EQing
in, drop, loop diving, phrase mixing, HPF, energy arc, stem separation, set
lengths, crate, white label, DJ-mix vs live-PA, rave vs club, venue aesthetics
(Tresor, Fabric, wedding, corporate, festival-support strategy), Rekordbox/Serato
import steps, Spotify-not-supported, "get more gigs" redirect. The model classifies
to a `topic`, the engine returns the vetted text, the model may rephrase but is
grounded to that text.

### 3.4 Conversation context (in- and cross-conversation)
- **In-conversation**: feed the full (compacted) turn history of the current
  thread, not just the last params (fixes D7). Each prior turn → a compact
  `{query, resolvedPlan}` line. Enables "more of those", "make it slower",
  "only in 8A", "what about at Fabric".
- **Cross-conversation (feasibility-bounded)**: a small local model with a 2–4k
  context **cannot** ingest many past conversations. Realistic design: maintain a
  compact **user-memory summary** (top genres/artists/labels, typical BPM/energy,
  recent venues, recently-discussed entities) derived from history + the existing
  `identity` snapshot, injected as a short preamble. This gives "knows me across
  sessions" behaviour without blowing the context budget. We will validate it's
  worth the tokens via the harness; if not, scope to in-conversation only.

### 3.5 Tiered model
- Keep `node-llama-cpp`. Abstract model selection behind a tiny capability check
  (RAM, arch). 3B floor; offer 7–8B (e.g. Qwen2.5-7B-Instruct) on Apple Silicon
  with ≥ ~12GB RAM, via the existing download/self-heal flow.
- **Default the assistant ON** (fixes D1) once quality is proven — with a graceful
  deterministic floor when the model can't load (already handled).
- Decision to actually build the 7–8B tier is **gated on harness data** (§4).

---

## 4 · Eval harness (the instrument)

`tests/eval/` — runs all 210 prompts against the live engine, headless.

- **Seeded fixture library**: a deterministic SQLite DB with tracks spanning the
  metadata the matrix needs (BPMs, keys incl. flats/minors, genres, labels, years,
  durations, play counts, never-played, missing-field rows, duplicates, broken
  paths), plus seeded `play_sessions`/`session_tracks` (venues incl. "Hi Ibiza",
  "Fabric", warehouse; dates incl. last Saturday, March, this year; slots).
- **Encoded "Pass when"** per prompt as assertions on the QueryPlan and/or the
  executed result (e.g. 161 → exactly 10 rows, all play_count=0, randomised;
  002 → artist/album contains "Burial", honest zero-result text when absent).
- **Scoring**: pass/fail per prompt, rolled up by category + complexity. Output a
  scorecard (`eval/scorecard.md`) each run. CI-runnable subset (deterministic
  parts) + a model-in-the-loop full run (local, opt-in, slower).
- **Two-layer assertion**: most `[DATA]` prompts assert on the deterministic
  result (model-independent → CI-stable). `[KNOW]`/`[BOTH]` assert KB topic
  selection + key-fact presence. This isolates "did we understand" from "did the
  model phrase it".

This harness is what decides 3B-vs-7B and proves "passes the matrix" objectively.

---

## 5 · Rekordbox play-history enrichment (Gigs)

Surface **all** real-world data that helps the user:

- **Per-track play timeline**: from `session_tracks` build a chronological list of
  every appearance (date, venue, event-type, slot, position-in-set) for a track.
  New query + a "Play history" panel reachable from a track and from Gigs.
- **Two honest play-count streams**, clearly distinguished:
  - *CDJ plays* = Rekordbox `DJPlayCount` (flat aggregate; cannot be split by date
    — state this).
  - *Logged-session plays* = count of `session_tracks` appearances (fully
    date/venue-attributable).
- **Richer Gigs timeline**: per-session view already exists; add a global timeline
  (gigs over time), venue/event rollups, "most played at venue X", and per-track
  drill-in. Show `played_at` (already stored, currently unused).
- **Import more if it helps**: evaluate importing Rekordbox `LastPlayedTime` and
  `My Tags` (additive, backup-guarded) — only if the harness/UX shows real value.
  Beatgrid/waveform stay out (SetSense re-analyzes).

---

## 6 · Phasing (eval-gated milestones)

- **P0 — Harness + fixtures + baseline. ✅ DONE (2026-06-04).** Built `tests/eval/`
  (types · fixtures world · headless model-off driver · runner · scorecard),
  encoded all 210 criteria, ran the current engine. **Baseline: 27/210 (13%).**
  See `tests/eval/scorecard.md`. Honest low baseline — knowledge/import/library-mgmt
  categories at 0% (need KB, actions, label/stats support that don't exist yet);
  deterministic filter categories partial (Genre 42%, BPM/Key 28%). Confirmed the
  "10 Fisher songs" class fails via the literal full-sentence fallback. Logged data
  gap: Track has no `releaseYear` (year-based prompts need a P2 field).
  Run: `npx vitest run tests/eval/eval.test.ts` (writes the scorecard).
- **P1 — Pipeline unification + core fixes. 🚧 IN PROGRESS.**
  - ✅ **Artist/text search (the "10 Fisher songs" / "find Burial" class).**
    `textQuery` now strips filler/punctuation ("find", "search for", "anything",
    quotes); text is extracted whenever there's no *real* filter (a bare count no
    longer drops the artist); `text` is now a structured signal in
    `hasStructuredParams` (homeStore + harness driver) so it executes instead of
    falling through to the literal full-sentence search. Fixes D2/D3 for the
    common case. **Baseline 27 → 42 (13% → 20%)**; Basic Search 20%→45%; cases
    002/003/008/199 (Burial/Aphex/Villalobos/Deadmau5) now pass. All 79 existing
    query-layer unit tests still green.
  - ✅ **Router unified (D6).** Search-vs-ask is now decided solely by
    interpretHome's `ask` flag — any parsed deterministic search executes
    (including sort-only: "fastest tracks", "my most played track") instead of
    being re-derived via `hasStructuredParams` and mis-routed to the off model.
  - ✅ **Deterministic breadth:** label included in text search (Drumcode/Transmat
    → 006/118), `fastest`/`slowest` → BPM sort (024), singular "most played track"
    → 1 result (014), niche genres (detroit/acid/electro house). **42 → 47.**
  - ⏭ Remaining P1/P2: fill `execIntent` for similar_to/build_set/count/duplicates
    (D4) and default the model on with a deterministic floor (D1). **47/210 (22%).**
  - Note: removing the literal-echo fallback also corrected two false-green stats
    cases (149/154) whose lenient narration check had matched the echoed query.
- **P2 — Expanded QueryPlan + engine breadth. 🚧 IN PROGRESS.**
  - ✅ **Stats engine** (`src/utils/statsIntent.ts` detect + `electron/algorithms/memory/stats.ts`
    compute, both pure/shared). 21 metrics. Wired into the harness; **app wiring next**.
    **47 → 67/210**: Stats 0→**12/12**, and it cleared analytics cases across Basic
    Search (65%), Genre (75%), BPM/Key (44%), Library Mgmt.
  - ⏭ Next: wire stats into the app (memoryService + IPC + Home result), then
    gig-history engine, set-building arcs, transitions, harmonic search,
    actions-with-confirmation, clarify.
- **P3 — Knowledge base.** Author + wire `[KNOW]`/`[BOTH]` topics. Re-score
  categories 3, 13, 14, parts of 6/7.
- **P4 — Conversation context.** Full in-thread history + user-memory preamble.
  Add multi-turn refinement tests to the harness.
- **P5 — Tier decision.** Read the 3B scorecard; if needed, wire the 7–8B tier +
  hardware detection; re-score on capable HW. Lock the shipping config.
- **P6 — Gigs play-history UI.** Per-track timeline, dual play-count streams,
  global gig timeline, venue rollups.

Each phase ends with a re-run scorecard and no regressions vs the prior phase.

---

## 7 · Open questions / risks to resolve before/while building

1. **3B ceiling is unknown** until P0–P1 measured. Plan assumes we *might* need
   7–8B; if 3B underperforms badly even as a translator, we revisit grammar/prompt
   engineering before model size.
2. **Cross-conversation memory** may not justify its token cost on a small model
   (§3.4). We will keep it behind the user-memory-summary approach and let the
   harness decide whether it earns its place.
3. **Action prompts** (`delete everything`, `export`, `remove broken`) require
   real write paths + multi-step confirmation UX — larger surface; may slip to a
   follow-up if it threatens the query-quality timeline.
4. **Performance on Intel Macs**: model latency budget must stay acceptable; the
   deterministic pre-pass keeps common queries instant and model-free.
5. **Matrix realism**: a handful of prompts (e.g. 112 "5 years ago", 168
   "SoundCloud years ago") are explicitly limitation-tests — "pass" = honest
   limitation message, encoded as such in the harness.
