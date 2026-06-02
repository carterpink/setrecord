import * as Sentry from '@sentry/electron/main'
import type { ErrorEvent } from '@sentry/electron/main'

// Populated at build/launch time via the SENTRY_DSN environment variable.
// Never hard-coded here — see .env.example for how to configure it.
const DSN = process.env.SENTRY_DSN ?? ''

/**
 * Initialise Sentry crash reporting in the main process.
 * Call only when the user has opted in (crashReportingEnabled === true in settings).
 * If SENTRY_DSN is not set, this is a no-op.
 *
 * Collected:  error type, message, redacted stack trace, app version, OS, CPU arch.
 * Never sent: library contents, track titles, file paths, or any personal data.
 *
 * Changes take effect on the next app launch.
 */
export function initCrashReporter(): void {
  if (!DSN) return

  Sentry.init({
    dsn: DSN,
    // Crash reports only — no performance/tracing data
    tracesSampleRate: 0,
    // Screenshots could capture personal data; always off
    attachScreenshot: false,
    beforeSend(event: ErrorEvent): ErrorEvent | null {
      // Strip user identity in case Sentry infers one from environment
      delete event.user

      // Redact absolute file paths in stack frames.
      // We keep the filename and line/column so bugs are still locatable,
      // but drop everything before the last path segment so the user's
      // home directory structure is never transmitted.
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              if (frame.filename) {
                const parts = frame.filename.replace(/\\/g, '/').split('/')
                frame.filename = parts[parts.length - 1]
              }
              // abs_path is the raw OS path — always drop it
              if ('abs_path' in frame) delete (frame as Record<string, unknown>).abs_path
            }
          }
        }
      }

      // Breadcrumbs can contain console output and navigation events that
      // may include local paths or other sensitive context
      delete event.breadcrumbs

      // Extra / request data should not be present in the main process,
      // but drop defensively
      delete event.extra
      delete event.request

      return event
    }
  })
}
