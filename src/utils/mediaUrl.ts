/**
 * Build a media:// URL from an absolute file path.
 *
 * Why the `local` placeholder host: the `media` scheme is registered with
 * `standard: true`, so Chromium parses it like http — `scheme://authority/path`.
 * Without an authority, `media:///Users/...` gets normalised to
 * `media://users/...` (Chromium consumes the first path segment as the host
 * and lowercases it), which then turns into an invalid `file://users/...` URL.
 * Forcing an explicit host (`local`) keeps the absolute path intact for the
 * main-process handler to strip back to `file:///path`.
 *
 * Each path segment is encoded with encodeURIComponent so `#`, `?`, spaces,
 * and other URL-meta characters survive intact.
 */
export function toMediaUrl(filePath: string): string {
  const segments = filePath.split('/').map((s) => encodeURIComponent(s))
  return 'media://local' + segments.join('/')
}
