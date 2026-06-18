/**
 * NFR-801 Phase 4 — feedback diagnostics helpers.
 *
 * Pure, dependency-free logic shared by the renderer FeedbackModal and the
 * main-process feedback:submit handler. Kept here (rather than inline) so the
 * Bug-attach decision and the mailto body composition are unit-testable without
 * standing up Electron or a DOM.
 */

/** The feedback category whose reports attach diagnostics by default. */
export const BUG_CATEGORY = 'Bug'

/** Non-identifying, per-launch correlation handle for a report. */
export interface FeedbackDiagnostics {
  /** Random-per-launch session id (also a Sentry tag + in every log line). */
  sid: string
  /** App version string. */
  version: string
}

/**
 * Whether a category should offer / default to attaching diagnostic logs.
 * Only Bug reports do; everything else never attaches.
 */
export function shouldAttachDiagnostics(category: string): boolean {
  return category === BUG_CATEGORY
}

/**
 * Compose the plain-text mailto body for a feedback report. The diagnostics
 * line (session id + version) is appended for Bug reports so even an UN-attached
 * report is correlatable to its Sentry issue. Falsy sections are dropped.
 *
 * Note: this body is user-composed message + reply email + non-identifying
 * sid/version + a client meta string. It never contains track titles, venues,
 * or library paths.
 */
export function buildFeedbackBody(payload: {
  message: string
  email?: string
  meta?: string
  diagnostics?: FeedbackDiagnostics
}): string {
  const { message, email, meta, diagnostics } = payload
  return [
    message,
    '',
    email ? `Reply to: ${email}` : '',
    diagnostics ? `\nDiagnostics — session ${diagnostics.sid} · v${diagnostics.version}` : '',
    meta ? `\n— ${meta}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}
