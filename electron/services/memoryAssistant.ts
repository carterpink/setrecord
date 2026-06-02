/**
 * memoryAssistant.ts — Phase 13 optional local-LLM layer for the Recall tab.
 *
 * The model is a NARRATION + ROUTING layer only. It never invents library data:
 * grammar-constrained generation forces its output into a fixed {intent, slots}
 * shape, the deterministic memoryService engine produces the actual tracks, and
 * a templated sentence narrates the real result. The whole Recall tab works with
 * the model absent — this just adds free-text "ask your library" search.
 *
 * The model (≈1.9 GB) ships INSIDE the app bundle (electron-builder
 * `extraResources` → Contents/Resources/models), so the feature works offline
 * from the first launch with no download step. If the bundled copy is ever
 * missing — a dev run, or an install where it was stripped — we self-heal by
 * downloading it once into userData/models; thereafter it loads exactly like
 * the bundled copy. Either way the model is a NARRATION + ROUTING layer only.
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import type {
  Llama,
  LlamaModel,
  LlamaContext,
  LlamaChatSession as LlamaChatSessionType
} from 'node-llama-cpp'
import type { RecallAiStatus, RecallAskResult, Track } from '../../src/types'
import * as memory from './memoryService'
import { parseQuery } from '../algorithms/memory/queryParser'

// Small instruct model — good enough for intent routing + slot extraction.
// `hf:` URI lets node-llama-cpp resolve the exact GGUF file for the quant.
const MODEL_URI = 'hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M'
const MODEL_FILENAME = 'qwen2.5-3b-instruct-q4_k_m.gguf'

type State = RecallAiStatus['state']

let _enabled = false
let _state: State = 'absent'
let _progress = 0
let _error: string | undefined

let _llama: Llama | null = null
let _model: LlamaModel | null = null
let _context: LlamaContext | null = null
let _session: LlamaChatSessionType | null = null
// node-llama-cpp's grammar object (typed loosely to avoid leaking lib internals).
let _grammar: { parse: (s: string) => unknown } | null = null

let _loadPromise: Promise<void> | null = null
let _askLock: Promise<unknown> = Promise.resolve()

/** Where a self-healed download lands (writable per-user dir). */
function downloadDir(): string {
  return join(app.getPath('userData'), 'models')
}
function downloadedModelPath(): string {
  return join(downloadDir(), MODEL_FILENAME)
}
/** Where the model ships inside the packaged app (read-only app bundle). */
function bundledModelPath(): string {
  return join(process.resourcesPath, 'models', MODEL_FILENAME)
}
/**
 * The model file we'll actually load: prefer the copy bundled in the app, then
 * a previously self-healed download. Returns null when neither exists (we'd then
 * download on demand). The bundled path doesn't resolve in `electron-vite dev`
 * (no real resourcesPath), so dev naturally exercises the download fallback.
 */
function resolveModelPath(): string | null {
  try {
    if (process.resourcesPath && existsSync(bundledModelPath())) return bundledModelPath()
  } catch {
    /* process.resourcesPath unavailable (e.g. tests) — fall through */
  }
  if (existsSync(downloadedModelPath())) return downloadedModelPath()
  return null
}

export function setEnabled(enabled: boolean): void {
  _enabled = enabled
}

export function getStatus(): RecallAiStatus {
  // Report _state verbatim. The model loads lazily on first ask(), so a
  // downloaded-but-not-loaded model stays 'absent' and the UI shows the input
  // (the load happens transparently on ask). `downloaded` lets the UI tell
  // "needs the 2 GB download" apart from "just needs an in-memory load".
  return {
    enabled: _enabled,
    state: _state,
    downloaded: resolveModelPath() !== null,
    progress: _progress,
    error: _error
  }
}

/**
 * Download (if needed) + load the model. Idempotent — concurrent callers share
 * one in-flight promise. `onProgress` streams 0–1 download progress.
 */
export async function ensureModel(onProgress?: (p: number) => void): Promise<void> {
  if (_session && _grammar) return
  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    try {
      _error = undefined
      const { getLlama } = await import('node-llama-cpp')

      // Prefer the model bundled in the app; only download if it's genuinely
      // absent (dev run, or an install where the resource was stripped).
      let path = resolveModelPath()
      if (!path) {
        _state = 'downloading'
        _progress = 0
        const { createModelDownloader } = await import('node-llama-cpp')
        const downloader = await createModelDownloader({
          modelUri: MODEL_URI,
          dirPath: downloadDir(),
          fileName: MODEL_FILENAME,
          onProgress: ({ totalSize, downloadedSize }) => {
            _progress = totalSize > 0 ? downloadedSize / totalSize : 0
            onProgress?.(_progress)
          }
        })
        await downloader.download()
        path = downloadedModelPath()
      }

      _state = 'loading'
      _llama = await getLlama()
      _model = await _llama.loadModel({ modelPath: path })
      _context = await _model.createContext({ contextSize: 2048 })
      const { LlamaChatSession } = await import('node-llama-cpp')
      _session = new LlamaChatSession({
        contextSequence: _context.getSequence(),
        systemPrompt: SYSTEM_PROMPT
      })
      _grammar = (await _llama.createGrammarForJsonSchema(INTENT_SCHEMA)) as unknown as {
        parse: (s: string) => unknown
      }
      _state = 'ready'
    } catch (err) {
      _state = 'error'
      _error = friendlyLoadError(err)
      _session = null
      _grammar = null
      throw err
    } finally {
      _loadPromise = null
    }
  })()

  return _loadPromise
}

/**
 * Map the raw error from a download/native-load failure into something a DJ can
 * act on. The underlying library surfaces low-level messages (ENOENT, dlopen,
 * getaddrinfo) that mean nothing to a user — and these are what the Settings
 * panel shows via `getStatus().error`. The deterministic Recall search keeps
 * working regardless, so every message says so.
 */
function friendlyLoadError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)) || ''
  const m = raw.toLowerCase()

  if (/enospc|no space left/.test(m)) {
    return 'Not enough free disk space to download the language model (~2 GB needed). Free up space and try again. Recall search still works without it.'
  }
  if (/enotfound|getaddrinfo|econnrefused|etimedout|network|fetch failed|socket hang|enetdown|eai_again/.test(m)) {
    return 'Couldn’t download the language model — check your internet connection and try again. Recall search still works without it.'
  }
  if (/cannot find module|dlopen|different node\.?js version|could not locate the bindings|\.node|was compiled against|invalid elf|symbol not found|llama|metal|no available backend|gpu/.test(m)) {
    return 'The local AI engine couldn’t start on this Mac. Recall’s built-in search still answers most questions — Extended understanding is unavailable.'
  }
  if (/enoent|no such file/.test(m)) {
    return 'The language model file is missing or incomplete. Turn Extended understanding off and on again to re-download it. Recall search still works without it.'
  }
  return `Extended understanding couldn’t start (${raw.slice(0, 120)}). Recall’s built-in search still works.`
}

// ─── Intent routing schema ───────────────────────────────────────────────────

const INTENTS = [
  'forgotten_gems',
  'tracks_after',
  'best_closers',
  'best_openers',
  'top_sequences',
  'smart_filter',
  'lifecycle',
  'health',
  'identity',
  'unknown'
] as const
type Intent = (typeof INTENTS)[number]

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { enum: INTENTS as unknown as string[] },
    trackQuery: { type: 'string' },
    bpmMin: { type: 'number' },
    bpmMax: { type: 'number' },
    energyMin: { type: 'number' },
    energyMax: { type: 'number' },
    genre: { type: 'string' },
    neverPlayed: { type: 'boolean' },
    dormantMonths: { type: 'number' },
    minRating: { type: 'number' }
  },
  required: ['intent']
} as const

interface RoutedIntent {
  intent: Intent
  trackQuery?: string
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  genre?: string
  neverPlayed?: boolean
  dormantMonths?: number
  minRating?: number
}

const SYSTEM_PROMPT = `You route a DJ's plain-English question about their music library to ONE intent and extract any slots. Output JSON only.
Intents:
- forgotten_gems: tracks they used to play but haven't in a while.
- tracks_after: what they tend to play AFTER a specific track (put the track name in trackQuery).
- best_closers / best_openers: their habitual set-closing / set-opening tracks.
- top_sequences: their most-used multi-track runs.
- smart_filter: find tracks matching constraints (bpmMin/bpmMax, energyMin/energyMax 1-10, genre, neverPlayed, dormantMonths, minRating).
- lifecycle: how their library breaks down by lifecycle (new/active/peak/forgotten/etc).
- health: library health (missing files/keys/bpm, duplicates).
- identity: their overall taste / signature sound.
- unknown: anything that doesn't fit.
Energy words map to 1-10: chill≈1-3, groovy≈4-6, peak/banger≈8-10. "warmup"≈low energy, "peak hour"≈high energy.`

// ─── Public ask() ────────────────────────────────────────────────────────────

/**
 * Answer a free-text question. The deterministic parser runs FIRST — it handles
 * the bulk of real queries instantly with no model and no network. Only when it
 * can't parse the phrasing do we fall back to the local LLM (and only if the
 * user has enabled it). Model calls are serialized via _askLock so concurrent
 * asks don't collide on the single context sequence.
 */
export async function ask(question: string): Promise<RecallAskResult> {
  const parsed = parseQuery(question)
  if (parsed) return execIntent(parsed)

  // Nothing matched the keyword parser → need the model for free-form phrasing.
  if (!_enabled) {
    return {
      intent: 'unknown',
      kind: 'tracks',
      tracks: [],
      narration:
        'I couldn’t pin that down. Try something like "128 bpm tech house", "forgotten gems", or "my best closers" — or enable Extended understanding in Settings for unusual phrasing.'
    }
  }

  try {
    await ensureModel()
  } catch {
    // Download/native-load failed. _error already holds a friendly explanation
    // for the Settings panel; here we return a graceful answer instead of
    // throwing into the renderer's generic "something went wrong" catch.
    return {
      intent: 'unknown',
      kind: 'tracks',
      tracks: [],
      narration:
        _error ??
        'Extended understanding isn’t available right now. Try a phrasing like "128 bpm tech house", "forgotten gems", or "my best closers".'
    }
  }
  const run = _askLock.then(() => routeAndRun(question))
  _askLock = run.catch(() => undefined)
  return run
}

async function routeAndRun(question: string): Promise<RecallAskResult> {
  if (!_session || !_grammar) throw new Error('Model not ready')

  _session.resetChatHistory()
  const raw = await _session.prompt(question, { grammar: _grammar as never, maxTokens: 200 })

  let routed: RoutedIntent
  try {
    routed = _grammar.parse(raw) as RoutedIntent
  } catch {
    routed = { intent: 'unknown' }
  }

  return execIntent(routed)
}

async function execIntent(r: RoutedIntent): Promise<RecallAskResult> {
  switch (r.intent) {
    case 'forgotten_gems': {
      const gems = await memory.getGems()
      const tracks = gems.map((g) => g.track)
      return { intent: r.intent, kind: 'tracks', tracks, narration: gemsNarration(tracks.length) }
    }
    case 'tracks_after': {
      if (!r.trackQuery) return unknownResult()
      const track = memory.findTrackByQuery(r.trackQuery)
      if (!track) {
        return {
          intent: r.intent,
          kind: 'combos',
          combos: [],
          narration: `I couldn't find "${r.trackQuery}" in your library.`
        }
      }
      const combos = await memory.getCombosFor(track.id)
      return {
        intent: r.intent,
        kind: 'combos',
        combos,
        narration: combos.length
          ? `After ${track.title} you most often reach for ${combos[0].track.title} (${combos[0].count}×).`
          : `No recorded transitions out of ${track.title} yet.`
      }
    }
    case 'best_closers': {
      const { closers } = await memory.getEnds()
      return {
        intent: r.intent,
        kind: 'combos',
        combos: closers,
        narration: endsNarration('close', closers)
      }
    }
    case 'best_openers': {
      const { openers } = await memory.getEnds()
      return {
        intent: r.intent,
        kind: 'combos',
        combos: openers,
        narration: endsNarration('open', openers)
      }
    }
    case 'top_sequences': {
      const sequences = await memory.getTopSequences()
      return {
        intent: r.intent,
        kind: 'sequences',
        sequences,
        narration: sequences.length
          ? `Your ${sequences.length} most-recurring runs.`
          : 'No recurring runs yet — build and perform a few sets.'
      }
    }
    case 'smart_filter': {
      const rule = {
        bpmMin: r.bpmMin,
        bpmMax: r.bpmMax,
        energyMin: r.energyMin,
        energyMax: r.energyMax,
        genreIncludes: r.genre,
        neverPlayed: r.neverPlayed,
        lastPlayedOlderThanMonths: r.dormantMonths,
        ratingMin: r.minRating
      }
      // Guard: a filter with no constraints would match the whole library.
      // Don't dump thousands of tracks — ask the user to be more specific.
      const hasConstraint = Object.values(rule).some((v) => v !== undefined)
      if (!hasConstraint) return unknownResult()

      const tracks = await memory.evaluateCrateById({
        id: 'ai-adhoc',
        name: 'Ask result',
        match: 'all',
        rules: [rule]
      })
      return {
        intent: r.intent,
        kind: 'tracks',
        tracks,
        narration: tracks.length
          ? `${tracks.length} tracks match.`
          : 'No tracks match those constraints.'
      }
    }
    case 'lifecycle': {
      const c = await memory.getLifecycleCounts()
      return {
        intent: r.intent,
        kind: 'stats',
        stats: Object.entries(c).map(([label, value]) => ({ label, value: String(value) })),
        narration: `${c.peak} in peak rotation, ${c.forgotten} forgotten, ${c.untested} never tested.`
      }
    }
    case 'health': {
      const h = await memory.getHealth()
      return {
        intent: r.intent,
        kind: 'stats',
        stats: [
          { label: 'Health score', value: `${h.healthScore}/100` },
          { label: 'Missing files', value: String(h.missingFiles) },
          { label: 'Missing key', value: String(h.missingKey) },
          { label: 'Missing BPM', value: String(h.missingBpm) },
          { label: 'Duplicate groups', value: String(h.duplicateGroups.length) }
        ],
        narration: `Library health is ${h.healthScore}/100.`
      }
    }
    case 'identity': {
      const id = await memory.getIdentity()
      const topGenre = id.genreDistribution[0]?.label ?? '—'
      const topArtist = id.topArtists[0]?.label ?? '—'
      return {
        intent: r.intent,
        kind: 'stats',
        stats: [
          { label: 'Top genre', value: topGenre },
          { label: 'Top artist', value: topArtist },
          { label: 'Top label', value: id.topLabels[0]?.label ?? '—' }
        ],
        narration: `Your sound leans ${topGenre}, anchored by ${topArtist}.`
      }
    }
    default:
      return unknownResult()
  }
}

function unknownResult(): RecallAskResult {
  return {
    intent: 'unknown',
    kind: 'tracks',
    tracks: [],
    narration:
      "I couldn't map that to a search. Try the saved questions, or ask about forgotten tracks, closers, or a BPM/energy range."
  }
}

function gemsNarration(n: number): string {
  return n
    ? `Found ${n} tracks you used to play but have let slip.`
    : 'No forgotten gems surfaced yet.'
}
function endsNarration(verb: 'open' | 'close', list: { track: Track; count: number }[]): string {
  if (!list.length)
    return `Not enough history to know your go-to ${verb === 'open' ? 'openers' : 'closers'} yet.`
  return `You most often ${verb} with ${list[0].track.title} (${list[0].count}×).`
}
