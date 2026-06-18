/**
 * Track-level energy analysis: cache → decode → spectral score.
 *
 * Deliberately free of Electron/ffmpeg imports so it can be unit-tested with an
 * injected decoder and an in-memory cache. energyAnalyser.ts supplies the real
 * ffmpeg PCM decoder and the file-backed shared cache.
 */

import { analyseSamples, ANALYSIS_SAMPLE_RATE, clamp01 } from './spectralFeatures'
import { vocalPresence } from './vocalFeature'
import { EnergyCache, CACHE_VERSION, type CachedEnergy } from './energyCache'
import type { EnergySource } from '../../../src/types'

export interface PcmDecode {
  samples: Float32Array
  sampleRate: number
}

export type DecodeFn = (filePath: string) => Promise<PcmDecode | null>

export interface AnalyseDeps {
  decode: DecodeFn
  cache?: EnergyCache
  /** Overridable for tests; defaults to fs.existsSync at the call site. */
  fileExists?: (filePath: string) => boolean
}

export interface AnalyseResult {
  trackId: string
  energy: number
  energyRaw: number
  source: EnergySource
  /** True when the score was served from cache without decoding. */
  cached: boolean
  components?: { rms: number; brightness: number; loudness: number; vocalness: number }
}

const MIN_BPM = 90
const MAX_BPM = 150

/** Cheap BPM-only term used purely as a fallback when decoding fails. */
export function bpmTerm(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0.5
  return clamp01((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM))
}

function bpmFallbackScore(bpm: number): { energy: number; raw: number } {
  const raw = bpmTerm(bpm)
  return { energy: Math.max(1, Math.min(10, 1 + Math.round(raw * 9))), raw }
}

/**
 * Analyse one track. Always resolves (never rejects) so a single bad file can't
 * stall the queue. Provenance via `source`:
 *   - 'missing'  → file not on disk → neutral score 5
 *   - 'failed'   → decode produced nothing → BPM-only fallback
 *   - 'computed' → real spectral score (fresh or cache hit)
 */
export async function analyseTrack(
  trackId: string,
  filePath: string,
  bpm: number,
  missingFile: boolean,
  deps: AnalyseDeps
): Promise<AnalyseResult> {
  const exists = deps.fileExists ?? (() => true)

  if (missingFile || !exists(filePath)) {
    const { raw } = bpmFallbackScore(bpm)
    return { trackId, energy: 5, energyRaw: raw, source: 'missing', cached: false }
  }

  // Cache hit → instant, no decode.
  const cacheKey = deps.cache?.keyForFile(filePath) ?? null
  if (deps.cache && cacheKey) {
    const hit = deps.cache.get(cacheKey)
    if (hit) {
      return {
        trackId,
        energy: hit.energy,
        energyRaw: hit.energyRaw,
        source: hit.source,
        cached: true,
        components: {
          rms: hit.rms,
          brightness: hit.brightness,
          loudness: hit.loudness,
          vocalness: hit.vocalness ?? 0
        }
      }
    }
  }

  const pcm = await deps.decode(filePath)
  if (!pcm || pcm.samples.length === 0) {
    const { energy, raw } = bpmFallbackScore(bpm)
    return { trackId, energy, energyRaw: raw, source: 'failed', cached: false }
  }

  const sampleRate = pcm.sampleRate || ANALYSIS_SAMPLE_RATE
  const { score, raw, components } = analyseSamples(pcm.samples, sampleRate)
  const vocalness = vocalPresence(pcm.samples, sampleRate)
  const fullComponents = { ...components, vocalness }

  if (deps.cache && cacheKey) {
    const entry: CachedEnergy = {
      energy: score,
      energyRaw: raw,
      source: 'computed',
      rms: components.rms,
      brightness: components.brightness,
      loudness: components.loudness,
      vocalness,
      v: CACHE_VERSION
    }
    deps.cache.set(cacheKey, entry)
  }

  return {
    trackId,
    energy: score,
    energyRaw: raw,
    source: 'computed',
    cached: false,
    components: fullComponents
  }
}

// re-export so callers have one import site for the cache type.
export { EnergyCache }
