/**
 * Shared contracts for the intelligence resolution cascade.
 *
 * These types are the single source of truth for both the live app
 * (src/intelligence/resolve.ts wired into homeStore) and the eval harness
 * (tests/eval re-exports them), so the engine the harness scores IS the engine
 * the app ships.
 */

import type { Track, LibrarySearchParams } from '@/types'

/** A logged gig the cascade can reason over (play_sessions + ordered tracks). */
export interface ResolveSession {
  id: string
  name?: string
  performedAt: string // ISO date (YYYY-MM-DD)
  venue?: string
  city?: string
  country?: string
  eventType?: string
  setSlot?: string
  durationSec?: number
  /** Ordered track ids played in this session. */
  trackIds: string[]
}

/** The world a query is resolved against. */
export interface ResolveCtx {
  tracks: Track[]
  sessions: ResolveSession[]
  byId: Map<string, Track>
  /** Ordered track-id sequences (one per session) for transition/closer analysis. */
  sequences: string[][]
  /** Playlist ground truth for library-management intents. */
  playlists: { name: string; trackIds: string[] }[]
  now: Date
}

/**
 * Normalized engine output. Every resolution path collapses to this shape so
 * callers (and eval predicates) can inspect results uniformly.
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
  sessions?: ResolveSession[]
  /** Recurring track runs for kind 'sequences'. */
  sequences?: { tracks: Track[]; count: number }[]
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
  /** Set when the query only resolved after slang/typo normalization. */
  correctedQuery?: string
}
