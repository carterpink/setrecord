/**
 * NFR-801 Phase 4 — feedback Bug-attach logic.
 *
 * Covers the pure helpers shared by the FeedbackModal and the feedback:submit
 * handler: which categories attach diagnostics, and how the mailto body carries
 * the session id + version (so an un-attached Bug report is still correlatable
 * to its Sentry issue).
 */
import { describe, it, expect } from 'vitest'
import {
  shouldAttachDiagnostics,
  buildFeedbackBody,
  BUG_CATEGORY
} from '../electron/services/logging/feedbackDiagnostics'

describe('shouldAttachDiagnostics', () => {
  it('is true only for Bug reports', () => {
    expect(shouldAttachDiagnostics(BUG_CATEGORY)).toBe(true)
    expect(shouldAttachDiagnostics('Bug')).toBe(true)
    expect(shouldAttachDiagnostics('Idea')).toBe(false)
    expect(shouldAttachDiagnostics('Love')).toBe(false)
    expect(shouldAttachDiagnostics('Other')).toBe(false)
  })
})

describe('buildFeedbackBody', () => {
  it('appends a sid + version diagnostics line when diagnostics are present', () => {
    const body = buildFeedbackBody({
      message: 'crash on import',
      diagnostics: { sid: 'abc-123', version: '1.4.2' }
    })
    expect(body).toContain('crash on import')
    expect(body).toContain('Diagnostics — session abc-123 · v1.4.2')
  })

  it('omits the diagnostics line entirely when none are provided', () => {
    const body = buildFeedbackBody({ message: 'love the app' })
    expect(body).toContain('love the app')
    expect(body).not.toContain('Diagnostics')
    expect(body).not.toMatch(/session/i)
  })

  it('includes a reply-to line only when an email is given', () => {
    const withEmail = buildFeedbackBody({ message: 'm', email: 'dj@example.com' })
    expect(withEmail).toContain('Reply to: dj@example.com')
    const without = buildFeedbackBody({ message: 'm' })
    expect(without).not.toContain('Reply to:')
  })

  it('carries no library content — only the user message, email, meta, sid/version', () => {
    const body = buildFeedbackBody({
      message: 'it broke',
      email: 'dj@example.com',
      meta: 'Sent from SetRecord · MacIntel',
      diagnostics: { sid: 'sid-xyz', version: '2.0.0' }
    })
    // Exactly the four user-facing/correlation fragments — nothing inferred.
    expect(body).toContain('it broke')
    expect(body).toContain('Reply to: dj@example.com')
    expect(body).toContain('Sent from SetRecord · MacIntel')
    expect(body).toContain('session sid-xyz · v2.0.0')
  })
})
