# SetRecord — Pre-Launch Manual QA Script

**Purpose:** A single-pass, founder-run smoke + edge test before shipping.
**Time budget:** ~2–3 hours. **Run order:** top to bottom (later sections assume a populated library).
**How to use:** Tick each box. If anything in a "🔴 Broken looks like" line happens, stop and log it.

### Before you start
- [ ] 0.1 Build the **production** package (not `dev`) — `npm run build` / packaged app. Bugs hide in dev-only paths.
- [ ] 0.2 Run on a **clean profile** if possible (rename your app-data dir so you start from zero state) — keep a copy of your real DB to restore after.
- [ ] 0.3 Have test assets ready: a Rekordbox XML export, a Serato `_Serato_` folder, 2–3 audio files with embedded art, 1 file with a Unicode/emoji filename, 1 file with a `media://`-style path with spaces.
- [ ] 0.4 Open DevTools console (or tail the local log file) and **leave it open the whole run** — watch for red errors even when the UI looks fine.
- [ ] 0.5 Note your machine: OS version, display scaling, whether external monitor attached.

---

## 1. App launch & Electron shell
- [ ] 1.1 **Happy:** Cold launch — opening "The Cut" splash plays, then lands on the Library (front door). No flash of unstyled content.
- [ ] 1.2 Window **resize**: drag from small → large → small. Layout reflows; no clipped panels, no horizontal scrollbar, no overlapping text.
- [ ] 1.3 **Fullscreen** toggle (green button / `Ctrl/Cmd+Ctrl+F`). Enter and exit cleanly.
- [ ] 1.4 **Minimize → restore** and **hide → reopen** (dock/taskbar). State preserved.
- [ ] 1.5 **Quit & relaunch** (`Cmd/Ctrl+Q`): reopens to last-known good state; library still populated; no "database locked" error.
- [ ] 1.6 **Second-instance:** try launching the app again while it's open — should focus existing window, not spawn a duplicate or corrupt the DB.
- [ ] 1.7 Native **menu bar**: About, Quit, Edit (copy/paste), and any custom items present and functional.
- [ ] 1.8 **Film grain / atmosphere** (Grit theme) renders without pinning a CPU core; check Activity Monitor — idle app should be near-idle.
- [ ] 1.9 `window.__setTheme('aurora')` reverts to the old look app-wide; reload back to default — confirm the toggle is not user-exposed if it shouldn't be.
- [ ] 🔴 **Broken looks like:** white screen on launch, splash never clears, window opens off-screen (multi-monitor), DB-locked toast, runaway fan from the grain shader.

## 2. Onboarding (first-run)
- [ ] 2.1 **Happy:** Fresh profile → onboarding/first-run flow appears; the activation step (first import) is clearly the primary CTA.
- [ ] 2.2 **Beginner mode:** confirm `isBeginner` path hides DJ jargon; advanced labels appear only for non-beginners.
- [ ] 2.3 **Free trial arms on first import** — verify the 7-day Pro trial starts and is surfaced (not silently).
- [ ] 2.4 Skip / dismiss onboarding — app remains usable; doesn't re-nag on every launch.
- [ ] 2.5 Re-launch after completing onboarding — it does **not** show again.
- [ ] 🔴 **Broken looks like:** onboarding loops on every launch, trial doesn't arm, beginner copy shows raw jargon, primary CTA dead-ends.

## 3. Import — Rekordbox XML
- [ ] 3.1 **Happy:** Native **file dialog** opens, pick `.xml`, import runs with visible progress, tracks land in Library with title/artist/BPM/key.
- [ ] 3.2 **Playlists/folders:** Rekordbox playlist tree appears in the sidebar; nesting preserved; counts correct.
- [ ] 3.3 **Album artwork:** embedded covers render (ffmpeg path); missing-art tracks fall back to placeholder, don't error.
- [ ] 3.4 **MyTag / color:** colors and MyTags import (djmdColor Commnt vs Name handled).
- [ ] 3.5 **Re-import the same XML:** dedupes / updates rather than creating duplicates.
- [ ] 3.6 **Edge — Unicode/emoji** filenames and accented artist names import without mojibake.
- [ ] 3.7 **Edge — missing files:** tracks whose audio path no longer exists import as "missing", clearly flagged, don't crash playback.
- [ ] 3.8 **Edge — malformed/empty XML:** import shows a friendly error, not a stack trace; app stays usable.
- [ ] 3.9 **Edge — huge library** (if you have one): progress stays responsive; UI doesn't freeze the main thread.
- [ ] 🔴 **Broken looks like:** dialog won't open, silent no-op import, duplicates on re-import, mojibake, app hang on large files, raw error JSON shown to user.

## 4. Import — Serato
- [ ] 4.1 **Happy:** Point at a Serato library; crates + tracks import (binary DB V2 path).
- [ ] 4.2 **Cues / beatgrids:** per-file cues and beatgrids come through where present.
- [ ] 4.3 **Crates** appear as playlists/folders in the sidebar.
- [ ] 4.4 **Edge — partial Serato data:** library with crates but no cues still imports cleanly.
- [ ] 4.5 **Edge — Engine DJ source** (stubbed): selecting it fails gracefully with a "not yet supported" message, not a crash.
- [ ] 4.6 Cross-check a handful of tracks against Serato itself — BPM/key/cues match.
- [ ] 🔴 **Broken looks like:** binary parse throws, crates missing, cues silently dropped without notice, Engine stub crashes the importer.

## 5. Library & RecallPanel
- [ ] 5.1 **Happy:** Library lists imported tracks; scroll is smooth at full library size (virtualized, no jank).
- [ ] 5.2 **Search / filter:** type a query — results filter live and correctly; clearing restores full list.
- [ ] 5.3 **Tags bar:** auto-tags show; clicking a tag filters; multi-tag behaves sensibly.
- [ ] 5.4 **Playback:** click a track → audio plays, **waveform** renders, seek works. Test a file with **spaces in the path** (the `media://` encoding bug class) — audio is NOT silent and waveform appears.
- [ ] 5.5 **Recall/conversational query** (RecallPanel): ask a natural question ("tracks like X", "stuff I haven't played") — returns sensible results; the "I read that as" interpretation line is editable and re-runs.
- [ ] 5.6 **Gig recall:** "songs I played at [venue]" and "sets in [month]" return correct play-session matches.
- [ ] 5.7 **Edge — empty library:** RecallPanel and Library show a real empty state, not a spinner-of-death.
- [ ] 5.8 **Edge — query with no results:** clear "nothing found" message, not a blank panel.
- [ ] 🔴 **Broken looks like:** silent audio, missing/garbled waveform, search returns stale results, recall returns nonsense or hangs, empty-state spinner.

## 6. Uncover (swipe deck)
- [ ] 6.1 **Happy:** Open Uncover in Library — cards deal; swipe/keyboard left/right works; each card shows track + art.
- [ ] 6.2 Actions persist (liked/dismissed tracks affect future decks or a saved list).
- [ ] 6.3 **Edge — small library** (<5 tracks): deck handles gracefully, doesn't crash on running out of cards.
- [ ] 6.4 **Edge — run the deck to empty:** clean "you're all caught up" state.
- [ ] 🔴 **Broken looks like:** cards don't deal, swipe does nothing, crash at end of deck, art missing on every card.

## 7. Auto-tagger
- [ ] 7.1 **Happy:** Newly imported tracks get plain-language tags from spectral features within reasonable time.
- [ ] 7.2 Tags appear in the Library Tags bar and are filterable.
- [ ] 7.3 **Rekordbox MyTag write-back:** trigger write-back → confirm a **backup is made first**, then Rekordbox reads the new tags. Verify the backup file exists.
- [ ] 7.4 **Edge — corrupt/zero-length audio:** tagger skips it, logs, doesn't stall the queue.
- [ ] 7.5 **Edge — write-back with Rekordbox open:** handled gracefully (lock/permission message), no DB corruption.
- [ ] 🔴 **Broken looks like:** no tags ever appear, tagger queue stuck, write-back without backup, Rekordbox DB corrupted after write-back.

## 8. Set Flight Recorder
- [ ] 8.1 **Happy:** Recorder is always-armed/dashcam; start a session — tracklist auto-builds as you "play" tracks.
- [ ] 8.2 **Lo-fi audio capture:** consent prompt appears first time; REC indicator visible while recording; audio is captured (room-mic, lo-fi).
- [ ] 8.3 **In-app playback:** play back a recorded session; per-track **seek** works; tracklist entries align to audio.
- [ ] 8.4 **Reactions** (experimental, gated): if enabled, reaction capture runs without breaking the main recording.
- [ ] 8.5 **Local-only:** confirm nothing uploads — check network tab is silent during/after recording.
- [ ] 8.6 **Quit mid-recording → relaunch:** session is recovered or cleanly closed, not corrupted/zero-byte.
- [ ] 8.7 **Edge — deny mic consent:** tracklist still records; audio simply absent; no crash.
- [ ] 8.8 **Edge — long session / disk space:** lo-fi keeps size reasonable; check a multi-hour file size is sane.
- [ ] 🔴 **Broken looks like:** no consent prompt (privacy fail), REC indicator missing while capturing (privacy fail), playback seek broken, corrupted file after quit, any network upload.

## 9. Home surface
- [ ] 9.1 **Happy:** Home's conversational box accepts a query and routes into Library/recall results.
- [ ] 9.2 The "I read that as" interpretation line shows, is editable, and re-runs on edit.
- [ ] 9.3 **Voice / smart-whisper** (if enabled): mic input transcribes into the box; degrades cleanly if disabled.
- [ ] 9.4 Gamification / weekly-streak + activation surfacing render with real numbers (not NaN / "undefined").
- [ ] 9.5 **Edge — first run, no data:** Home shows a welcoming empty state, not broken stat cards.
- [ ] 🔴 **Broken looks like:** box does nothing, interpretation line wrong/uneditable, NaN streaks, voice hard-crashes when unsupported.

## 10. Build / Set Architect
- [ ] 10.1 **Happy:** Open Build/Set Architect; source pool (Rekordbox playlists + library) populates.
- [ ] 10.2 Build a set: add tracks, reorder (drag), remove — order persists.
- [ ] 10.3 Any AI/suggestion assist returns coherent next-track suggestions.
- [ ] 10.4 Save a set and reopen it — contents intact.
- [ ] 10.5 **Edge — empty source pool:** clear prompt to import first, no crash.
- [ ] 10.6 **Edge — set with a missing-file track:** flagged, doesn't block the rest of the set.
- [ ] 🔴 **Broken looks like:** source pool empty when library has tracks, drag-reorder loses items, saved set comes back empty/reordered.

## 11. Engine DJ export
- [ ] 11.1 **Happy:** Export a set/crate to an Engine Library on a USB drive — audio files copy, `m.db` written, validator passes.
- [ ] 11.2 **Eject & load in Engine** (or inspect the USB structure): tracks, BPM, key present and playable on target.
- [ ] 11.3 **Validator — non-owned / missing files:** these are flagged as **blocking** before export proceeds (per spec).
- [ ] 11.4 **Edge — USB full / read-only:** friendly error, partial write doesn't leave a corrupt `m.db`.
- [ ] 11.5 **Edge — eject mid-export:** handled without crashing the app.
- [ ] 11.6 **Pro-gated:** confirm export respects entitlement (see §13).
- [ ] 🔴 **Broken looks like:** corrupt `m.db`, audio not copied, Engine refuses the library, validator lets missing files through, partial write on full disk.

## 12. Beatport export (if in scope for launch)
- [ ] 12.1 Export modal offers CSV; offline ISRC/title match-keys generated; no network calls.
- [ ] 12.2 CSV opens cleanly in a spreadsheet; no DB writes occurred.
- [ ] 12.3 Pro-gated as expected.
- [ ] 🔴 **Broken looks like:** malformed CSV, unexpected network call, DB mutated by an "export".

## 13. Payment / upgrade flow (Lemon Squeezy)
- [ ] 13.1 **Happy:** Hit a Pro gate (Engine export / Beatport / Pro feature) → upgrade prompt appears with correct tiers (Free / $79yr / $199 lifetime; $9 decoy if shown).
- [ ] 13.2 Click upgrade → Lemon Squeezy checkout opens (in-app or browser) on the **correct** product/price.
- [ ] 13.3 **Test purchase** (LS test mode): complete checkout → fulfilment Worker mints license → app unlocks Pro **without restart** (or with a clear "restart to apply").
- [ ] 13.4 **License signature:** confirm the app verifies the Ed25519 signature — tamper with the stored license and confirm it's rejected.
- [ ] 13.5 **Restore / re-enter license** on a fresh profile unlocks Pro.
- [ ] 13.6 **Trial expiry:** roll the clock forward (or simulate) → trial ends, Pro features re-lock, upgrade prompt returns. Confirm **clock-rollback** defense (setting clock back doesn't revive the trial).
- [ ] 13.7 **Edge — offline:** Pro stays unlocked offline once licensed (no phone-home requirement to use paid features).
- [ ] 13.8 **Edge — checkout cancelled / failed payment:** app returns to free state cleanly, no half-unlocked features.
- [ ] 🔴 **Broken looks like:** wrong price shown, license never applies, Pro unlocks with an invalid/tampered license, trial revives on clock rollback, app bricks when offline.

## 14. Settings, i18n & cross-cutting
- [ ] 14.1 Settings modal opens; changes persist across relaunch.
- [ ] 14.2 **i18n:** switch language (en/es/de/fr/pt-BR) — UI chrome translates; no missing-key fallbacks like `settings.title` showing raw.
- [ ] 14.3 **Reduced motion:** enable OS reduce-motion → house animations respect it (no jarring movement).
- [ ] 14.4 **Logging:** confirm local log file is written and **redaction** holds (no file paths/PII leaking if Sentry opt-in is on). Bug-feedback export attaches the sid-correlated log.
- [ ] 14.5 **External links** (pricing, support, landing page) open in the system browser, not inside the app shell.
- [ ] 🔴 **Broken looks like:** settings reset on relaunch, raw i18n keys, animations ignoring reduce-motion, PII in logs, links opening in-app.

## 15. Electron native-integration sweep (do these last, across the populated app)
- [ ] 15.1 **All native file dialogs** (XML import, Serato folder pick, USB export target, any "reveal in Finder") open and return correct paths — including paths with **spaces and Unicode**.
- [ ] 15.2 **Drag-and-drop** a file/folder onto the app (if supported) behaves or is cleanly ignored.
- [ ] 15.3 **Deep sleep / wake:** sleep the machine mid-app, wake — no zombie state, audio engine recovers.
- [ ] 15.4 **External monitor / DPI change:** move the window between a Retina and non-Retina display — UI re-renders crisply, grain doesn't tear.
- [ ] 15.5 **Quit with unsaved work** (mid-build set, mid-recording): prompt or autosave, no silent data loss.
- [ ] 15.6 **Relaunch after a crash** (force-quit the app): recovers without "database is locked" or corrupt state.
- [ ] 15.7 **Auto-update** (if wired for launch): update check doesn't block startup; failed check degrades silently.
- [ ] 🔴 **Broken looks like:** dialog returns wrong/encoded path, audio dead after wake, blurry UI on DPI switch, data loss on quit, DB lock after crash.

---

## Final go/no-go
- [ ] **No red console errors** observed during the full run (review your open DevTools/log).
- [ ] **No data loss** in any quit/relaunch/crash test.
- [ ] **Privacy holds:** mic consent + REC indicator present, recordings local-only, no unexpected network calls.
- [ ] **Money path verified end-to-end** in test mode, including tamper + rollback defenses.
- [ ] **Every 🔴 you hit is either fixed or consciously accepted** with a written note.

> Restore your real DB/profile when done. Keep this filled-in copy as the launch QA record.
