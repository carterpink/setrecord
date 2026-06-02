import { describe, it, expect } from 'vitest'
import {
  parseActivationUrl,
  checkoutUrl,
  ACTIVATION_DEEP_LINK,
  ACTIVATION_SCHEME
} from '../electron/services/licensing/signingKey'

describe('parseActivationUrl', () => {
  it('extracts the key from a well-formed activation deep-link', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=SES1.payload.sig`)).toBe(
      'SES1.payload.sig'
    )
  })

  it('accepts the triple-slash shape where activate is a path segment', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}:///activate?key=TEST`)).toBe('TEST')
  })

  it('trims surrounding whitespace from the key', () => {
    expect(
      parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=${encodeURIComponent(' SES1.x ')}`)
    ).toBe('SES1.x')
  })

  it('rejects a foreign scheme', () => {
    expect(parseActivationUrl('https://setsense.app/activate?key=SES1.x')).toBeNull()
  })

  it('rejects the right scheme but wrong action', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://checkout?key=SES1.x`)).toBeNull()
  })

  it('rejects a link with no key', () => {
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate`)).toBeNull()
  })

  it('rejects an absurdly long key rather than passing it downstream', () => {
    const huge = 'A'.repeat(2000)
    expect(parseActivationUrl(`${ACTIVATION_SCHEME}://activate?key=${huge}`)).toBeNull()
  })

  it('returns null for garbage input instead of throwing', () => {
    expect(parseActivationUrl('not a url')).toBeNull()
  })
})

describe('checkoutUrl', () => {
  it('appends the activation deep-link as the return context for plan checkout', () => {
    const url = new URL(checkoutUrl('lifetime'))
    expect(url.searchParams.get('plan')).toBe('lifetime')
    expect(url.searchParams.get('redirect')).toBe(ACTIVATION_DEEP_LINK)
  })

  it('carries both the tip amount and the redirect for the support path', () => {
    const url = new URL(checkoutUrl('tip', 25))
    expect(url.searchParams.get('amount')).toBe('25')
    expect(url.searchParams.get('redirect')).toBe(ACTIVATION_DEEP_LINK)
  })
})
