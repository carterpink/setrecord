/**
 * homeStore.ts — state for the conversational Home surface.
 *
 * Holds the live conversation `turns` (each with its editable filter model and
 * real, hydrated results), runs/refines turns against the real engines via the
 * IPC bridge, and persists a lightweight (result-free) history that re-runs on
 * load so old chats always reflect the current library.
 */

import { create } from 'zustand'
import type {
  Track,
  ComboResult,
  SetTrack,
  ArchitectParams,
  LibrarySearchParams,
  RecallRoute
} from '@/types'
import {
  interpretHome,
  forgottenParams,
  readSummary,
  type HomeFilters,
  type HomeKind,
  type ForgottenFilters
} from '@/utils/homeQuery'
import { useLibraryStore } from '@/stores/libraryStore'
import { isProUser } from '@/utils/premium'

const CONVO_KEY = 'setsense-home-convos'
const MAX_CONVOS = 50

/** A duplicate group resolved into keep/drop tracks for the cleanup card. */
export interface DupeGroupView {
  normalisedKey: string
  keep: Track
  drop: Track[]
  reason: string
}

/** A candidate "what to play next" with its evidence. */
export interface AfterCandidate {
  track: Track
  /** Recorded times the user has actually mixed source → track (0 for harmonic suggestions). */
  count: number
}

export type HomeResult =
  | { kind: 'forgotten'; tracks: Track[]; requested: number }
  | {
      kind: 'warmup'
      setTracks: SetTrack[]
      params: ArchitectParams
      startBpm: number
      targetBpm: number
      name: string
    }
  | {
      kind: 'after'
      source: Track | null
      sourceQuery: string
      candidates: AfterCandidate[]
      harmonic: boolean
    }
  | { kind: 'duplicates'; groups: DupeGroupView[]; total: number }
  | { kind: 'tracks'; tracks: Track[]; narration: string }
  | { kind: 'combos'; combos: ComboResult[]; narration: string }
  | { kind: 'sequences'; sequences: { tracks: Track[]; count: number }[]; narration: string }
  | { kind: 'stats'; stats: { label: string; value: string }[]; narration: string }
  | { kind: 'count'; count: number; sample: Track[]; narration: string }
  | { kind: 'empty'; note: string }

export interface HomeTurn {
  id: string
  query: string
  kind: HomeKind
  filters: HomeFilters
  followups: string[]
  /** True while the engine is working. */
  pending: boolean
  /** True when this turn needs the model (drives the "happens once" framing). */
  usesModel: boolean
  result?: HomeResult
  summary: string
}

/** Persisted shape — no heavy results; re-run on load. */
interface PersistedTurn {
  id: string
  query: string
  kind: HomeKind
  filters: HomeFilters
  followups: string[]
  summary: string
}
interface HomeConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  turns: PersistedTurn[]
}

const uid = (): string => crypto.randomUUID()

function api(): Window['setsense'] | undefined {
  return typeof window !== 'undefined' ? window.setsense : undefined
}

function trackMap(): Map<string, Track> {
  return new Map(useLibraryStore.getState().tracks.map((t) => [t.id, t]))
}

function loadConversations(): HomeConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CONVO_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as HomeConversation[]) : []
  } catch {
    return []
  }
}

function saveConversations(convos: HomeConversation[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONVO_KEY, JSON.stringify(convos.slice(0, MAX_CONVOS)))
  } catch {
    /* quota — drop silently */
  }
}

// ─── Result runners (the real wiring) ────────────────────────────────────────

const FMT_RANK: Record<string, number> = {
  wav: 5,
  aiff: 5,
  flac: 4,
  alac: 4,
  aac: 2,
  m4a: 2,
  mp3: 1
}

/** Pick the "best" copy in a duplicate group given the keep strategy. */
function pickKeep(tracks: Track[], keep: 'Highest quality' | 'Newest'): Track {
  const sorted = [...tracks].sort((a, b) => {
    if (keep === 'Newest') return (b.dateAdded ?? '').localeCompare(a.dateAdded ?? '')
    // Highest quality: bitrate, then container format rank, then file size.
    const br = (b.bitrate ?? 0) - (a.bitrate ?? 0)
    if (br !== 0) return br
    const fr = (FMT_RANK[b.format] ?? 0) - (FMT_RANK[a.format] ?? 0)
    if (fr !== 0) return fr
    return (b.fileSize ?? 0) - (a.fileSize ?? 0)
  })
  return sorted[0]
}

function dupeReason(keep: Track, drop: Track[]): string {
  const d = drop[0]
  if (d && d.format !== keep.format) return 'same track, lower-quality copy'
  if (d && (d.bitrate ?? 0) < (keep.bitrate ?? 0)) return 'same track, lower bitrate copy'
  return 'duplicate import'
}

async function runForgotten(f: HomeFilters & { kind: 'forgotten' }): Promise<HomeResult> {
  const s = api()
  if (!s) return { kind: 'empty', note: 'Library engine unavailable in preview.' }
  const tracks = await s.recallSearch(forgottenParams(f))
  if (tracks.length === 0)
    return {
      kind: 'empty',
      note: 'Nothing’s gathering dust in that window — try a longer one, or drop “never played live”.'
    }
  return { kind: 'forgotten', tracks, requested: f.count }
}

function architectFromWarmup(f: HomeFilters & { kind: 'warmup' }): ArchitectParams {
  const target = f.bpm
  // A warm-up climbs into its peak; open ~6 BPM below the target.
  const bpmMin = Math.max(60, target - 8)
  const bpmMax = target + 2
  return {
    targetDuration: f.length,
    vibe: 'warmup',
    slotTime: 'warmup',
    crowdAge: 'mixed',
    venueType: 'club',
    bpmMin,
    bpmMax,
    harmonicMixing: true,
    followEnergyCurve: true,
    energyCurveType: f.shape === 'Slow burn' ? 'rise' : 'wave'
  }
}

async function runWarmup(f: HomeFilters & { kind: 'warmup' }): Promise<HomeResult> {
  const s = api()
  if (!s) return { kind: 'empty', note: 'Set builder unavailable in preview.' }
  const params = architectFromWarmup(f)
  const setTracks = await s.buildSet(params)
  if (!setTracks || setTracks.length === 0)
    return {
      kind: 'empty',
      note: 'Couldn’t find enough tracks for that — try widening the BPM or shortening the set.'
    }
  const bpms = setTracks.map((st) => st.track.bpm).filter((b) => b > 0)
  return {
    kind: 'warmup',
    setTracks,
    params,
    startBpm: Math.round(bpms[0] ?? f.bpm - 6),
    targetBpm: Math.round(Math.max(...bpms, f.bpm)),
    name: `${f.length}-min warm-up`
  }
}

async function runAfter(f: HomeFilters & { kind: 'after' }): Promise<HomeResult> {
  const s = api()
  if (!s) return { kind: 'empty', note: 'Library engine unavailable in preview.' }
  const matches = await s.recallSearch({ text: f.source, limit: 1 })
  const source = matches[0] ?? null
  if (!source)
    return {
      kind: 'empty',
      note: `I couldn’t find “${f.source}” in your library. Try the exact title or artist.`
    }

  const combos = await s.recallCombos(source.id)
  let candidates: AfterCandidate[] = combos.map((c) => ({ track: c.track, count: c.count }))
  let harmonic = false

  if (candidates.length === 0) {
    // No recorded transitions yet — fall back to harmonic neighbours.
    harmonic = true
    const near = await s.recallSearch({
      keyExact: f.inKey && source.key ? source.key : undefined,
      bpmMin: source.bpm ? Math.round(source.bpm - 4) : undefined,
      bpmMax: source.bpm ? Math.round(source.bpm + 6) : undefined,
      sort: 'random',
      limit: 8
    })
    candidates = near.filter((t) => t.id !== source.id).map((t) => ({ track: t, count: 0 }))
  }

  // "Lift" prefers higher-energy candidates; "Hold" keeps them close to source.
  candidates.sort((a, b) => {
    if (f.energy === 'Lift') return (b.track.energy ?? 0) - (a.track.energy ?? 0)
    return (
      Math.abs((a.track.energy ?? 0) - source.energy) -
      Math.abs((b.track.energy ?? 0) - source.energy)
    )
  })

  if (candidates.length === 0)
    return { kind: 'empty', note: `Nothing pairs cleanly out of ${source.title} yet.` }
  return {
    kind: 'after',
    source,
    sourceQuery: f.source,
    candidates: candidates.slice(0, 5),
    harmonic
  }
}

async function runDuplicates(f: HomeFilters & { kind: 'duplicates' }): Promise<HomeResult> {
  const s = api()
  if (!s) return { kind: 'empty', note: 'Library engine unavailable in preview.' }
  const health = await s.recallHealth()
  const map = trackMap()
  const groups: DupeGroupView[] = []
  for (const g of health.duplicateGroups) {
    const tracks = g.ids.map((id) => map.get(id)).filter((t): t is Track => t !== undefined)
    if (tracks.length < 2) continue
    const keep = pickKeep(tracks, f.keep)
    const drop = tracks.filter((t) => t.id !== keep.id)
    groups.push({ normalisedKey: g.normalisedKey, keep, drop, reason: dupeReason(keep, drop) })
  }
  if (groups.length === 0)
    return { kind: 'empty', note: 'No duplicates to clear — your library’s clean on that front.' }
  return { kind: 'duplicates', groups, total: groups.length }
}

async function runGeneric(f: HomeFilters & { kind: 'generic' }): Promise<HomeResult> {
  const s = api()
  if (!s) return { kind: 'empty', note: 'Library engine unavailable in preview.' }
  const tracks = await s.recallSearch(f.params)
  if (tracks.length === 0)
    return {
      kind: 'empty',
      note: 'Nothing matches that — try widening the BPM range, dropping a filter, or a different genre.'
    }
  return { kind: 'tracks', tracks, narration: f.narration || `${tracks.length} tracks.` }
}

async function execute(filters: HomeFilters): Promise<HomeResult> {
  switch (filters.kind) {
    case 'forgotten':
      return runForgotten(filters)
    case 'warmup':
      return runWarmup(filters)
    case 'after':
      return runAfter(filters)
    case 'duplicates':
      return runDuplicates(filters)
    case 'generic':
      return runGeneric(filters)
  }
}

// ─── Model-routed resolution (the "handle anything" path) ────────────────────

const PRETTY_SORT: Record<string, string> = {
  mostPlayed: 'most played first',
  leastPlayed: 'rarest first',
  recent: 'newest first',
  oldest: 'oldest first',
  rating: 'highest-rated first',
  random: 'shuffled'
}

/** Translate a model route into deterministic search params. */
function routeToParams(r: RecallRoute): LibrarySearchParams {
  const p: LibrarySearchParams = {}
  const text = [r.text, r.artist].filter(Boolean).join(' ').trim()
  if (text) p.text = text
  if (r.genre) p.genre = r.genre
  if (r.bpmMin != null) p.bpmMin = r.bpmMin
  if (r.bpmMax != null) p.bpmMax = r.bpmMax
  if (r.energyMin != null) p.energyMin = r.energyMin
  if (r.energyMax != null) p.energyMax = r.energyMax
  if (r.keyExact) p.keyExact = r.keyExact.toUpperCase()
  if (r.minRating != null) p.minRating = r.minRating
  if (r.neverPlayed) p.neverPlayed = true
  if (r.dormantMonths != null) p.dormantMonths = r.dormantMonths
  if (r.durationMinSec != null) p.durationMinSec = r.durationMinSec
  if (r.durationMaxSec != null) p.durationMaxSec = r.durationMaxSec
  if (r.addedWithinDays != null)
    p.addedAfter = new Date(Date.now() - r.addedWithinDays * 86400000).toISOString()
  if (r.tags?.length) p.tags = r.tags
  if (r.sort) p.sort = r.sort
  p.limit = r.limit && r.limit > 0 ? r.limit : 25
  return p
}

/** A short human summary of search params for the "I read that as" line. */
function describeParams(p: LibrarySearchParams): string {
  const parts: string[] = []
  if (p.energyMin != null && p.energyMin >= 8) parts.push('high-energy')
  else if (p.energyMax != null && p.energyMax <= 4) parts.push('chilled')
  else if (p.energyMin === 4 && p.energyMax === 6) parts.push('groovy')
  if (p.genre) parts.push(p.genre)
  if (p.tags?.length) parts.push(p.tags.join(' / '))
  let head = parts.join(' ') + (p.text ? ` “${p.text}”` : '') + ' tracks'
  head = head.trim().replace(/^tracks$/, 'tracks')
  const tail: string[] = []
  if (p.bpmMin != null && p.bpmMax != null) tail.push(`${p.bpmMin}–${p.bpmMax} bpm`)
  if (p.keyExact) tail.push(`in ${p.keyExact}`)
  if (p.minRating != null) tail.push(`${p.minRating}★+`)
  if (p.neverPlayed) tail.push('never played')
  if (p.dormantMonths != null) tail.push(`untouched ${p.dormantMonths}+ mo`)
  if (p.addedAfter) tail.push('recently added')
  if (p.sort && PRETTY_SORT[p.sort]) tail.push(PRETTY_SORT[p.sort])
  return [head, ...tail].filter(Boolean).join(', ')
}

function snapWindow(months: number): ForgottenFilters['window'] {
  if (months <= 4) return '3 months'
  if (months <= 9) return '6 months'
  return '12 months'
}

const genericAsk = (query: string, narration: string): HomeFilters => ({
  kind: 'generic',
  params: {},
  ask: true,
  query,
  narration
})

/** A full patch applied to a turn once resolved. */
interface TurnPatch {
  kind: HomeKind
  filters: HomeFilters
  followups: string[]
  result: HomeResult
}

/**
 * The catch-all path: ask the local model to route the request, then execute the
 * routed intent against the real engines. Returns null only when there's no
 * sensible result and the caller should fall back to a plain text search.
 */
async function resolveViaModel(
  query: string,
  contextJson: string | null
): Promise<TurnPatch | null> {
  const s = api()
  if (!s?.recallAiRoute) return null
  let r: RecallRoute
  try {
    r = await s.recallAiRoute(query, contextJson ?? undefined)
  } catch {
    return null
  }

  switch (r.intent) {
    case 'similar_to': {
      const seedQ = r.trackQuery || r.text || query
      const seed = (await s.recallSearch({ text: seedQ, limit: 1 }))[0]
      if (!seed)
        return {
          kind: 'generic',
          filters: genericAsk(query, `tracks like “${seedQ}”`),
          followups: ['Surprise me', 'My most played'],
          result: { kind: 'empty', note: `I couldn’t find “${seedQ}” in your library.` }
        }
      const tracks = await s.recallSimilar(seed.id, 20)
      return {
        kind: 'generic',
        filters: genericAsk(query, `tracks like ${seed.title}`),
        followups: [
          'More like the first one',
          'Build a set from these',
          'Only the never-played ones'
        ],
        result: tracks.length
          ? {
              kind: 'tracks',
              tracks,
              narration: `Closest matches to ${seed.title} — ${seed.artist}.`
            }
          : { kind: 'empty', note: `Nothing close to ${seed.title} surfaced.` }
      }
    }
    case 'build_set': {
      const f: HomeFilters = {
        kind: 'warmup',
        bpm: r.targetBpm ?? 126,
        length: r.lengthMinutes ?? 90,
        shape: r.shape === 'steady' ? 'Steady' : 'Slow burn'
      }
      return {
        kind: 'warmup',
        filters: f,
        followups: ['A touch slower to start', 'Open it in Build', 'Make it longer'],
        result: await runWarmup(f)
      }
    }
    case 'tracks_after': {
      const f: HomeFilters = {
        kind: 'after',
        source: r.trackQuery || r.text || query,
        inKey: true,
        energy: 'Hold'
      }
      return {
        kind: 'after',
        filters: f,
        followups: [
          'Take the energy up instead',
          'Keep it strictly in key',
          'Build the rest of the hour'
        ],
        result: await runAfter(f)
      }
    }
    case 'forgotten_gems': {
      const f: HomeFilters = {
        kind: 'forgotten',
        window: r.dormantMonths != null ? snapWindow(r.dormantMonths) : '6 months',
        neverLive: !!r.neverPlayed,
        count: r.limit && r.limit > 0 ? r.limit : 10
      }
      return {
        kind: 'forgotten',
        filters: f,
        followups: [
          'Only the ones under 124 bpm',
          'Build a set from these',
          'Surprise me with one'
        ],
        result: await runForgotten(f)
      }
    }
    case 'duplicates': {
      const f: HomeFilters = { kind: 'duplicates', match: 'Audio', keep: 'Highest quality' }
      return {
        kind: 'duplicates',
        filters: f,
        followups: ['Show my library health', 'Find my forgotten gems'],
        result: await runDuplicates(f)
      }
    }
    case 'count': {
      const params = { ...routeToParams(r), limit: 100000 }
      const tracks = await s.recallSearch(params)
      return {
        kind: 'generic',
        filters: genericAsk(query, `count — ${describeParams(routeToParams(r))}`),
        followups: ['Show them', 'Only the never-played ones', 'What’s my sound?'],
        result: {
          kind: 'count',
          count: tracks.length,
          sample: tracks.slice(0, 6),
          narration: describeParams(routeToParams(r))
        }
      }
    }
    case 'best_closers':
    case 'best_openers': {
      const ends = await s.recallEnds()
      const list = r.intent === 'best_closers' ? ends.closers : ends.openers
      const word = r.intent === 'best_closers' ? 'closers' : 'openers'
      return {
        kind: 'generic',
        filters: genericAsk(query, `your go-to ${word}`),
        followups: ['What do I open with?', 'Build a set from these'],
        result: list.length
          ? { kind: 'combos', combos: list, narration: `Your most-used ${word}.` }
          : { kind: 'empty', note: `Not enough history to know your ${word} yet.` }
      }
    }
    case 'top_sequences': {
      const seqs = await s.recallSequences()
      return {
        kind: 'generic',
        filters: genericAsk(query, 'your recurring runs'),
        followups: ['What do I play after the first one?'],
        result: seqs.length
          ? {
              kind: 'sequences',
              sequences: seqs.map((sq) => ({ tracks: sq.tracks, count: sq.count })),
              narration: `Your ${seqs.length} most-recurring runs.`
            }
          : { kind: 'empty', note: 'No recurring runs yet — perform a few sets first.' }
      }
    }
    case 'dead_ends': {
      const dead = await s.recallDeadEnds()
      return {
        kind: 'generic',
        filters: genericAsk(query, 'tracks you rarely mix out of'),
        followups: ['What plays after these?'],
        result: dead.length
          ? { kind: 'combos', combos: dead, narration: 'Tracks you rarely mix out of.' }
          : { kind: 'empty', note: 'No clear dead-ends in your history.' }
      }
    }
    case 'lifecycle': {
      const c = await s.recallLifecycle()
      return {
        kind: 'generic',
        filters: genericAsk(query, 'your library by lifecycle'),
        followups: ['Show my forgotten gems', 'What’s my sound?'],
        result: {
          kind: 'stats',
          stats: Object.entries(c).map(([label, value]) => ({ label, value: String(value) })),
          narration: `${c.peak} in peak rotation, ${c.forgotten} forgotten.`
        }
      }
    }
    case 'health': {
      const h = await s.recallHealth()
      return {
        kind: 'generic',
        filters: genericAsk(query, 'your library health'),
        followups: ['Clean up my duplicates'],
        result: {
          kind: 'stats',
          stats: [
            { label: 'Health', value: `${h.healthScore}/100` },
            { label: 'Missing files', value: String(h.missingFiles) },
            { label: 'Missing key', value: String(h.missingKey) },
            { label: 'Missing BPM', value: String(h.missingBpm) },
            { label: 'Duplicate groups', value: String(h.duplicateGroups.length) }
          ],
          narration: `Library health is ${h.healthScore}/100.`
        }
      }
    }
    case 'identity': {
      const id = await s.recallIdentity()
      const topGenre = id.genreDistribution[0]?.label ?? '—'
      const topArtist = id.topArtists[0]?.label ?? '—'
      return {
        kind: 'generic',
        filters: genericAsk(query, 'your signature sound'),
        followups: ['Show my forgotten gems', `More ${topGenre}`],
        result: {
          kind: 'stats',
          stats: [
            { label: 'Top genre', value: topGenre },
            { label: 'Top artist', value: topArtist },
            { label: 'Top label', value: id.topLabels[0]?.label ?? '—' }
          ],
          narration: `Your sound leans ${topGenre}, anchored by ${topArtist}.`
        }
      }
    }
    case 'smart_filter': {
      const params = routeToParams(r)
      const tracks = await s.recallSearch(params)
      const filters: HomeFilters = {
        kind: 'generic',
        params,
        ask: false,
        query,
        narration: describeParams(params)
      }
      return {
        kind: 'generic',
        filters,
        followups: ['Surprise me', 'More like the first one', 'Build a set from these'],
        result: tracks.length
          ? { kind: 'tracks', tracks, narration: `${tracks.length} match.` }
          : { kind: 'empty', note: 'Nothing matched that — try widening a constraint.' }
      }
    }
    default:
      return null // unknown → caller falls back to the deterministic ask path
  }
}

/**
 * Safety net for when the model is off or routes to "unknown". recallAiAsk runs
 * the deterministic keyword parser FIRST (so closers/openers/gems/etc. still
 * resolve with no model), only touching the model as its own last resort.
 */
async function resolveViaAsk(query: string): Promise<TurnPatch | null> {
  const s = api()
  if (!s) return null
  let res: Awaited<ReturnType<NonNullable<typeof s>['recallAiAsk']>> | null = null
  try {
    res = await s.recallAiAsk(query)
  } catch {
    return null
  }
  if (!res || res.intent === 'unknown') return null
  let result: HomeResult
  switch (res.kind) {
    case 'combos':
      result = { kind: 'combos', combos: res.combos ?? [], narration: res.narration }
      break
    case 'sequences':
      result = {
        kind: 'sequences',
        sequences: (res.sequences ?? []).map((sq) => ({ tracks: sq.tracks, count: sq.count ?? 0 })),
        narration: res.narration
      }
      break
    case 'stats':
      result = { kind: 'stats', stats: res.stats ?? [], narration: res.narration }
      break
    case 'tracks':
    default:
      result = (res.tracks ?? []).length
        ? { kind: 'tracks', tracks: res.tracks ?? [], narration: res.narration }
        : { kind: 'empty', note: res.narration }
  }
  return {
    kind: 'generic',
    filters: genericAsk(query, res.narration.slice(0, 80) || 'your request'),
    followups: ['Surprise me', 'Find my forgotten gems', 'What’s my sound?'],
    result
  }
}

/** Last-resort plain text search so there's always *some* result. */
async function resolveViaText(query: string): Promise<TurnPatch> {
  const filters: HomeFilters = {
    kind: 'generic',
    params: { text: query, sort: 'mostPlayed', limit: 25 },
    ask: false,
    query,
    narration: `tracks matching “${query}”`
  }
  return {
    kind: 'generic',
    filters,
    followups: ['Surprise me', 'My most played', 'Find my forgotten gems'],
    result: await execute(filters)
  }
}

/** Context (previous route) we feed the model so refinements work. */
function contextFromFilters(f: HomeFilters): string | null {
  if (f.kind === 'generic') return JSON.stringify(f.params)
  return JSON.stringify(f)
}

function usesModelInitially(query: string): {
  interp: ReturnType<typeof interpretHome>
  useModel: boolean
} {
  const interp = interpretHome(query)
  // Route to the model ONLY when interpretHome couldn't parse the request (its
  // `ask` flag). Any parsed deterministic search executes directly — including
  // sort-only ones ("fastest tracks", "my most played track"). One source of
  // truth for search-vs-ask, instead of re-deriving structure from params.
  const useModel =
    interp.kind === 'generic' && interp.filters.kind === 'generic' && interp.filters.ask === true
  return { interp, useModel }
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface HomeState {
  turns: HomeTurn[]
  conversations: HomeConversation[]
  currentId: string | null
  /** JSON of the previous turn's route/params — fed back so refinements work. */
  lastContext: string | null
  run: (query: string) => Promise<void>
  rerun: (turnId: string, filters: HomeFilters) => Promise<void>
  newConversation: () => void
  selectConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => void
}

/** Persist the live turns into the current conversation record. */
function persist(state: HomeState): HomeConversation[] {
  // "Edged" free tier (pricing re-cut 2026-06): asking is unlimited and free —
  // the live thread renders this session — but conversations are an EPHEMERAL
  // taste. Nothing is written to history until Pro, so the upgrade reason lands
  // at the value moment ("keep what you just made"), never as a wall on use.
  // Any conversations saved while previously Pro are left untouched on disk.
  if (!isProUser()) return state.conversations
  const id = state.currentId
  if (!id) return state.conversations
  const persistedTurns: PersistedTurn[] = state.turns.map((t) => ({
    id: t.id,
    query: t.query,
    kind: t.kind,
    filters: t.filters,
    followups: t.followups,
    summary: t.summary
  }))
  const now = new Date().toISOString()
  const existing = state.conversations.find((c) => c.id === id)
  const title = state.turns[0]?.query.slice(0, 60) ?? 'New chat'
  const record: HomeConversation = existing
    ? { ...existing, title, turns: persistedTurns, updatedAt: now }
    : { id, title, createdAt: now, updatedAt: now, turns: persistedTurns }
  const convos = [record, ...state.conversations.filter((c) => c.id !== id)]
  saveConversations(convos)
  return convos
}

export const useHomeStore = create<HomeState>((set, get) => ({
  turns: [],
  conversations: loadConversations(),
  currentId: null,
  lastContext: null,

  run: async (query) => {
    const q = query.trim()
    if (!q) return
    const { interp, useModel } = usesModelInitially(q)
    const turnId = uid()
    // Pending turn — kind/filters are provisional; the model path resolves them.
    const turn: HomeTurn = {
      id: turnId,
      query: q,
      kind: interp.kind,
      filters: interp.filters,
      followups: interp.followups,
      pending: true,
      usesModel: useModel,
      summary: readSummary(interp.filters)
    }
    set((s) => ({ turns: [...s.turns, turn], currentId: s.currentId ?? uid() }))
    set((s) => ({ conversations: persist(s) }))

    let patch: TurnPatch
    try {
      if (useModel) {
        // Model first → deterministic keyword ask → plain text search. Always lands.
        patch =
          (await resolveViaModel(q, get().lastContext)) ??
          (await resolveViaAsk(q)) ??
          (await resolveViaText(q))
      } else {
        patch = {
          kind: interp.kind,
          filters: interp.filters,
          followups: interp.followups,
          result: await execute(interp.filters)
        }
      }
    } catch {
      patch = {
        kind: interp.kind,
        filters: interp.filters,
        followups: interp.followups,
        result: { kind: 'empty', note: 'Something went wrong with that — try rephrasing.' }
      }
    }

    set((s) => ({
      turns: s.turns.map((t) =>
        t.id === turnId
          ? {
              ...t,
              pending: false,
              kind: patch.kind,
              filters: patch.filters,
              followups: patch.followups,
              summary: readSummary(patch.filters),
              result: patch.result
            }
          : t
      ),
      lastContext: contextFromFilters(patch.filters)
    }))
    set((s) => ({ conversations: persist(s) }))
  },

  rerun: async (turnId, filters) => {
    // Refining via the edit panel is an explicit, deterministic re-run.
    set((s) => ({
      turns: s.turns.map((t) =>
        t.id === turnId ? { ...t, filters, summary: readSummary(filters), pending: true } : t
      )
    }))
    let result: HomeResult
    try {
      result = await execute(filters)
    } catch {
      result = { kind: 'empty', note: 'Something went wrong with that — try rephrasing.' }
    }
    set((s) => ({
      turns: s.turns.map((t) => (t.id === turnId ? { ...t, pending: false, result } : t)),
      lastContext: contextFromFilters(filters)
    }))
    set((s) => ({ conversations: persist(s) }))
  },

  newConversation: () => set({ turns: [], currentId: null, lastContext: null }),

  selectConversation: async (id) => {
    const conv = get().conversations.find((c) => c.id === id)
    if (!conv) return
    // Restore turns as pending, then re-run each (deterministically, from its
    // persisted filters) against the live library so results are always fresh.
    const restored: HomeTurn[] = conv.turns.map((t) => ({
      ...t,
      pending: true,
      usesModel: false,
      result: undefined
    }))
    set({ currentId: id, turns: restored, lastContext: null })
    for (const t of restored) {
      let result: HomeResult
      try {
        result = await execute(t.filters)
      } catch {
        result = { kind: 'empty', note: 'Couldn’t reload that answer.' }
      }
      set((s) => ({
        turns: s.turns.map((x) => (x.id === t.id ? { ...x, pending: false, result } : x))
      }))
    }
  },

  deleteConversation: (id) => {
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id)
      saveConversations(conversations)
      const clearing = s.currentId === id
      return {
        conversations,
        currentId: clearing ? null : s.currentId,
        turns: clearing ? [] : s.turns,
        lastContext: clearing ? null : s.lastContext
      }
    })
  }
}))
