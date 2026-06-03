/**
 * NFR-107 — fixture emitter. Run via `npm run bench:fixtures`. Writes the
 * canonical 10k-track library to disk in the two forms Tier B consumes:
 *
 *   bench/results/library-10k.xml   → seed the app via window.setsense.importLibrary
 *   bench/results/library-10k.json  → the same Track[] for reference / debugging
 *
 * Kept out of the bench/node/** gating glob so it never runs (and never writes a
 * ~30 MB file) on a PR. It's a Vitest test purely to reuse the TS generator
 * without a standalone TS loader.
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { generateLibrary, BENCH_SEED } from './generateLibrary'
import { tracksToRekordboxXml } from './toRekordboxXml'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'results')
const COUNT = Number(process.env.BENCH_FIXTURE_COUNT ?? 10_000)

describe('emit benchmark fixtures', () => {
  it(`writes a ${COUNT}-track library`, () => {
    mkdirSync(OUT, { recursive: true })
    const tracks = generateLibrary(BENCH_SEED, COUNT)

    const xml = tracksToRekordboxXml(tracks)
    writeFileSync(join(OUT, `library-${COUNT}.xml`), xml)
    writeFileSync(join(OUT, `library-${COUNT}.json`), JSON.stringify(tracks))

    expect(tracks).toHaveLength(COUNT)

    console.log(
      `  emitted library-${COUNT}.xml (${(xml.length / 1e6).toFixed(1)} MB) + library-${COUNT}.json`
    )
  })
})
