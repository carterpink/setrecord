import * as Sentry from '@sentry/react'
import type { EventHint, ErrorEvent } from '@sentry/react'

// DSN from environment — fallback if not provided (disables Sentry)
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

/**
 * Initialize Sentry on the renderer process (browser side).
 * Only sent if `optIn` is true — user must explicitly enable error tracking.
 */
export function initSentryRenderer(optIn: boolean): void {
  if (!optIn || !SENTRY_DSN) {
    Sentry.init({ dsn: '' })
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.DEV ? 'development' : 'production',
    tracesSampleRate: 1.0,
    // Redact sensitive personal and library data before sending
    beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
      return redactEvent(event as Sentry.Event) as ErrorEvent | null
    },
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true
      })
    ]
  })
}

/**
 * Redaction policy: strip PII and library-specific data before sending to Sentry.
 * Preserves error messages, stack traces, and non-sensitive context.
 */
function redactEvent(event: Sentry.Event | null): Sentry.Event | null {
  if (!event) return null

  // Redact breadcrumb data
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc: Sentry.Breadcrumb) => ({
      ...bc,
      data: bc.data
        ? Object.fromEntries(
            Object.entries(bc.data).map(([k, v]) => [k, shouldRedact(k, v) ? '[REDACTED]' : v])
          )
        : undefined
    }))
  }

  // Redact request data
  if (event.request) {
    event.request = {
      ...event.request,
      url: redactUrl(event.request.url),
      headers: event.request.headers
        ? Object.fromEntries(
            Object.entries(event.request.headers).map(([k, v]) => [
              k,
              k.toLowerCase().includes('auth') || k.toLowerCase().includes('cookie')
                ? '[REDACTED]'
                : v
            ])
          )
        : undefined
    }
  }

  // Redact context data
  if (event.contexts) {
    event.contexts = Object.fromEntries(
      Object.entries(event.contexts).map(([key, ctx]) => {
        if (!ctx || typeof ctx !== 'object') return [key, ctx]
        return [
          key,
          Object.fromEntries(
            Object.entries(ctx).map(([k, v]) => [k, shouldRedact(k, v) ? '[REDACTED]' : v])
          )
        ]
      })
    )
  }

  // Redact extra data
  if (event.extra) {
    event.extra = Object.fromEntries(
      Object.entries(event.extra).map(([k, v]) => [k, shouldRedact(k, v) ? '[REDACTED]' : v])
    )
  }

  return event
}

/**
 * Determine if a key/value pair should be redacted.
 * Redacts: emails, paths, filenames, library names, playlist names, usernames.
 */
function shouldRedact(key: string, value: unknown): boolean {
  const lowerKey = key.toLowerCase()
  // Keys to always redact
  if (
    lowerKey.includes('email') ||
    lowerKey.includes('path') ||
    lowerKey.includes('file') ||
    lowerKey.includes('name') ||
    lowerKey.includes('username') ||
    lowerKey.includes('user') ||
    lowerKey.includes('library') ||
    lowerKey.includes('playlist') ||
    lowerKey.includes('crate') ||
    lowerKey.includes('track') ||
    lowerKey.includes('artist') ||
    lowerKey.includes('title') ||
    lowerKey.includes('url') ||
    lowerKey.includes('uri')
  ) {
    return true
  }

  // Values that look like paths or emails
  if (typeof value === 'string') {
    if (
      value.includes('@') ||
      value.includes('/') ||
      value.includes('\\') ||
      value.match(/\.[a-z]{2,}$/i)
    ) {
      return true
    }
  }

  return false
}

/**
 * Redact sensitive parts of URLs while preserving domain.
 */
function redactUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    // Keep protocol + domain, redact path
    return `${u.protocol}//${u.host}/[REDACTED]`
  } catch {
    return '[REDACTED]'
  }
}
