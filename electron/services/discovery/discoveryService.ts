/**
 * Orchestrates YouTube fetching, tracklist parsing, and SQLite caching.
 *
 * Design principles:
 *  - Browse returns card metadata only (no tracklist parsing) — lazy, fast
 *  - Tracklist is parsed on-demand when a user opens a set's detail modal
 *  - Pagination: each browse call returns nextPageToken for infinite scroll
 *  - Cache-first: 7-day TTL for set metadata, 24h for search queries
 */

import type Database from 'better-sqlite3'
import type { DiscoverSet, DiscoverTrack, TasteProfile } from '../../../src/types'
import { getApiKey } from './apiKey'
import {
  searchDJSets,
  getVideosMetadata,
  getTopComments,
  YouTubeError,
} from './youtubeClient'
import { parseDescriptionWithCommentFallback } from './tracklistParser'
import { deriveClarityReason } from './clarityReasonServer'

const SET_TTL_MS   = 7 * 24 * 60 * 60 * 1000  // 7 days
const QUERY_TTL_MS = 24 * 60 * 60 * 1000       // 24 hours

// ─── Genre → search queries ────────────────────────────────────────────────

const GENRE_QUERIES: Record<string, string> = {
  Techno:       'techno dj set live',
  House:        'house music dj set live',
  'Deep House': 'deep house dj set live',
  Minimal:      'minimal techno dj set live',
  Breakbeat:    'breakbeat dj set live',
  UKG:          'uk garage dj set live',
  Electro:      'electro dj set live',
  Disco:        'disco dj set live',
  Industrial:   'industrial techno dj set',
  IDM:          'idm electronica dj set',
}

const DEFAULT_QUERIES = [
  'techno dj set live 2024',
  'house dj set boiler room 2024',
  'festival dj set live 2024',
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function ytThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function extractDjName(title: string, channelTitle: string): { djName: string; eventName?: string } {
  const atMatch = title.match(/^([^@|]+?)\s+[@|]\s+(.+)$/)
  if (atMatch) return { djName: atMatch[1].trim(), eventName: atMatch[2].trim() }
  const dashMatch = title.match(/^([^-]+?)\s+-\s+(.+)$/)
  if (dashMatch) return { djName: dashMatch[1].trim(), eventName: dashMatch[2].trim() }
  return { djName: channelTitle }
}

const GENRE_KEYWORDS = [
  'techno', 'house', 'deep house', 'minimal', 'breakbeat', 'uk garage', 'ukg',
  'electro', 'disco', 'industrial', 'idm', 'ambient', 'trance', 'drum and bass',
  'dnb', 'jungle', 'acid', 'dub techno', 'melodic techno', 'hard techno',
  'peak time', 'closing set', 'warm up', 'afro house', 'tech house',
]

function extractGenreTags(description: string, ytTags: string[]): string[] {
  const text = `${description} ${ytTags.join(' ')}`.toLowerCase()
  const found = new Set<string>()
  for (const g of GENRE_KEYWORDS) {
    if (text.includes(g)) found.add(g.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))
  }
  return [...found].slice(0, 8)
}

// ─── Cache ────────────────────────────────────────────────────────────────

function getCachedSet(db: Database.Database, videoId: string): DiscoverSet | null {
  const row = db
    .prepare('SELECT payload, fetched_at FROM discovery_sets WHERE id = ?')
    .get(videoId) as { payload: string; fetched_at: string } | undefined
  if (!row) return null
  if (Date.now() - new Date(row.fetched_at).getTime() > SET_TTL_MS) return null
  try { return JSON.parse(row.payload) as DiscoverSet } catch { return null }
}

function putCachedSet(db: Database.Database, set: DiscoverSet): void {
  db.prepare(`
    INSERT INTO discovery_sets (id, payload, fetched_at, tracklist_confidence, source)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload               = excluded.payload,
      fetched_at            = excluded.fetched_at,
      tracklist_confidence  = excluded.tracklist_confidence,
      source                = excluded.source
  `).run(
    set.id,
    JSON.stringify(set),
    new Date().toISOString(),
    set.tracklistConfidence,
    set.tracklistSource ?? null,
  )
}

interface CachedQuery { videoIds: string[]; nextPageToken: string | null }

function getCachedQuery(db: Database.Database, queryKey: string): CachedQuery | null {
  const row = db
    .prepare('SELECT video_ids, fetched_at FROM discovery_queries WHERE query_key = ?')
    .get(queryKey) as { video_ids: string; fetched_at: string } | undefined
  if (!row) return null
  if (Date.now() - new Date(row.fetched_at).getTime() > QUERY_TTL_MS) return null
  try { return JSON.parse(row.video_ids) as CachedQuery } catch { return null }
}

function putCachedQuery(db: Database.Database, queryKey: string, data: CachedQuery): void {
  db.prepare(`
    INSERT INTO discovery_queries (query_key, video_ids, fetched_at)
    VALUES (?, ?, ?)
    ON CONFLICT(query_key) DO UPDATE SET
      video_ids  = excluded.video_ids,
      fetched_at = excluded.fetched_at
  `).run(queryKey, JSON.stringify(data), new Date().toISOString())
}

// ─── Card builder (no tracklist parsing) ──────────────────────────────────

function buildCardSet(
  d: {
    videoId: string; title: string; channelTitle: string; publishedAt: string
    description: string; durationSeconds: number; viewCount: number; likeCount: number
    thumbnailUrl: string; tags: string[]
  },
  tasteProfile: TasteProfile,
): DiscoverSet {
  const tags = extractGenreTags(d.description, d.tags)
  const { djName, eventName } = extractDjName(d.title, d.channelTitle)
  return {
    id: d.videoId,
    videoId: d.videoId,
    title: d.title,
    djName,
    eventName,
    // Truncate description for card display; full text preserved in tracklist fetch
    description: d.description.slice(0, 600).trim(),
    thumbnailUrl: d.thumbnailUrl || ytThumbnail(d.videoId),
    durationSeconds: d.durationSeconds,
    viewCount: d.viewCount,
    likeCount: d.likeCount,
    uploadedAt: d.publishedAt,
    tags,
    tracklist: [],              // populated lazily on modal open
    tracklistConfidence: 0,     // 0 = not yet fetched
    tracklistSource: undefined,
    clarity: deriveClarityReason({ djName, tags, tracklist: [] }, tasteProfile),
  }
}

// ─── Public types ─────────────────────────────────────────────────────────

export interface BrowseResult {
  sets: DiscoverSet[]
  nextPageToken: string | null
  hasMore: boolean
  error?: { code: string; message: string }
}

export interface TracklistResult {
  tracklist: DiscoverTrack[]
  confidence: number
  source: 'description' | 'comments' | 'mixed'
}

// ─── Browse ───────────────────────────────────────────────────────────────

/**
 * Fetch one page of DJ sets from YouTube.
 * Returns card-level metadata only — tracklist is NOT parsed.
 * Pass nextPageToken from a previous result to get the next page.
 */
export async function browseDiscoverySets(
  db: Database.Database,
  tasteProfile: TasteProfile,
  opts: {
    genres?: string[]
    pageToken?: string | null
    forceRefresh?: boolean
    pageSize?: number
  } = {},
): Promise<BrowseResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return {
      sets: [],
      nextPageToken: null,
      hasMore: false,
      error: { code: 'no_key', message: 'No YouTube API key configured' },
    }
  }

  const { genres = [], pageToken = null, forceRefresh = false, pageSize = 25 } = opts

  // Pick search query for this genre or use a default
  const query = genres.length > 0
    ? (GENRE_QUERIES[genres[0]] ?? `${genres[0].toLowerCase()} dj set live 2024`)
    : DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)]

  const queryKey = `browse:${query}:${pageToken ?? 'first'}`

  // 1. Check query cache
  let searchResult: CachedQuery | null = !forceRefresh ? getCachedQuery(db, queryKey) : null
  let nextPageToken: string | null = null

  if (!searchResult) {
    try {
      const raw = await searchDJSets(query, apiKey, pageSize, pageToken ?? undefined)
      nextPageToken = raw.nextPageToken ?? null
      searchResult = { videoIds: raw.items.map((i) => i.videoId), nextPageToken }
      putCachedQuery(db, queryKey, searchResult)
    } catch (err) {
      if (err instanceof YouTubeError) {
        return { sets: [], nextPageToken: null, hasMore: false, error: { code: err.code, message: err.message } }
      }
      throw err
    }
  } else {
    nextPageToken = searchResult.nextPageToken ?? null
  }

  const videoIds = searchResult.videoIds.filter(Boolean)

  // 2. Resolve each video ID — from cache first, fetch the rest
  const sets: DiscoverSet[] = []
  const toFetch: string[] = []

  for (const id of videoIds) {
    const cached = !forceRefresh ? getCachedSet(db, id) : null
    if (cached) {
      // Re-derive clarity in case taste profile changed; preserve tracklist from cache
      sets.push({ ...cached, clarity: deriveClarityReason(cached, tasteProfile) })
    } else {
      toFetch.push(id)
    }
  }

  // 3. Batch-fetch metadata for uncached IDs (1 quota unit for up to 50 videos)
  if (toFetch.length > 0) {
    try {
      const details = await getVideosMetadata(toFetch, apiKey)
      for (const d of details) {
        if (d.durationSeconds < 1800) continue  // skip shorts / sub-30-min clips
        const set = buildCardSet(d, tasteProfile)
        putCachedSet(db, set)
        sets.push(set)
      }
    } catch (err) {
      if (err instanceof YouTubeError) {
        return { sets, nextPageToken, hasMore: !!nextPageToken, error: { code: err.code, message: err.message } }
      }
      throw err
    }
  }

  return { sets, nextPageToken, hasMore: !!nextPageToken }
}

// ─── Tracklist (lazy) ─────────────────────────────────────────────────────

/**
 * Fetch and parse the tracklist for a single video.
 * Called when the user opens the set detail modal.
 * Updates the cached set payload so subsequent opens are instant.
 */
export async function getSetTracklist(
  videoId: string,
  db: Database.Database,
): Promise<TracklistResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  // Check if we already have a parsed tracklist in cache
  const cached = getCachedSet(db, videoId)
  if (cached && cached.tracklist.length > 0) {
    return { tracklist: cached.tracklist, confidence: cached.tracklistConfidence, source: cached.tracklistSource ?? 'description' }
  }

  // Fetch full description (we only stored 600 chars on browse; need the full text)
  const [details] = await getVideosMetadata([videoId], apiKey)
  if (!details) return null

  // Try description first
  let result = parseDescriptionWithCommentFallback(details.description, [], 0.6)

  // Fall back to comments if confidence is low
  if (result.confidence < 0.6) {
    const comments = await getTopComments(videoId, apiKey, 20)
    result = parseDescriptionWithCommentFallback(details.description, comments, 0.6)
  }

  // Update the cached set with the parsed tracklist
  if (cached) {
    const updated: DiscoverSet = {
      ...cached,
      description: details.description.slice(0, 800).trim(),
      tracklist: result.tracks,
      tracklistConfidence: result.confidence,
      tracklistSource: result.source,
    }
    putCachedSet(db, updated)
  }

  return { tracklist: result.tracks, confidence: result.confidence, source: result.source }
}

// ─── Force-refresh single set ─────────────────────────────────────────────

export async function refreshDiscoverySet(
  videoId: string,
  db: Database.Database,
  tasteProfile: TasteProfile,
): Promise<DiscoverSet | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const [details] = await getVideosMetadata([videoId], apiKey)
  if (!details || details.durationSeconds < 1800) return null

  const comments = await getTopComments(videoId, apiKey, 20)
  const result = parseDescriptionWithCommentFallback(details.description, comments, 0.6)
  const tags = extractGenreTags(details.description, details.tags)
  const { djName, eventName } = extractDjName(details.title, details.channelTitle)

  const set: DiscoverSet = {
    id: videoId,
    videoId,
    title: details.title,
    djName,
    eventName,
    description: details.description.slice(0, 800).trim(),
    thumbnailUrl: details.thumbnailUrl || ytThumbnail(videoId),
    durationSeconds: details.durationSeconds,
    viewCount: details.viewCount,
    likeCount: details.likeCount,
    uploadedAt: details.publishedAt,
    tags,
    tracklist: result.tracks,
    tracklistConfidence: result.confidence,
    tracklistSource: result.source,
    clarity: deriveClarityReason({ djName, tags, tracklist: result.tracks }, tasteProfile),
  }

  putCachedSet(db, set)
  return set
}
