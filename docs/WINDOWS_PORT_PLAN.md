# SetRecord — Windows 10/11 Port: Architectural Plan & Implementation Blueprint

**Date:** 2026-06-10 · **Author:** Claude (lead architect pass) · **Scope:** Full Windows 10 (1909+) / Windows 11 x64 support for the production Electron 33 app.
**Ground truth:** every file/line reference below was verified against the working tree on `feat/grit-redesign`.

---

## Phased Delivery Plan (read this first)

| Phase | Name | Contents | Exit criteria |
|---|---|---|---|
| **0** | De-risk the toolchain | Windows CI lane (typecheck/lint/test/build), native-module compile proof, `ffmpeg-static` unpack fix | All four CI gates green on `windows-latest`; all 4 native modules load in a packaged `--dir` build |
| **1** | Core runtime correctness | Path normalization layer, `media://` fix, window chrome, lifecycle, keytar→Credential Manager validation, licensing/trial anchors | App boots on Windows, imports a folder of audio, plays it, license activation works |
| **2** | Packaging & distribution | NSIS installer, Authenticode signing, fuses, deep links via registry, release workflow | Signed `SetRecord-x.y.z-setup.exe` installs, launches, `setrecord://activate` round-trips |
| **3** | DJ ecosystem integrations | Rekordbox (Win paths + XML drive letters), Serato (Win), Engine DJ export + drive-letter USB enumeration | Import from real RB7/Serato Windows libraries; Engine USB export validates on a CDJ-ecosystem stick |
| **4** | Audio & ML parity | Flight Recorder capture on WASAPI, Live engine fingerprinting, whisper CPU backend, llama prebuilt | Flight Recorder records a set on Windows hardware; voice input transcribes; Recall answers |
| **5** | Polish & beta | ⌘→Ctrl hints, "Finder"→"File Explorer", i18n keys ×5 locales, GPU/perf QA on integrated graphics, beta cohort | PRELAUNCH_QA_SCRIPT.md executed end-to-end on Win10 + Win11 |

Phases 0–2 are sequential. Phases 3 and 4 can run in parallel after Phase 1. Each phase maps to one or more `feat/win-*` branches off `main`.

---

## 1. Build System, Packaging & Installer

### 1.1 Current state (mac-only)

[electron-builder.yml](../electron-builder.yml) is mac-centric:

- `mac:` block (lines 54–83): DMG-only target, `hardenedRuntime: true`, `entitlements: build/entitlements.mac.plist`, `extendInfo` with `NSMicrophoneUsageDescription` etc., `notarize: true`.
- A **skeletal `win:`/`nsis:` section already exists** (lines 47–52): `executableName: SetRecord`, `artifactName: ${name}-${version}-setup.${ext}`, `shortcutName`, `uninstallDisplayName`, `createDesktopShortcut: always`. It has never been exercised.
- `asarUnpack` (lines 37–46): `resources/**`, `node-llama-cpp`, `@node-llama-cpp`, `@journeyapps/sqlcipher`, `smart-whisper`.
- `extraResources` (lines 32–36): `resources/models → models` (~1.9 GB Qwen GGUF + ~142 MB whisper model).
- `npmRebuild: false` — rebuilds are manual via `npm run rebuild` ([package.json](../package.json) `"rebuild": "electron-rebuild -f -w better-sqlite3,keytar,@journeyapps/sqlcipher,smart-whisper"`).
- Only a `build:mac` script exists; icons via [scripts/generate-icons.mjs](../scripts/generate-icons.mjs) which shells out to `iconutil` (mac-only binary) for `.icns`. **`build/icon.ico` (121 KB) already exists**, so Windows icon generation is solved — but the icons script must not be a hard dependency of the Windows build.

### 1.2 Exact changes required

**`electron-builder.yml` — flesh out the `win:` block:**

```yaml
win:
  executableName: SetRecord
  icon: build/icon.ico
  target:
    - target: nsis
      arch: [x64]
  # Authenticode — see §2. No entitlements/hardenedRuntime equivalents exist on Windows.
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
  oneClick: true            # keep default one-click; per-user install
  perMachine: false         # per-user = no UAC prompt, matches Keychain-per-user model
  deleteAppDataOnUninstall: false   # NEVER delete: library.db + recordings are user memory
```

**Gotchas:**
- The installer will be **~2.1 GB** because of `extraResources` models. NSIS handles this, but use `compression: normal` (default `maximum` LZMA on 2 GB takes 20+ min per build and barely shrinks GGUF, which is already quantized/incompressible). Add `nsis.differentialPackage: false` — we don't use electron-updater's blockmap flow (manual-download update model, per the comment at electron-builder.yml lines 54–60).
- `deleteAppDataOnUninstall: false` is load-bearing: `%APPDATA%\SetRecord` holds `library.db`, `recordings/`, `artwork/`. Default NSIS uninstall leaves it alone only if this is explicit.
- Per-user install puts the app under `%LOCALAPPDATA%\Programs\SetRecord` — paths with spaces; never build child-process args by string concatenation (all current `spawn`/`execFile` call sites pass arg arrays — verified OK).

**`package.json` — add scripts:**

```json
"build:win": "npm run fetch-model && electron-vite build && electron-builder --win",
"icons:win": "echo build/icon.ico is committed; regenerate on mac via npm run icons"
```

`scripts/fetch-model.mjs` is pure Node `fetch` — cross-platform, no change. `scripts/generate-icons.mjs` stays mac-only (it calls `iconutil`); guard it with a `process.platform === 'darwin'` check that skips `.icns` generation and warns instead of crashing on Windows (lines 65–68).

### 1.3 `ffmpeg-static` unpack — latent bug, blocks both platforms

`ffmpeg-static` is spawned from [electron/services/energyAnalyser.ts:55](../electron/services/energyAnalyser.ts), [artworkExtractor.ts](../electron/services/artworkExtractor.ts), [liveEngine.ts](../electron/services/live/liveEngine.ts), [blackbox/reactionPipeline.ts](../electron/services/blackbox/reactionPipeline.ts) — but `node_modules/ffmpeg-static/**` is **not in `asarUnpack`**. A binary inside `app.asar` cannot be `spawn()`ed. Either this silently fails in packaged mac builds today, or it's escaping via another mechanism — verify, and add:

```yaml
asarUnpack:
  - node_modules/ffmpeg-static/**
```

`ffmpeg-static` downloads the **platform-native binary at `npm install` time** — therefore the Windows installer must be built on a Windows runner (or with `npm_config_platform=win32` set during install). Building `--win` from a mac checkout will bundle the mac ffmpeg binary. This single fact forces a `windows-latest` packaging job (§2.3).

### 1.4 Electron fuses

electron-builder.yml lines 108–114 set six fuses (`runAsNode: false`, `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true`, etc.). All are applied by electron-builder on Windows too. **Gotcha:** ASAR integrity validation on Windows requires Electron ≥ 30 (we're on 33 — fine) and only takes effect in packaged builds; add a packaged-build smoke test to the Windows QA script exactly as the mac one in [docs/PRELAUNCH_QA_SCRIPT.md](PRELAUNCH_QA_SCRIPT.md).

### 1.5 Entitlements

[build/entitlements.mac.plist](../build/entitlements.mac.plist) (`allow-jit`, `allow-unsigned-executable-memory` for V8 + llama.cpp, `device.audio-input`) has **no Windows equivalent and requires no port**. Windows has no hardened-runtime concept; JIT works by default. Mic permission is OS-settings based (§8.4).

---

## 2. Code Signing & Release Pipeline

### 2.1 Current state

[.github/workflows/release.yml](../.github/workflows/release.yml) runs on `macos-latest` only: `electron-builder --mac --publish always` with `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID .p12) + `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` (notarytool), followed by `codesign --verify`, `spctl`, `xcrun stapler validate` (lines 70–81).

[.github/workflows/ci.yml](../.github/workflows/ci.yml) also runs on `macos-latest` only.

### 2.2 Windows signing: Authenticode + SmartScreen

| Concern | macOS | Windows equivalent |
|---|---|---|
| Identity | Developer ID cert | Authenticode code-signing cert |
| Malware gate | Notarization (notarytool) | SmartScreen **reputation** (no submission step; reputation accrues per cert + per file hash) |
| Verification | `codesign --verify`, `spctl` | `signtool verify /pa /v SetRecord-*-setup.exe` |

**Recommendation: Azure Trusted Signing** (cloud HSM, ~$10/mo, no EV hardware token, and — critically — grants near-immediate SmartScreen reputation like an EV cert). electron-builder ≥ 26 supports it natively:

```yaml
win:
  azureSignOptions:
    endpoint: https://eus.codesigning.azure.net
    codeSigningAccountName: setrecord
    certificateProfileName: setrecord-public
```

with `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` repo secrets. Fallback option: OV cert from SSL.com/DigiCert (cheaper but ships with zero SmartScreen reputation → "Windows protected your PC" interstitial for the first few thousand installs — a real conversion killer for a paid app at launch).

**Gotcha:** every byte change to the installer resets per-file SmartScreen reputation; the per-publisher (cert) reputation is what carries over. Sign **both** the inner `SetRecord.exe` and the NSIS installer (electron-builder does both automatically when signing is configured).

### 2.3 CI changes (exact)

**`ci.yml`** — convert to a matrix; Windows lane is the cheapest possible early-warning system for path bugs:

```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest]
runs-on: ${{ matrix.os }}
```

Gotchas for the Windows lane:
- `npm ci` triggers `postinstall: electron-builder install-app-deps` → native rebuild needs MSVC. `windows-latest` ships VS 2022 Build Tools + Python — no setup step needed, but `smart-whisper` additionally needs CMake (preinstalled on the runner; verify `cmake --version` in a step).
- Cache `%LOCALAPPDATA%\node-gyp` and `node_modules/.cache`.
- Shell defaults differ (`pwsh`); any `run:` step using bash-isms must declare `shell: bash` (Git Bash is present).

**`release.yml`** — add a `release-windows` job (don't touch the mac job):

```yaml
release-windows:
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npm run rebuild
    - name: Build, sign & publish the NSIS installer
      env:
        AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
        AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
        AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: |
        npm run fetch-model
        npx electron-vite build
        npx electron-builder --win --publish always
    - name: Verify signature
      run: |
        & "$(Resolve-Path 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' | Select-Object -Last 1)" verify /pa /v (Get-Item dist\*-setup.exe).FullName
```

**Gotcha:** `fetch-model` downloads ~2 GB per run; cache `resources/models` keyed on the model filenames to keep release builds under 15 min.

### 2.4 Update model

The app deliberately does not self-update (2 GB payload; it notifies and links a manual download — electron-builder.yml comment, lines 54–60). Keep identical behavior on Windows: the `publish` GitHub config already produces a `latest.yml` alongside `latest-mac.yml`; the in-app version check just needs to pick the `-setup.exe` asset for `win32`. Find the version-check call site in `electron/main.ts` (it reads the GitHub release feed) and make the download-URL selection keyed on `process.platform`.

---

## 3. Native Modules & Toolchain

### 3.1 Inventory and per-module verdict

| Module | Version | Windows story | Action |
|---|---|---|---|
| `better-sqlite3` | ^12.9.0 | Prebuilds exist for win32-x64 Electron ABI via `prebuild-install`; falls back to MSVC compile | None expected; verify in Phase 0 CI |
| `keytar` | ^7.9.0 | Native Windows Credential Manager backend built-in; prebuilds for win32 | API-compatible, but **validate semantics** (§5) |
| `@journeyapps/sqlcipher` | ^6.0.0 | Ships win32 prebuilds; statically links its own SQLCipher/crypto | Verify `os` constraint in package-lock doesn't exclude win32; rebuild for Electron ABI via existing `npm run rebuild` |
| `smart-whisper` | ^0.8.1 (optional) | **Builds whisper.cpp from source at install** via its `dist/build.js`; backend selection: `darwin+arm64→metal`, `darwin→accelerate`, else **`cpu`** | Needs CMake + MSVC on the build machine; CPU backend = slower transcription (§9.2) |
| `node-llama-cpp` | ^3.18.1 | Postinstall downloads prebuilt binaries per platform — win32 x64 CPU + CUDA + Vulkan variants exist | None; it auto-selects at runtime. Keep `asarUnpack` entries |
| `ffmpeg-static` | — | Platform binary fetched at install time | Must `npm install` on Windows; add to `asarUnpack` (§1.3) |

### 3.2 Exact changes

- `npm run rebuild` works as-is on Windows **provided** VS Build Tools 2022 + Python 3 + CMake are present. Document this in CLAUDE.md / BUILDING_REPORT.md as the Windows dev prerequisite (one line: `winget install Microsoft.VisualStudio.2022.BuildTools Kitware.CMake Python.Python.3.12`).
- `smart-whisper` is an **optionalDependency** with a graceful runtime fallback ([transcribeService.ts:131](../electron/services/speech/transcribeService.ts) catches `cannot find module|dlopen|bindings|\.node`). If its source build fails on a contributor's Windows box, the app still ships — voice input degrades to typed input. Keep that property; do not promote it to a hard dep.
- `transcribeService.ts:195-199` constructs `new mod.Whisper(path, { gpu: true })`. On Windows CPU backend `gpu: true` is ignored by whisper.cpp — harmless, but pass `gpu: process.platform === 'darwin'` for clarity.
- The error string at transcribeService.ts:131 says *"Voice input couldn't start on this Mac."* → change to platform-neutral copy + i18n key (§14.4).

### 3.3 Gotchas

- **ABI mismatches are the #1 Windows-Electron support burden.** `npmRebuild: false` + manual `npm run rebuild` means a dev who runs plain `npm install` then `npm start` gets `NODE_MODULE_VERSION` errors. The existing `postinstall: electron-builder install-app-deps` mostly covers it; verify it actually rebuilds all four modules on Windows in Phase 0.
- `better-sqlite3` and `@journeyapps/sqlcipher` **both embed a SQLite**; on Windows watch for symbol-collision warnings at link time — they're isolated per `.node` DLL so runtime is safe (same as mac dylibs).
- Antivirus: Defender real-time scanning of `library.db-wal` can add write latency. WAL mode (set at [electron/db/schema.ts:38](../electron/db/schema.ts)) is correct and stays; just don't fsync-spam (better-sqlite3 defaults are fine).

---

## 4. File Paths, Path Normalization & the `media://` Protocol

This is the highest-density bug surface of the whole port. Decision first, then call sites.

### 4.1 Architectural decision: canonical path form

**Store OS-native absolute paths in `library.db` (`C:\Users\…` on Windows), and normalize to forward slashes only at URL boundaries.** Rationale: every `fs` call takes native paths directly; only `media://` and DJ-database interchange need slash translation. Add one utility module and route everything through it:

**NEW FILE `electron/utils/paths.ts`:**
```ts
import { sep } from 'path'

/** OS-native absolute path → forward-slash form (for URLs / interchange). */
export function toPosixish(p: string): string {
  return p.replace(/\\/g, '/')
}
/** Forward-slash form → OS-native. No-op on macOS. */
export function toNative(p: string): string {
  return sep === '\\' ? p.replace(/\//g, '\\') : p
}
/** Basename that tolerates both separators (cross-OS imported strings). */
export function anySep(p: string): string[] {
  return p.split(/[\\/]/)
}
```

Mirror `toPosixish`/`anySep` in `src/utils/` for the renderer (no Node imports there).

### 4.2 `media://` protocol — both ends

- **Renderer builder, [src/utils/mediaUrl.ts:15-17](../src/utils/mediaUrl.ts) — BROKEN on Windows.** `filePath.split('/')` doesn't split `C:\Users\…`, producing `media://localC%3A%5CUsers…`. Fix:
  ```ts
  export function toMediaUrl(filePath: string): string {
    const segments = filePath.replace(/\\/g, '/').split('/').map(encodeURIComponent)
    return 'media://local' + (segments[0] === '' ? '' : '/') + segments.join('/')
  }
  ```
  Seven consumers inherit the fix: `TrackRow.tsx`, `SetPlayer.tsx`, `UncoverSection.tsx`, `RecallTrackLine.tsx`, `CuePointEditor.tsx`, `home/results/shared.tsx`, `usePreviewAudio.ts`.
- **Main-process handler, [electron/main.ts:2237-2250](../electron/main.ts):** `filePath = decodeURIComponent(new URL(req.url).pathname)` yields `/C:/Users/…/track.mp3` on Windows — note the **leading slash before the drive letter**. Strip it and re-nativize:
  ```ts
  let filePath = decodeURIComponent(new URL(req.url).pathname)
  if (process.platform === 'win32') filePath = filePath.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\')
  ```
- **`isAllowedMediaPath` allowlist** (same region of main.ts): audit its prefix comparison — on Windows it must compare **case-insensitively** (NTFS is case-preserving/insensitive; `C:\Users` vs `c:\users` must both pass/fail consistently). Compare on `p.toLowerCase()` when `win32`.

This is the direct descendant of the historical `media://` URL-encoding bug that silenced all audio and waveforms (memory: `feedback_audio_bug`) — write regression tests for both ends with `C:\` paths **before** fixing (Phase 1, first PR).

### 4.3 Already-correct surfaces (no change, verify only)

- All app-data paths go through `app.getPath('userData')` → `%APPDATA%\SetRecord\` automatically: `library.db` (schema.ts:24), `artwork/` (artworkExtractor.ts:51), `recordings/` (setRecorder.ts:40), `models/` (memoryAssistant.ts:55, transcribeService.ts:63), `logs/` (logger.ts:189), `energy-cache.json`, `live-fingerprint-index.bin`, and [resetService.ts:67-68](../electron/services/resetService.ts).
- Log redaction ([electron/services/logging/redact.ts:16-27](../electron/services/logging/redact.ts)) already handles both separators (`replace(/\\/g, '/')`).
- Beatport CSV atomic write (`csvExport.ts:77-100`) and MyTag backup naming (`myTagWriter.ts:86-93`) are separator-safe.

### 4.4 Long paths & reserved names (Windows-only failure class)

- **MAX_PATH (260 chars):** DJ libraries nest deep (`C:\Users\name\Music\DJ\Genres\Melodic House & Techno\Artist – Long Title (Extended Remix)\…`). Node bypasses MAX_PATH when given `\\?\`-prefixed paths, but plain paths can fail in `copyFile` during Engine export to USB. Add the NSIS-installed app manifest `longPathAware` (electron-builder does this for the exe by default in recent versions — verify with `mt.exe`), and wrap Engine-export copies: if `copyFile` throws `ENOENT` on a >240-char source, retry with `\\\\?\\` prefix.
- **Reserved device names:** `CON, PRN, AUX, NUL, COM1-9, LPT1-9` are invalid filenames; trailing dots/spaces are stripped silently by Win32. [engineSchema.ts:134-149](../electron/services/engine/engineSchema.ts) `safeMusicFilename()` must add: split on `/[\\/]/` (currently `split('/')` — breaks on Windows source paths), reject reserved stems (`/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i` → prefix `_`), and trim trailing `[. ]`.

---

## 5. Secrets, Licensing & Trial Anchoring (Keychain → Credential Manager)

### 5.1 Current state

All secret storage is `keytar` with service `'SetRecord'`:

| Store | File | Accounts |
|---|---|---|
| API + license keys | [electron/services/secretStore.ts](../electron/services/secretStore.ts) | `youtubeApiKey`, `licenseKey` |
| Device identity | [electron/services/licensing/deviceId.ts](../electron/services/licensing/deviceId.ts) | `deviceId` (random UUID — **not** hardware-derived; portable as-is) |
| Anti-trial-farm anchors | [electron/services/licensing/licenseAnchors.ts](../electron/services/licensing/licenseAnchors.ts) | `trialStartedAtDurable`, `clockHighWaterDurable` |

License verification is Ed25519 against [signingKey.ts](../electron/services/licensing/signingKey.ts) — pure crypto, platform-independent. Trial state in [trialStore.ts](../electron/services/licensing/trialStore.ts) + [licenseLocalStore.ts](../electron/services/licensing/licenseLocalStore.ts) lives in `userData` — portable.

### 5.2 Windows mapping — keytar "just works," with three semantic differences

keytar on Windows writes **Generic Credentials** in Windows Credential Manager (`Control Panel → Credential Manager`), target name `SetRecord/<account>`. API-identical. The differences that matter:

1. **Durability across "Fresh Start":** The whole point of the keychain anchors (memory: trial-farming defence) is surviving `userData` deletion. On Windows, Credential Manager entries survive app uninstall + reinstall **same as mac Keychain** ✅, but they do **not** survive a Windows user-profile reset, and they roam with the profile on domain accounts (could *teleport* a trial anchor to a second machine via roaming profiles — acceptable: roaming makes trials *stricter*, not looser).
2. **No ACL prompt:** mac Keychain prompts when a *different signed binary* reads the item; Windows Generic Credentials are readable by **any process in the user session**. The trial anchor is therefore easier to *read* on Windows, but also easier to *delete* (a trial-farmer can clear Credential Manager). Mitigation (same trick as mac, belt-and-braces): the anchors are already mirrored in `licenseLocalStore`; additionally mirror the trial anchor into the registry under `HKCU\Software\SetRecord\state` (an obscure-but-not-secret second location) and take `max()` of all anchors. ~30 lines in `licenseAnchors.ts`, win32-gated.
3. **Credential size limit:** Generic Credential blobs cap at ~2560 bytes. All five accounts store short strings (UUID, ISO timestamps, license key) — fine; just don't ever route the log bundle or license *payload JSON* through keytar.

### 5.3 Exact changes

- No code change to `secretStore.ts` / `deviceId.ts` call sites — keytar abstracts.
- `licenseAnchors.ts`: add the HKCU mirror (use `Bun`-free pure-Node approach: `reg.exe add/query` via `execFile`, or the zero-dep `winreg` pattern — prefer `execFile('reg.exe', ['query', …])` to avoid a new native dep).
- **Clock high-water (`clockHighWaterDurable`)** logic is pure timestamp comparison — portable. Verify the tests in [tests/licenseAnchors.test.ts](../tests/licenseAnchors.test.ts) pass on the Windows CI lane (they mock keytar, so they should).
- `signingKey.ts` is founder-signoff territory (CLAUDE.md) — **no edits needed or planned**; the activation scheme constant `setrecord://` it exports is consumed read-only by §6.

---

## 6. Deep Links, Protocol Registration & Single Instance

### 6.1 Current state

- mac registration is declarative via `extendInfo → CFBundleURLTypes → setrecord` (electron-builder.yml lines 74–77).
- Runtime: `app.setAsDefaultProtocolClient(ACTIVATION_SCHEME, process.execPath, [resolve(process.argv[1])])` in main.ts, plus the mac-only `open-url` event for `setrecord://activate?key=SES1.<payload>.<sig>`.

### 6.2 Windows equivalent (three pieces, all required)

1. **Installer-time registry keys** — move protocol declaration to electron-builder's cross-platform top-level key (NSIS then writes `HKCU\Software\Classes\setrecord` automatically):
   ```yaml
   protocols:
     - name: SetRecord activation
       schemes: [setrecord]
   ```
   (Keep the mac `extendInfo` block or delete it — the top-level `protocols` key generates `CFBundleURLTypes` too; delete the duplicate to avoid drift.)
2. **Single-instance lock + argv delivery.** On Windows, clicking a `setrecord://` link launches a **second process with the URL in `argv`** — there is no `open-url` event. Required pattern in `main.ts`:
   ```ts
   const gotLock = app.requestSingleInstanceLock()
   if (!gotLock) app.quit()
   app.on('second-instance', (_e, argv) => {
     const url = argv.find((a) => a.startsWith('setrecord://'))
     if (url) handleActivationUrl(url)   // same handler the mac open-url path calls
     mainWindow?.show(); mainWindow?.focus()
   })
   // cold start: check process.argv too
   const coldUrl = process.argv.find((a) => a.startsWith('setrecord://'))
   ```
   Verify whether `requestSingleInstanceLock` already exists in main.ts; if the mac build allowed multi-instance, gate the lock behind `win32` or (better) adopt it on both platforms — two instances sharing one `library.db` WAL is a corruption hazard on mac today too.
3. **Dev-mode registration:** `setAsDefaultProtocolClient` with `process.execPath + argv[1]` (already written) is the correct Windows dev-mode form — confirm the existing call isn't darwin-gated.

**Gotcha:** browsers show "Open SetRecord?" dialogs keyed to the *executable path*; per-user NSIS installs keep a stable path across updates (`%LOCALAPPDATA%\Programs\SetRecord\SetRecord.exe`) ✅.

---

## 7. Window Chrome, App Lifecycle & OS Integration

### 7.1 Window creation — [electron/main.ts:492-495](../electron/main.ts)

Current:
```ts
titleBarStyle: 'hiddenInset',
trafficLightPosition: { x: 16, y: 20 },
```
Both options are silently ignored on Windows, which would yield a **standard Windows title bar** on top of a UI designed frameless — wrong for the grit identity. Exact change:

```ts
...(process.platform === 'darwin'
  ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 20 } }
  : {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: { color: '#000000', symbolColor: '#9a9aa2', height: 40 },
    }),
```

`titleBarOverlay` gives native Windows 11 snap-layout-compatible min/max/close buttons drawn over the app's own black canvas (matches flat-black grit). The renderer's `.draggable { -webkit-app-region: drag }` ([globals.css:267-272](../src/styles/globals.css)) **does work on Windows** with `titleBarStyle: 'hidden'` — but the drag strip must not extend under the overlay buttons: reserve `env(titlebar-area-x)` etc. via the CSS `titlebar-area-*` environment variables, or simply pad the drag region's right edge by 140 px on `win32` (expose `process.platform` through preload — see §7.4).

**Window icon:** main.ts comment at 494–495 already notes `icon:` is for Windows/Linux taskbar — confirm it points at a `.png ≥256px` or the `.ico`.

### 7.2 Lifecycle

`window-all-closed` → `if (process.platform !== 'darwin') app.quit()` (main.ts:2408-2410) — **already correct** Windows behavior. Verify there's a corresponding `activate` handler for mac only; nothing to add for Windows.

### 7.3 Shell integration

- `shell.showItemInFolder` (log-bundle reveal path used by FeedbackModal's `revealLogBundle`) is cross-platform → opens Explorer. Only the *copy* says "Finder" (§14.4).
- "Now playing" via `osascript` AppleScript ([liveEngine.ts:515-534](../electron/services/live/liveEngine.ts)) returns `Promise.resolve(null)` off-mac — **ship v1 with the null path** (graceful: live engine just lacks the Spotify/Music hint). Windows v2 option, documented for later: GlobalSystemMediaTransportControls (SMTC) via `@nodert-win10-rs4/windows.media.control` or a 20-line PowerShell `Get-Process`-free WinRT call; postpone — not launch-blocking.

### 7.4 Preload platform exposure

[electron/preload.ts](../electron/preload.ts) exposes no platform flag today; the renderer resorts to `navigator.platform` (FeedbackModal.tsx:43). Add to the contextBridge surface:
```ts
platform: process.platform,   // 'darwin' | 'win32'
```
and a typed accessor in [preload.d.ts](../electron/preload.d.ts). Renderer then keys all platform copy/hints off `window.setrecord.platform`, not user-agent sniffing.

---

## 8. Audio Capture: Set Flight Recorder, Live Engine & Permissions

### 8.1 Capture path is renderer-side — largely portable

Both the Flight Recorder room-mic capture ([src/components/live/roomRecorder.ts:30](../src/components/live/roomRecorder.ts)) and the Live engine feed ([src/components/live/audioFeed.ts:81-91](../src/components/live/audioFeed.ts)) use `getUserMedia({ audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false } })` + `MediaRecorder` (`audio/webm;codecs=opus`) / `AudioContext({ sampleRate: 22050 })`. All supported by Chromium on Windows (WASAPI under the hood). The code already resamples when the hardware rate differs (audioFeed.ts:100-106) ✅.

### 8.2 Windows-specific audio gotchas (test, don't assume)

- **Driver zoo:** Realtek onboard, USB interfaces with vendor ASIO drivers — Chromium uses WASAPI *shared mode*; a DJ interface locked to ASIO by another app (Serato/rekordbox running!) can present a device that opens but delivers silence. The Flight Recorder's level-meter/consent UI is the existing guard; add a "no signal detected in first 10 s" warning state (renderer-only, ~small) — on a DJ's laptop *mid-gig with rekordbox open* this is the **most likely real-world failure** of the port's flagship feature.
- **`echoCancellation: false` honored** on Windows WASAPI ✅ (the reconstructed-reference reaction-capture experiment in `blackbox/reactionPipeline.ts` depends on raw capture; the ffmpeg-side processing is platform-neutral once §1.3 lands).
- **Default-device switching:** Windows switches default capture device on USB plug/unplug more aggressively than macOS; the `enumerateDevices`-driven device picker should listen for `navigator.mediaDevices.ondevicechange` (verify it does; if not, add — both platforms benefit).
- Disk-write of recordings (`userData/recordings/`, setRecorder.ts:40) — Defender scans on `.webm` close are async; no change, but note in QA to watch for dropped finalize on slow disks.

### 8.3 Fingerprinting / Live engine

[fingerprintCodec.ts](../electron/services/live/fingerprintCodec.ts) + the fingerprint index (`live-fingerprint-index.bin` in userData) are pure math/Buffer code — portable; [tests/fingerprintCodec.test.ts](../tests/fingerprintCodec.test.ts) will prove it on the Windows CI lane. The ffmpeg decode feeding it follows §1.3.

### 8.4 Permission flow

[transcribeService.ts:89-112](../electron/services/speech/transcribeService.ts) **already has a `win32` branch**: `systemPreferences.getMediaAccessStatus('microphone')` → treats non-`denied` as granted. Correct: Windows mic privacy is a per-app-class OS toggle (`Settings → Privacy → Microphone`), no runtime prompt API. Add to that branch a user-facing remediation string ("Enable microphone access for desktop apps in Windows Settings → Privacy & security → Microphone") surfaced through the same error channel the mac `denied` path uses — currently the win32 path can return `denied` with mac-flavoured guidance upstream.

---

## 9. On-Device ML: Whisper Voice Input & Llama Recall

### 9.1 Model bundling

`extraResources → models` lands at `process.resourcesPath/models` on Windows (`…\Programs\SetRecord\resources\models`) — the resolution chain in transcribeService.ts:68-79 (`bundled → downloaded → null`) and memoryAssistant.ts:55 is path-API-clean. **No change.** mmap of a 1.9 GB GGUF from NTFS works; first-token latency may be higher on HDD-equipped machines — QA note, not code.

### 9.2 Whisper (smart-whisper)

Backend matrix from `smart-whisper/dist/build.js`: Windows gets **`cpu`** (no Metal, no Accelerate; OpenBLAS only if discoverable at build time). Consequences:
- `ggml-base.en` (~142 MB) on AVX2 CPU transcribes ~2–4× realtime — acceptable for short voice commands (the Home composer use case), not for long-form. No architectural change; set expectations in QA.
- The install-time source build needs CMake+MSVC (§3.2). If it fails → optional-dep fallback already handles it.
- `GGML_METAL_PATH_RESOURCES` env set in its binding is darwin-inert on Windows — ignore.

### 9.3 Llama (node-llama-cpp)

Prebuilt win32 binaries (CPU/CUDA/Vulkan) auto-selected at runtime; `asarUnpack` already includes both `node-llama-cpp` and `@node-llama-cpp` (the platform-binary sub-packages). **Gotcha:** the `@node-llama-cpp/win-x64*` optional packages only install on a Windows `npm install` — another reason packaging must run on a Windows runner (§1.3 pattern). Vulkan variant can tickle old GPU drivers; first run should default CPU and let users opt into GPU in Settings later (check what `memoryAssistant.ts` passes for `gpuLayers` — if it hardcodes GPU, gate on darwin for v1).

---

## 10. Rekordbox Import

### 10.1 Detection — [electron/services/rekordbox/detect.ts](../electron/services/rekordbox/detect.ts)

Current (mac): `~/Library/Pioneer/rekordbox/master.db` (lines 6–10), alt `~/Library/Application Support/Pioneer/rekordbox6/master.db` (14–21), app discovery in `/Applications` incl. the RB7 nested-app fix (158–165), version via `Info.plist` regex (177–189).

Windows equivalents — add a platform table at the top of the file:

| Artifact | macOS (current) | Windows |
|---|---|---|
| master.db (RB6/7) | `~/Library/Pioneer/rekordbox/master.db` | `%APPDATA%\Pioneer\rekordbox\master.db` (`join(app.getPath('appData'), 'Pioneer', 'rekordbox', 'master.db')`) |
| Alt RB6 | `~/Library/Application Support/Pioneer/rekordbox6` | `%APPDATA%\Pioneer\rekordbox6\master.db` |
| options.json | same dir as master.db | same dir as master.db |
| App install | `/Applications/rekordbox*.app` | `C:\Program Files\Pioneer\rekordbox <ver>\rekordbox.exe` |
| App version | Info.plist `CFBundleShortVersionString` | exe VERSIONINFO: `execFile('powershell', ['-NoProfile','-Command', '(Get-Item "<exe>").VersionInfo.ProductVersion'])` — or skip; **version is cosmetic if the DB key probe works** (recommended: probe both key formats, report version "unknown") |

The RB7 "nested app" path quirk (memory: `rekordbox7_cipher`) is a mac bundle phenomenon; on Windows RB7 is a flat `Program Files` install — the nested-path branch becomes darwin-only.

### 10.2 Cipher — no change

[cipher.ts](../electron/services/rekordbox/cipher.ts): same publicly-documented key on both platforms; the dual key-format probe (RB6 raw `x'<hex>'` vs RB7 passphrase, lines 123–126) is exactly the right mechanism for Windows too. `@journeyapps/sqlcipher` opens read-only — Windows file locking: rekordbox holds `master.db` open while running; SQLite read-only open still succeeds against its WAL, but **copy-to-temp-then-open** is the robust pattern if QA shows `SQLITE_BUSY` (mac gets away with POSIX advisory locks; Windows mandatory share modes are stricter). Implement the temp-copy fallback behind the existing open error path.

### 10.3 Path decoding — two precise bugs

1. **DB track locations, [dbReader.ts:377-386](../electron/services/rekordbox/dbReader.ts) `combinePath()`:** Rekordbox-on-Windows stores folder paths like `C:/Users/dj/Music/` (forward slashes, URL-encoded). Current code does `decodeURIComponent` then `path.normalize` — on Windows `normalize` flips to backslashes (fine, that's our canonical form per §4.1), but on **macOS reading a Windows-origin DB** (or tests), it mangles. Change: after decode, run `toNative()` from §4.1 instead of bare `normalize`, and join folder+file with `/` tolerant of an existing trailing slash (current logic OK).
2. **XML import, [libraryImport.ts:44-46](../electron/services/libraryImport.ts) `parseLocation()`:** current regex chain turns `file://localhost/C:/Users/x/track.mp3` into `/C:/Users/x/track.mp3` — leading slash bug. Fix:
   ```ts
   function parseLocation(raw: string): string {
     let p = decodeURIComponent(raw.replace(/^file:\/\/localhost\//, '/').replace(/^file:\/{3}/, '/'))
     if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1)          // windows drive letter
     return process.platform === 'win32' ? p.replace(/\//g, '\\') : p
   }
   ```
   Note Rekordbox-on-Windows XML emits `file://localhost/C:/…` — the test fixture must cover exactly that string.

### 10.4 MyTag write-back

[myTagWriter.ts](../electron/services/rekordbox/myTagWriter.ts) backup naming + WAL/SHM copies (lines 86–93) are portable. **Gotcha:** write-back requires rekordbox **closed** — on Windows the open-DB share lock makes this *enforceable*: attempt an exclusive open first; if it fails, show the existing "close rekordbox first" guidance (which today on mac is honor-system).

---

## 11. Serato Import

### 11.1 Lift the platform gate

[serato/detect.ts:53-55](../electron/services/serato/detect.ts) hard-returns `unsupported` off-darwin. Windows default dir is the **same shape**: `join(homedir(), 'Music', '_Serato_')` resolves to `C:\Users\<u>\Music\_Serato_` — the existing `defaultSeratoDir()` (lines 22–25) is already correct on Windows. Change: replace the `!== 'darwin'` gate with `!['darwin','win32'].includes(process.platform)`.

**Gotcha:** OneDrive "Known Folder Move" relocates `Music` to `C:\Users\<u>\OneDrive\Music`. `homedir()+'Music'` misses it. Probe both: `join(homedir(),'Music','_Serato_')` and `join(homedir(),'OneDrive','Music','_Serato_')` (cheap `existsSync`, no API needed).

### 11.2 Drive-relative path resolution — the real work

Serato `pfil` chunks store **drive-relative** paths (UTF-16BE decode in [chunks.ts:65-73](../electron/services/serato/chunks.ts) is platform-clean). [databaseReader.ts:82-85](../electron/services/serato/databaseReader.ts):

```ts
export function resolveSeratoPath(driveRelative: string): string {
  return '/' + driveRelative.replace(/^\/+/, '')   // assumes the boot volume is "/"
}
```

On Windows, "drive root" = the drive containing the `_Serato_` folder. Exact change — thread the Serato dir through:

```ts
export function resolveSeratoPath(driveRelative: string, seratoDir: string): string {
  const rel = driveRelative.replace(/^[\\/]+/, '')
  if (process.platform === 'win32') {
    const drive = seratoDir.slice(0, 2)            // "C:"
    return drive + '\\' + rel.replace(/\//g, '\\')
  }
  return '/' + rel
}
```
Update the single call site in `seratoRecordToTrack()` (databaseReader.ts:142) and the index.ts plumbing. External-drive `_Serato_` folders (USB `D:\_Serato_`) then work for free — the same function resolves against `D:`.

### 11.3 Crates

`readSubcrates()` ([serato/index.ts:66-81](../electron/services/serato/index.ts)) uses `join()` + case-insensitive `.crate` filter — portable, no change.

---

## 12. Engine DJ Export & USB/Volume Handling

### 12.1 Volume enumeration — replace `/Volumes` with drive letters

Two call sites scan `/Volumes`: [engine/detect.ts:24-32](../electron/services/engine/detect.ts) and [usbDetector.ts:99-141](../electron/services/usbDetector.ts) (which also shells `df -Pk` + `diskutil info`, lines 77–91, and `fs.watch('/Volumes')`, lines 164–173).

**NEW FILE `electron/services/volumes/winVolumes.ts`** — one PowerShell CIM call replaces `df`+`diskutil`:

```ts
import { execFile } from 'child_process'
import { promisify } from 'util'
const run = promisify(execFile)

export interface WinVolume { mountPath: string; label: string; fs: string; sizeKB: number; freeKB: number; removable: boolean; isUsb: boolean }

export async function listWinVolumes(): Promise<WinVolume[]> {
  const ps = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,FileSystem,Size,FreeSpace,DriveType | ConvertTo-Json -Compress`
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true })
  const rows = JSON.parse(stdout); const list = Array.isArray(rows) ? rows : [rows]
  return list.map((d) => ({
    mountPath: d.DeviceID + '\\',            // "E:\"
    label: d.VolumeName ?? '',
    fs: (d.FileSystem ?? '').toLowerCase(),  // 'fat32' | 'exfat' | 'ntfs'
    sizeKB: Math.floor((d.Size ?? 0) / 1024),
    freeKB: Math.floor((d.FreeSpace ?? 0) / 1024),
    removable: d.DriveType === 2,
    isUsb: d.DriveType === 2,                // DriveType 2 = removable; good v1 proxy for USB
  }))
}
```

- `usbDetector.listUSBDevices()`: branch — darwin keeps `/Volumes`+`diskutil`; win32 maps `listWinVolumes().filter(v => v.removable)` into the existing `USBDevice` shape. Drop the mac-only `protocol.startsWith('usb')` check on Windows (DriveType 2 is the equivalent signal; SD cards slip through — acceptable, they're valid Engine targets anyway).
- **Watcher:** `fs.watch('/Volumes')` has no Windows analog. v1: poll `listWinVolumes()` every 4 s while the export UI is open (the only consumer), diff by `mountPath`. (WM_DEVICECHANGE needs a native module — not worth it.)
- `engineDbCandidates()` (detect.ts:24-32): win32 branch = `join(homedir(),'Music','Engine Library','Database2','m.db')` (+ OneDrive variant per §11.1) plus `for (const v of volumes) join(v.mountPath, 'Engine Library', …)`. Lift the darwin gate at detect.ts:68-69.
- `testUSBSpeed()` (usbDetector.ts:186-214) is pure fs I/O — portable as-is.

### 12.2 Export correctness — [engineExport.ts:169-225](../electron/services/engine/engineExport.ts)

- Relative paths written into `m.db` as `Music/${filename}` with **forward slashes** — this is what Engine hardware expects regardless of host OS. **Keep forward slashes**; do not let any normalize pass touch DB-bound strings (add a unit test asserting `/` survives on win32 via `path.win32` injection).
- `safeMusicFilename()` fixes per §4.4 (any-separator split, reserved names, trailing dot/space).
- Target sticks are FAT32/exFAT: 4 GB file-size cap on FAT32 (long WAV/AIFF sets can exceed it) — add a pre-copy size check that surfaces as a blocking validator finding (the ecosystem-aware validator in [usbValidator.ts](../electron/services/usbValidator.ts) is the right home; its format matrices are already platform-neutral).
- `resolveEnginePath()` ([engine/dbReader.ts:53-61](../electron/services/engine/dbReader.ts)): `isAbsolute()` is platform-correct under Node; `join()` normalizes mixed separators — verified OK, cover with a win32 test.

---

## 13. Logging, Crash Reporting & Diagnostics

### 13.1 Already portable (verify-only)

- electron-log wrapper writes `userData/logs` ([logger.ts:189-191](../electron/services/logging/logger.ts)) → `%APPDATA%\SetRecord\logs` ✅.
- Redaction ([redact.ts](../electron/services/logging/redact.ts)) handles `\` and `/`, and `homedir()` scrubbing works for `C:\Users\<name>` ✅. **One check:** the home-dir scrub compares forward-slashed forms (`HOME` is `replace(/\\/g,'/')`-ed) — confirm incoming frame paths are also slash-normalized before comparison (they are, via `frameBasename`'s replace — but the *full-path* redaction pass needs the same; eyeball `redact.ts` body in Phase 1).
- Sentry ([crashReporter.ts:40-45](../electron/services/crashReporter.ts)): strips `server_name` + device context — note the comment says hostnames like "Sams-MacBook-Pro"; Windows hostnames (`DESKTOP-7G3K2P` or real names) are equally PII — the existing wholesale strip already covers it ✅. Add `windows-latest` to whatever Sentry release/sourcemap upload step exists (check `src/utils/sentry.ts` init for environment tags — tag `platform` explicitly so dashboards split mac/win).
- Diagnostic bundle already records `process.platform`/`arch` ([exportBundle.ts:126](../electron/services/logging/exportBundle.ts)) ✅.

### 13.2 Changes

- **minidumps:** if `crashReporter.start()` (Electron native) is used anywhere, Windows produces `.dmp` files in `userData/Crashpad` — include the Crashpad directory in the export bundle's file list, win32-gated.
- The log-bundle "reveal" flow (`revealLogBundle` → `shell.showItemInFolder`) is portable; only the renderer copy changes (§14.4).

---

## 14. Renderer UI, Keyboard, Fonts, i18n & QA Matrix

### 14.1 Keyboard — already abstracted, hints are not

[useKeyboard.ts:23](../src/hooks/useKeyboard.ts) uses `e.metaKey || e.ctrlKey` ✅ (Cmd+K/Z/N all become Ctrl+K/Z/N for free; ProWaveform.tsx:585 likewise). The **displayed hints** hardcode `⌘`:
- [LibraryPanel.tsx:334](../src/components/library/LibraryPanel.tsx) `kbd="⌘K"`
- [SearchInput.tsx:8](../src/components/shared/SearchInput.tsx) (doc/prop example)
- [LiveOverlay.tsx:174](../src/components/live/LiveOverlay.tsx) `<kbd className="lv-kbd">⌘</kbd>`

Add `src/utils/platform.ts`:
```ts
export const isMac = window.setrecord?.platform === 'darwin'   // preload, §7.4
export const modKey = isMac ? '⌘' : 'Ctrl'
export const modCombo = (k: string) => (isMac ? `⌘${k}` : `Ctrl+${k}`)
```
and replace the three call sites.

### 14.2 Window-chrome CSS

`.draggable` region (globals.css:267-272) works on Windows with §7.1's `titleBarStyle: 'hidden'`; add right-edge clearance for `titleBarOverlay` buttons (`html[data-platform='win32'] .draggable { padding-right: 144px }` — set `data-platform` on `<html>` at boot in [src/main.tsx](../src/main.tsx)).

### 14.3 Fonts, glass, grain — no code change, QA targets

- Font stacks self-host Space Grotesk + Fraunces via @fontsource ([tokens.css:79-81](../src/styles/tokens.css)); `SF Pro Display`/`-apple-system` entries fall through to `system-ui` → Segoe UI ✅. **QA:** Fraunces renders via DirectWrite — check optical-size axis rendering of serif heads at small sizes on 100% scaling (mac's greyscale AA hides thin-stroke shimmer that ClearType can exaggerate; if heads look brittle, bump `--font-display` weight one notch under `data-platform='win32'` — tokens make this a 2-line override).
- `backdrop-filter` glass: supported (D3D11/ANGLE) ✅; `-webkit-font-smoothing` ignored, harmless.
- Grit atmosphere (Bloom canvas `destination-in` compositing, film-grain `steps(4)` background-position animation, framer-motion scale/opacity) is standard 2D canvas + compositor work — portable. **QA on Intel iGPU**: the bloom cycle + grain at 4K/200%-scaling is the perf hot spot; the existing `prefers-reduced-motion` degradation path (BloomCycle.tsx:61-62) doubles as the perf escape hatch. Add a `disable-gpu-driver-bug-workarounds`-free fallback note: if users report black windows (classic Electron-on-busted-driver failure), document `--disable-gpu` and consider a Settings toggle wired to `app.disableHardwareAcceleration()` (persisted via settingsService) — Phase 5, only if beta telemetry shows it.
- **Per-monitor DPI / mixed scaling** (no mac equivalent): drag a window between 100% and 150% monitors — Chromium handles rescale, but canvas-based blooms re-render at the new DPR only if the resize observer re-reads `devicePixelRatio`; check Bloom.tsx's canvas sizing (it sizes from `getBoundingClientRect` × DPR at mount — add a `matchMedia('(resolution: …)')` or resize listener if stale-DPR blur shows in QA).

### 14.4 Copy & i18n (5 locales: en/es/de/fr/pt-BR)

| Location | Current | Change |
|---|---|---|
| [FeedbackModal.tsx:141-147](../src/components/modals/FeedbackModal.tsx) | "Your logs opened in **Finder** — drag the file into the email." | i18n key `feedback.logsRevealed` with `{{fileManager}}` interpolation: `isMac ? t('common.finder') : t('common.fileExplorer')` |
| SettingsModal i18n `backup.anotherMac` ([SettingsModal.tsx:538-540](../src/components/modals/SettingsModal.tsx)) | "another Mac" | Rename key → `backup.anotherDevice`, retranslate ×5 (`modals.json`/`settings.json` per locale) |
| transcribeService error (§3.2) | "couldn't start on this Mac" | platform-neutral string, routed through i18n |
| electron-builder `NSMicrophoneUsageDescription` | "…never leaves your Mac" | mac-only string — fine as-is |
| FeedbackModal.tsx:43 `navigator.platform` metadata | "Sent from SetRecord · MacIntel" | keep (diagnostic, becomes `Win32`) ✅ |
| [usbUtils.ts:10-42](../src/utils/usbUtils.ts) | already cross-platform copy | none ✅ |

Run the existing i18n key-parity test after key renames (memory: i18n — parity test exists; it will catch a missed locale).

### 14.5 Tests & QA matrix

**Unit tests (Phase 0/1):**
- [tests/engineImport.test.ts:82-148](../tests/engineImport.test.ts), [tests/rekordboxDbMapping.test.ts:18-27](../tests/rekordboxDbMapping.test.ts), [tests/serato.test.ts:131-187](../tests/serato.test.ts) hardcode `/Users/...` fixtures. Strategy: keep POSIX fixtures (they test mac behavior), **add** win32 cases that exercise the new branches by injecting `path.win32`/platform flags rather than skipping on the host OS — every path function in §§4,10,11,12 gets a `describe('windows paths')` block that runs on both CI lanes.
- New regression tests: `toMediaUrl('C:\\Users\\dj\\track.mp3')`, `parseLocation('file://localhost/C:/Users/dj/t.mp3')`, `resolveSeratoPath('Users/dj/t.mp3','C:\\Users\\dj\\Music\\_Serato_')`, `safeMusicFilename('CON.mp3')`.

**Manual QA matrix (Phase 5, extend PRELAUNCH_QA_SCRIPT.md):**

| Axis | Cover |
|---|---|
| OS | Win10 22H2, Win11 24H2 |
| Hardware | Intel iGPU laptop, discrete-GPU desktop, one ARM-on-Windows *explicitly out of scope v1* (x64 emulation will run but unsupported) |
| Scaling | 100%, 150%, mixed dual-monitor |
| Audio | Realtek mic, USB interface while rekordbox is running |
| AV | Defender on (default), one third-party AV smoke |
| Install | per-user install → launch → `setrecord://activate` from browser → uninstall (verify `%APPDATA%\SetRecord` survives) → reinstall (trial anchor intact) |

---

## RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Path-handling regressions silently break audio/library on Windows** (`media://` builder, Rekordbox XML drive letters, Serato drive-relative resolution) — the exact bug class that once silenced all audio on mac | High | Critical — app appears empty/mute; launch-killing reviews | Phase 1 ships the §4.1 path layer + regression tests *before* any feature work; Windows CI lane runs all path tests with `path.win32` injection from Phase 0 |
| 2 | **SmartScreen "unrecognized app" interstitial** suppresses installs of a paid app with zero cert reputation | High | High — direct conversion loss at launch | Azure Trusted Signing (immediate reputation); sign installer *and* inner exe; warm the cert by shipping beta builds weeks before launch |
| 3 | **Native-module build/ABI failures on Windows** (`smart-whisper` source build needs CMake+MSVC; sqlcipher Electron-ABI rebuild; ffmpeg-static is platform-fetched and currently not asar-unpacked) | Medium | High — no voice input / no Rekordbox import / no waveforms in packaged builds | Phase 0 is *only* this: windows-latest CI proving all four modules load in a packaged `--dir` build; smart-whisper stays optional-dep with graceful fallback; add `ffmpeg-static` to `asarUnpack` immediately (fixes a latent mac risk too) |
| 4 | **Trial-anchor durability weaker on Windows** — Credential Manager entries are user-deletable without an ACL prompt, re-opening the trial-farming hole the 2026-06-10 audit closed on mac | Medium | Medium — revenue leak, undermines the audit's headline fix | Mirror anchors into `HKCU\Software\SetRecord` + existing local store, take `max()` of all anchors; accept that Windows raises the floor rather than matching Keychain exactly; monitor trial-restart telemetry post-launch |
| 5 | **Flight Recorder fails on real Windows audio stacks** (WASAPI exclusive-mode locks while rekordbox/Serato run, aggressive default-device switching, vendor drivers) — flagship "DJ's memory" feature dies exactly when it matters, mid-gig | Medium | High — core value prop broken for the target user | Phase 4 validation on hardware *with rekordbox running* (mirrors the still-open mac "real-booth validation" task); add no-signal-in-10s warning + `ondevicechange` re-arm; beta cohort of Windows DJs before GA |

---

*Companion docs: [REPO_AUDIT_2026-06-10.md](REPO_AUDIT_2026-06-10.md) (security posture), [PRELAUNCH_QA_SCRIPT.md](PRELAUNCH_QA_SCRIPT.md) (extend per §14.5), [BUILDING_REPORT.md](BUILDING_REPORT.md) (add Windows toolchain prereqs per §3.2).*
