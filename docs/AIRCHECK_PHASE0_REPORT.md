# Aircheck Phase 0 — Room-Mic Match-Rate Report

**Date:** 2026-06-11 · **Verdict: GO** (with engineering notes below)
**Harness:** `tests/aircheckRoomMic.test.ts` (env-gated, never runs in CI)
**Corpus:** 40 full-length tracks from `~/Desktop/EVERY DJ SONG` (mp3/wav/aif, real library audio) · index 180 s/track · probes 6 s

## Question

The Aircheck mobile bet ("the phone on the booth shelf writes your tracklist") only holds if closed-set fingerprint matching survives a **phone mic in a loud room**. The shipped engine was validated at 90–100% on clean master-out signal only. This spike answers the noisy-mic question offline.

## Method

Real library audio pushed through a simulated phone-in-the-booth signal path:
capsule roll-off (highpass 150 Hz) → two early room reflections (aecho) → pink-noise crowd at three levels → phone AGC (dynaudnorm) → **real libopus 32 kbps mono webm round-trip** (byte-identical to the flight recorder's `webm-opus` format). Pink noise is a stand-in for crowd babble (broadband-correct, spectrally kinder than shouting) — **real-booth validation remains on the checklist**.

Two measurements:
- **Part A** — single 6 s probe per track per condition (diagnostic).
- **Part B** — `LiveDetector` simulation: continuous 6 s windows at the live 1.5 s capture cadence over 24 s of degraded audio, streak-debounced commit (`LIVE_COMMIT_STREAK = 2`). This is what the product actually consumes.

## Results

### Part A — single-probe accuracy (40 tracks × 8 conditions, 0 skipped)

| Condition | Raw top-1 id | Conf-gated (≥0.25) | Confident-WRONG | Match latency |
|---|---|---|---|---|
| clean (control) | **100%** | 90.0% | 0% | ~45 ms (p95 71) |
| opus 32k only | **100%** | 85.0% | 0% | ~49 ms |
| room-mic, quiet floor | **100%** | 35.0% | 0% | ~58 ms |
| room-mic, moderate crowd | **100%** | 35.0% | 0% | ~57 ms |
| room-mic, loud crowd | **100%** | 37.5% | 0% | ~59 ms |
| room-mic, very loud crowd | **100%** | 37.5% | 0% | ~61 ms |
| room loud + keylock +4% | **100%** | 10.0% | 0% | ~56 ms |
| room loud + NO-keylock +4% | 15.0% | 0% | **0%** | ~50 ms |

### Part B — LiveDetector on the loud-crowd chain (the product metric)

**82.5% correct lock · 0% false locks · time-to-lock mean 9.0 s / p95 13.5 s**

## Reading

1. **The signal survives.** Raw top-1 identification is **100% through every room-mic condition** — reverb, crowd noise, AGC, and the 32 kbps codec do not destroy the constellation landmarks. The matcher always finds the right track; what collapses is single-window *confidence*, whose floor (`FP_MIN_CONFIDENCE = 0.25`) was calibrated for clean master-out probes.
2. **The streak detector converts marginal confidence into a usable tracklist**: 82.5% of tracks lock correctly within ~9 s, with **zero wrong commits** across the whole run (320 single probes + 40 detector sims). A hole in the tracklist is acceptable; a wrong entry is not — and there were none.
3. **No-keylock fails quietly, as designed** (0% confident-wrong) — matching desktop behaviour and the documented fingerprint limitation.
4. **Latency is a non-issue**: ~50–60 ms per probe in plain JS against a 147 k-hash index. An on-phone port has enormous headroom (probe cadence is 1.5 s).

## Go/no-go gates (all passed)

- Clean control raw id > 95% ✓ (100%)
- Loud-crowd raw id ≥ 80% ✓ (100%)
- Confident-wrong rate ≤ 5% in every condition ✓ (0% everywhere)
- Detector correct-lock ≥ 80% ✓ (82.5%) · false-lock ≤ 2% ✓ (0%)

## Engineering notes for Phase 2 (levers, not blockers)

- **Confidence calibration for noisy probes** is the big lever: raw id is 100%, so re-tuning the confidence floor/shape for room-mic input (or a per-source floor) should push lock rate well past 90%.
- **Longer mobile probe windows** (8–10 s vs 6 s) and/or soft-voting across consecutive windows are cheap accuracy multipliers — the phone has no UI-latency pressure in pocket mode.
- Keylock ±4% + room: raw id stays 100% but confidence hovers at the floor (~0.28) — include tempo-shifted cases in the calibration set.
- Harness wart: vitest reports an unhandled worker-RPC timeout (`onTaskUpdate`) because the harness blocks the worker thread with synchronous ffmpeg calls — the test passes but the process exits 1. Read the pass/fail line, not the exit code, or run with a reporter that tolerates it.

## What this does NOT prove yet

- Real crowd babble / real club acoustics / real phone-mic AGC (simulated only). **Action:** first TestFlight build must log per-window match telemetry at a real gig (Phase 2 verification step).
- Behaviour at full-library scale (index built over 40 tracks; desktop builds over the whole library — collision pressure grows with size). **Action:** rerun harness with `AIRCHECK_SPIKE_LIMIT=300` overnight before Phase 2 starts.
