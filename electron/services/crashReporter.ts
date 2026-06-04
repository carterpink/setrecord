import * as Sentry from '@sentry/electron/main'
import type { ErrorEvent } from '@sentry/electron/main'
import { frameBasename } from './logging/redact'
import { getSessionId, setSentryBreadcrumbsActive } from './logging/logger'

// Populated at build/launch time via the SENTRY_DSN environment variable.
// Never hard-coded here — see .env.example for how to configure it.
const DSN = process.env.SENTRY_DSN ?? ''

// Tracks whether init() has run this session, so closeCrashReporter() can tear
// down on opt-out and we never double-initialise.
let initialised = false

/**
 * Initialise Sentry crash reporting in the main process.
 * Call only when the user has opted in (crashReportingEnabled === true in settings).
 * If SENTRY_DSN is not set, this is a no-op.
 *
 * Collected:  error type, message, redacted stack trace, app version, OS, CPU arch.
 * Never sent: library contents, track titles, file paths, hostname/device name,
 *             or any personal data.
 *
 * Changes take effect on the next app launch.
 */
export function initCrashReporter(): void {
  if (!DSN || initialised) return

  Sentry.init({
    dsn: DSN,
    // Send every crash — pre-launch, each one is signal (see TELEMETRY.md)
    sampleRate: 1.0,
    // Crash reports only — no performance/tracing data
    tracesSampleRate: 0,
    // Never let the SDK attach IP, cookies, or other inferred PII
    sendDefaultPii: false,
    // Screenshots could capture personal data; always off
    attachScreenshot: false,
    beforeSend(event: ErrorEvent): ErrorEvent | null {
      // Strip user identity in case Sentry infers one from environment
      delete event.user

      // server_name defaults to the OS hostname, which is frequently the
      // user's real name (e.g. "Sams-MacBook-Pro"). Never transmit it.
      delete event.server_name

      // The device context block carries device name / model / memory — drop
      // it wholesale. Keep os/runtime context, which is just version strings.
      if (event.contexts) delete event.contexts.device

      // Redact absolute file paths in stack frames.
      // We keep the filename and line/column so bugs are still locatable,
      // but drop everything before the last path segment so the user's
      // home directory structure is never transmitted.
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              if (frame.filename) {
                frame.filename = frameBasename(frame.filename)
              }
              // abs_path is the raw OS path — always drop it
              if ('abs_path' in frame) delete (frame as Record<string, unknown>).abs_path
            }
          }
        }
      }

      // Breadcrumbs are NOT stripped here: the only breadcrumbs we emit come
      // from the logger (NFR-801 Phase 4), and each one is the already-redacted
      // NDJSON log line — home paths collapsed to '~', emails removed, stack
      // frames reduced to basenames. So they are safe by construction, and they
      // give crashes the leading context the file logs already capture.

      // Extra / request data should not be present in the main process,
      // but drop defensively
      delete event.extra
      delete event.request

      return event
    }
  })

  // Tag every issue with the per-launch session id so an exported log bundle
  // (which carries the same sid in meta.json + every NDJSON line) can be matched
  // to the Sentry issue. The sid is random per launch and non-identifying.
  Sentry.getCurrentScope().setTag('sid', getSessionId())

  // Begin mirroring redacted log lines into Sentry as breadcrumbs. The logger
  // only emits these while this flag is on, so breadcrumbs flow strictly while
  // crash reporting is active.
  setSentryBreadcrumbsActive(true)

  initialised = true
}

/**
 * Tear down crash reporting immediately. Called when the user withdraws consent
 * (toggles crash reporting off) so reporting stops the same session, without
 * waiting for a restart. No-op if the reporter was never initialised.
 */
export async function closeCrashReporter(): Promise<void> {
  if (!initialised) return
  // Stop the breadcrumb mirror first so no further log lines reach Sentry while
  // (or after) we tear down.
  setSentryBreadcrumbsActive(false)
  // Flush with a short timeout, then disable the client.
  await Sentry.close(2000)
  initialised = false
}
