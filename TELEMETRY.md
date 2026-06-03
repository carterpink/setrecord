# Telemetry & Crash Reporting

SetSense is offline-first. Audio, your library, and your taste data **never leave
your machine** (NFR-301). The one exception is crash reporting, and it is
**off by default** and **opt-in only**. This document is the canonical record of
what the crash reporter collects, how it is configured, and how to opt out — it
exists to satisfy NFR-304 and NFR-802, and to keep the privacy promise and the
implementation reconciled in one place.

## Default state

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Default             | **Off** (opt-in)                                             |
| Consent surface     | Settings → Privacy → **Crash reporting** toggle              |
| Transport           | [Sentry](https://sentry.io) (`@sentry/electron`), main process only |
| Scope               | Crash reports only — no usage analytics, no performance tracing |
| Network when off    | Zero. With the toggle off, Sentry is never initialised.      |

Nothing is transmitted unless **both** are true: the user has enabled the toggle,
**and** the build was compiled with a `SENTRY_DSN`. Local and CI builds ship with
no DSN, so they never report regardless of the toggle.

## What is collected

When — and only when — a user has opted in:

- Error type and message
- A **redacted** stack trace: filenames only (e.g. `main.ts`), with all absolute
  paths removed
- App version
- OS name and version
- CPU architecture
- Sentry runtime/os context (version strings only)

## What is never collected

- Audio, waveforms, or any analysis input
- Library contents, track titles, artists, file paths, playlists, cues
- Absolute filesystem paths (scrubbed to bare filenames; `abs_path` dropped)
- Your computer's hostname / device name (`server_name` and `contexts.device`
  are deleted)
- User identity (`event.user` deleted; `sendDefaultPii: false`)
- Breadcrumbs (console output, navigation) — dropped wholesale
- Screenshots (`attachScreenshot: false`)
- IP-derived identity or cookies (`sendDefaultPii: false`)

Scrubbing is enforced in `beforeSend` in
[`electron/services/crashReporter.ts`](electron/services/crashReporter.ts) and is
covered by tests in [`tests/reliability.test.ts`](tests/reliability.test.ts).

## Sampling

| Stream            | Rate  | Rationale                                            |
| ----------------- | ----- | --------------------------------------------------- |
| Errors / crashes  | `1.0` | Pre-launch, every crash is signal. Revisit only if volume becomes a cost issue. |
| Performance/traces| `0`   | No tracing data is collected at all.                |

## DSN ownership

- The DSN is supplied at build time via the `SENTRY_DSN` environment variable and
  is **never committed** to the repo (`.env.example` ships a blank placeholder).
- It is injected from CI secrets for release builds only.
- A DSN is a write-only ingestion key — it cannot be used to read reports — but it
  is kept out of source to avoid quota abuse.
- The Sentry project ("SetSense Desktop") is owned by the SetSense maintainers.

## How to opt out

1. Open **Settings → Privacy**.
2. Turn **Crash reporting** off.

Turning it **off** stops reporting **immediately** in the current session
(`closeCrashReporter()` flushes and disables the client). Turning it **on** takes
effect on the next launch, so that startup errors can be captured.

Consent is per-machine and never travels: `crashReportingEnabled` is deliberately
excluded from `PORTABLE_SETTINGS_KEYS`, so restoring a backup on another computer
never silently enables reporting.

## Future work

- **Post-crash consent prompt (opt-in).** A buried settings toggle converts
  poorly, so real-world crash visibility is currently low. A future enhancement
  would capture a crash locally and, on next launch, ask once whether to send an
  anonymous report — still fully consent-based, but with far better coverage.
