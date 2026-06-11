/**
 * Headless engine driver for the eval harness.
 *
 * The resolution cascade lives in `src/intelligence/resolve.ts` — the SAME
 * module the live app (homeStore) executes — so the harness measures exactly
 * what ships. This file exists only to keep the harness's import path stable
 * and to document that seam. EvalCtx (fixtures world) structurally satisfies
 * ResolveCtx; the extra fixture-only fields (releaseYears) are ignored.
 */

export { resolveQuery, resolveDetectors } from '../../src/intelligence/resolve'
