/**
 * Thin wrapper around the YouTube Data API v3.
 * All functions return typed objects; errors propagate as thrown YouTubeError instances.
 * Callers (discoveryService) are responsible for caching, rate-limit handling, and retries.
 */

const BASE = 'https://www.googleapis.com/youtube/v3'

// Max parallel requests to YouTube at once
export const MAX_CONCURRENT = 4

export class YouTubeError extends Error {
  constructor(
    message: string,
    public readonly code: 'no_key' | 'quota_exceeded' | 'network' | 'not_found' | 'api_error',
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'YouTubeError'
  }
}

export interface YTSearchItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl: string
}

export interface YTSearchResult {
  items: YTSearchItem[]
  nextPageToken: string | null
}

export interface YTVideoDetails {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  description: string
  durationIso: string   // e.g. "PT1H23M45S"
  durationSeconds: number
  viewCount: number
  likeCount: number
  thumbnailUrl: string
  tags: string[]
}

export interface YTComment {
  text: string
  likeCount: number
}

async function apiFetch(url: string, apiKey: string): Promise<unknown> {
  if (!apiKey) throw new YouTubeError('No YouTube API key configured', 'no_key')

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new YouTubeError('Network request to YouTube failed', 'network')
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 60) * 1000
    throw new YouTubeError('YouTube rate limit hit', 'quota_exceeded', 429, retryAfter)
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as { error?: { errors?: Array<{ reason?: string }> } }
    const reason = body?.error?.errors?.[0]?.reason ?? ''
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      throw new YouTubeError('YouTube daily quota exceeded', 'quota_exceeded', 403)
    }
    throw new YouTubeError(`YouTube API error 403: ${reason}`, 'api_error', 403)
  }

  if (!res.ok) {
    throw new YouTubeError(`YouTube API returned ${res.status}`, 'api_error', res.status)
  }

  return res.json()
}

/** Parse ISO 8601 duration (PT1H23M45S) → seconds */
function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0)
}

function bestThumbnail(thumbnails: Record<string, { url?: string }>): string {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ''
  )
}

/**
 * Search for DJ set videos. Returns up to `maxResults` items + pagination token.
 * Costs 100 quota units per call.
 */
export async function searchDJSets(
  query: string,
  apiKey: string,
  maxResults = 25,
  pageToken?: string,
): Promise<YTSearchResult> {
  let url =
    `${BASE}/search?part=snippet&type=video&videoDuration=long` +
    `&q=${encodeURIComponent(query)}` +
    `&maxResults=${Math.min(maxResults, 50)}` +
    `&key=${encodeURIComponent(apiKey)}`

  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`

  const data = await apiFetch(url, apiKey) as {
    nextPageToken?: string
    items?: Array<{
      id?: { videoId?: string }
      snippet?: {
        title?: string
        channelTitle?: string
        publishedAt?: string
        thumbnails?: Record<string, { url?: string }>
      }
    }>
  }

  return {
    nextPageToken: data.nextPageToken ?? null,
    items: (data.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id!.videoId!,
        title: item.snippet?.title ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        thumbnailUrl: bestThumbnail(item.snippet?.thumbnails ?? {}),
      })),
  }
}

/**
 * Fetch full metadata for up to 50 video IDs in one call.
 * Costs 1 quota unit per call (up to 50 videos).
 */
export async function getVideosMetadata(
  videoIds: string[],
  apiKey: string,
): Promise<YTVideoDetails[]> {
  if (videoIds.length === 0) return []
  const ids = videoIds.slice(0, 50).join(',')
  const url =
    `${BASE}/videos?part=snippet,contentDetails,statistics` +
    `&id=${encodeURIComponent(ids)}` +
    `&key=${encodeURIComponent(apiKey)}`

  const data = await apiFetch(url, apiKey) as {
    items?: Array<{
      id?: string
      snippet?: {
        title?: string
        channelTitle?: string
        publishedAt?: string
        description?: string
        tags?: string[]
        thumbnails?: Record<string, { url?: string }>
      }
      contentDetails?: { duration?: string }
      statistics?: { viewCount?: string; likeCount?: string }
    }>
  }

  return (data.items ?? []).map((item) => {
    const durationIso = item.contentDetails?.duration ?? 'PT0S'
    return {
      videoId: item.id ?? '',
      title: item.snippet?.title ?? '',
      channelTitle: item.snippet?.channelTitle ?? '',
      publishedAt: item.snippet?.publishedAt ?? '',
      description: item.snippet?.description ?? '',
      durationIso,
      durationSeconds: parseIsoDuration(durationIso),
      viewCount: Number(item.statistics?.viewCount ?? 0),
      likeCount: Number(item.statistics?.likeCount ?? 0),
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails ?? {}),
      tags: item.snippet?.tags ?? [],
    }
  })
}

/**
 * Cheap test-ping. Costs 1 quota unit. Uses videos.list against a known stable
 * ID (the "Me at the zoo" upload — youtube.com/watch?v=jNQXAC9IVRw — the first
 * video ever uploaded; unlikely to disappear). Returns a structured result so
 * the UI can distinguish "bad key" from "quota out" from "no network".
 */
export type ValidateApiKeyResult =
  | { ok: true }
  | { ok: false; code: 'invalid_key' | 'quota_exceeded' | 'network' | 'api_error'; message: string }

export async function validateApiKey(apiKey: string): Promise<ValidateApiKeyResult> {
  if (!apiKey.trim()) {
    return { ok: false, code: 'invalid_key', message: 'No key provided' }
  }
  const url = `${BASE}/videos?part=id&id=jNQXAC9IVRw&key=${encodeURIComponent(apiKey.trim())}`
  try {
    const res = await fetch(url)
    if (res.ok) return { ok: true }
    if (res.status === 400) {
      return { ok: false, code: 'invalid_key', message: 'YouTube rejected the key as malformed' }
    }
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { errors?: Array<{ reason?: string }>; message?: string }
      }
      const reason = body?.error?.errors?.[0]?.reason ?? ''
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
        return { ok: false, code: 'quota_exceeded', message: 'Daily quota already used on this key' }
      }
      return {
        ok: false,
        code: 'invalid_key',
        message: body?.error?.message ?? 'YouTube rejected the key (403)',
      }
    }
    return { ok: false, code: 'api_error', message: `YouTube returned ${res.status}` }
  } catch {
    return { ok: false, code: 'network', message: 'Could not reach YouTube — check your connection' }
  }
}

/**
 * Fetch top comments for a video (relevance sort).
 * Costs 1 quota unit per call.
 */
export async function getTopComments(
  videoId: string,
  apiKey: string,
  maxResults = 20,
): Promise<YTComment[]> {
  const url =
    `${BASE}/commentThreads?part=snippet` +
    `&videoId=${encodeURIComponent(videoId)}` +
    `&order=relevance` +
    `&maxResults=${maxResults}` +
    `&key=${encodeURIComponent(apiKey)}`

  try {
    const data = await apiFetch(url, apiKey) as {
      items?: Array<{
        snippet?: {
          topLevelComment?: {
            snippet?: { textOriginal?: string; likeCount?: number }
          }
        }
      }>
    }
    return (data.items ?? []).map((item) => ({
      text: item.snippet?.topLevelComment?.snippet?.textOriginal ?? '',
      likeCount: item.snippet?.topLevelComment?.snippet?.likeCount ?? 0,
    }))
  } catch (err) {
    // Comments may be disabled — treat as empty, not fatal
    if (err instanceof YouTubeError && (err.status === 403 || err.status === 400)) return []
    throw err
  }
}
