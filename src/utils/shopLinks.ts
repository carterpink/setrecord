export function beatportSearchUrl(artist: string, title: string): string {
  return `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`.trim())}`
}

export function soundcloudSearchUrl(artist: string, title: string): string {
  return `https://soundcloud.com/search?q=${encodeURIComponent(`${artist} ${title}`.trim())}`
}

/**
 * YouTube video IDs are always exactly 11 chars of [A-Za-z0-9_-]. Anything else
 * came from a stale cache, a parser bug, or an attempt to smuggle URL fragments
 * into our iframe src. Reject these defensively so the embed never loads a
 * surprise origin.
 */
const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function isValidYoutubeVideoId(id: string | null | undefined): boolean {
  return typeof id === 'string' && YT_VIDEO_ID_RE.test(id)
}

export function youtubeTimestampUrl(videoId: string, seconds?: number): string {
  if (!isValidYoutubeVideoId(videoId)) return 'about:blank'
  const base = `https://www.youtube.com/watch?v=${videoId}`
  return seconds != null && seconds > 0 ? `${base}&t=${Math.floor(seconds)}s` : base
}

export function youtubeThumbnailUrl(videoId: string): string {
  if (!isValidYoutubeVideoId(videoId)) return ''
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function youtubeEmbedUrl(videoId: string): string {
  if (!isValidYoutubeVideoId(videoId)) return 'about:blank'
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
}
