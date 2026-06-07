# SetSense — Claude Code Guide

## Stack
Electron 33 · Vite · TypeScript · React · better-sqlite3 · Vitest · ESLint

## CI (GitHub Actions)
Every PR runs: **typecheck → lint → test → build** (`.github/workflows/ci.yml`, macOS runner).
All four must pass before merging to `main`.

Local equivalents:
```bash
npm run typecheck   # tsc (node + web tsconfigs)
npm run lint        # eslint --cache
npm test            # vitest run
npm run build       # typecheck + electron-vite build
```

## Parallel agent workflows — how to use

### Single feature end-to-end (implement → PR → CI fix loop)
```
Workflow({ name: 'feature-pipeline', args: {
  task:   "add BPM nudge buttons to TrackRow",
  branch: "feat/bpm-nudge",
  base:   "main"          // optional, defaults to main
}})
```
The workflow:
1. Creates an isolated git worktree so it never touches your working tree
2. Implements the feature, typechecks, commits, pushes, opens a PR
3. Polls GitHub CI — if checks fail it spawns a fix agent (up to 4 attempts)
4. Returns `{ status, prUrl, prNumber, fixesApplied }`

### Multiple features in parallel (each fully isolated)
```
Workflow({ name: 'parallel-features', args: [
  { task: "add play count badge to TrackRow",        branch: "feat/play-count" },
  { task: "venue autocomplete on gig metadata form", branch: "feat/venue-autocomplete" },
  { task: "BPM nudge buttons",                       branch: "feat/bpm-nudge" }
]})
```
Each feature gets its own git worktree — they cannot conflict with each other or with your current working tree on `feat/memory-product`.

### Why this doesn't clobber your work
- `isolation: 'worktree'` means each agent gets a *separate filesystem copy* of the repo
- Your uncommitted changes on the current branch are untouched
- Branches are pushed to GitHub; local worktrees are auto-cleaned after each agent finishes

## Branch conventions
- Features: `feat/<slug>`
- Bug fixes: `fix/<slug>`
- Always branch off `main` unless told otherwise

## Key source directories
```
electron/          main process, IPC handlers, services, DB
src/components/    React UI
src/components/recall/    RecallPanel (Library tab)
src/components/modals/    all modal dialogs
electron/db/       schema, migrations, queries
electron/services/ import, export, licensing, memory
electron/algorithms/ setArchitect, suggestions, transitions
```

## Native modules
`better-sqlite3`, `keytar`, `@journeyapps/sqlcipher`, `smart-whisper` — all need rebuild after `npm install`:
```bash
npm run rebuild
```

## Do not
- Commit to `main` directly
- Push without CI passing
- Edit `electron/services/licensing/signingKey.ts` without founder sign-off
- Add `console.log` to production paths (use the crash reporter / logger)
