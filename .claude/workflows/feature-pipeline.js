export const meta = {
  name: 'feature-pipeline',
  description: 'Implement a feature end-to-end: isolated worktree → commit → push → PR → CI fix loop',
  phases: [
    { title: 'Implement' },
    { title: 'CI Monitor' },
    { title: 'Fix' },
  ],
}

// args: { task: string, branch: string, base?: string }
// Example: { task: "add BPM nudge button to TrackRow", branch: "feat/bpm-nudge", base: "main" }

const { task, branch } = args
const base = args.base || 'main'

const PR_SCHEMA = {
  type: 'object',
  properties: {
    prNumber: { type: 'number' },
    prUrl: { type: 'string' },
  },
  required: ['prNumber', 'prUrl'],
}

const CI_SCHEMA = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['pending', 'passed', 'failed'] },
    failedChecks: { type: 'array', items: { type: 'string' } },
    failureSummary: { type: 'string' },
  },
  required: ['state'],
}

// ── Phase 1: Implement ──────────────────────────────────────────────────────

phase('Implement')
log(`Task: ${task}`)
log(`Branch: ${branch} (base: ${base})`)

const pr = await agent(
  `You are implementing a feature in SetRecord — an Electron DJ app (TypeScript, React, better-sqlite3, Vite).
Repo: /Users/samcarter/Documents/SetRecordV2

TASK: ${task}

You are already inside a fresh isolated git worktree. Do the following in order:

1. Orient yourself: run \`git log --oneline -3\` and \`git branch --show-current\`
2. Create the feature branch off origin/${base}:
     git fetch origin ${base} --depth=1
     git checkout -b ${branch} origin/${base}
3. Read the relevant files before editing. Plan before coding.
4. Implement the task. Edit source files using your file tools.
5. Typecheck before committing:
     npm run typecheck 2>&1 | tail -30
   Fix any errors before moving on.
6. Stage and commit:
     git add -A
     git commit -m "feat(<scope>): <concise description>"
7. Push:
     git push -u origin ${branch}
8. Open a PR:
     gh pr create --title "<title>" --base ${base} --body "$(cat <<'BODY'
## Summary
- <bullet points>

## Test plan
- [ ] Typecheck passes
- [ ] Manual smoke test

🤖 Generated with Claude Code
BODY
)"
9. Return the PR number and URL.`,
  { label: 'implement', isolation: 'worktree', schema: PR_SCHEMA },
)

if (!pr) {
  log('Implementation agent skipped — no changes made.')
  return { status: 'skipped', branch }
}

log(`PR ready: ${pr.prUrl}`)

// ── Phase 2 & 3: CI monitor + auto-fix loop ─────────────────────────────────

phase('CI Monitor')

let passed = false
let pendingRounds = 0
let fixCount = 0
const MAX_PENDING_ROUNDS = 20 // ~20 agent calls ≈ plenty of time for GHA
const MAX_FIXES = 4

while (!passed && fixCount <= MAX_FIXES) {
  if (pendingRounds > MAX_PENDING_ROUNDS) {
    log('CI has been pending too long — manual check needed.')
    return { status: 'ci-timeout', prUrl: pr.prUrl, prNumber: pr.prNumber }
  }

  log(`Polling CI for PR #${pr.prNumber}...`)

  const ci = await agent(
    `Check the CI/checks status for PR #${pr.prNumber} in /Users/samcarter/Documents/SetRecordV2.

Run: gh pr checks ${pr.prNumber}

Rules:
- If ALL checks show "pass" → state: "passed"
- If ANY check is queued/in_progress/pending → state: "pending"
- If ANY check shows "fail" → state: "failed"

For "failed" state also run:
  RUNID=$(gh run list --branch ${branch} --limit 1 --json databaseId -q '.[0].databaseId')
  gh run view $RUNID --log-failed 2>&1 | head -150

Return state, failedChecks (array of check names), and a failureSummary (what specifically broke — paste relevant error lines).`,
    { label: `ci-poll-${fixCount}-${pendingRounds}`, schema: CI_SCHEMA },
  )

  if (ci.state === 'passed') {
    passed = true
    log('CI passed! PR is ready for review.')
    break
  }

  if (ci.state === 'pending') {
    pendingRounds++
    log(`CI still running (round ${pendingRounds})...`)
    continue
  }

  // ── Failed ─────────────────────────────────────────────────────────────────

  if (fixCount >= MAX_FIXES) {
    log(`CI still failing after ${MAX_FIXES} fix attempts. Needs manual review.`)
    return {
      status: 'needs-manual-fix',
      prUrl: pr.prUrl,
      prNumber: pr.prNumber,
      fixesApplied: fixCount,
      lastFailure: ci.failureSummary,
    }
  }

  fixCount++
  pendingRounds = 0
  phase('Fix')
  log(`Fix attempt ${fixCount}: ${(ci.failedChecks || []).join(', ') || 'CI failure'}`)

  await agent(
    `PR #${pr.prNumber} has failing CI. You need to fix it.
Repo: /Users/samcarter/Documents/SetRecordV2
Branch: ${branch}

FAILED CHECKS: ${(ci.failedChecks || []).join(', ')}

FAILURE SUMMARY:
${ci.failureSummary || '(no details — run gh run view to get logs)'}

Fix instructions:
1. You are in a fresh isolated worktree. Set up the branch:
     git fetch origin ${branch}
     git checkout -b fix-${fixCount} origin/${branch}

2. Read the failing files carefully before editing.

3. Fix based on check type:
   - "Typecheck" error → fix TypeScript types (npm run typecheck to verify)
   - "Lint" error → fix ESLint violations (npm run lint to verify)
   - "Test" error → fix the failing test or the code under test (npm test to verify)
   - "Build" error → fix build/import issues (npm run build 2>&1 | tail -40 to verify)

4. Verify locally BEFORE committing:
     npm run typecheck 2>&1 | tail -30
   Do not commit if errors remain.

5. Commit and push back to the PR branch:
     git add -A
     git commit -m "fix: resolve CI failure — <what you fixed>"
     git push origin HEAD:${branch}`,
    { label: `fix-${fixCount}`, isolation: 'worktree' },
  )
}

return {
  status: passed ? 'ci-passed' : 'needs-manual-fix',
  prUrl: pr.prUrl,
  prNumber: pr.prNumber,
  fixesApplied: fixCount,
  branch,
}
