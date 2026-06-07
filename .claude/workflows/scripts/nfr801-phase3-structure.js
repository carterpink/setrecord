export const meta = {
  name: 'nfr801-phase3-structure',
  description: 'NFR-801 Phase 3 (structure): convert hot-path console.* to structured logging → branch → commit → push',
  phases: [
    { title: 'Implement' },
    { title: 'Verify' },
  ],
}

// gh-free pipeline. Implements, runs full local gate, commits, pushes, returns compare URL.
// Stacked on Phase 2.

const BRANCH = 'feat/nfr-801-logging-structure'
const BASE = 'feat/nfr-801-logging-export' // Phase 2 branch

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    pushed: { type: 'boolean' },
    branch: { type: 'string' },
    commitSha: { type: 'string' },
    compareUrl: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    callSitesConverted: { type: 'number' },
    gateResults: {
      type: 'object',
      properties: {
        typecheck: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
        lint: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
        test: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
        build: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
      },
      required: ['typecheck', 'lint', 'test', 'build'],
    },
    ourFilesClean: { type: 'boolean' },
    summary: { type: 'string' },
    blockers: { type: 'string' },
  },
  required: ['pushed', 'branch', 'gateResults', 'ourFilesClean', 'summary'],
}

phase('Implement')
log(`Branch: ${BRANCH} (base: ${BASE}) — Phase 3 structure hot paths, gh-free`)

const result = await agent(
  `You are implementing NFR-801 Phase 3 (structure the hot paths) in SetSense — Electron 33 DJ app
(TypeScript, React, better-sqlite3, Vite, Vitest, ESLint). Repo: /Users/samcarter/Documents/SetSenseV2
You are inside a FRESH ISOLATED git worktree. The user's working tree on feat/memory-product must NOT be touched.

=== SETUP ===
1. git fetch origin ${BASE} --depth=1
2. git checkout -b ${BRANCH} origin/${BASE}
   (${BASE} already contains the Phase 1+2 logging foundation: electron/services/logging/logger.ts
    exporting createLogger(scope), plus redact.ts, exportBundle.ts. READ logger.ts FIRST.)
3. git log --oneline -3 ; git branch --show-current
4. If the worktree has no node_modules: npm install (electron-log@^5.4.4 is in package.json on this branch).
   If native ABI errors during test/build: npm run rebuild once.

=== CONTEXT ===
- createLogger(scope) returns a scoped logger with .error(msg, err?, ctx?), .warn(msg, ctx?),
  .info(msg, ctx?), .debug(msg, ctx?). The scope string should match the existing bracket tags
  (e.g. createLogger('import') for code that currently does console.error('[import] ...')).
- redact.ts exports redactPath(), scrubString(). The logger already redacts internally, but when you
  pass file paths in ctx, prefer ctx: { file: redactPath(path) } to keep intent explicit.
- Phase 1 already routes raw console.* into the logger globally, so untouched call sites still persist.
  Phase 3 is about UPGRADING the highest-value sites to STRUCTURED calls with scope + context.

=== SCOPE — convert hot-path console.* in these failure-prone services ONLY ===
Target files (READ each, then convert its console.* calls to structured logger calls):
  - electron/services/libraryImport.ts            scope: 'import'
  - electron/services/rekordbox/dbReader.ts        scope: 'rekordbox'  (+ any sibling reader files it logs through)
  - electron/services/energyAnalyser.ts            scope: 'energy'
  - electron/services/usbValidator.ts              scope: 'usb'
  - electron/services/engine/engineExport.ts       scope: 'engine'   (and engine/* it logs from)
  - electron/services/usbDetector.ts               scope: 'usb'      (if it has console.* — optional)

Conversion rules:
  - console.error('[x] msg', err)  →  const log = createLogger('x'); log.error('msg', err, { ...ctx })
  - console.warn(...)              →  log.warn(...)
  - console.log(lifecycle)         →  log.info(...)   (begin/end/counts/milestones)
  - console.log(per-item detail)   →  log.debug(...)  (per-track timings, individual cue parse, row counts)
  - Put identifiers/counts in ctx as scalars (trackId, count, format), NEVER raw titles/venues/emails.
  - File paths in ctx go through redactPath().
  - Create the scoped logger once per module (const log = createLogger('<scope>')) near the top.
  - Keep messages terse; drop the now-redundant '[x] ' prefix from the string since scope carries it.

=== STRICT BOUNDARIES ===
- Do NOT change logger.ts / redact.ts / exportBundle.ts behavior (you may only IMPORT from them).
- Do NOT touch the feedback flow, FeedbackModal, crashReporter, or Sentry (those are Phase 4).
- Do NOT mass-convert console.* across the whole repo — ONLY the target services above. Leave the
  other ~ sites to the global console hook from Phase 1.
- Do NOT change behavior/control flow — this is a logging refactor only. No functional edits.

=== TESTS ===
Existing tests for these services must still pass. If a test asserts on console output (unlikely),
adapt it. Add a small test only if a conversion introduces a non-trivial helper. Count the call sites
you converted and report callSitesConverted.

=== LOCAL GATE ===
Run all four, record pass/fail:
  npm run typecheck 2>&1 | tail -40
  npm run lint 2>&1 | tail -30
  npm test 2>&1 | tail -40
  npm run build 2>&1 | tail -40
The base has ~37 PRE-EXISTING typecheck + ~6 lint errors in UNRELATED files
(src/stores/setStore.ts, src/utils/homeQuery.ts, src/components/shared/ErrorBoundary.tsx, some tests,
 and note rekordbox/dbReader.ts already had a PRE-EXISTING typecheck error before your change —
 do not let your edit ADD errors, but you are not obligated to fix that pre-existing one unless your
 refactor trivially resolves it).
YOUR obligation: the files you EDIT must have ZERO NEW typecheck/lint errors vs base, and the test
suite must stay green (no NEW failures). Verify by diffing error counts/lines for your files against
base. Set ourFilesClean accordingly. Commit even if base's pre-existing errors keep the gate red,
exactly as Phase 1/2 did — but NEVER if you introduced an error or a test failure.

=== COMMIT & PUSH (no gh) ===
  git add -A
  git commit -m "refactor(logging): NFR-801 Phase 3 — structured logging on import/rekordbox/energy/usb/engine hot paths

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push -u origin ${BRANCH}
compareUrl = https://github.com/<owner>/<repo>/compare/${BASE}...${BRANCH}?expand=1 (derive owner/repo from origin remote)
commitSha = git rev-parse HEAD ; filesChanged = git diff --name-only origin/${BASE}...HEAD
If push fails, commit locally and report pushed:false + blocker.

Return the structured result.`,
  { label: 'implement-phase3', isolation: 'worktree', schema: RESULT_SCHEMA },
)

phase('Verify')

if (!result) {
  log('Implementation agent returned nothing (skipped).')
  return { status: 'skipped', branch: BRANCH }
}

const g = result.gateResults || {}
log(`Converted ${result.callSitesConverted ?? '?'} call sites`)
log(`Gate — typecheck:${g.typecheck} lint:${g.lint} test:${g.test} build:${g.build} | ourFilesClean:${result.ourFilesClean}`)
log(result.pushed ? `Pushed ${BRANCH} @ ${result.commitSha || '?'}` : `NOT pushed — ${result.blockers || 'see summary'}`)

return {
  status: result.ourFilesClean && result.pushed ? 'pushed-clean' : (result.ourFilesClean ? 'clean-not-pushed' : 'our-files-dirty'),
  branch: BRANCH,
  pushed: !!result.pushed,
  ourFilesClean: !!result.ourFilesClean,
  callSitesConverted: result.callSitesConverted,
  commitSha: result.commitSha,
  compareUrl: result.compareUrl,
  filesChanged: result.filesChanged,
  gateResults: g,
  summary: result.summary,
  blockers: result.blockers,
}
