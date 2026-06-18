/**
 * memoryService.ts — Orchestration layer for the memory/intelligence engine.
 *
 * Loads data from the DB once per call (no long-lived cache), runs the pure
 * engine functions, and returns serialisable results ready for IPC.
 */

import { getDb } from '../db/schema'
import {
  getAllTracks,
  getAllSets,
  getSessions,
  getSessionTracks,
  getTrackIdsPlayedWhere,
  querySessions,
  createCrate,
  getCrates,
  updateCrate,
  deleteCrate,
  getDismissedDuplicateGroupKeys,
  dismissDuplicateGroup,
  undismissDuplicateGroup,
  setTrackLifecycle
} from '../db/queries'
import type { SmartCrateRow } from '../db/queries'
import { findForgottenGems } from '../algorithms/memory/forgottenGems'
import { evaluateCrate, SEED_CRATES } from '../algorithms/memory/smartCrates'
import { classifyAll } from '../algorithms/memory/lifecycle'
import {
  buildTransitionGraph,
  tracksAfter,
  terminalTracks
} from '../algorithms/memory/transitionGraph'
import { buildIdentity } from '../algorithms/memory/identity'
import { analyzeHealth } from '../algorithms/memory/libraryHealth'
import { analyzeEnds } from '../algorithms/memory/closers'
import { searchLibrary } from '../algorithms/memory/librarySearch'
import type {
  GemResult,
  SmartCrate,
  CrateRule,
  LifecycleState,
  IdentitySnapshot,
  HealthReport,
  Track,
  CrateWithCount,
  LifecycleCounts,
  ComboResult,
  LibrarySearchParams,
  SessionFilter,
  PlaySession
} from '../../src/types'

export type { CrateWithCount, LifecycleCounts, ComboResult } from '../../src/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build ordered track-id sequences from BOTH performed sessions and saved sets.
 * Each sequence = one session or set's ordered track ids.
 */
async function buildSequences(): Promise<string[][]> {
  const db = getDb()
  const sessions = getSessions(db)
  const sequences: string[][] = []

  // Performed sessions — verified evidence only. A "Mark as Performed" claim
  // (method='user-asserted') duplicates its saved set's sequence, which is
  // already included below; counting it again would double-weight transitions
  // on the strength of an unverified click.
  for (const session of sessions) {
    if (session.method === 'user-asserted') continue
    if (session.trackCount < 2) continue
    const sessionTracks = getSessionTracks(db, session.id)
    const ids = sessionTracks.sort((a, b) => a.playOrder - b.playOrder).map((st) => st.trackId)
    if (ids.length >= 2) sequences.push(ids)
  }

  // Saved sets
  const sets = getAllSets(db)
  for (const s of sets) {
    if (s.tracks.length < 2) continue
    const ids = s.tracks
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((st) => st.trackId)
    if (ids.length >= 2) sequences.push(ids)
  }

  return sequences
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getGems(): Promise<GemResult[]> {
  const tracks = getAllTracks(getDb())
  return findForgottenGems(tracks)
}

export async function listCrates(): Promise<CrateWithCount[]> {
  const db = getDb()
  const tracks = getAllTracks(db)

  // Saved crates from DB
  const savedRows: SmartCrateRow[] = getCrates(db)
  const savedCrates: SmartCrate[] = savedRows.map((row) => ({
    id: row.id,
    name: row.name,
    rules: JSON.parse(row.rulesJson) as CrateRule[],
    match: row.matchMode
  }))
  const savedIds = new Set(savedCrates.map((c) => c.id))

  // Seeds not overridden by saved crates
  const seeds = SEED_CRATES.filter((sc) => !savedIds.has(sc.id))

  const result: CrateWithCount[] = []

  for (const crate of seeds) {
    const evalTracks = evaluateCrate(crate, tracks)
    result.push({ ...crate, trackCount: evalTracks.length, isSeed: true })
  }

  for (const crate of savedCrates) {
    const evalTracks = evaluateCrate(crate, tracks)
    const isSeed = SEED_CRATES.some((sc) => sc.id === crate.id)
    result.push({ ...crate, trackCount: evalTracks.length, isSeed })
  }

  return result
}

export async function evaluateCrateById(idOrCrate: string | SmartCrate): Promise<Track[]> {
  const db = getDb()
  const tracks = getAllTracks(db)

  let crate: SmartCrate | null = null

  if (typeof idOrCrate === 'string') {
    // Try seed first, then DB
    crate = SEED_CRATES.find((sc) => sc.id === idOrCrate) ?? null
    if (!crate) {
      const savedRows = getCrates(db)
      const row = savedRows.find((r) => r.id === idOrCrate)
      if (row) {
        crate = {
          id: row.id,
          name: row.name,
          rules: JSON.parse(row.rulesJson) as CrateRule[],
          match: row.matchMode
        }
      }
    }
  } else {
    crate = idOrCrate
  }

  if (!crate) return []
  return evaluateCrate(crate, tracks)
}

export async function saveCrate(crate: SmartCrate): Promise<void> {
  const db = getDb()
  const existing = getCrates(db)
  const row: SmartCrateRow = {
    id: crate.id,
    name: crate.name,
    rulesJson: JSON.stringify(crate.rules),
    matchMode: crate.match,
    createdAt: new Date().toISOString()
  }

  if (existing.some((r) => r.id === crate.id)) {
    updateCrate(db, crate.id, {
      name: crate.name,
      rulesJson: JSON.stringify(crate.rules),
      matchMode: crate.match
    })
  } else {
    createCrate(db, row)
  }
}

export async function deleteCrateById(id: string): Promise<void> {
  deleteCrate(getDb(), id)
}

export async function getLifecycleCounts(): Promise<LifecycleCounts> {
  const tracks = getAllTracks(getDb())
  const stateMap = classifyAll(tracks)

  const counts: LifecycleCounts = {
    new: 0,
    untested: 0,
    testing: 0,
    active: 0,
    peak: 0,
    occasional: 0,
    archive: 0,
    forgotten: 0
  }

  for (const state of stateMap.values()) {
    counts[state as LifecycleState]++
  }

  return counts
}

export async function getCombosFor(trackId: string): Promise<ComboResult[]> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))
  const sequences = await buildSequences()
  const graph = buildTransitionGraph(sequences)
  const nexts = tracksAfter(graph, trackId)

  const results: ComboResult[] = []
  for (const { trackId: nextId, count } of nexts) {
    const track = trackMap.get(nextId)
    if (track) {
      results.push({ track, count })
    }
  }

  return results
}

/**
 * Tracks the DJ has historically ended on but never (or rarely) transitions
 * out of — surfaced in the Combos section so the user can revisit them.
 */
export async function getDeadEnds(): Promise<ComboResult[]> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))
  const ranked = terminalTracks(await buildSequences())
  const results: ComboResult[] = []
  for (const { trackId, count } of ranked) {
    const track = trackMap.get(trackId)
    if (track) results.push({ track, count })
  }
  return results
}

/**
 * Cheap lookup for the suggestion ranker: candidate trackId → number of times
 * the DJ has played that track immediately after `trackId` in their sessions
 * and saved sets. Skips track hydration since the suggestion ranker already
 * has the library.
 */
export async function getComboLookupFor(trackId: string): Promise<Map<string, number>> {
  const graph = buildTransitionGraph(await buildSequences())
  const lookup = new Map<string, number>()
  for (const { trackId: nextId, count } of tracksAfter(graph, trackId)) {
    lookup.set(nextId, count)
  }
  return lookup
}

/**
 * The DJ's most-used track→track transitions, pulled from every adjacent pair
 * across their saved sets and performed sessions, ranked by how often the pair
 * recurs. This answers "what are my most common 2-song transitions?" directly —
 * far more useful than rare 3-track chains.
 */
export async function getTopSequences(): Promise<
  { trackIds: string[]; tracks: Track[]; count: number }[]
> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))
  const graph = buildTransitionGraph(await buildSequences())

  const pairs: { from: string; to: string; count: number }[] = []
  for (const [from, nexts] of graph.adjacency) {
    for (const [to, count] of nexts) pairs.push({ from, to, count })
  }
  pairs.sort((a, b) => b.count - a.count)

  return pairs
    .slice(0, 30)
    .map((p) => {
      const from = trackMap.get(p.from)
      const to = trackMap.get(p.to)
      return from && to ? { trackIds: [p.from, p.to], tracks: [from, to], count: p.count } : null
    })
    .filter((x): x is { trackIds: string[]; tracks: Track[]; count: number } => x !== null)
}

export async function getIdentity(): Promise<IdentitySnapshot> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const sessions = getSessions(db)

  const sessionDtos = sessions.map((s) => ({
    performedAt: s.performedAt,
    trackIds: [] as string[] // populated below
  }))

  // For identity's tasteTimeline we need session track ids too
  for (let i = 0; i < sessions.length; i++) {
    const st = getSessionTracks(db, sessions[i].id)
    sessionDtos[i].trackIds = st.map((t) => t.trackId)
  }

  return buildIdentity(tracks, sessionDtos)
}

export async function getHealth(): Promise<HealthReport> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const dismissedGroupKeys = getDismissedDuplicateGroupKeys(db)
  return analyzeHealth(tracks, { dismissedGroupKeys })
}

/**
 * "Keep all" on a duplicate group: record the normalised key so this group
 * stops appearing in future health reports without touching the underlying
 * tracks.
 */
export async function dismissDuplicate(normalisedKey: string): Promise<void> {
  dismissDuplicateGroup(getDb(), normalisedKey)
}

/** Reverse the above, for testing or admin use. */
export async function undismissDuplicate(normalisedKey: string): Promise<void> {
  undismissDuplicateGroup(getDb(), normalisedKey)
}

/**
 * "Keep this one, archive the others" — mark every track in `archiveIds` as
 * lifecycle 'archive' (user override) and dismiss the group's normalised key
 * so it doesn't re-surface.
 */
export async function resolveDuplicateGroup(
  normalisedKey: string,
  archiveIds: string[]
): Promise<void> {
  const db = getDb()
  for (const id of archiveIds) {
    setTrackLifecycle(db, id, 'archive', 'user')
  }
  dismissDuplicateGroup(db, normalisedKey)
}

/** Deterministic, model-free library search powering Intelligence conversations. */
export async function search(params: LibrarySearchParams): Promise<Track[]> {
  const db = getDb()
  // If the query carries gig constraints (venue/city/date-range/event/slot),
  // resolve them to the set of track ids played in matching sessions and
  // intersect with the in-memory track filters. Returns null when no gig
  // constraint is present, so ordinary searches are unaffected.
  const allowedTrackIds = getTrackIdsPlayedWhere(db, {
    venue: params.performedVenue,
    city: params.performedCity,
    after: params.performedAfter,
    before: params.performedBefore,
    eventType: params.performedEventType,
    setSlot: params.performedSetSlot
  })
  return searchLibrary(getAllTracks(db), params, allowedTrackIds)
}

/** Session-oriented query powering "all sets I played in July 2025" / "my festival sets". */
export async function searchSessions(filter: SessionFilter): Promise<PlaySession[]> {
  return querySessions(getDb(), filter)
}

/** Best openers / closers across performed sessions + saved sets, joined to track objects. */
export async function getEnds(): Promise<{ openers: ComboResult[]; closers: ComboResult[] }> {
  const db = getDb()
  const tracks = getAllTracks(db)
  const trackMap = new Map(tracks.map((t) => [t.id, t]))
  const { openers, closers } = analyzeEnds(await buildSequences())
  const join = (ranked: { trackId: string; count: number }[]): ComboResult[] =>
    ranked
      .map(({ trackId, count }) => {
        const track = trackMap.get(trackId)
        return track ? { track, count } : null
      })
      .filter((x): x is ComboResult => x !== null)
  return { openers: join(openers), closers: join(closers) }
}

/** Camelot adjacency: same wheel number, relative major/minor, or ±1 number. */
function harmonicallyClose(a: string, b: string): boolean {
  const pa = a.match(/^(\d{1,2})([ab])$/i)
  const pb = b.match(/^(\d{1,2})([ab])$/i)
  if (!pa || !pb) return false
  const na = +pa[1]
  const nb = +pb[1]
  const la = pa[2].toLowerCase()
  const lb = pb[2].toLowerCase()
  if (na === nb) return true // same key or relative major/minor
  if (la === lb && (Math.abs(na - nb) === 1 || Math.abs(na - nb) === 11)) return true // ±1 around the wheel
  return false
}

/**
 * Find tracks similar to a seed by sonic proximity — BPM, energy, harmonic key,
 * genre, and shared auto-tags. Used for "songs like X" / "more like that".
 */
export async function findSimilar(trackId: string, count = 12): Promise<Track[]> {
  const tracks = getAllTracks(getDb()).filter((t) => t.phantom !== true)
  const seed = tracks.find((t) => t.id === trackId)
  if (!seed) return []
  const seedTags = new Set((seed.tags ?? []).map((x) => x.value.toLowerCase()))
  const score = (t: Track): number => {
    let s = 0
    s += Math.max(0, 8 - Math.abs((t.bpm ?? 0) - (seed.bpm ?? 0))) // ±8 BPM band
    s += Math.max(0, 5 - Math.abs((t.energy ?? 0) - (seed.energy ?? 0))) * 1.2
    if (t.genre && seed.genre && t.genre.toLowerCase() === seed.genre.toLowerCase()) s += 6
    if (t.key && seed.key && harmonicallyClose(seed.key, t.key)) s += 5
    s += (t.tags ?? []).filter((x) => seedTags.has(x.value.toLowerCase())).length * 1.5
    return s
  }
  return tracks
    .filter((t) => t.id !== trackId)
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map((x) => x.t)
}

/** Fuzzy-resolve a free-text "title / artist" query to a single library track. */
export function findTrackByQuery(query: string): Track | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const tracks = getAllTracks(getDb())
  let best: Track | null = null
  let bestScore = 0
  for (const t of tracks) {
    const hay = `${t.title} ${t.artist}`.toLowerCase()
    let score = 0
    if (hay.includes(q)) score = q.length / hay.length + 0.5
    else if (t.title.toLowerCase().includes(q)) score = 0.4
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return best
}

// Re-export SmartCrateRow so main.ts can import it if needed
export type { SmartCrateRow }
