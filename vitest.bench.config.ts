import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * NFR-107 — Tier A benchmark config, kept separate from vitest.config.ts so the
 * perf harness never runs inside `npm test` (and a flaky timing assertion never
 * blocks the unit suite). Run with `npm run bench:node`.
 */
export default defineConfig({
  test: {
    include: ['bench/node/**/*.bench.test.ts'],
    environment: 'node',
    globals: false,
    globalSetup: ['bench/setup/globalSetup.ts'],
    // Benchmarks build a 10k fixture and run many iterations — generous timeouts.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Perf samples must not contend for cores with each other.
    fileParallelism: false,
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
