/**
 * NFR-107 — Synthetic library generator.
 *
 * Produces a deterministic, *realistically distributed* Track[] from a seed.
 * Same seed + count → byte-identical library, so a benchmark regression is
 * always the code changing, never the data.
 *
 * Why distributions matter: getSuggestions() and buildSet() both filter the
 * candidate pool by a BPM window (see suggestions.ts:117, setArchitect.ts:131).
 * A uniform-random BPM spread would leave tiny pools after filtering and badly
 * *understate* the scoring cost. Real DJ libraries cluster around a handful of
 * tempos, so the densest cluster — the worst case for the scoring loop — is the
 * case the budgets exist to protect. We model that explicitly.
 */

import type { Track, AudioFormat, EnergySource } from '../../src/types'

// ───────── Seeded PRNG (mulberry32) ─────────
// Same algorithm as setArchitect.ts's variation seed — small, fast, deterministic.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Weighted pick from [value, weight] pairs using a rng draw in [0,1). */
function weightedPick<T>(rng: () => number, pairs: Array<[T, number]>): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [v, w] of pairs) {
    r -= w
    if (r < 0) return v
  }
  return pairs[pairs.length - 1][0]
}

/** Bates-distributed noise in [-1,1] (sum of k uniforms → bell-ish), seeded. */
function bell(rng: () => number, k = 3): number {
  let s = 0
  for (let i = 0; i < k; i++) s += rng()
  return (s / k) * 2 - 1
}

const KEYS: string[] = (() => {
  const out: string[] = []
  for (let n = 1; n <= 12; n++) for (const m of ['A', 'B']) out.push(`${n}${m}`)
  return out
})()

const OPEN_NOTATION: Record<string, string> = {
  // Just enough valid open-key values for the XML fixture's Tonality attribute.
  '8A': 'Am',
  '8B': 'C',
  '9A': 'Em',
  '9B': 'G',
  '5A': 'Cm',
  '5B': 'Eb',
  '1A': 'Abm',
  '1B': 'B',
  '12A': 'Dm',
  '12B': 'F'
}

// Tempo clusters (centre BPM, spread, weight) — multi-modal, house/techno-heavy.
const BPM_CLUSTERS: Array<{ centre: number; spread: number; weight: number }> = [
  { centre: 122, spread: 3, weight: 14 }, // deep / tech house
  { centre: 124, spread: 3, weight: 20 },
  { centre: 126, spread: 3, weight: 22 }, // densest — tech house core
  { centre: 128, spread: 3, weight: 18 }, // peak house / techno edge
  { centre: 132, spread: 4, weight: 8 }, // melodic / prog
  { centre: 140, spread: 4, weight: 8 }, // techno / trance
  { centre: 150, spread: 5, weight: 4 }, // hard
  { centre: 174, spread: 4, weight: 6 } // dnb
]

// Genres weighted so detectDominantProfile() resolves a real (tech-house) profile.
const GENRES: Array<[string, number]> = [
  ['Tech House', 26],
  ['House', 16],
  ['Deep House', 10],
  ['Melodic Techno', 10],
  ['Techno', 12],
  ['Progressive House', 8],
  ['Trance', 5],
  ['Drum & Bass', 6],
  ['Disco', 3],
  ['', 4] // some untagged tracks, like a real library
]

const FORMATS: Array<[AudioFormat, number]> = [
  ['mp3', 60],
  ['m4a', 14],
  ['aiff', 12],
  ['wav', 8],
  ['flac', 6]
]

const FORMAT_EXT: Record<AudioFormat, string> = {
  mp3: '.mp3',
  m4a: '.m4a',
  aiff: '.aiff',
  wav: '.wav',
  flac: '.flac',
  unknown: '.mp3'
}

export interface GenerateOpts {
  /** Number of distinct artists to draw from (controls artist-collision rate,
   *  which matters because getSuggestions excludes artists already in the set). */
  artistPool?: number
}

/**
 * Generate `count` synthetic tracks deterministically from `seed`.
 */
export function generateLibrary(seed: number, count: number, opts: GenerateOpts = {}): Track[] {
  const rng = mulberry32(seed)
  const artistPool = opts.artistPool ?? Math.max(50, Math.floor(count / 12))
  const tracks: Track[] = []

  for (let i = 0; i < count; i++) {
    const cluster = weightedPick(
      rng,
      BPM_CLUSTERS.map((c) => [c, c.weight] as [typeof c, number])
    )
    const bpm = Math.round((cluster.centre + bell(rng) * cluster.spread) * 10) / 10

    const key = KEYS[Math.floor(rng() * KEYS.length)]
    // Energy: triangular toward 5–7 (most tracks are mid-energy), clamped 1–10.
    const energy = Math.min(10, Math.max(1, Math.round(5.5 + bell(rng, 3) * 3.5)))
    const duration = Math.round(180 + rng() * 240) // 3–7 min
    const format = weightedPick(rng, FORMATS)
    const genre = weightedPick(rng, GENRES)
    const artistN = 1 + Math.floor(rng() * artistPool)
    const playCount = Math.floor(rng() * rng() * 60) // skewed toward low play counts
    const rating = weightedPick(rng, [
      [0, 30],
      [3, 20],
      [4, 30],
      [5, 20]
    ])

    // A handful of cue points / hot cues per track — real tracks carry several,
    // and they add per-track object weight to the import + render paths.
    const hotCueCount = Math.floor(rng() * 4)
    const cuePoints = Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, k) => ({
      position: Math.floor(rng() * duration * 1000),
      type: (k === 0 ? 'cue' : 'memory') as 'cue' | 'memory'
    }))
    const hotCues = Array.from({ length: hotCueCount }, (_, k) => ({
      index: k,
      position: Math.floor(rng() * duration * 1000),
      label: `Cue ${k + 1}`
    }))

    const energySource: EnergySource = rng() < 0.85 ? 'rekordbox' : 'pending'

    tracks.push({
      id: `bench-${seed}-${i}`,
      rekordboxId: String(100000 + i),
      title: `Bench Track ${i}`,
      artist: `Artist ${artistN}`,
      album: rng() < 0.7 ? `Album ${1 + Math.floor(rng() * artistPool)}` : undefined,
      genre: genre || undefined,
      bpm,
      key,
      keyOpenNotation: OPEN_NOTATION[key],
      energy,
      energySource,
      duration,
      filePath: `/Users/dj/Music/SetRecordBench/${format}/${i}_${artistN}${FORMAT_EXT[format]}`,
      fileSize: Math.floor(
        (duration * (format === 'flac' || format === 'wav' ? 1400 : 320) * 1000) / 8
      ),
      bitrate: format === 'flac' || format === 'wav' ? 1411 : 320,
      format,
      cuePoints,
      hotCues,
      beatgridOffset: Math.floor(rng() * 500),
      playCount,
      rating,
      dateAdded: new Date(2020, 0, 1 + Math.floor(rng() * 2000)).toISOString(),
      lastPlayed:
        playCount > 0 ? new Date(2024, 0, 1 + Math.floor(rng() * 500)).toISOString() : undefined,
      comment: undefined,
      label: rng() < 0.5 ? `Label ${1 + Math.floor(rng() * 40)}` : undefined,
      missingFile: false
    })
  }

  return tracks
}

/** The canonical seed used by all benchmarks — keep stable across runs. */
export const BENCH_SEED = 1337
