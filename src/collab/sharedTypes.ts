/**
 * Shared types + constants for the real-time "Back-to-Back" collaboration layer.
 *
 * A live session syncs ONE set between peers over a Yjs CRDT. The CRDT only ever
 * carries display-safe, machine-independent data — never absolute file paths and
 * never a peer's full Track row (whose `id`/`filePath` are meaningless on another
 * machine). Each peer re-hydrates the shared slots against its OWN library at
 * projection time (see projection.ts), falling back to a phantom Track when it
 * doesn't own the file.
 */

import type { Track } from '@/types'

// ── Yjs document layout ──────────────────────────────────────────────────────
// One Y.Doc per session. `meta` holds set-level scalars; `tracks` is the ordered
// slot list (array index == position, so position is never stored or contended).
export const Y_META = 'meta'
export const Y_TRACKS = 'tracks'

/** Keys inside the `meta` Y.Map — the set-level scalars worth sharing live. */
export const META_KEYS = [
  'setId',
  'name',
  'targetBpmMin',
  'targetBpmMax',
  'vibe',
  'venue',
  'energyCurveType',
  'targetHardware',
  'slotTime',
  'hostName'
] as const

// ── Wire protocol (binary frames over the host-hub WebSocket relay) ───────────
// The relay is a dumb broadcaster: it rebroadcasts every frame to all OTHER
// peers without parsing it. The first byte is the frame type.
export const MSG_SYNC = 0 // Yjs update bytes follow (Y.encodeStateAsUpdate / update)
export const MSG_QUERY = 1 // "send me your full state" — no payload
export const MSG_AWARENESS = 2 // y-protocols/awareness update bytes follow

// ── Per-slot payload carried in the CRDT ─────────────────────────────────────
/**
 * The minimal, display-only description of a track shared across peers. Resolved
 * back to a local Track by `matchKey` on the receiving side. Deliberately omits
 * filePath, cues, beatgrid — those are local concerns.
 */
export interface SharedTrackMeta {
  /** The originating peer's Track.id. Opaque to everyone else; never matched on. */
  trackId: string
  title: string
  artist: string
  bpm: number
  key: string
  energy: number
  duration: number
  genre?: string
  /** Normalised artist|title|bpm key used to find this track in a peer's library. */
  matchKey: string
}

// ── Presence (Yjs awareness) ─────────────────────────────────────────────────
export interface AwarenessUser {
  name: string
  color: string
}

export interface CollabAwarenessState {
  user: AwarenessUser
  /** Slot (SetTrack.id) the peer currently has focused/selected, if any. */
  editingSlotId: string | null
}

/** A connected peer, derived from awareness for the presence UI. */
export interface CollabPeer {
  clientId: number
  name: string
  color: string
  editingSlotId: string | null
}

// ── Identity helpers (ephemeral — no accounts) ───────────────────────────────
/** Distinct, high-contrast booth-friendly colours assigned per peer. */
export const PEER_COLORS = [
  '#c8ff00', // lime (brand)
  '#ff5da2', // pink
  '#36d1ff', // cyan
  '#ffa53b', // amber
  '#a78bfa', // violet
  '#4ade80', // green
  '#ff6b6b', // red
  '#f4d35e' // yellow
] as const

/** Deterministic colour for a numeric client id (stable within a session). */
export function colorForClientId(clientId: number): string {
  const idx = Math.abs(clientId) % PEER_COLORS.length
  return PEER_COLORS[idx]
}

/** Normalise a track into a cross-library match key: "artist|title|bpm". */
export function makeMatchKey(artist: string, title: string, bpm: number): string {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `${norm(artist)}|${norm(title)}|${Math.round(bpm)}`
}

/** Build the shareable, machine-independent meta payload from a local Track. */
export function toSharedMeta(track: Track): SharedTrackMeta {
  return {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    bpm: track.bpm,
    key: track.key,
    energy: track.energy,
    duration: track.duration,
    genre: track.genre,
    matchKey: makeMatchKey(track.artist, track.title, track.bpm)
  }
}

/**
 * A display-only Track for a shared slot the local library doesn't contain.
 * Reuses the existing `phantom` flag so the timeline renders it greyed-out with
 * preview disabled (TimelineTrackCard already handles `track.phantom === true`).
 */
export function phantomFromMeta(meta: SharedTrackMeta): Track {
  return {
    id: meta.trackId,
    title: meta.title,
    artist: meta.artist,
    bpm: meta.bpm,
    key: meta.key,
    energy: meta.energy,
    duration: meta.duration,
    genre: meta.genre,
    filePath: '',
    format: 'unknown',
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: new Date().toISOString(),
    phantom: true,
    missingFile: true
  }
}
