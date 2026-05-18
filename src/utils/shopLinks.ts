export function beatportSearchUrl(artist: string, title: string): string {
  return `https://www.beatport.com/search?q=${encodeURIComponent(`${artist} ${title}`.trim())}`
}

export function soundcloudSearchUrl(artist: string, title: string): string {
  return `https://soundcloud.com/search?q=${encodeURIComponent(`${artist} ${title}`.trim())}`
}

export function youtubeTimestampUrl(videoId: string, seconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  return seconds != null && seconds > 0 ? `${base}&t=${Math.floor(seconds)}s` : base
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`
}
