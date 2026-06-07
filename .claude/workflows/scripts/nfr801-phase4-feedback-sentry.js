export const meta = {
  name: 'nfr801-phase4-feedback-sentry',
  description: 'NFR-801 Phase 4: feedback Bug-attach + redacted Sentry breadcrumbs + sid tag → branch → commit → push',
  phases: [
    { title: 'Implement' },
    { title: 'Verify' },
  ],
}

// gh-free pipeline. Implements, runs full local gate, commits, pushes, returns compare URL.
// Stacked on Phase 3. Final phase of NFR-801.

const BRANCH = 'feat/nfr-801-logging-feedback-sentry'
const BASE = 'feat/nfr-801-logging-structure' // Phase 3 branch

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
    consentRespected: { type: 'boolean' },
    summary: { type: 'string' },
    blockers: { type: 'string' },
  },
  required: ['pushed', 'branch', 'gateResults', 'ourFilesClean', 'consentRespected', 'summary'],
}

phase('Implement')
log(`Branch: ${BRANCH} (base: ${BASE}) — Phase 4 feedback + Sentry, gh-free`)

const result = await agent(
  `You are implementing NFR-801 Phase 4 (final) in SetSense — Electron 33 DJ app
(TypeScript, React, better-sqlite3, Vite, Vitest, ESLint). Repo: /Users/samcarter/Documents/SetSenseV2
You are inside a FRESH ISOLATED git worktree. The user's working tree on feat/memory-product must NOT be touched.

=== SETUP ===
1. git fetch origin ${BASE} --depth=1
2. git checkout -b ${BRANCH} origin/${BASE}
   (${BASE} contains the full Phase 1-3 logging stack: logger.ts (createLogger, getSessionId,
    getRingBuffer, listLogFiles, getLogDir), redact.ts (redactPath, scrubString, frameBasename),
    exportBundle.ts (buildLogBundle), lazyLogger.ts, logs:export + logs:reveal IPC.)
3. READ FIRST, before writing anything:
   - electron/services/logging/logger.ts and redact.ts (accessors + redaction API)
   - electron/services/crashReporter.ts (the Sentry init + beforeSend — note its CURRENT behavior:
     it strips ALL breadcrumbs and is GATED behind settings.crashReportingEnabled, default off)
   - electron/services/logging/exportBundle.ts (buildLogBundle)
   - src/components/modals/FeedbackModal.tsx and the feedback:submit handler in electron/main.ts
   - electron/preload.ts / preload.d.ts (the window.setsense surface, incl. exportLogs/revealLogBundle from Phase 2)
4. npm install if no node_modules (electron-log@^5.4.4 is in package.json on this branch). npm run rebuild if native ABI errors.

=== SCOPE — two pieces ===

PIECE A — Feedback "Bug" path attaches diagnostics (renderer + main):
  - In FeedbackModal.tsx: when category === 'Bug' (match the existing category values), show a checkbox
    "Attach diagnostic logs (helps me fix it faster)" DEFAULT CHECKED for Bug only, plus a small
    "What's included?" disclosure: "App logs with file paths and personal details removed."
  - On submit WITH the box checked: call window.setsense.exportLogs() (Phase 2) to build the bundle,
    then reveal it in Finder via the existing revealLogBundle/logs:reveal, AND open the existing mailto
    draft. Since mailto cannot carry attachments, the UX is: open the pre-filled mail draft + reveal the
    zip in Finder, and add a one-line in-modal instruction "Your logs opened in Finder — drag the file
    into the email." If export fails, still send the report (do not block) and note logs unavailable.
  - ALWAYS (attached or not, for the Bug category at least) append the session id (getSessionId via a
    small IPC or include it in the exportLogs result / a new logs:sid accessor) and app version to the
    mailto body, so even un-attached bug reports are correlatable to a Sentry issue. Keep the existing
    'mailto' approach in feedback:submit (do NOT stand up a backend).
  - Update preload.ts/preload.d.ts only if you add a tiny accessor (e.g. logs:sid). Keep it minimal.

PIECE B — Redacted Sentry breadcrumbs + sid tag (main, consent-gated):
  - In logger.ts (you MAY edit it for this piece — additive, behind a hook): every info/warn/error record
    the logger emits should ALSO be pushed as a Sentry breadcrumb — BUT the breadcrumb must be the
    ALREADY-REDACTED line (run through the same redact path the file writer uses). Use a lazy/dynamic
    import of @sentry/electron's addBreadcrumb so logger.ts has no hard Sentry dependency and does
    nothing if Sentry isn't initialized. Breadcrumbs must NOT be emitted unless crash reporting is active.
  - In crashReporter.ts: STOP stripping breadcrumbs in beforeSend (remove ONLY the breadcrumb-stripping
    line). Keep ALL other redaction (user stripping, frame basename, abs_path removal, request/extra
    stripping, attachScreenshot:false). The breadcrumbs arriving now are pre-redacted by the logger, so
    this is safe. Attach the session id (getSessionId()) as a Sentry tag (e.g. scope.setTag('sid', ...))
    at init so issues can be matched to exported log bundles.
  - DO NOT change the consent model: Sentry stays OFF by default and only initializes when
    settings.crashReportingEnabled is true. Breadcrumbs/tags must only flow when Sentry is initialized.
    Report consentRespected:true only after you have verified this gating end-to-end in the code.

=== STRICT BOUNDARIES ===
- Do NOT enable crash reporting by default or weaken any other beforeSend redaction.
- Do NOT log raw track titles/venues/emails anywhere; the mail body is user-composed + sid/version only.
- Do NOT rewrite unrelated console.* sites.

=== TESTS ===
- Add/extend tests: (a) a redaction/breadcrumb test asserting the breadcrumb text is scrubbed (no home
  paths / emails) and that nothing is emitted when Sentry is not initialized; (b) a FeedbackModal test
  (if the repo tests components) or a logic test for the Bug-path attach branch. Follow existing test
  patterns (mock electron / @sentry/electron). Keep the suite green.

=== LOCAL GATE ===
Run all four, record pass/fail:
  npm run typecheck 2>&1 | tail -40
  npm run lint 2>&1 | tail -30
  npm test 2>&1 | tail -40
  npm run build 2>&1 | tail -40
Base carries ~37 PRE-EXISTING typecheck + ~6 lint errors in UNRELATED files (setStore.ts, homeQuery.ts,
ErrorBoundary.tsx, rekordbox/dbReader.ts MasterDb, several tests). YOUR obligation: files you create/edit
add ZERO new typecheck/lint errors, and NO new test failures. Verify by checking error lines/counts for
your files vs base (total should remain ~37 with electron-log installed). Set ourFilesClean accordingly.
Commit through the pre-existing red gate exactly as Phases 1-3 did — but NEVER if you introduced an error
or a test regression.

=== COMMIT & PUSH (no gh) ===
  git add -A
  git commit -m "feat(logging): NFR-801 Phase 4 — feedback Bug-attach + redacted Sentry breadcrumbs (sid-correlated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push -u origin ${BRANCH}
compareUrl = https://github.com/<owner>/<repo>/compare/${BASE}...${BRANCH}?expand=1 (derive owner/repo from origin remote)
commitSha = git rev-parse HEAD ; filesChanged = git diff --name-only origin/${BASE}...HEAD
If push fails, commit locally and report pushed:false + blocker.

Return the structured result.`,
  { label: 'implement-phase4', isolation: 'worktree', schema: RESULT_SCHEMA },
)

phase('Verify')

if (!result) {
  log('Implementation agent returned nothing (skipped).')
  return { status: 'skipped', branch: BRANCH }
}

const g = result.gateResults || {}
log(`Gate — typecheck:${g.typecheck} lint:${g.lint} test:${g.test} build:${g.build} | ourFilesClean:${result.ourFilesClean} | consentRespected:${result.consentRespected}`)
log(result.pushed ? `Pushed ${BRANCH} @ ${result.commitSha || '?'}` : `NOT pushed — ${result.blockers || 'see summary'}`)

return {
  status: result.ourFilesClean && result.consentRespected && result.pushed
    ? 'pushed-clean'
    : (result.ourFilesClean && result.consentRespected ? 'clean-not-pushed' : 'needs-attention'),
  branch: BRANCH,
  pushed: !!result.pushed,
  ourFilesClean: !!result.ourFilesClean,
  consentRespected: !!result.consentRespected,
  commitSha: result.commitSha,
  compareUrl: result.compareUrl,
  filesChanged: result.filesChanged,
  gateResults: g,
  summary: result.summary,
  blockers: result.blockers,
}
