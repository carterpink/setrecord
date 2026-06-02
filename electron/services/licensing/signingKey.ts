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

/**
 * The signed body encoded inside a license key.
 *
 * v1 keys (no device fields) are treated as *portable* for backward
 * compatibility — every license minted before device-binding keeps working on
 * any machine. v2 adds device-binding + a customer id so refunds/charge-backs
 * can be tied to an order and a shared key can be rejected on a foreign device.
 */
export interface LicensePayload {
  /** Schema version. v1 = bearer token; v2 = device-bindable. */
  v: 1 | 2
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
  // ── v2 fields (all optional so v1 keys still satisfy the type) ────────────
  /** Anonymous device id this key is bound to. Absent ⇒ not device-bound. */
  deviceId?: string
  /** When true, ignore device binding — the key works on any machine. */
  portable?: boolean
  /** Order/customer id from the store, for support + server-side revocation lookups. */
  customerId?: string
}

// ── Commerce ────────────────────────────────────────────────────────────────
// Display strings live here so the paywall and any receipts stay in lockstep.

export const PRICING = {
  subscription: { label: '$12', period: '/month', amount: 12 },
  lifetime: { label: '$89', period: 'one-time', amount: 89 }
} as const

/** Suggested tip amounts (USD) for the "support the developer" path. */
export const TIP_AMOUNTS = [5, 12, 25] as const

/**
 * Host the checkout/support pages live on. Kept separate from the Discover
 * shell allowlist so commerce links and content links can be reasoned about
 * independently.
 */
export const COMMERCE_HOST = 'setsense.app'

/**
 * Custom URL scheme the OS routes back to the app after checkout. The full
 * activation deep-link looks like `setsense://activate?key=SES1.…`. Kept as a
 * single constant so the planned product rename only has to touch one line
 * (the scheme is also baked into the macOS Info.plist — see electron-builder.yml).
 */
export const ACTIVATION_SCHEME = 'setsense'

/** The deep-link the checkout backend should redirect to once a key is minted. */
export const ACTIVATION_DEEP_LINK = `${ACTIVATION_SCHEME}://activate`

/**
 * Validate an inbound activation deep-link and pull the raw license key out of
 * it. Returns `null` for anything that isn't our `activate` link — the key
 * itself is NOT trusted here; it still passes through the Ed25519 verification
 * in licenseService before it can grant Pro, so a forged link can't entitle.
 */
export function parseActivationUrl(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  // URL parses the scheme with a trailing colon.
  if (url.protocol !== `${ACTIVATION_SCHEME}:`) return null
  // Accept both setsense://activate and setsense:///activate shapes — the host
  // or the first path segment may carry "activate" depending on the OS.
  const action = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase()
  if (action !== 'activate') return null
  const key = url.searchParams.get('key')?.trim()
  // Cap the length defensively — a real key is well under 1KB.
  if (!key || key.length > 1024) return null
  return key
}

/** Build the external checkout URL for a given plan or a tip. */
export function checkoutUrl(plan: 'subscription' | 'lifetime' | 'tip', tipAmount?: number): string {
  // Tell the checkout backend where to send the buyer once payment clears, so
  // it can redirect to `setsense://activate?key=…` and the app self-activates
  // instead of relying on a manual copy-paste from the confirmation email.
  const redirect = `redirect=${encodeURIComponent(ACTIVATION_DEEP_LINK)}`
  if (plan === 'tip') {
    const amt = tipAmount && tipAmount > 0 ? `amount=${Math.round(tipAmount)}&` : ''
    return `https://${COMMERCE_HOST}/support?${amt}${redirect}`
  }
  return `https://${COMMERCE_HOST}/checkout?plan=${plan}&${redirect}`
}
