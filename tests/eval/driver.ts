/**
 * Headless engine driver for the eval harness.
 *
 * `resolveQuery(prompt, ctx)` is a faithful, model-OFF reimplementation of the
 * app's live resolution path:
 *   homeStore.run  →  (interpretHome → useModel?) →
 *     model-off:  parseQuery → execIntent  →  literal text fallback
 *     structured: execute(filters)  (generic search / forgotten / after / dupes / set)
 *
 * It calls the SAME pure engine modules the app uses (interpretHome,
 * interpretTurn, searchLibrary, parseQuery, forgottenGems, transitionGraph,
 * closers, libraryHealth, identity, lifecycle), backed by an in-memory fixture
 * world instead of SQLite. As the engine improves in later phases, this driver
 * is updated in lock-step so the harness measures real engine quality.
 *
 * The model is intentionally OFF here: that is the app's default, it's what CI
 * can run deterministically, and it's exactly the configuration that fails the
 * "give me 10 Fisher songs" class today — which the baseline must expose.
 */

import type { LibrarySearchParams, Track } from '../../src/types'
import type { EngineResult, EvalCtx, FixtureSession } from './types'

import { interpretHome } from '../../src/utils/homeQuery'
import { searchLibrary } from '../../electron/algorithms/memory/librarySearch'
import { parseQuery, type ParsedQuery } from '../../electron/algorithms/memory/queryParser'
import { findForgottenGems } from '../../electron/algorithms/memory/forgottenGems'
import { buildTransitionGraph, tracksAfter } from '../../electron/algorithms/memory/transitionGraph'
import { analyzeEnds } from '../../electron/algorithms/memory/closers'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Mirror of queries.getTrackIdsPlayedWhere over the fixture sessions. */
function trackIdsPlayedWhere(ctx: EvalCtx, p: LibrarySearchParams): Set<string> | null {
  const hasGig =
    p.performedVenue != null ||
    p.performedCity != null ||
    p.performedAfter != null ||
    p.performedBefore != null ||
    p.performedEventType != null ||
    p.performedSetSlot != null
  if (!hasGig) return null
  const ci = (s?: string): string => (s ?? '').toLowerCase()
  const matchSession = (s: FixtureSession): boolean => {
    if (p.performedVenue && !ci(s.venue).includes(ci(p.performedVenue))) return false
    if (p.performedCity && !ci(s.city).includes(ci(p.performedCity))) return false
    if (p.performedEventType && s.eventType !== p.performedEventType) return false
    if (p.performedSetSlot && s.setSlot !== p.performedSetSlot) return false
    if (p.performedAfter && s.performedAt < p.performedAfter.slice(0, 10)) return false
    if (p.performedBefore && s.performedAt > p.performedBefore.slice(0, 10)) return false
    return true
  }
  const ids = new Set<string>()
  for (const s of ctx.sessions) if (matchSession(s)) for (const id of s.trackIds) ids.add(id)
  return ids
}

/** Run a deterministic library search (with gig-session intersection). */
function execSearch(ctx: EvalCtx, params: LibrarySearchParams, intent: string): EngineResult {
  const allowed = trackIdsPlayedWhere(ctx, params)
  const tracks = searchLibrary(ctx.tracks, params, allowed)
  return {
    intent,
    kind: tracks.length ? 'tracks' : 'empty',
    tracks,
    params,
    narration: tracks.length ? `${tracks.length} tracks.` : 'No tracks match.'
  }
}

// ── parseQuery intent execution (mirrors memoryAssistant.execIntent, model-off) ──

function execParsed(ctx: EvalCtx, r: ParsedQuery): EngineResult | null {
  switch (r.intent) {
    case 'forgotten_gems': {
      const gems = findForgottenGems(ctx.tracks, { now: ctx.now })
      const tracks = gems.map((g) => g.track)
      return {
        intent: r.intent,
        kind: tracks.length ? 'tracks' : 'empty',
        tracks,
        narration: tracks.length ? `Found ${tracks.length} forgotten gems.` : 'No forgotten gems.'
      }
    }
    case 'tracks_after': {
      if (!r.trackQuery) return null
      const q = r.trackQuery.toLowerCase()
      const source =
        ctx.tracks.find((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) ?? null
      if (!source) {
        return { intent: r.intent, kind: 'empty', narration: `Couldn't find "${r.trackQuery}".` }
      }
      const graph = buildTransitionGraph(ctx.sequences)
      const after = tracksAfter(graph, source.id)
      const tracks = after.map((a) => ctx.byId.get(a.trackId)).filter((t): t is Track => !!t)
      return {
        intent: r.intent,
        kind: tracks.length ? 'combos' : 'empty',
        tracks,
        sourceTrack: source,
        narration: tracks.length
          ? `After ${source.title} you reach for ${tracks[0].title}.`
          : `No recorded transitions out of ${source.title}.`
      }
    }
    case 'best_closers':
    case 'best_openers': {
      const ends = analyzeEnds(ctx.sequences)
      const ranked = r.intent === 'best_closers' ? ends.closers : ends.openers
      const tracks = ranked.map((x) => ctx.byId.get(x.trackId)).filter((t): t is Track => !!t)
      return {
        intent: r.intent,
        kind: tracks.length ? 'combos' : 'empty',
        tracks,
        narration: tracks.length ? `Your habitual ${r.intent}.` : 'Not enough history.'
      }
    }
    case 'top_sequences': {
      // Faithful enough for baseline: report whether recurring runs exist.
      const graph = buildTransitionGraph(ctx.sequences)
      const counts = Array.from(graph.adjacency.values()).flatMap((m) => Array.from(m.values()))
      const recurring = counts.filter((c) => c >= 2).length
      return {
        intent: r.intent,
        kind: recurring ? 'sequences' : 'empty',
        narration: recurring ? `${recurring} recurring runs.` : 'No recurring runs yet.'
      }
    }
    case 'smart_filter': {
      // FAITHFUL TO THE BUG (D2): execIntent's crate rule has NO text/artist
      // slot, so artist/title searches silently lose their text and, with no
      // other constraint, return unknown → null → literal text fallback.
      const params: LibrarySearchParams = {
        bpmMin: r.bpmMin,
        bpmMax: r.bpmMax,
        energyMin: r.energyMin,
        energyMax: r.energyMax,
        genre: r.genre,
        neverPlayed: r.neverPlayed,
        dormantMonths: r.dormantMonths,
        minRating: r.minRating
      }
      const hasConstraint = Object.values(params).some((v) => v !== undefined)
      if (!hasConstraint) return null
      return execSearch(ctx, params, r.intent)
    }
    case 'lifecycle':
      return { intent: r.intent, kind: 'stats', stats: [], narration: 'Lifecycle breakdown.' }
    case 'health':
      return { intent: r.intent, kind: 'stats', stats: [], narration: 'Library health.' }
    case 'identity':
      return { intent: r.intent, kind: 'stats', stats: [], narration: 'Your sound.' }
    default:
      return null
  }
}

// ── bespoke HomeKind execution (mirrors homeStore.execute) ───────────────────

/** Minimal deterministic set builder (stand-in for setArchitect until wired). */
function buildSet(ctx: EvalCtx, bpm: number, lengthMin: number): Track[] {
  const lo = bpm - 8
  const hi = bpm + 2
  const pool = ctx.tracks
    .filter((t) => t.phantom !== true && t.bpm >= lo && t.bpm <= hi)
    .sort((a, b) => a.bpm - b.bpm)
  const avgLen = 5 // minutes/track assumption
  const want = Math.max(1, Math.round(lengthMin / avgLen))
  return pool.slice(0, want)
}

function dedupeGroups(ctx: EvalCtx): Track[] {
  const byKey = new Map<string, Track[]>()
  for (const t of ctx.tracks) {
    const key = `${t.title}|${t.artist}`.toLowerCase()
    byKey.set(key, [...(byKey.get(key) ?? []), t])
  }
  return Array.from(byKey.values())
    .filter((g) => g.length > 1)
    .flat()
}

// ── public entry ─────────────────────────────────────────────────────────────

export function resolveQuery(query: string, ctx: EvalCtx): EngineResult {
  const interp = interpretHome(query)
  const f = interp.filters

  // Route to the model ONLY when interpretHome couldn't parse the request
  // (its `ask` flag). Any parsed search — including sort-only ("fastest",
  // "most played track") — executes deterministically. (D6: one source of truth.)
  const useModel = interp.kind === 'generic' && f.kind === 'generic' && f.ask === true

  if (!useModel) {
    switch (f.kind) {
      case 'forgotten': {
        const params: LibrarySearchParams = {
          dormantMonths: f.window === '3 months' ? 3 : f.window === '6 months' ? 6 : 12,
          neverPlayed: f.neverLive || undefined,
          sort: 'oldest',
          limit: f.count
        }
        return { ...execSearch(ctx, params, 'forgotten'), intent: 'forgotten' }
      }
      case 'warmup': {
        const set = buildSet(ctx, f.bpm, f.length)
        return {
          intent: 'warmup',
          kind: set.length ? 'set' : 'empty',
          set,
          narration: set.length
            ? `${f.length}-min warm-up, ${set.length} tracks.`
            : 'Not enough tracks.'
        }
      }
      case 'after': {
        const q = f.source.toLowerCase()
        const source =
          ctx.tracks.find((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) ?? null
        if (!source) {
          return { intent: 'after', kind: 'empty', narration: `Couldn't find "${f.source}".` }
        }
        const graph = buildTransitionGraph(ctx.sequences)
        let cand = tracksAfter(graph, source.id)
          .map((a) => ctx.byId.get(a.trackId))
          .filter((t): t is Track => !!t)
        if (cand.length === 0) {
          // harmonic fallback (key + bpm neighbourhood)
          cand = searchLibrary(ctx.tracks, {
            keyExact: f.inKey ? source.key : undefined,
            bpmMin: source.bpm - 4,
            bpmMax: source.bpm + 6
          }).filter((t) => t.id !== source.id)
        }
        return {
          intent: 'after',
          kind: cand.length ? 'combos' : 'empty',
          tracks: cand.slice(0, 5),
          sourceTrack: source,
          narration: cand.length
            ? `Out of ${source.title}.`
            : `Nothing pairs out of ${source.title}.`
        }
      }
      case 'duplicates': {
        const dupes = dedupeGroups(ctx)
        return {
          intent: 'duplicates',
          kind: dupes.length ? 'tracks' : 'empty',
          tracks: dupes,
          narration: dupes.length ? `${dupes.length} duplicate entries.` : 'No duplicates.'
        }
      }
      case 'generic':
        return execSearch(ctx, f.params, 'generic')
    }
  }

  // model-off "handle anything" path: parseQuery → execIntent → literal text
  const parsed = parseQuery(query)
  if (parsed) {
    const r = execParsed(ctx, parsed)
    if (r && r.kind !== 'empty') return r
    if (r && r.kind === 'empty' && parsed.intent !== 'smart_filter') return r
  }

  // resolveViaText: the literal full-sentence search (the failure mode). When it
  // finds nothing, the engine did NOT understand the request — that's 'unknown',
  // NOT an honest 'empty' (which is reserved for a real filter that matched zero).
  const params: LibrarySearchParams = { text: query, sort: 'mostPlayed', limit: 25 }
  const tracks = searchLibrary(ctx.tracks, params)
  return {
    intent: 'text',
    kind: tracks.length ? 'tracks' : 'unknown',
    tracks,
    params,
    narration: tracks.length
      ? `tracks matching "${query}"`
      : `I couldn't map "${query}" to a search.`
  }
}
