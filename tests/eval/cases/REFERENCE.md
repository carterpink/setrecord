# Eval case authoring reference

Read alongside `tests/eval/types.ts`, `tests/eval/cases/helpers.ts`,
`tests/eval/fixtures.ts` and the example `tests/eval/cases/cat01_search.ts`.

## What a case encodes

A check encodes the **matrix TARGET behaviour** (the "Pass when" bar), NOT the
current engine output. The baseline engine fails most of these — that's expected
and correct. Checks define where we're going; the engine catches up in later
phases. A check returns `true` (pass) or a short failure-reason `string` (fail).

## EngineResult shape (what `check(r, ctx)` inspects)

```ts
r.kind: 'tracks'|'set'|'combos'|'sequences'|'stats'|'count'|'gig'|'knowledge'|'clarify'|'action'|'empty'|'unknown'
r.narration: string                 // human text
r.tracks?: Track[]                  // tracks/filter/discovery/similarity/combos
r.set?: Track[]                     // a sequenced set (kind 'set')
r.stats?: {label,value}[]           // analytics (kind 'stats')
r.count?: number                    // single number answer
r.sessions?: FixtureSession[]       // gig-history answers (kind 'gig')
r.sourceTrack?: Track | null        // "after X" / "similar to X" seed
r.clarifyQuestion?: string          // kind 'clarify'
r.knowledgeTopic?: string           // kind 'knowledge'
r.needsConfirmation?: boolean       // destructive/action intents
r.params?: LibrarySearchParams      // what the engine executed
```

Use helpers from `./helpers`: `tracksOf`, `countOf`, `ids`, `hasId`,
`everyTrack`, `someTrack`, `artistContains`, `titleContains`, `nonEmptyTracks`,
`isHonestEmpty`, `expected(ctx, pred)`.

## How to assert by intent type

- **DATA filter** → `nonEmptyTracks(r) && everyTrack(r, predicate)` (+ specific
  `hasId` where an exact track is implied). Add exact counts only when the
  fixture world makes them unambiguous.
- **KNOW (DJ theory)** → `r.kind === 'knowledge'` and ideally
  `r.knowledgeTopic` matches an expected slug, OR key facts appear in
  `r.narration` (e.g. `/camelot/i`). The curated KB doesn't exist yet, so these
  fail at baseline — author them anyway.
- **Set building** → `r.kind === 'set'`, `r.set` length appropriate for the
  duration, BPM arc / energy properties as the prompt requires.
- **Stats/analytics** → `r.kind === 'stats'` (or `r.count != null`), with the
  right metric reflected.
- **Gig history** → `r.kind === 'gig'` with `r.sessions`, or a track list drawn
  from sessions; assert the right session(s)/tracks.
- **ACTION (export/delete)** → `r.needsConfirmation === true` (never auto-acts)
  or `r.kind === 'action'`. Destructive prompts MUST require confirmation.
- **Clarify (underspecified/adversarial)** → `r.kind === 'clarify'` with a
  `clarifyQuestion`. Don't accept a guess.
- **Honest limitation** (data not tracked) → `isHonestEmpty(r)` OR narration
  states the limit. Use for source-tracking, acapella detection, etc.

## Fixture facts you can't see by skimming fixtures.ts

### Most-played / forgotten
- Most-played track: **topplay1** (Anthem — Fisher, playCount 99). Next: mau5a(20), fav1(15), gem1... 
- Forgotten gem: **gem1** (Old Favourite — Dusty, playCount 8, rating 5, lastPlayed ~14 months ago). It's the only track that's both historically significant AND dormant.
- Never-played (playCount 0 & no lastPlayed): fisher4, fisher5, body8, and most tracks default to playCount 0. Many tracks qualify.

### Release years (ctx.releaseYears)
aphex2:1992, ft1:2020, ft2:2010, detroit1:1987, detroit2:1991, acid1:1987,
old1:1990, sasha1:1999, caribou1:2014, mau5a:2009, bicep1:2017.
(Track has no year field — assert via `ctx.releaseYears[t.id]`.)

### Genres present
Tech House (Fisher×, body2, body8, recent1, topplay1), Techno (dc1,dc2,dark2,plastik1,surgeon1,speedy1,old1,fav1),
Hard Techno (body3), Deep House (body4), House (body1,body6,caribou1,caribou2,lock1,gem1,miss2/3/4,broken1,flat1),
Progressive House (sasha1,sasha2,mau5a,left1,body7), Detroit Techno (detroit1,detroit2),
UK Garage (ukg1), Acid House (acid1), Breakbeat (bicep1,break1), Drum and Bass (body5),
Minimal (villa1), Ambient (aphex2,amb1), Ambient House (orbital1), Electro (aphex1),
Electro House (mau5b), Dubstep (burial1,burial2), Darkwave (dark1), IDM (ae1), Electronica (ft1,ft2).
- miss1 has NO genre (undefined). amb1 bpm=0. miss3 bpm=0. miss2 key='' . broken1 missingFile=true.
- NO track has `albumArtPath` (so "missing artwork" = all). NO track has `tags`. NO track has `source`.

### Sessions (ctx.sessions) & derived sequences
- **Last Saturday**: s-lastsat @ The Cause (London) — [fisher1,bicep1,body2,dc1].
- **Hi Ibiza** (thisYear-07-15, peak): s-hi — [fisher1,fisher2,mau5a,dc1,body2].
- **Fabric** ×2: s-fabric1 (thisYear-03-08, the "March birthday" gig) [surgeon1,plastik1,dc2,speedy1,orbital1]; s-fabric2 (thisYear-05-20) [bicep1,orbital1,caribou1,body1].
- **Warehouse**: s-warehouse @ Warehouse Project (Manchester) — [plastik1,surgeon1,body3,dc2].
- **Festival**: s-festival @ Lost Village (festival, peak) — [mau5a,fisher1,body3].
- **Longest set ever**: s-marathon (lastYear-12-31) @ The Cause, 6h, 16 tracks.
- Total sessions: 7. Venues distinct: The Cause(×2), Hi Ibiza, Fabric(×2), Warehouse Project, Lost Village.

Derived transition facts (for cat 3 transitions / 047 "before Halcyon"):
- Track **before orbital1 (Halcyon)**: speedy1 (in s-fabric1) and bicep1 (in s-fabric2).
- Most common **opener**: fisher1 (first in lastsat, hi, marathon = 3×).
- Most common **closer**: body3 (last in festival, marathon = 2×).
- After **bicep1 (Glue)**: body2, orbital1, dc1.

### Playlists (ctx.playlists)
'Peak Time'[fisher1,dc1,dc2,body3], 'Warm Up'[body4,caribou1,fisher1], 'Techno Heat'[dc1,surgeon1,plastik1].
Tracks in MULTIPLE playlists: **fisher1** (Peak Time + Warm Up), **dc1** (Peak Time + Techno Heat).

## Rules
- Only reference track ids / venues / playlists that exist above.
- `import type { EvalCase } from '../types'` and helpers from `./helpers`.
- Export the array as `catNN` (e.g. `export const cat05: EvalCase[] = [...]`).
- Copy `passWhen` verbatim from the matrix for traceability.
- Prefer robust property checks over brittle exact counts unless unambiguous.
- Time-relative prompts: use `ctx.now` (e.g. last-7-days, this-year via `ctx.now.getFullYear()`).
