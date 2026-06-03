import { homedir } from 'os'

/**
 * Redaction helpers shared by the crash reporter (Sentry beforeSend) and the
 * NDJSON file logger. The goal is "safe by construction": anything that reaches
 * disk or a remote has already had absolute home-dir paths and identity-shaped
 * tokens stripped, while keeping enough (basenames, line/col) to locate bugs.
 */

/**
 * Reduce a single stack-frame path to its last path segment (the filename).
 * Handles both POSIX and Windows separators. This is the exact behaviour the
 * crash reporter relied on inline; it now lives here so both paths share one
 * implementation instead of duplicating the split logic.
 *
 * @example frameBasename('/Users/sam/app/electron/main.ts') // 'main.ts'
 */
export function frameBasename(filename: string): string {
  const parts = filename.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1]
}

// Resolve the home dir once. In test/headless contexts os.homedir() always
// returns a value, so this is safe to read at module load.
const HOME = (() => {
  try {
    return homedir().replace(/\\/g, '/').replace(/\/+$/, '')
  } catch {
    return ''
  }
})()

// Matches an email-shaped token anywhere in a string.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

// File extensions we treat as "library / media" content. Paths pointing at one
// of these are collapsed to basename-only, since the surrounding directory tree
// reveals the user's filesystem and folder-naming habits.
const MEDIA_EXT_RE = /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|opus|wma|alac|mp4|mov)$/i

/**
 * Redact a filesystem path for logging.
 *
 * - Library/media files (audio/video extensions) are reduced to
 *   `basename.ext` only — the directory structure is dropped entirely.
 * - Any other absolute path under the user's home dir has that prefix
 *   collapsed to `~` so the rest of the (app-relevant) path is preserved.
 *
 * Non-path / empty input is returned unchanged.
 */
export function redactPath(p: string): string {
  if (!p) return p
  const norm = p.replace(/\\/g, '/')

  // Library/media content: keep only the filename + extension.
  if (MEDIA_EXT_RE.test(norm)) {
    return frameBasename(norm)
  }

  // Collapse the home-dir prefix to '~'.
  if (HOME && norm.toLowerCase().startsWith(HOME.toLowerCase())) {
    const rest = norm.slice(HOME.length)
    return '~' + rest
  }

  return p
}

/**
 * Final-pass scrubber for arbitrary freeform strings (log messages, error
 * messages, context values). Removes home-dir absolute paths and email-shaped
 * tokens. Defensive last line of defence — callers should still prefer
 * {@link redactPath} for known paths.
 */
export function scrubString(s: string): string {
  if (!s) return s
  let out = s

  // Replace home-dir absolute paths (with either separator) with '~'.
  if (HOME) {
    // Escape regex metacharacters in the home path, then match either slash style.
    const escaped = HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]')
    out = out.replace(new RegExp(escaped, 'gi'), '~')
  }

  // Strip email-shaped tokens.
  out = out.replace(EMAIL_RE, '[redacted-email]')

  return out
}
