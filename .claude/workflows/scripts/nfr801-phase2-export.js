export const meta = {
  name: 'nfr801-phase2-export',
  description: 'NFR-801 Phase 2 (export): logs:export IPC + bundle zip + Settings entry → branch → commit → push',
  phases: [
    { title: 'Implement' },
    { title: 'Verify' },
  ],
}

// gh-free pipeline (gh not installed here). Implements, runs the full local gate,
// commits, pushes, returns the GitHub compare URL. CI runs on GitHub once a PR opens.
// Built ON TOP OF Phase 1 so it stacks cleanly.

const BRANCH = 'feat/nfr-801-logging-export'
const BASE = 'feat/nfr-801-logging-capture' // Phase 1 branch

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    pushed: { type: 'boolean' },
    branch: { type: 'string' },
    commitSha: { type: 'string' },
    compareUrl: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
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
log(`Branch: ${BRANCH} (base: ${BASE}) — Phase 2 export, gh-free`)

const result = await agent(
  `You are implementing NFR-801 Phase 2 (export) in SetRecord — Electron 33 DJ app
(TypeScript, React, better-sqlite3, Vite, Vitest, ESLint). Repo: /Users/samcarter/Documents/SetRecordV2
You are inside a FRESH ISOLATED git worktree. The user's working tree on feat/memory-product must NOT be touched.

=== SETUP ===
1. git fetch origin ${BASE} --depth=1
2. git checkout -b ${BRANCH} origin/${BASE}
   (${BASE} is the Phase 1 logging-capture branch — it already contains
    electron/services/logging/logger.ts and redact.ts. READ those first.)
3. git log --oneline -3 ; git branch --show-current
4. Install deps if the worktree has no node_modules (npm ci or npm install). If native-module
   ABI errors appear during test/build, run \`npm run rebuild\` once.

=== CONTEXT (Phase 1, already on this branch) ===
- electron/services/logging/logger.ts exports createLogger(scope), getSessionId(), getRingBuffer().
  Log file lives at app.getPath('userData')/logs/main.log with rotated archives main.1..5.log.
- electron/services/logging/redact.ts exports redactPath(), scrubString(), frameBasename().
- Logger is initialised early in electron/main.ts.
READ all of these before writing Phase 2 so you reuse their accessors (do NOT duplicate logic).

=== SCOPE (Phase 2 = "export"; do exactly this) ===
A. Add export accessors to logger.ts as needed (small, additive):
   - getLogDir(): the userData/logs path.
   - listLogFiles(): absolute paths of main.log + existing main.N.log archives.
   (getRingBuffer() already exists for the debug ring buffer.)

B. Create electron/services/logging/exportBundle.ts exposing buildLogBundle(): Promise<string>:
   - Builds userData/logs/export/setrecord-logs-<sid>-<timestamp>.zip (sid from getSessionId();
     timestamp from new Date() — allowed in app runtime, this is NOT a workflow script).
   - Bundle contents:
       * all files from listLogFiles() (already redacted, safe-by-construction)
       * ring-buffer.log — the flushed getRingBuffer() lines (debug/verbose trail), each passed through scrubString()
       * meta.json — app version (app.getVersion()), process.platform/arch, process.versions.electron/chrome/node,
         sid, crashReportingEnabled (read from settings), DB schema/user_version, and a small feature snapshot.
         meta.json MUST NOT contain library contents (no track titles, paths, venues, emails).
       * settings.json (OPTIONAL) — a redacted settings dump: run every string value through redactPath()/scrubString()
         so home dirs collapse to '~'. Omit any secret-ish keys.
   - Zip mechanism: PREFER an existing dependency if package.json already has one (adm-zip/archiver/jszip).
     If none exists, use the macOS system 'zip' via child_process execFile (the app + CI are macOS) —
     do NOT add a new npm dependency just for this. Write files to a temp staging dir under logs/export/ then zip.
   - On app startup, clean stale contents of logs/export/ (wire a small cleanup call into the existing
     logger init path or main.ts startup, mirroring the 30-day prune already there).

C. IPC + preload (follow the repo's existing invoke/handle + preload-facade convention):
   - electron/main.ts: ipcMain.handle('logs:export', async () => { try { const path = await buildLogBundle(); return { success: true, path } } catch (e) { return { success: false, error: String(e) } } })
   - electron/preload.ts: expose exportLogs(): Promise<{success:boolean;path?:string;error?:string}> → ipcRenderer.invoke('logs:export')
   - electron/preload.d.ts (and any window.setrecord type): add exportLogs to the typed surface.

D. Settings UI — add an "Export diagnostic logs" action under a Settings → Advanced area:
   - Find the existing Settings component (likely src/components/ or src/components/modals/). READ it first.
   - Add an Advanced section if one does not exist (minimal, consistent with existing styles).
   - Button calls window.setrecord.exportLogs(); on success it should reveal the file in Finder
     (add a tiny IPC 'logs:reveal' that calls shell.showItemInFolder(path), or reuse an existing reveal helper),
     and show a brief success/empty/error state. Copy: "Export diagnostic logs" with subtext like
     "Bundles app logs with personal details removed — attach when reporting a bug."

=== OUT OF SCOPE (do NOT do in this phase) ===
- Do NOT change Sentry consent/opt-in behavior or crashReporter beforeSend.
- Do NOT modify the feedback flow / FeedbackModal / feedback:submit yet (that is Phase 4).
- Do NOT add redacted breadcrumbs to Sentry yet (Phase 4).
- Do NOT rewrite the ~72 existing console.* call sites.

=== TESTS ===
Add tests/logExport.test.ts covering buildLogBundle's meta.json shape + that it produces a file,
mocking electron app/paths and fs as the repo's other electron tests do (see tests/logger.test.ts pattern).

=== LOCAL GATE ===
Run all four and record pass/fail:
  npm run typecheck 2>&1 | tail -40
  npm run lint 2>&1 | tail -30
  npm test 2>&1 | tail -40
  npm run build 2>&1 | tail -40
IMPORTANT: the base branch has ~37 PRE-EXISTING typecheck errors and ~6 lint errors in UNRELATED files
(src/stores/setStore.ts, src/utils/homeQuery.ts, electron/services/rekordbox/dbReader.ts, some tests).
Those are NOT yours to fix and are out of scope. Your obligation: YOUR new/edited files must have
ZERO typecheck and ZERO lint errors, and the test suite must stay green (no new failures).
Verify this by checking that none of the typecheck/lint error lines reference your files. Set
ourFilesClean accordingly. Commit even if the base's pre-existing errors keep the gate red,
exactly as Phase 1 did — but NEVER if YOUR files have errors or you introduced a test failure.

=== COMMIT & PUSH (no gh) ===
  git add -A
  git commit -m "feat(logging): NFR-801 Phase 2 — logs:export bundle + Settings export action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push -u origin ${BRANCH}
Derive compareUrl from origin remote → https://github.com/<owner>/<repo>/compare/${BASE}...${BRANCH}?expand=1
Capture commitSha (git rev-parse HEAD) and filesChanged (git diff --name-only origin/${BASE}...HEAD).
If push fails, still commit locally and report pushed:false + the blocker.

Return the structured result.`,
  { label: 'implement-phase2', isolation: 'worktree', schema: RESULT_SCHEMA },
)

phase('Verify')

if (!result) {
  log('Implementation agent returned nothing (skipped).')
  return { status: 'skipped', branch: BRANCH }
}

const g = result.gateResults || {}
log(`Gate — typecheck:${g.typecheck} lint:${g.lint} test:${g.test} build:${g.build} | ourFilesClean:${result.ourFilesClean}`)
log(result.pushed ? `Pushed ${BRANCH} @ ${result.commitSha || '?'}` : `NOT pushed — ${result.blockers || 'see summary'}`)

return {
  status: result.ourFilesClean && result.pushed ? 'pushed-clean' : (result.ourFilesClean ? 'clean-not-pushed' : 'our-files-dirty'),
  branch: BRANCH,
  pushed: !!result.pushed,
  ourFilesClean: !!result.ourFilesClean,
  commitSha: result.commitSha,
  compareUrl: result.compareUrl,
  filesChanged: result.filesChanged,
  gateResults: g,
  summary: result.summary,
  blockers: result.blockers,
}
