import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * NFR-107 — config for emitting Tier B fixtures to disk (`npm run bench:fixtures`).
 * Separate from the gating bench config so the large-fixture writer never runs
 * on a PR.
 */
export default defineConfig({
  test: {
    include: ['bench/fixtures/**/*.emit.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 120_000
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  }
})
