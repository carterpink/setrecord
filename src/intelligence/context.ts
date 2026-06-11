/**
 * context.ts — builds the ResolveCtx "world" the intelligence cascade reasons
 * over, from live renderer state (libraryStore) + the read-only history IPC.
 *
 * Sessions (with their ordered track ids) are fetched once and cached briefly:
 * gig history changes rarely within a chat, and the cascade itself is pure and
 * synchronous once the world is in hand. Falls back to an empty world (tracks
 * only) when the bridge is unavailable (preview) or a fetch fails — every
 * intent that needs sessions then answers honestly from zero sessions.
 */

import type { PlaySession, Track } from '@/types'
import { useLibraryStore } from '@/stores/libraryStore'
import type { ResolveCtx, ResolveSession } from './types'

const SESSION_CACHE_MS = 60_000

let sessionCache: { at: number; sessions: ResolveSession[] } | null = null

function toResolveSession(s: PlaySession, trackIds: string[]): ResolveSession {
  return {
    id: s.id,
    name: s.name,
    performedAt: (s.performedAt ?? s.createdAt ?? '').slice(0, 10),
    venue: s.venue,
    city: s.city,
    country: s.country,
    eventType: s.eventType,
    setSlot: s.setSlot,
    durationSec: s.duration,
    trackIds
  }
}

async function fetchSessions(api: NonNullable<Window['setrecord']>): Promise<ResolveSession[]> {
  if (sessionCache && Date.now() - sessionCache.at < SESSION_CACHE_MS) {
    return sessionCache.sessions
  }
  const sessions = await api.historySessions()
  const resolved = await Promise.all(
    sessions.map(async (s) => {
      try {
        const rows = await api.historySessionTracks(s.id)
        const ordered = [...rows].sort((a, b) => a.playOrder - b.playOrder)
        return toResolveSession(
          s,
          ordered.map((r) => r.trackId)
        )
      } catch {
        return toResolveSession(s, [])
      }
    })
  )
  sessionCache = { at: Date.now(), sessions: resolved }
  return resolved
}

/** Drop the session cache (call after an import or session edit). */
export function invalidateResolveCtx(): void {
  sessionCache = null
}

/** Assemble the world for one resolution. Never throws. */
export async function buildResolveCtx(): Promise<ResolveCtx> {
  const tracks: Track[] = useLibraryStore.getState().tracks
  const api = typeof window !== 'undefined' ? window.setrecord : undefined

  let sessions: ResolveSession[] = []
  let playlists: { name: string; trackIds: string[] }[] = []
  if (api) {
    try {
      sessions = await fetchSessions(api)
    } catch {
      sessions = []
    }
    try {
      const pls = await api.getPlaylists()
      playlists = pls
        .filter((p) => !p.isFolder)
        .map((p) => ({ name: p.name, trackIds: p.trackIds }))
    } catch {
      playlists = []
    }
  }

  return {
    tracks,
    sessions,
    byId: new Map(tracks.map((t) => [t.id, t])),
    sequences: sessions.map((s) => s.trackIds).filter((ids) => ids.length > 0),
    playlists,
    now: new Date()
  }
}
