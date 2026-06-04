/**
 * Eval harness contracts.
 *
 * The harness runs every prompt from setsense_ai_eval_matrix.md through a single
 * `resolveQuery(prompt, ctx)` engine driver and scores the normalized result
 * against an encoded "Pass when" predicate. The driver is the seam we improve
 * across phases (P0 baseline → P1+ ); the cases and fixtures stay fixed, so the
 * pass-rate is a like-for-like measure of engine quality over time.
 */

import type { Track, LibrarySearchParams } from '../../src/types'

/** A logged gig (mirrors play_sessions + its ordered session_tracks). */
export interface FixtureSession {
  id: string
  name: string
  performedAt: string // ISO date (YYYY-MM-DD)
  venue?: string
  city?: string
  country?: string
  eventType?: 'club' | 'festival' | 'bar' | 'private' | 'outdoor'
  setSlot?: 'opener' | 'peak' | 'closer' | 'b2b' | 'other'
  durationSec?: number
  /** Ordered track ids played in this session. */
  trackIds: string[]
}

/** The deterministic "world" a batch of cases is evaluated against. */
export interface EvalCtx {
  tracks: Track[]
  sessions: FixtureSession[]
  byId: Map<string, Track>
  /** Ordered track-id sequences (one per session) for transition/closer analysis. */
  sequences: string[][]
  /**
   * Ground-truth RELEASE years by track id. The Track type has no release-year
   * field yet (only dateAdded = import date) — a known gap slated for P2
   * (add `releaseYear`, populate from Rekordbox on import). Year-based cases
   * assert against this map so they're authored correctly now and flip
   * fail→pass once the engine gains real year support.
   */
  releaseYears: Record<string, number>
  /** Minimal playlist ground truth for library-management prompts (135/136). */
  playlists: { name: string; trackIds: string[] }[]
  now: Date
}

/**
 * Normalized engine output. Every resolution path collapses to this shape so a
 * case predicate can inspect results uniformly regardless of which engine branch
 * produced them.
 */
export type EngineKind =
  | 'tracks' // a track list (search / filter / discovery / similarity)
  | 'set' // a sequenced set/mix
  | 'combos' // "after X" / opener / closer candidates
  | 'sequences' // recurring multi-track runs
  | 'stats' // analytics / counts / breakdowns
  | 'count' // a single count answer
  | 'gig' // gig-history answer (sessions / per-track timeline)
  | 'knowledge' // DJ-theory answer from the curated KB
  | 'clarify' // asked the user to disambiguate
  | 'action' // a write/export/delete intent (gated on confirmation)
  | 'empty' // understood, but nothing matched (honest zero result)
  | 'unknown' // could not map the request

export interface EngineResult {
  /** Best-effort label of the resolved intent/path (for debugging). */
  intent: string
  kind: EngineKind
  /** Human-facing narration shown above the result. */
  narration: string
  /** Track list for kind 'tracks' / flattened candidates. */
  tracks?: Track[]
  /** Sequenced set for kind 'set'. */
  set?: Track[]
  /** Label/value pairs for kind 'stats'. */
  stats?: { label: string; value: string }[]
  /** Single numeric answer for kind 'count'. */
  count?: number
  /** Sessions returned for kind 'gig'. */
  sessions?: FixtureSession[]
  /** The search params the engine actually executed (for introspection). */
  params?: LibrarySearchParams
  /** Source track for "after X" / "similar to X". */
  sourceTrack?: Track | null
  /** Disambiguation question for kind 'clarify'. */
  clarifyQuestion?: string
  /** KB topic id for kind 'knowledge'. */
  knowledgeTopic?: string
  /** True when the engine requires explicit confirmation before acting. */
  needsConfirmation?: boolean
}

export type Complexity = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
export type CaseType = 'DATA' | 'KNOW' | 'BOTH' | 'ACTION'

/**
 * A check returns `true` to pass, or a short failure reason string to fail.
 * Returning a reason (not just false) makes the scorecard diagnostic.
 */
export type CheckResult = true | string

export interface EvalCase {
  id: string // matrix id, e.g. '001'
  category: string
  complexity: Complexity
  type: CaseType
  prompt: string
  passWhen: string // copied verbatim from the matrix for traceability
  check: (r: EngineResult, ctx: EvalCtx) => CheckResult
}
