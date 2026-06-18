# SetRecord — Security & Release Launch Checklist

Status legend: ✅ done in repo · ⚠️ needs your action · 🔲 out-of-repo / manual

This is the punch list distilled from the pre-launch audit (Electron security,
licensing/crypto, data & file-import safety, payments/telemetry/privacy, release
& scale readiness). Items marked ✅ were fixed in the codebase; ⚠️/🔲 need you.

---

## 0. Revenue integrity — the fulfilment Worker (DO THIS FIRST)

The Cloudflare Worker `setrecord-fulfilment.<…>.workers.dev` mints the real
Ed25519-signed keys. It is **not in this repo**, so the audit could not see it.
If it doesn't verify the Lemon Squeezy webhook signature before minting, anyone
who finds the URL can forge a "purchase" and mint unlimited valid Pro keys.

**Verify the Worker does ALL of these before it ever calls the signer:**

- 🔲 **Verify the webhook HMAC.** Compute `HMAC-SHA256(rawRequestBody, LEMON_SQUEEZY_WEBHOOK_SECRET)` and compare to the `X-Signature` header using a **constant-time** compare (`crypto.subtle` / timingSafeEqual — never `===`). Reject on mismatch with 401.
  - Use the **raw** body bytes for the HMAC, not a re-serialized JSON object.
- 🔲 **Assert the event type** is one you expect (`order_created` / `subscription_created` / `subscription_updated`) and ignore others.
- 🔲 **Assert the order is actually paid** (`data.attributes.status === 'paid'` / `'active'`) — don't mint on `pending`/`refunded`.
- 🔲 **Idempotency:** key minting on the LS order/subscription id so a replayed webhook can't mint twice. Store issued license ids (KV/D1).
- 🔲 **Bind on first activation (anti-piracy):** `/v1/activate` receives the app's anonymous `deviceId`. Re-issue a key with that `deviceId` baked in and return it. After this, the key is rejected on any other machine (`evaluateLicense → device-mismatch`). The app **already** stores the re-issued bound key — this is the single highest-leverage anti-piracy lever and it's purely a Worker change. (See `scripts/mint-license.mjs` header "RECOMMENDED PRODUCTION FLOW".)
- 🔲 **Revocation on refund/chargeback:** handle `subscription_cancelled` / `order_refunded` → mark the license id revoked so `/v1/check` returns `revoked:true`. The app honours this on its once-per-launch online check.
- 🔲 **Secrets live only in the Worker vault** (webhook secret, `LICENSE_PRIVATE_KEY_PEM`). Never in the app, never in git. (Repo scan confirmed none are committed. ✅)
- 🔲 **Rotate the signing key if it was ever on a laptop in plaintext** outside a vault. Back up the private key offline — losing it means you can't mint or renew.

A 10-line forged-webhook test (POST a fake `order_created` with a bad signature
→ expect 401; with no signature → 401) is worth writing against the Worker.

---

## 1. Release blockers (fix before distributing the build)

- ✅ **Update channel was pointed at the wrong repo** (`setrecordnsev2` → `setrecordv2`). Fixed in `electron/services/updateChecker.ts`; pinned by `tests/configInvariants.test.ts` so it can't drift from `electron-builder.yml` again. Without this, you could never notify installed users of a security patch.
- ✅ **Migrations are now crash-safe.** `electron/db/schema.ts` takes a `library.db.bak-v{N}` snapshot before any migration and wraps the whole run in one transaction (rolls back on failure). A half-finished migration previously could destroy an irreplaceable library.
- ✅/⚠️ **Notarized DMG is now built + verified in CI** by `.github/workflows/release.yml` (tag-triggered: `git tag v1.0.0 && git push origin v1.0.0`). It gates on typecheck/lint/test, runs `electron-builder --mac --publish always`, then **fails the release** unless `codesign --verify`, `spctl` (Gatekeeper primary-signature), and `xcrun stapler validate` all pass. **⚠️ You must add the Apple secrets** for it to work: `CSC_LINK` (base64 of your Developer ID Application .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Until those exist the signing step will fail (loudly, which is the point). Local equivalent for a one-off check: `npm run build:mac` then the same three asserts against `dist/mac*/SetRecord.app` and `dist/*.dmg`.
- ⚠️ **Add mic/camera hardened-runtime entitlements.** `build/entitlements.mac.plist` is missing `com.apple.security.device.audio-input` (and camera). Under hardened runtime this can make the OS deny mic access (Black Box / voice). Add them.
- ⚠️ **CI never packages or smoke-tests the real app.** Add a Playwright `_electron.launch()` smoke test (boots, opens a window, loads the library) so a native-module ABI mismatch or bad `asarUnpack` can't ship undetected.
- ⚠️ **Electron version drift:** `package.json` pins Electron `^39.x` while docs say "Electron 33." Confirm native modules (`better-sqlite3`, `keytar`, `@journeyapps/sqlcipher`, `smart-whisper`) are rebuilt against the Electron you actually ship, and add `node_modules/better-sqlite3/**` + `node_modules/keytar/**` to `asarUnpack`.

---

## 2. Security hardening (fixed in repo)

- ✅ **Arbitrary file read confined.** `media://` handler and `audio:read-file` now reject any path that isn't a known library file or an app cache dir (`electron/services/mediaAccess.ts`). `media://local/etc/passwd` → 403.
- ✅ **CSP tightened.** Dropped JS `unsafe-eval` (kept `wasm-unsafe-eval` for the OCR WASM) and removed `file:` from `media-src` in `index.html`; removed `unsafe-eval` entirely from `overlay.html`. ⚠️ **Verify once:** run `npm run dev` and exercise the OCR/import flow — if anything eval-dependent breaks, the one-token revert is `wasm-unsafe-eval` → `unsafe-eval`.
- ✅ **Navigation locked down.** `setWindowOpenHandler` now allowlists `https:`/`mailto:` before `shell.openExternal`; added `will-navigate`/`will-redirect` guards so the privileged window can't be steered to a remote origin.
- ✅ **CSV formula injection neutralized** (`electron/services/beatport/csvExport.ts`) — a track titled `=cmd|…` can no longer execute when a label opens your export in Excel. Covered by `tests/beatportExport.test.ts`.
- ⚠️ **Flip `sandbox: true`** on both BrowserWindows (`electron/main.ts`) for defense-in-depth. The preload only uses `contextBridge`/`ipcRenderer`, so this should work — verify the app still boots and the overlay renders.
- ⚠️ **Gate the dev Pro-bypass on `app.isPackaged`, not `NODE_ENV`** (`electron/services/licenseService.ts:305`). `NODE_ENV` is an env var an attacker could set on a packaged build to unlock Pro; `app.isPackaged` can't be spoofed.

---

## 3. Privacy & data-at-rest (your "local-first" claim)

- ✅ **In-transit privacy holds.** Audio/library/taste data never leave the device. Outbound calls are a small, fail-soft, mostly-optional set (licensing gateway, GitHub update check, optional HF model download, Lemon Squeezy checkout in browser, opt-in Sentry). Sentry is genuinely off-by-default and consent-gated; redaction is applied to both the local log file and Sentry.
- ⚠️ **At-rest encryption is NOT real.** `library.db` is opened with plain `better-sqlite3` — no SQLCipher key. Your whole library + gig history is cleartext on disk. You confirmed you don't currently claim encryption, so this is **deferred, not blocking** — but:
  - **Do:** keep all marketing copy free of "encrypted"/"encryption at rest" claims until it's implemented.
  - **Later (recommended):** open `library.db` via `@journeyapps/sqlcipher` with a per-install random key stored in keytar (`secretStore.ts` already does keychain storage). Then you can truthfully sell "your library is encrypted on your machine," which is a real differentiator for a privacy-positioned tool. Treat the migration carefully (it re-writes the DB) — gate behind the new backup path.
- ⚠️ **Tighten log redaction denylist.** Redaction catches emails + home-dir paths, but a track title logged as a free string isn't scrubbed. Add a key denylist (`title`, `artist`, `path`, `email`, `key`) that's dropped/masked regardless of shape (`electron/services/logging/redact.ts`).
- ℹ️ **Dead code:** the Sentry breadcrumb mirror (`logger.ts setSentryBreadcrumbsActive`) is never called — currently a privacy plus. Either delete it or wire+re-verify redaction; don't leave it half-wired.

---

## 4. Scale (per-user, not per-business)

- ⚠️ **Library-load cliff (not yet fixed — needs the running app to verify safely).** `library:get-all` pulls the entire `tracks` table across IPC and `libraryStore` runs an O(n) fuzzy search on every keystroke. This will freeze for power users (20k–100k tracks). See `docs/LAUNCH_PLAN.md` → "Scale refactor plan" for the sequenced fix. Until done, either cap launch positioning to "~25k tracks" or prioritize this for power-DJ outreach.
- ℹ️ **You do NOT need the "Kubernetes/sharding/load-balancing" stack.** Local-first + on-device AI means ~zero backend to scale — your only server is the stateless licensing Worker. This is an advantage, not a gap.

---

## 5. What's already done well (don't second-guess these)

- Private signing key is **not** in the repo (cryptographically confirmed public-only); no secrets committed anywhere.
- Ed25519 verification is correct and fail-closed; entitlement enforced in the **main process** (renderer can't flip an `isPro` flag).
- SQL is fully parameterized; XML/Serato parsers are bounds-checked and not XXE-vulnerable; backups are real AES-256-GCM with a scrypt KDF.
- `contextIsolation: true`, narrow preload allowlist (no generic `ipcRenderer` exposed), no remote content, no `<webview>`.
