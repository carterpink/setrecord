export const meta = {
  name: 'nfr801-green-ci',
  description: 'Clear the ~37 pre-existing typecheck + ~6 lint errors so the logging branch passes CI → branch → commit → push',
  phases: [
    { title: 'Triage' },
    { title: 'Fix' },
    { title: 'Verify' },
  ],
}

// gh-free. Branches off the squashed logging branch so the result = logging + clean base = fully green.
// Fixes are TYPE/LINT-ONLY, no behavior changes. Genuinely-unfinished WIP is REPORTED, not fabricated.

const BRANCH = 'feat/nfr-801-green-ci'
const BASE = 'feat/nfr-801-logging' // squashed logging branch (f79e7b2)

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    typecheckTotal: { type: 'number' },
    lintErrorTotal: { type: 'number' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          typecheckErrors: { type: 'number' },
          lintErrors: { type: 'number' },
          kind: { type: 'string', enum: ['mechanical', 'needs-judgment', 'incomplete-wip'] },
          note: { type: 'string' },
        },
        required: ['file', 'kind'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['typecheckTotal', 'lintErrorTotal', 'files', 'summary'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    pushed: { type: 'boolean' },
    commitSha: { type: 'string' },
    compareUrl: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    finalGate: {
      type: 'object',
      properties: {
        typecheck: { type: 'string', enum: ['pass', 'fail'] },
        lint: { type: 'string', enum: ['pass', 'fail'] },
        test: { type: 'string', enum: ['pass', 'fail'] },
        build: { type: 'string', enum: ['pass', 'fail'] },
      },
      required: ['typecheck', 'lint', 'test', 'build'],
    },
    typecheckRemaining: { type: 'number' },
    lintErrorsRemaining: { type: 'number' },
    couldNotFix: {
      type: 'array',
      items: {
        type: 'object',
        properties: { file: { type: 'string' }, reason: { type: 'string' } },
        required: ['file', 'reason'],
      },
    },
    behaviorChanges: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['pushed', 'finalGate', 'typecheckRemaining', 'lintErrorsRemaining', 'summary'],
}

phase('Triage')
log(`Branch: ${BRANCH} (base: ${BASE}) — clear pre-existing typecheck/lint so the logging stack is green`)

const triage = await agent(
  `SetSense (Electron 33 / TS / React / better-sqlite3 / Vitest / ESLint). Repo: /Users/samcarter/Documents/SetSenseV2
You are in a FRESH ISOLATED git worktree. TRIAGE ONLY — do not edit code yet.

1. git fetch origin ${BASE} --depth=1 ; git checkout -b ${BRANCH} origin/${BASE}
2. npm install if no node_modules (electron-log@^5.4.4 is in package.json on this branch — it must resolve).
   If native ABI errors: npm run rebuild.
3. Run \`npm run typecheck\` and \`npm run lint\`. These are the project's node+web tsconfigs and eslint.
4. Catalog EVERY typecheck error and every lint ERROR (ignore lint warnings). Group by file.
5. Classify each file's errors:
   - 'mechanical'      → obvious type/lint fixes (missing return type, unused var, ts-comment style,
                         a clearly-misspelled or missing import/type name) with ZERO behavior risk.
   - 'needs-judgment'  → fixable but requires understanding intent (e.g. a real type mismatch).
   - 'incomplete-wip'  → the code references symbols/types that simply don't exist yet, or is half-written;
                         fixing it would mean GUESSING the author's unfinished intent. (e.g. src/stores/setStore.ts
                         'Cannot find name X', electron/services/rekordbox/dbReader.ts 'Cannot find name MasterDb'.)
   READ the relevant code before classifying — do not assume.
Return the catalog. Do NOT commit anything in this phase.`,
  { label: 'triage', phase: 'Triage', isolation: 'worktree', schema: TRIAGE_SCHEMA },
)

if (!triage) {
  log('Triage returned nothing.')
  return { status: 'skipped' }
}
log(`Triage: ${triage.typecheckTotal} typecheck + ${triage.lintErrorTotal} lint errors across ${triage.files.length} files`)
const wip = triage.files.filter((f) => f.kind === 'incomplete-wip')
if (wip.length) log(`⚠ ${wip.length} file(s) look like incomplete WIP: ${wip.map((f) => f.file).join(', ')}`)

phase('Fix')

const fix = await agent(
  `SetSense. Repo: /Users/samcarter/Documents/SetSenseV2. You are in a FRESH ISOLATED git worktree.
GOAL: make \`npm run typecheck\`, \`npm run lint\`, \`npm test\`, and \`npm run build\` ALL pass on branch ${BRANCH},
so the NFR-801 logging stack underneath it goes green in CI. These are PRE-EXISTING errors, not from the logging work.

SETUP:
  git fetch origin ${BRANCH} --depth=1 || true
  git checkout -b ${BRANCH} origin/${BASE}    (or reuse ${BRANCH} if it exists)
  npm install if needed (electron-log@^5.4.4 must resolve); npm run rebuild on native ABI errors.

TRIAGE FROM THE PRIOR STEP (authoritative):
${JSON.stringify(triage.files, null, 2)}

RULES:
1. Fix ALL 'mechanical' and 'needs-judgment' errors. Prefer the SMALLEST change that satisfies the
   type checker / linter WITHOUT altering runtime behavior. No refactors, no API changes, no logic edits.
2. For 'incomplete-wip' files where a symbol/type genuinely doesn't exist: do NOT invent business logic.
   Use the MINIMAL, HONEST shim that makes it compile while preserving current runtime behavior — e.g.
   add the missing type/interface or import if you can infer it unambiguously from usage; if you truly
   cannot, leave it and record it in couldNotFix with a precise reason. Correctness over a green checkmark.
3. Do NOT touch any electron/services/logging/** file or the logging changes — they are already correct.
4. Do NOT change test assertions to mask a real failure. You may fix a test that fails to COMPILE.
5. After each file, re-run the relevant check. At the end run ALL FOUR gates and capture pass/fail +
   remaining counts. Note any unavoidable behavior change in behaviorChanges (there should be none).

COMMIT & PUSH (no gh) — only if you reduced errors (even partially):
  git add -A
  git commit -m "fix: clear pre-existing typecheck/lint errors for green CI (NFR-801 base)

Type/lint-only fixes to pre-existing WIP errors so the logging stack passes CI. No behavior changes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  git push -u origin ${BRANCH}
compareUrl = https://github.com/<owner>/<repo>/compare/${BASE}...${BRANCH}?expand=1
commitSha = git rev-parse HEAD ; filesChanged = git diff --name-only origin/${BASE}...HEAD
Return the structured result with honest finalGate + remaining counts + couldNotFix.`,
  { label: 'fix', phase: 'Fix', isolation: 'worktree', schema: FIX_SCHEMA },
)

phase('Verify')
if (!fix) {
  log('Fix returned nothing.')
  return { status: 'fix-skipped', triage }
}
const fg = fix.finalGate || {}
const allGreen = ['typecheck', 'lint', 'test', 'build'].every((k) => fg[k] === 'pass')
log(`Final gate — typecheck:${fg.typecheck} lint:${fg.lint} test:${fg.test} build:${fg.build}`)
log(`Remaining: ${fix.typecheckRemaining} typecheck / ${fix.lintErrorsRemaining} lint`)
if (fix.couldNotFix && fix.couldNotFix.length) log(`Could not fix ${fix.couldNotFix.length}: ${fix.couldNotFix.map((c) => c.file).join(', ')}`)
log(fix.pushed ? `Pushed ${BRANCH} @ ${fix.commitSha || '?'}` : 'NOT pushed')

return {
  status: allGreen && fix.pushed ? 'green-pushed' : (fix.pushed ? 'partial-pushed' : 'not-pushed'),
  branch: BRANCH,
  base: BASE,
  allGreen,
  pushed: !!fix.pushed,
  commitSha: fix.commitSha,
  compareUrl: fix.compareUrl,
  finalGate: fg,
  typecheckRemaining: fix.typecheckRemaining,
  lintErrorsRemaining: fix.lintErrorsRemaining,
  couldNotFix: fix.couldNotFix || [],
  behaviorChanges: fix.behaviorChanges,
  filesChanged: fix.filesChanged,
  summary: fix.summary,
}
