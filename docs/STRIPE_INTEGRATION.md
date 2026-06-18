# SetRecord × Stripe — Checkout & Licensing Integration

This is the **contract the app expects** from the commerce backend. The app is
offline-first: it never talks to Stripe directly and never needs a network at
run time to validate a purchase. Stripe + your backend mint an **Ed25519-signed
license key**, hand it to the app via a deep link, and the app verifies it
locally. Build your Stripe flow to satisfy the four contracts below.

> TL;DR for the backend: receive a Stripe payment → mint a `SES1.…` key whose
> payload matches §3 → redirect the browser to `setrecord://activate?key=…`. Done.

---

## 0. The end-to-end flow

```
 In-app "Go Pro" (UpgradeModal)
        │  opens external browser to:
        ▼
 https://setrecord.app/checkout?plan=annual&redirect=setrecord%3A%2F%2Factivate
        │  your page maps plan → Stripe Price, creates a Checkout Session
        ▼
 Stripe Checkout (card entry)  ──pays──►  Stripe
        │                                   │ webhook: checkout.session.completed
        │ success_url                        ▼
        ▼                            your backend mints a signed key
 your /activated page  ◄──────────────────  (scripts/mint-license.mjs logic)
        │  redirects to:
        ▼
 setrecord://activate?key=SES1.<payload>.<sig>
        │  OS routes the deep link back to the app
        ▼
 App verifies signature locally (Ed25519 public key) → unlocks Pro
```

Two delivery paths, support **both**:
1. **Deep link** (primary): `success_url` → a page that 302-redirects to
   `setrecord://activate?key=…`. The app auto-activates, zero copy-paste.
2. **Email fallback**: also email the raw `SES1.…` key. The user can paste it
   into UpgradeModal → "Already purchased? Enter your key". Always send this in
   case the deep link is blocked.

---

## 1. Checkout URL contract (app → your site)

The app builds these URLs (`electron/services/licensing/signingKey.ts` →
`checkoutUrl()`), opens them in the default browser, and restricts itself to the
`setrecord.app` host (`electron/main.ts`, `license:checkout`).

| Action | URL the app opens |
|---|---|
| Subscribe monthly | `https://setrecord.app/checkout?plan=monthly&redirect=setrecord://activate` |
| Subscribe annual | `https://setrecord.app/checkout?plan=annual&redirect=setrecord://activate` |
| Buy lifetime | `https://setrecord.app/checkout?plan=lifetime&redirect=setrecord://activate` |
| Tip | `https://setrecord.app/support?amount=12&redirect=setrecord://activate` |

- `plan` ∈ `monthly | annual | lifetime`. **You** map each to a Stripe Price.
- `redirect` is the deep-link base; append the minted key as `?key=` when you
  send the browser back (URL-encode it).
- The host **must stay `setrecord.app`** — the app refuses any other host.

### Suggested Stripe Prices

| `plan` | Stripe Price | Type | Amount |
|---|---|---|---|
| `monthly` | `price_monthly` | recurring / month | **$9.00** |
| `annual` | `price_annual` | recurring / year | **$79.00** |
| `lifetime` | `price_lifetime` | one-time | **$199.00** |
| tip | ad-hoc `price_data` | one-time | custom (`amount`) |

> Pricing rationale & the no-monthly-cannibalisation math live in
> `docs/PRICING_AND_MARKETING.md` and `electron/services/licensing/signingKey.ts`.

---

## 2. License key wire format

```
SES1.<base64url(payloadJSON)>.<base64url(ed25519_signature)>
```

- `SES1` is the fixed prefix (`LICENSE_KEY_PREFIX`).
- Middle segment: `base64url(JSON.stringify(payload))` — the payload in §3.
- Last segment: `base64url` of the **Ed25519 signature over the payload bytes**
  (the exact UTF-8 bytes you base64url-encoded, *before* encoding).
- Sign with the **private** key that lives only in `scripts/mint-license.mjs`
  (issuer-only — never ship it). The app embeds only the matching **public** key
  (`LICENSE_PUBLIC_KEY_PEM`), so a leaked binary cannot forge keys.

Your Stripe webhook handler should import/reuse the signing logic from
`scripts/mint-license.mjs` so app and backend stay byte-compatible.

---

## 3. `LicensePayload` schema (what you must sign)

From `electron/services/licensing/signingKey.ts`:

```ts
interface LicensePayload {
  v: 1 | 2                              // use 2
  id: string                           // your order/license id (e.g. Stripe object id)
  plan: 'lifetime' | 'subscription'    // NB: annual & monthly are BOTH 'subscription'
  email: string                        // buyer email (shown in Manage Licence)
  issuedAt: string                     // ISO 8601
  expiresAt?: string                   // ISO — REQUIRED for subscription, OMIT for lifetime
  // ── v2 optional ─────────────────────────────────────────────
  deviceId?: string                    // bind to one device (omit ⇒ not bound)
  portable?: boolean                   // true ⇒ ignore device binding (works anywhere)
  customerId?: string                  // Stripe customer id, for support + revocation
}
```

### Plan → payload mapping (the important table)

| App `plan` param | payload `plan` | `expiresAt` |
|---|---|---|
| `monthly` | `subscription` | `issuedAt + 1 month` (use Stripe `current_period_end`) |
| `annual` | `subscription` | `issuedAt + 1 year` (use Stripe `current_period_end`) |
| `lifetime` | `lifetime` | **omit** |

- For subscriptions, set `expiresAt` to the Stripe **`current_period_end`** of
  the paid invoice. The app drops to free the moment `expiresAt` passes
  (rollback-resistant — see §6).
- **Device binding:** the simplest Stripe-only flow mints **portable** keys —
  set `portable: true` (or omit `deviceId`). Only use device binding if you run
  the optional gateway in §5. Portable keys "just work" on any machine, matching
  a friendly indie UX; the tradeoff is they can be shared.

---

## 4. Webhooks → minting (the recurring-renewal gotcha)

The app does **not** auto-renew. A subscription key simply contains an
`expiresAt`; when it lapses, Pro turns off. So for a *recurring* Stripe sub you
must **re-mint a fresh key after every successful renewal** and re-deliver it.

| Stripe event | Do this |
|---|---|
| `checkout.session.completed` | First payment (lifetime *or* first sub period). Mint key, redirect to deep link, email key. |
| `invoice.paid` | A renewal cleared. Mint a **new** key with `expiresAt = current_period_end`. Email it (deep-link optional). |
| `customer.subscription.deleted` | Sub cancelled/ended. Mark `revoked` in the gateway DB (§5) if you run one. |
| `charge.refunded` / `charge.dispute.created` | Refund/chargeback. Mark `revoked` (§5). |

> Renewal delivery: emailing the refreshed key is the robust path (the app may
> not be open when the invoice clears). The user pastes it, or clicks the
> emailed `setrecord://activate?key=…` link. The in-app "Pro ends in N days —
> renew" chip (added this release) nudges them ~14 days before `expiresAt`.

---

## 5. (Optional) Online gateway — device binding & revocation

`electron/services/licensing/gateway.ts` is a ready client for an optional
server. It is **disabled by default** (`LICENSE_API_BASE = null`). If you host
it, the app will best-effort device-bind on activation and poll for revocation.

| Endpoint | Purpose |
|---|---|
| `POST /v1/activate` | body `{ keyOrOrderToken, deviceId }` → returns a device-bound key |
| `POST /v1/check` | body `{ licenseId, deviceId }` → `{ revoked, expiresAtOverride }` |

Rules the app enforces:
- The gateway can **only shorten** `expiresAt`, never extend it.
- Network failure ⇒ the app keeps its cached offline verdict and never locks
  the user out at a gig.
- **Without** the gateway, an already-issued offline key **cannot be remotely
  revoked** (by design — offline-first). If chargeback protection matters, run
  the gateway and mint device-bound (non-portable) keys.

---

## 6. Anti-abuse already handled by the app (don't reimplement)

- **Signature**: forged/edited keys fail Ed25519 verification → rejected.
- **Clock rollback**: expiry is judged against `max(now, lastSeenAt)` high-water
  mark, so winding the system clock back can't extend a sub.
- **Device mismatch / revoked**: surfaced with humane copy in Settings.
- **Trial**: a 7-day full-Pro trial arms on first import (local, set-once). It is
  independent of Stripe — you don't need to do anything for it.

---

## 7. Backend build checklist

- [ ] Create 3 Stripe Prices ($9/mo, $79/yr, $199 once) + tip handling.
- [ ] `GET /checkout?plan=&redirect=` → map `plan`→Price → create Checkout
      Session → 303 to Stripe. Put `plan` (and `deviceId` if used) in session
      `metadata`. Set `success_url` to your `/activated` page.
- [ ] `GET /support?amount=&redirect=` → one-time Checkout with `amount`.
- [ ] Webhook endpoint verifying Stripe signatures; handle the 4 events in §4.
- [ ] Mint helper (reuse `scripts/mint-license.mjs`): build payload per §3, sign,
      format `SES1.…`.
- [ ] `/activated` page: 302 → `setrecord://activate?key=<urlencoded key>`, and
      also show the key + "open SetRecord" button as a fallback.
- [ ] Email the key on every mint (first purchase **and** each renewal).
- [ ] (Optional) Host `/v1/activate` + `/v1/check`; set `LICENSE_API_BASE` in
      `gateway.ts` and ship device-bound keys.
- [ ] Test: paste a freshly minted key into UpgradeModal → it should flip to
      "You're on Pro". Then test the `setrecord://` deep link end-to-end.

---

## 8. App-side reference (where this lives)

| Concern | File |
|---|---|
| Prices, checkout URL builder, key format, payload type | `electron/services/licensing/signingKey.ts` |
| Verify + entitle + trial + rollback logic | `electron/services/licenseService.ts` |
| Optional online gateway client | `electron/services/licensing/gateway.ts` |
| Device id (keychain UUID) | `electron/services/licensing/deviceId.ts` |
| IPC: `license:checkout`, `license:activate`, deep-link intake | `electron/main.ts`, `electron/preload.ts` |
| Paywall UI + key entry | `src/components/modals/UpgradeModal.tsx` |
| Renewal nudge (`computeRenewal`, 14-day window) | `src/stores/licenseStore.ts` |
| Mint script (holds PRIVATE key — issuer only) | `scripts/mint-license.mjs` |
