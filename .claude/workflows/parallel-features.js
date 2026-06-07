export const meta = {
  name: 'parallel-features',
  description: 'Run multiple feature pipelines simultaneously — each fully isolated in its own git worktree',
  phases: [
    { title: 'Fan Out' },
    { title: 'Summary' },
  ],
}

// args: Array<{ task: string, branch: string, base?: string }>
// Example:
// [
//   { task: "add BPM nudge button to TrackRow", branch: "feat/bpm-nudge" },
//   { task: "show play count badge on TrackRow", branch: "feat/play-count" },
//   { task: "add venue autocomplete to gig metadata form", branch: "feat/venue-autocomplete" }
// ]

if (!Array.isArray(args) || args.length === 0) {
  log('No features provided. Pass an array of { task, branch, base? } objects.')
  return { status: 'no-input' }
}

phase('Fan Out')
log(`Launching ${args.length} feature pipeline(s) in parallel...`)
args.forEach((f, i) => log(`  ${i + 1}. [${f.branch}] ${f.task}`))

const results = await parallel(
  args.map(f => () =>
    workflow('feature-pipeline', {
      task: f.task,
      branch: f.branch,
      base: f.base || 'main',
    }),
  ),
)

phase('Summary')

const summary = results.filter(Boolean).map((r, i) => ({
  branch: args[i].branch,
  task: args[i].task,
  ...r,
}))

const passed = summary.filter(r => r.status === 'ci-passed')
const needsReview = summary.filter(r => r.status === 'needs-manual-fix' || r.status === 'ci-timeout')
const skipped = summary.filter(r => r.status === 'skipped')

log(`Done. ${passed.length} passed CI, ${needsReview.length} need attention, ${skipped.length} skipped.`)
if (needsReview.length > 0) {
  needsReview.forEach(r => log(`  ⚠ ${r.branch}: ${r.prUrl || 'no PR'}`))
}
if (passed.length > 0) {
  passed.forEach(r => log(`  ✓ ${r.branch}: ${r.prUrl}`))
}

return summary
