/**
 * resolve.ts — THE intelligence resolution cascade (single source of truth).
 *
 * Lifted verbatim from the eval harness driver that passes all 210 matrix
 * prompts, then hardened with a normalization retry: the raw query runs first
 * (so proven behaviour never changes), and only when the engine cannot map it
 * does it retry with slang stripped and typos repaired against the user's own
 * library vocabulary ("oi mate give us some fisher" → "give me fisher").
 *
 * Both the live app (homeStore) and the harness (tests/eval/driver.ts) import
 * THIS module, so the engine the harness scores is the engine the app ships.
 * Everything here is pure, offline and renderer-safe.
 */

import type { LibrarySearchParams, Track } from '@/types'
import type { EngineResult, ResolveCtx, ResolveSession } from './types'
import { basicClean, buildVocab, normalizeQuery } from './normalize'

import { interpretHome } from '../utils/homeQuery'
import { detectStats } from '../utils/statsIntent'
import { computeStats } from '../../electron/algorithms/memory/stats'
import { detectGig } from '../utils/gigIntent'
import { computeGig } from '../../electron/algorithms/memory/gigHistory'
import { detectKnowledge } from '../utils/knowledge'
import { detectMaintenance } from '../utils/maintenanceIntent'
import { computeMaintenance } from '../../electron/algorithms/memory/maintenance'
import { detectSetBuild } from '../utils/setBuildIntent'
import { buildSet as buildSetEngine } from '../../electron/algorithms/memory/setBuilder'
import { detectDiscovery } from '../utils/discoveryIntent'
import { computeDiscovery } from '../../electron/algorithms/memory/discovery'
import { detectTransition } from '../utils/transitionIntent'
import { computeTransition } from '../../electron/algorithms/memory/transitionsEngine'
import { detectMood } from '../utils/moodIntent'
import { computeMood } from '../../electron/algorithms/memory/mood'
import { detectKeyBpm } from '../utils/keyBpmIntent'
import { computeKeyBpm } from '../../electron/algorithms/memory/keyBpm'
import { detectClarify } from '../utils/clarifyIntent'
import { detectVenue } from '../utils/venueIntent'
import { computeVenue } from '../../electron/algorithms/memory/venue'
import { detectBrief } from '../utils/briefIntent'
import { computeBrief } from '../../electron/algorithms/memory/brief'
import { detectAction } from '../utils/actionIntent'
import { searchLibrary } from '../../electron/algorithms/memory/librarySearch'
import { parseQuery, type ParsedQuery } from '../../electron/algorithms/memory/queryParser'
import { findForgottenGems } from '../../electron/algorithms/memory/forgottenGems'
import { buildTransitionGraph, tracksAfter } from '../../electron/algorithms/memory/transitionGraph'
import { analyzeEnds } from '../../electron/algorithms/memory/closers'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Mirror of queries.getTrackIdsPlayedWhere over the in-memory sessions. */
function trackIdsPlayedWhere(ctx: ResolveCtx, p: LibrarySearchParams): Set<string> | null {
  const hasGig =
    p.performedVenue != null ||
    p.performedCity != null ||
    p.performedAfter != null ||
    p.performedBefore != null ||
    p.performedEventType != null ||
    p.performedSetSlot != null
  if (!hasGig) return null
  const ci = (s?: string): string => (s ?? '').toLowerCase()
  const matchSession = (s: ResolveSession): boolean => {
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
function execSearch(ctx: ResolveCtx, params: LibrarySearchParams, intent: string): EngineResult {
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

// ── parseQuery intent execution (model-off "handle anything" floor) ──────────

function execParsed(ctx: ResolveCtx, r: ParsedQuery): EngineResult | null {
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

// ── bespoke HomeKind execution (mirrors homeStore.execute, in-memory) ────────

/** Minimal deterministic set builder used by the warm-up HomeKind. */
function buildWarmupSet(ctx: ResolveCtx, bpm: number, lengthMin: number): Track[] {
  const lo = bpm - 8
  const hi = bpm + 2
  const pool = ctx.tracks
    .filter((t) => t.phantom !== true && t.bpm >= lo && t.bpm <= hi)
    .sort((a, b) => a.bpm - b.bpm)
  const avgLen = 5 // minutes/track assumption
  const want = Math.max(1, Math.round(lengthMin / avgLen))
  return pool.slice(0, want)
}

function dedupeGroups(ctx: ResolveCtx): Track[] {
  const byKey = new Map<string, Track[]>()
  for (const t of ctx.tracks) {
    const key = `${t.title}|${t.artist}`.toLowerCase()
    byKey.set(key, [...(byKey.get(key) ?? []), t])
  }
  return Array.from(byKey.values())
    .filter((g) => g.length > 1)
    .flat()
}

// ── the detector cascade ─────────────────────────────────────────────────────

/**
 * Run only the specific intent detectors (most-specific first), or null when
 * none fires. This is the part homeStore consults BEFORE its bespoke paths —
 * the same priority order the harness proved.
 */
export function resolveDetectors(query: string, ctx: ResolveCtx): EngineResult | null {
  // DJ-theory questions answered from the curated KB (before data intents, since
  // definitional phrasings like "how long should my sets be" overlap with them).
  const know = detectKnowledge(query)
  if (know) {
    return {
      intent: `knowledge:${know.topic}`,
      kind: 'knowledge',
      knowledgeTopic: know.topic,
      narration: know.answer
    }
  }

  // Analytics questions are intercepted before the generic search path would
  // otherwise swallow them as a text search.
  const statHit = detectStats(query)
  if (statHit) {
    const a = computeStats(statHit, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: `stats:${statHit.metric}`,
      kind: a.kind,
      stats: a.stats,
      count: a.count,
      tracks: a.tracks,
      narration: a.narration
    }
  }

  const maint = detectMaintenance(query)
  if (maint) {
    const a = computeMaintenance(maint, ctx.tracks, ctx.playlists)
    return {
      intent: `maintenance:${maint.metric}`,
      kind: a.kind,
      tracks: a.tracks,
      stats: a.stats,
      count: a.count,
      needsConfirmation: a.needsConfirmation,
      narration: a.narration
    }
  }

  // Venue/crowd context (before gig, so "last time at a warehouse" beats the
  // generic "what did I play" last-session lookup).
  const ven = detectVenue(query)
  if (ven) {
    const a = computeVenue(ven, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: `venue:${ven.metric}`,
      kind: a.kind,
      tracks: a.tracks,
      sessions: a.sessionIds ? ctx.sessions.filter((s) => a.sessionIds!.includes(s.id)) : undefined,
      narration: a.narration
    }
  }

  // Forward-looking pre-gig Brief ("what should I play at Fabric"). After the
  // backward-looking venue lookup, before gig recall, so "what did I play" stays
  // recall and "what should I play at X" becomes a game plan.
  const briefHit = detectBrief(query)
  if (briefHit) {
    const a = computeBrief(briefHit, ctx.tracks, ctx.sessions, ctx.now)
    const tracks = [...a.proven, ...a.bring]
    return {
      intent: `brief:${briefHit.venue ?? briefHit.eventType ?? 'gig'}`,
      kind: tracks.length ? 'tracks' : 'empty',
      tracks,
      narration: a.narration
    }
  }

  const gigHit = detectGig(query)
  if (gigHit) {
    const a = computeGig(gigHit, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: `gig:${gigHit.metric}`,
      kind: a.kind,
      sessions: a.sessions as ResolveSession[] | undefined,
      tracks: a.tracks,
      stats: a.stats,
      count: a.count,
      narration: a.narration
    }
  }

  const trans = detectTransition(query)
  if (trans) {
    const a = computeTransition(trans, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: `transition:${trans.metric}`,
      kind: a.kind,
      tracks: a.tracks,
      sequences: a.sequences
        ? a.sequences.map((s) => ({ tracks: s.tracks, count: s.count }))
        : undefined,
      sourceTrack: a.sourceTrack,
      narration: a.narration
    }
  }

  const disc = detectDiscovery(query)
  if (disc) {
    const a = computeDiscovery(disc, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: `discovery:${disc.metric}`,
      kind: a.kind,
      tracks: a.tracks,
      sourceTrack: a.sourceTrack,
      narration: a.narration
    }
  }

  const setHit = detectSetBuild(query)
  if (setHit) {
    const a = buildSetEngine(setHit, ctx.tracks, ctx.sessions, ctx.now)
    return {
      intent: 'set_build',
      kind: a.kind,
      set: a.set,
      tracks: a.tracks,
      stats: a.stats,
      narration: a.narration
    }
  }

  // Mood/vibe — after the more-specific intents (so "build me a set" wins).
  const mood = detectMood(query)
  if (mood) {
    const a = computeMood(mood, ctx.tracks)
    return { intent: `mood:${mood}`, kind: a.kind, tracks: a.tracks, narration: a.narration }
  }

  // Precise key/BPM queries (after set-build so "build a set at 128 bpm" wins).
  const kb = detectKeyBpm(query)
  if (kb) {
    const a = computeKeyBpm(kb, ctx.tracks)
    return {
      intent: `keybpm:${kb.metric}`,
      kind: a.kind,
      tracks: a.tracks,
      count: a.count,
      sourceTrack: a.sourceTrack,
      narration: a.narration
    }
  }

  // Export / import actions — describe (and in-app, trigger) the side-effecting flow.
  const act = detectAction(query)
  if (act) {
    return {
      intent: `action:${act.op}`,
      kind: 'action',
      needsConfirmation: true,
      narration: act.narration
    }
  }

  // Underspecified / adversarial / destructive → clarify, confirm, or reframe.
  const clar = detectClarify(query)
  if (clar) {
    if (clar.mode === 'clarify')
      return {
        intent: 'clarify',
        kind: 'clarify',
        clarifyQuestion: clar.question,
        narration: clar.question ?? ''
      }
    if (clar.mode === 'action')
      return {
        intent: 'action',
        kind: 'action',
        needsConfirmation: true,
        narration: clar.narration ?? ''
      }
    return { intent: 'reframe', kind: 'knowledge', narration: clar.narration ?? '' }
  }

  return null
}

// ── single resolution pass ───────────────────────────────────────────────────

function resolveOnce(query: string, ctx: ResolveCtx): EngineResult {
  const hit = resolveDetectors(query, ctx)
  if (hit) return hit

  const interp = interpretHome(query)
  const f = interp.filters

  // Route onward ONLY when interpretHome couldn't parse the request (its `ask`
  // flag). Any parsed search — including sort-only ("fastest", "most played
  // track") — executes deterministically. (D6: one source of truth.)
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
        const set = buildWarmupSet(ctx, f.bpm, f.length)
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

  // The literal full-sentence search. When it finds nothing, the engine did NOT
  // understand the request — that's 'unknown', NOT an honest 'empty' (which is
  // reserved for a real filter that matched zero).
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

// ── public entry ─────────────────────────────────────────────────────────────

/**
 * Resolve a query against the world. Raw query first (proven behaviour), then
 * — only when the engine couldn't map it, or mapped it to a zero-result text
 * miss — a second pass with slang stripped and typos repaired against the
 * user's own library vocabulary. An honest 'empty' from a real filter is kept
 * unless the normalized pass finds a genuinely better answer.
 */
export function resolveQuery(query: string, ctx: ResolveCtx): EngineResult {
  const first = resolveOnce(query, ctx)
  if (first.kind !== 'unknown' && first.kind !== 'empty') return first

  const vocab = buildVocab(ctx.tracks)
  const normalized = normalizeQuery(query, vocab)
  if (!normalized || normalized === basicClean(query)) return first

  const second = resolveOnce(normalized, ctx)
  if (second.kind !== 'unknown' && second.kind !== 'empty') {
    return { ...second, correctedQuery: normalized }
  }
  // Prefer the honest first answer; fall to the second only if the first was a
  // hard 'unknown' and the second at least understood the request.
  if (first.kind === 'unknown' && second.kind === 'empty') {
    return { ...second, correctedQuery: normalized }
  }
  return first
}

/**
 * Normalize a query for downstream consumers (the local model prompt, the
 * last-resort text search). Exposed so homeStore shares one normalizer.
 */
export function normalizeForEngine(query: string, tracks: readonly Track[]): string {
  return normalizeQuery(query, buildVocab(tracks))
}
