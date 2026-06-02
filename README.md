# SetSense

SetSense is a desktop DJ companion for macOS — set planning, harmonic mixing,
and Pioneer CDJ–ready exports. It reads your existing Rekordbox library
(collection XML or the Rekordbox database), analyses your tracks for key, energy
and structure, and helps you build, audition and refine sets before you ever
touch the decks.

Core capabilities:

- **Library import** — pull tracks, playlists and play history from a Rekordbox
  collection XML export or directly from the Rekordbox `master.db`.
- **Harmonic mixing** — keys are normalised to the Camelot wheel so compatible
  transitions surface automatically.
- **Set Architect** — assemble sets from playlists and the full library, with
  cue points and inline audio preview.
- **Energy & structure analysis** — local audio analysis (no upload) for
  energy curves and embedded cover art.
- **Recall & memory** — a searchable record of past sessions and decisions.

SetSense runs entirely on your machine. Audio is never uploaded; analysis is
performed locally.

## Requirements

- **macOS** on Apple Silicon (the shipped build targets `arm64`).
- **Node.js 22+** (developed against Node 24) and **npm** for local development.
- **Xcode Command Line Tools** — required to compile the native modules
  (`better-sqlite3`, `keytar`, `@journeyapps/sqlcipher`, `node-llama-cpp`).
- A **Rekordbox** library to import from (collection XML export, or a local
  Rekordbox `master.db`).

`ffmpeg` is bundled via `ffmpeg-static` — you do **not** need a system ffmpeg.

## Local development

```bash
# Install dependencies (also rebuilds native modules for Electron)
npm install

# Run the app in development with hot reload
npm run dev

# Type-check the whole project (main + renderer)
npm run typecheck

# Lint / format
npm run lint
npm run format

# Run the test suite
npm run test
```

If native modules fail to load after an Electron or Node upgrade, rebuild them:

```bash
npm run rebuild
```

## Importing a Rekordbox library

SetSense supports two import sources:

1. **Collection XML** (recommended, non-destructive)
   - In Rekordbox: **File → Library → Export Collection in xml format**.
   - In SetSense, choose the import action and select that `.xml` file.
   - The importer reads the XML read-only; it never writes back to Rekordbox.

2. **Rekordbox database** (`master.db`)
   - SetSense can read the Rekordbox SQLite database directly, read-only.
   - This requires a one-time, explicit consent in Settings before SetSense will
     touch the Rekordbox database.

Re-importing is safe: tracks are matched by file path, so existing track IDs are
reused and your sets, cue points and history stay intact across re-imports.

## Audio files & path expectations

- Track audio paths come from your Rekordbox library. Rekordbox stores them as
  `file://localhost/…` / `file:///…` URIs; SetSense decodes these to absolute
  local paths.
- **The audio files must exist at those paths.** SetSense reads audio in place —
  it does not copy files into its own store. If you move or rename audio after
  exporting from Rekordbox, preview and analysis for those tracks will fail until
  the library is re-imported from an up-to-date source.
- Supported formats: **MP3, AIFF/AIF, WAV, FLAC, M4A**. Other extensions import
  as metadata but won't analyse or preview.
- Local audio is served to the UI through an internal `media://` protocol — files
  are read straight from disk and never leave your machine.

## Where your data lives

- Library database: `~/Library/Application Support/SetSense/library.db`
  (SQLite with WAL). This is local to your machine.
- Secrets (license key, optional API keys) are stored in the **macOS Keychain**
  under the `SetSense` service — never in the database or in plain files.

## Licensing

SetSense uses a signed-license model (SetSense Pro):

- A license key has the form `<prefix>.<payload>.<signature>` and is verified
  in-app with an embedded **Ed25519 public key** — the app can verify a license
  but cannot mint one.
- Activated keys are stored in the macOS Keychain, not on disk.
- License **minting** is issuer-only and happens off-device. The minting script
  (`scripts/mint-license.mjs`) signs with the Ed25519 **private key**, which:
  - is read only from the environment (`LICENSE_PRIVATE_KEY_PEM`),
  - is gitignored and **never committed**,
  - is **never bundled** into the shipped app (`scripts/**` and `*.pem` are
    excluded from packaging).

In production the private key lives only in the fulfilment backend's secrets
vault (behind the payment provider's "order paid" webhook) — not on any laptop.

### Anti-abuse hardening (offline-first)

Three checks deter casual sharing and make refunds enforceable, all while the
app stays usable with **no network**:

- **Device binding.** Payloads carry a version (`v`). A **v2** key may include a
  `deviceId`; if set (and not flagged `portable`), the key only unlocks on the
  machine whose anonymous device id matches. The device id is a random UUID
  minted once and kept in the Keychain — it is **not** a hardware fingerprint and
  contains no PII. Mint a bound key with `--device <id>` (or `--portable` to opt
  out). **Migration: none required** — every legacy **v1** key, and any v2 key
  marked `portable`, is treated as a transferable bearer token and keeps working
  on any device exactly as before.
- **Clock-rollback resistance.** The highest wall-clock time ever observed is
  persisted locally; subscription expiry is judged against `max(now, lastSeen)`,
  so winding the system clock back can't revive a lapsed sub. A large backward
  jump surfaces a soft warning only — legitimate users are never locked out.
- **Online revocation (optional).** A gateway (`gateway.ts`, disabled by default —
  `LICENSE_API_BASE = null`) can mark a key revoked or tighten its expiry so
  refunds/charge-backs actually take effect. The answer is cached so it survives
  going offline. The network is **never on the critical path**: an unreachable
  gateway is a silent no-op and the offline signature verdict stands.

## Building & releasing

```bash
# Generate icons, build, and package the macOS app
npm run build:mac

# Unpacked build (no signing/notarization, for quick local checks)
npm run build:unpack
```

Packaging is configured in [`electron-builder.yml`](electron-builder.yml). Only
the built output in `out/` plus runtime dependencies are packaged — source trees
(`src/`, `electron/`, `tests/`), tooling (`scripts/`), docs, config and secrets
are excluded.

### Code signing & notarization (macOS)

Release builds are **signed and notarized**. Credentials are read from the
environment at build time — **never hardcode them** in the repo. Set the
following before running `npm run build:mac`:

| Env var | Purpose |
| --- | --- |
| `APPLE_ID` | Apple Developer account email used for notarization. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID (from appleid.apple.com). |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID. |
| `CSC_LINK` | Path or base64 of the **Developer ID Application** `.p12` certificate. *(Optional if the cert is already in the login keychain.)* |
| `CSC_KEY_PASSWORD` | Password for that `.p12` certificate. |

With those set, `notarize: true` in `electron-builder.yml` runs Apple's
`notarytool` automatically after signing. The hardened runtime and the
entitlements in `build/entitlements.mac.plist` are required for notarization and
are already configured.

If these secrets are **not** available, `npm run build:mac` will produce an app
that is unsigned/un-notarized (or fail at the notarization step). Local
development (`npm run dev`) and unpacked builds (`npm run build:unpack`) do not
require any of these credentials.

> **Auto-update:** SetSense currently has **no auto-update infrastructure**
> wired up (no `electron-updater` dependency or code). Releases are distributed
> manually. To add hosted updates later, configure a `publish` provider in
> `electron-builder.yml` and integrate `electron-updater` in the app.

## Support & contact

Questions, bug reports, or license issues: **carterpinkmusic@gmail.com**

## Support & recovery

- **Corrupted library database.** On startup SetSense validates the library DB.
  If it can't be opened or migrated, the app quarantines the file rather than
  deleting it — it is renamed to `library.db.corrupt-<timestamp>` in
  `~/Library/Application Support/SetSense/`, and a fresh database is created.
  The quarantined file is preserved so it can be inspected or sent in for
  diagnosis. WAL sidecars (`-wal`, `-shm`) are cleared as part of recovery.
- **Re-importing from Rekordbox** rebuilds tracks, playlists and history
  non-destructively; it's the safe first step after most library issues.
- **Missing audio / broken previews** almost always mean the underlying files
  moved. Restore the files to their original paths or re-import from an
  up-to-date Rekordbox source.
- **License not recognized after an OS migration** usually means the Keychain
  entry didn't carry over — re-activate with your original key.
