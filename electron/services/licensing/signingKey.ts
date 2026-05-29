/**
 * SetSense licensing — verification material + commerce constants.
 *
 * SetSense is offline-first (PRD §2): the app must validate a purchase with no
 * network, at a venue, on a laptop with no WiFi. We therefore use Ed25519
 * *offline-signed* license keys. The signing (private) key lives only with the
 * issuing authority (see scripts/mint-license.mjs) and is NEVER bundled into
 * the app. This file ships only the PUBLIC key, which can verify a signature
 * but cannot mint a valid one — so a leaked binary cannot forge licenses.
 *
 * Key wire format (compact, JWT-ish but Ed25519):
 *   SES1.<base64url(payloadJSON)>.<base64url(signature)>
 * The payload is a `LicensePayload`. The signature covers the payload bytes.
 */

/** Ed25519 SPKI public key. Pair lives in scripts/mint-license.mjs (issuer-only). */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAIaXts10rDORhwzq2F9VyNEoljpsFgxjlSIKjaiVt+9w=
-----END PUBLIC KEY-----`

/** Prefix that tags a SetSense license key and pins the payload schema version. */
export const LICENSE_KEY_PREFIX = 'SES1'

/** The signed body encoded inside a license key. */
export interface LicensePayload {
  /** Schema version — bumped if the payload shape ever changes. */
  v: 1
  /** Opaque license id (order id from the store). */
  id: string
  /** Which product was bought. */
  plan: 'lifetime' | 'subscription'
  /** Buyer email, shown in the manage-license UI. */
  email: string
  /** ISO issue timestamp. */
  issuedAt: string
  /** ISO expiry — present for subscriptions, omitted for lifetime. */
  expiresAt?: string
}

// ── Commerce ────────────────────────────────────────────────────────────────
// Display strings live here so the paywall and any receipts stay in lockstep.

export const PRICING = {
  subscription: { label: '$12', period: '/month', amount: 12 },
  lifetime: { label: '$89', period: 'one-time', amount: 89 },
} as const

/** Suggested tip amounts (USD) for the "support the developer" path. */
export const TIP_AMOUNTS = [5, 12, 25] as const

/**
 * Host the checkout/support pages live on. Kept separate from the Discover
 * shell allowlist so commerce links and content links can be reasoned about
 * independently.
 */
export const COMMERCE_HOST = 'setsense.app'

/** Build the external checkout URL for a given plan or a tip. */
export function checkoutUrl(plan: 'subscription' | 'lifetime' | 'tip', tipAmount?: number): string {
  if (plan === 'tip') {
    const amt = tipAmount && tipAmount > 0 ? `?amount=${Math.round(tipAmount)}` : ''
    return `https://${COMMERCE_HOST}/support${amt}`
  }
  return `https://${COMMERCE_HOST}/checkout?plan=${plan}`
}
