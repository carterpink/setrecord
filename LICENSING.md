# SetSense Licensing — Founder's Runbook

This document is the single source of truth for everything you need to know
and do as the person who sells SetSense licenses. It assumes no cryptography
background. Skip to the section you need.

---

## Contents

1. [How a license key works](#1-how-a-license-key-works)
2. [The private key — where it lives and why it matters](#2-the-private-key)
3. [Generating the keypair for the first time](#3-generating-the-keypair)
4. [Minting a key for a paying customer](#4-minting-a-key)
5. [How the customer activates (one-click deep-link)](#5-how-the-customer-activates)
6. [Device binding — what it is and when to use it](#6-device-binding)
7. [Trial clock-rollback defence](#7-trial-clock-rollback-defence)
8. [Online revocation and refunds](#8-online-revocation)
9. [Common support scenarios](#9-common-support-scenarios)
10. [Key inventory and record-keeping](#10-key-inventory)

---

## 1. How a license key works

SetSense works offline — no internet required at a venue. That means the app
cannot phone home to ask "is this person allowed in?" every time it opens. Instead
we use **cryptographic signing**: you produce a key on your laptop, the customer
types or clicks it once, and from that point forward the app can verify it is
genuine without any network at all.

The technology is called **Ed25519**, the same algorithm used by SSH and Signal.
You have two mathematically linked pieces:

| Piece | Who holds it | What it can do |
|---|---|---|
| **Private key** | You only (your secrets vault) | *Sign* a license — produce a key that looks valid |
| **Public key** | Baked into every copy of the app | *Verify* a license — confirm it was signed by the private key |

A license key looks like this:

```
SES1.eyJ2IjoxLCJpZCI6IjEyMy4uLiJ9.Zm9vYmFyYmF6...
 ↑    ↑ customer info (base64)      ↑ signature (base64)
 tag  (anyone can read this part)   (only you could produce this)
```

Breaking it down:
- `SES1` — the SetSense version tag. Tells the app which format to expect.
- Middle segment — the payload: your customer's email, what they bought
  (`lifetime` or `subscription`), when it was issued, and optionally when it
  expires. Base64-encoded JSON — anyone can decode and read it, but that is fine
  because the security comes from the signature, not from hiding the data.
- Last segment — the Ed25519 signature of the middle segment. The app verifies
  this against the public key that is baked in at compile time. If the signature
  doesn't match — forged key, typo, or a key from a different private key — the
  app rejects it immediately.

**The app cannot forge keys.** It ships only the public key. Even if someone
reverse-engineers the binary they get nothing useful — the public key is useless
for minting.

---

## 2. The private key

**The private key is the single secret that makes the whole system work.**
If it leaks, anyone can generate valid-looking license keys for free.
Treat it like a bank password.

Rules, without exception:

- **Never write it into a source file.** Not even as a comment.
- **Never commit it to git** — not even to a private repo.
- **It is not in this repository.** The repo holds only the public key
  (`electron/services/licensing/signingKey.ts`). The minting script
  (`scripts/mint-license.mjs`) reads the private key exclusively from the
  environment variable `LICENSE_PRIVATE_KEY_PEM` at run time.
- **Never email it or paste it into Slack.** If you need to hand it to a
  fulfilment backend, use that service's secrets vault (e.g. a Stripe webhook
  function's environment variables, AWS Secrets Manager, 1Password Secrets
  Automation).
- **Store the canonical copy in 1Password** (or equivalent). Two copies max:
  one in your password manager, one in the fulfilment backend's vault.

Where NOT to put it:
- `.env` files in the repo
- Dotfiles synced via iCloud / Dropbox
- Any chat tool

---

## 3. Generating the keypair for the first time

You do this once. If you already have a keypair (you minted a key before), skip
this section — generating a new pair invalidates every key you've issued so far.

```bash
# Generate a new Ed25519 keypair. This creates two files.
openssl genpkey -algorithm ed25519 -out license-ed25519-private.pem
openssl pkey -in license-ed25519-private.pem -pubout -out license-ed25519-public.pem
```

After running this:

1. **Open `license-ed25519-public.pem`** and copy its entire contents (including
   the `-----BEGIN PUBLIC KEY-----` header and footer) into
   `electron/services/licensing/signingKey.ts` as `LICENSE_PUBLIC_KEY_PEM`.

2. **Store `license-ed25519-private.pem`** in 1Password (or your vault of choice).
   Delete the file from your filesystem once it's safely stored.

3. **Never commit the `.pem` files.** They are gitignored by default — verify
   with `git status` before any push.

---

## 4. Minting a key for a paying customer

Do this each time you need to issue a license manually (support comps, refund
replacements, tester access). In production your checkout webhook (Stripe /
Lemon Squeezy / Paddle) will call the minting script automatically; this section
covers the manual path.

### Prerequisites

The private key in your shell session:

```bash
export LICENSE_PRIVATE_KEY_PEM="$(pbpaste)"
# ↑ paste from 1Password; pbpaste reads the macOS clipboard
```

Or if you exported it to a temp file:

```bash
export LICENSE_PRIVATE_KEY_PEM="$(cat /tmp/license-ed25519-private.pem)"
```

Verify it loaded: `echo "$LICENSE_PRIVATE_KEY_PEM"` should show `BEGIN PRIVATE KEY`.

### Lifetime key

```bash
node scripts/mint-license.mjs \
  --plan lifetime \
  --email dj@example.com \
  --customer ORDER-123
```

- `--email` — the buyer's email. Shown in the app under "License details".
- `--customer` — your order ID from the payment provider. Used if you ever need
  to revoke the key via the gateway. Optional but recommended.

### Monthly subscription

```bash
node scripts/mint-license.mjs \
  --plan subscription \
  --months 1 \
  --email dj@example.com \
  --customer ORDER-123
```

- `--months` — how many months until the key expires. Default 1 if omitted.
  For an annual plan use `--months 12`.

### The output

The script prints the payload (so you can confirm the details) and then the
key on its own line. Copy the key — `SES1.…` — and include it in the
customer's receipt email, **or** redirect them to the activation deep-link
(see section 5 below). The key is the only thing the customer needs.

---

## 5. How the customer activates (one-click deep-link)

SetSense is registered as the OS handler for the `setsense://` URL scheme
(declared in `electron-builder.yml`). Your checkout backend should redirect
the customer to:

```
setsense://activate?key=SES1.<payload>.<signature>
```

When the customer clicks that link (in their browser, in their email client, or
in a payment confirmation page), macOS hands the URL to SetSense, which:

1. Extracts the key from the URL.
2. Verifies the Ed25519 signature.
3. Calls `activateLicense()` — same code path as the manual entry field.
4. If valid, stores the key in the macOS Keychain and switches the app to Pro.
5. Shows an "Activated — welcome to SetSense Pro" confirmation to the user.

**The key is still verified.** The deep-link is just convenience routing — a
forged or malformed link is rejected by the same Ed25519 check as a manually
typed key.

### Building the redirect URL in your checkout backend

The checkout URL the app opens already passes `redirect=setsense://activate` to
your checkout backend (built by `checkoutUrl()` in `signingKey.ts`). Your backend:

1. Receives the "order paid" webhook.
2. Mints a key (calls `mint-license.mjs` or the equivalent server-side function).
3. URL-encodes the key and appends it: `setsense://activate?key=<encoded-key>`.
4. Redirects the customer's browser to that URL.

The customer's browser fires the OS URL handler → SetSense opens and activates.

### Manual fallback

If the customer copies the key from their email and opens Settings → SetSense Pro
→ Activate, the text field path goes through the exact same `activateLicense()`
function. Both routes are tested.

---

## 6. Device binding

By default, a key is a **bearer token**: whoever has it can activate it on any
machine. For most lifetime buyers this is correct — they might reinstall, get a
new laptop, etc.

When you want to tie a key to a specific machine (stronger anti-sharing for
subscriptions, or a corporate seat), mint a v2 key:

```bash
# First, find out the customer's device id. They can see it at
# Settings → SetSense Pro → Device ID (or you can ask them via support).
node scripts/mint-license.mjs \
  --plan subscription \
  --months 1 \
  --email dj@example.com \
  --device <their-device-id>
```

The `deviceId` field in the key payload is an anonymous random UUID — **not**
a hardware fingerprint. It has no PII. If the customer gets a new laptop, issue
them a replacement key bound to the new device id; no refund or anything else
required.

To issue a key that is explicitly portable (v2 format but works on any machine):

```bash
node scripts/mint-license.mjs --plan lifetime --email dj@example.com --portable
```

All v1 keys (the default when no device/customer/portable flag is passed) are
treated as portable forever, for backward compatibility.

---

## 7. Trial clock-rollback defence

New users who import a Rekordbox library get a 7-day free Pro trial automatically.
We defend against the obvious cheat (winding the macOS clock back to extend it):

- Every time the app runs, it saves the current time as a "last seen at" timestamp
  in a local file (`~/Library/Application Support/SetSense/license-state.json`).
- This high-water mark only ever moves forward — it is never decreased.
- Expiry for the trial (and for subscription keys) is judged against
  `max(now, last-seen-at)`, so setting the clock to yesterday accomplishes nothing
  once the app has run today.

This is a deterrent, not a vault: the file is editable by a technical user.
That is fine — we are deterring casual cheating, not nation-state adversaries.
Honest paying customers are never locked out: if the clock looks wrong we surface
a soft warning but never revoke access.

---

## 8. Online revocation

The license gateway (`electron/services/licensing/gateway.ts`) is **disabled by
default** (`LICENSE_API_BASE = null`). When you wire up a backend, the app
will contact it once per launch to ask "is this key still valid?" The answer is
cached, so the check works offline after the first contact.

The gateway never blocks the user. An unreachable endpoint means "keep trusting
the offline signature." This is intentional — a flaky server must never lock
a DJ out mid-gig.

### How to revoke after a refund

Without a live gateway: you cannot revoke an issued key remotely. The key works
until it expires (subscriptions) or indefinitely (lifetime). This is the
trade-off of going offline-first.

With a live gateway: call `POST /v1/check` on your backend, mark the key
`revoked: true`, and the next time the app connects it will drop to free. The
cached verdict survives offline sessions until the next reachable check.

---

## 9. Common support scenarios

### "I lost my key / deleted my email."

Mint a replacement key with the same email and customer ID. The old key still
works (you can't revoke it without a gateway), but the customer only needs
one valid key so this is harmless.

### "I got a new laptop."

If their old key was a portable/v1 key (the default), they simply activate it
on the new machine — it works immediately. If it was device-bound, mint a new
key with `--device <new-device-id>`.

### "SetSense says my key is expired."

For a subscription key, check the `expiresAt` in the key payload (it's base64
JSON — decode with `atob()` in any browser DevTools or `echo "PAYLOAD" | base64 -d`).
If the expiry is wrong, mint a replacement key. If the customer's clock is
behind by more than 24 hours, the app will show a clock warning — ask them to
sync their system clock.

### "A friend shared the same key and now it's rejected."

Only possible if the key was device-bound. The first machine to activate "wins".
You can issue the sharing customer a new portable key (as a goodwill gesture)
and the friend a fresh purchase link.

---

## 10. Key inventory and record-keeping

Keep a spreadsheet (outside the repo) with at minimum:

| Column | Example |
|---|---|
| Order ID | ORDER-123 |
| Email | dj@example.com |
| Plan | lifetime |
| Issued at | 2026-06-02 |
| Key prefix (last 4 of sig) | SES1·••••·AB3F |
| Device bound? | No |
| Notes | — |

You do not need to store the full key — the "last 4 of signature" gives you
enough to match what a customer pastes if they need support. The app shows the
same masked form in Settings.

---

*Questions or edge cases not covered here? Email carterpinkmusic@gmail.com.*
