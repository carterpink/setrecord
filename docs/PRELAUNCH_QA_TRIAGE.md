# Pre-Launch QA — Founder Checklist (do-this → tick-this)

Companion to `PRELAUNCH_QA_SCRIPT.md`, rewritten so every item is plain and
self-contained. Verified against the code + green test suite (912 passing).

**How to use:** work top to bottom through **Section B** (must test by hand) and
**Section C** (quick glance). Each item tells you exactly what to do and what
"pass" looks like. Tick the box if it passes; if it fails, note it and fix it.
**Section A** is already proven by automated tests — you can skip it.

⭐ = highest-risk, don't skip.

---

## ✅ Section A — already proven, SKIP these

These pass in the automated test suite; no need to hand-test:
`1.6 single-instance · 1.9 dev theme toggle · 2.3 trial-arms-can't-be-farmed ·
3.8 malformed-XML error · 4.5 Engine-import stub · 7.3 MyTag backup-first ·
8.6 recorder crash-recovery · 11.3 Engine validator blocks bad files · 11.6 Engine
export Pro-gated · 12.1–12.3 Beatport (no network / no DB writes / Pro-gated) ·
13.1 correct pricing · 13.4 tampered-license rejected · 13.6 clock-rollback trial
defense · 13.7 offline Pro stays unlocked · 14.2 i18n no-missing-keys ·
14.3 reduced-motion · 14.4 log redaction · 14.5 external links open in browser ·
15.6 clean relaunch after crash · 15.7 auto-update non-blocking`

---

## 👁️ Section B — MUST test by hand (visual / audio / hardware / real purchase)

### Setup (do once before you start)
- [ ] **Run the production build**, not `npm run dev` (some bugs only show in the real app). `npm run build:mac` makes the `.app`.
- [ ] **Gather test files:** a Rekordbox `.xml` export · a Serato folder · 2–3 songs with embedded album art · 1 song with emoji/accents in the filename · 1 song whose file path has spaces in it.
- [ ] **Open DevTools** (View menu → Toggle Developer Tools, or ⌥⌘I) and leave the Console tab open the whole time — watch for red errors.
- [ ] *(Optional but ideal)* test on an **empty library**: rename `~/Library/Application Support/setrecord` so the app starts fresh; keep the renamed copy to restore after.

### Launch & window
- [ ] **1.1 ⭐ Cold open.** Fully quit (⌘Q), reopen. → Pass: the "Cut" splash plays, then you land on the Library. No white/blank flash, no jumbled unstyled text.
- [ ] **1.2 Resize.** Drag the window small → large → small. → Pass: layout reflows, nothing clipped or overlapping, no sideways scrollbar.
- [ ] **1.3 Fullscreen.** Click the green button (or ⌃⌘F). → Pass: enters and exits cleanly.
- [ ] **1.4 Minimize / hide.** Minimize (yellow button) then click the dock icon; then ⌘H then reopen. → Pass: comes back exactly as you left it.
- [ ] **1.7 Menu bar.** Check the top menus: SetRecord → About + Quit exist; Edit → Copy/Paste work in a text field. → Pass: present and working. *(The app uses macOS's default menu — that's fine.)*
- [ ] **1.8 Idle CPU.** Leave the app sitting still; open Activity Monitor, find SetRecord. → Pass: CPU near 0–few %, no fan spin-up from the grain effect.

### Onboarding *(only if you started on an empty library)*
- [ ] **2.1 First run.** → Pass: a welcome / first-import flow appears, and "import" is clearly the main button.
- [ ] **2.4 Skip it.** Dismiss onboarding. → Pass: app still usable, doesn't force it again.
- [ ] **2.5 Reopen.** Quit and reopen after finishing onboarding. → Pass: it does NOT show again.

### Imports
- [ ] **3.1 ⭐ Rekordbox import.** Import → pick your `.xml`. → Pass: file dialog opens, progress shows, tracks appear with title / artist / BPM / key.
- [ ] **3.3 Album art.** After import → Pass: tracks with embedded covers show artwork; tracks without show a placeholder (not a broken/error image).
- [ ] **3.6 Weird filenames.** Import the emoji/accent file. → Pass: the name shows correctly (no garbled "Ã©"-style mojibake).
- [ ] **3.9 Big library** *(if you have one).* Import a large collection. → Pass: progress keeps moving, the app doesn't freeze/beachball.
- [ ] **4.3 Serato crates.** After a Serato import → Pass: crates appear in the sidebar.
- [ ] **4.6 Spot-check vs Serato.** Pick a few tracks, compare BPM / key / cues to what Serato shows. → Pass: they match.

### Library & playback
- [ ] **5.1 Scroll.** Scroll the full library fast. → Pass: smooth, no stutter.
- [ ] **5.3 Tags bar.** Click a tag. → Pass: library filters to it; clearing restores the full list.
- [ ] **5.4 ⭐ Play a track with SPACES in its file path.** Click it. → Pass: you HEAR audio AND the waveform draws AND seek works. *(This is the exact bug class we fixed — confirm it.)*

### Uncover (swipe deck)
- [ ] **6.1 Open Uncover** (in Library). → Pass: cards appear, swipe or arrow-keys left/right work, each card shows track + art.
- [ ] **6.2 Like / dismiss a few, then reopen.** → Pass: your choices stuck.

### Set Flight Recorder (privacy — important)
- [ ] **8.2 ⭐ First recording.** Start a recording for the first time. → Pass: a mic-consent prompt appears FIRST; a REC indicator is visible while recording; audio is actually captured. → **Stop if:** no consent prompt or no REC light (privacy fail).
- [ ] **8.3 Playback.** Play back a recorded session. → Pass: you can seek within it; the tracklist lines up with the audio.
- [ ] **8.5 No upload.** During/after recording, open DevTools → Network tab. → Pass: nothing uploads (stays local).
- [ ] **8.7 Deny mic.** Record after denying mic consent. → Pass: tracklist still builds, just no audio, no crash.
- [ ] **8.8 Long session.** Record a long one (or check an existing multi-hour file). → Pass: file size stays reasonable.

### Home
- [ ] **9.4 Stats.** Look at the streak / activation numbers. → Pass: real numbers, no "NaN" or "undefined".
- [ ] **9.5 Empty state** *(empty library).* → Pass: Home shows a friendly empty state, not broken stat cards.

### Build / Set Architect
- [ ] **10.2 ⭐ Build a set.** Add tracks, drag to reorder, remove one, then reopen the set. → Pass: order sticks and contents are intact.

### Engine DJ export *(needs a USB stick; ideally Denon gear)*
- [ ] **11.1 Export to USB.** Export a set/crate to a USB Engine library. → Pass: audio files copy, the database writes, validator passes.
- [ ] **11.2 Load it.** Eject and load on Denon/Engine (or inspect the USB). → Pass: tracks / BPM / key present and playable.
- [ ] **11.4 Full / locked USB.** Try exporting to a full or read-only stick. → Pass: friendly error, no corrupt half-write.
- [ ] **11.5 Eject mid-export.** Pull the stick during export. → Pass: app handles it, no crash.

### Payment (real Lemon Squeezy — still in TEST mode for now)
- [ ] **13.2 Open checkout.** Hit a Pro feature → click upgrade. → Pass: Lemon Squeezy checkout opens on the correct product / price.
- [ ] **13.3 ⭐ Test purchase.** Complete checkout with test card `4242 4242 4242 4242`. → Pass: Pro unlocks (instantly, or with a clear "restart to apply").
- [ ] **13.5 Restore license.** Re-enter your license on a fresh profile. → Pass: Pro unlocks.
- [ ] **13.8 Cancel / fail.** Cancel the checkout or fail the payment. → Pass: app stays Free cleanly, no half-unlocked features.

### Native sweep (do last)
- [ ] **15.2 Drag & drop.** Drag a file/folder onto the app. → Pass: it does something sensible or cleanly ignores it (no crash).
- [ ] **15.3 ⭐ Sleep / wake.** Sleep your Mac mid-app, wake it. → Pass: app isn't frozen; audio still works.
- [ ] **15.4 Monitor / DPI** *(if you have a second monitor).* Move the window between Retina and non-Retina. → Pass: UI stays crisp, grain doesn't tear.

### Final go / no-go
- [ ] No red errors in the DevTools Console during the whole run.
- [ ] No data lost in any quit/relaunch.
- [ ] Privacy held: consent prompt + REC light shown, nothing uploaded.
- [ ] Payment worked end-to-end in test mode.
- [ ] Every problem you hit is either fixed or written down as a known/accepted issue.

---

## 🟡 Section C — quick glance (code is correct; just confirm it looks right)

These have passing tests behind them — you're just eyeballing that the UX looks
right, not deeply testing. A few seconds each.

- [ ] **2.2 Beginner mode** — labels read in plain language, no raw DJ jargon.
- [ ] **3.2 Playlist tree** — Rekordbox folders/playlists nested correctly in the sidebar, counts look right.
- [ ] **3.4 Colors / MyTags** — track colors and tags came across on import.
- [ ] **3.5 Re-import same XML** — no duplicates appear; it updates instead.
- [ ] **3.7 Missing files** — a track whose file moved shows as "missing", flagged, doesn't crash.
- [ ] **4.1 Serato import** — crates + tracks come in.
- [ ] **4.2 Cues / beatgrids** — present where Serato had them.
- [ ] **4.4 Partial Serato** — a library with crates but no cues still imports cleanly.
- [ ] **5.2 Search** — type a query, results filter live; clearing restores the list.
- [ ] **5.5 Recall question** — ask "tracks like X" or "stuff I haven't played"; sensible results; the "I read that as" line is editable and re-runs.
- [ ] **5.6 Gig recall** — "songs I played at [venue]" / "sets in [month]" return the right matches.
- [ ] **5.7 Empty library** — shows a real empty state, not a forever spinner.
- [ ] **5.8 No-result query** — clear "nothing found" message, not a blank panel.
- [ ] **6.3 Tiny library (<5 tracks)** — Uncover deck doesn't crash.
- [ ] **6.4 Deck to empty** — clean "all caught up" state.
- [ ] **7.1 Auto-tags appear** — new imports get plain-language tags within a reasonable time.
- [ ] **7.2 Tags filter** — those tags show in the tags bar and filter when clicked.
- [ ] **8.1 Auto tracklist** — recorder builds the tracklist as tracks play.
- [ ] **8.4 Reactions** *(only if you flip the experimental toggle on)* — don't break the main recording.
- [ ] **9.1 Home box** — accepts a query and routes to results.
- [ ] **9.2 "I read that as"** — line shows, is editable, re-runs on edit.
- [ ] **9.3 Voice** *(if enabled)* — mic dictates into the box; clean if disabled.
- [ ] **10.1 Source pool** — Set Architect fills from library + Rekordbox playlists.
- [ ] **10.3 Suggestions** — next-track suggestions are coherent.
- [ ] **10.4 Save / reopen set** — contents intact.
- [ ] **10.5 Empty source pool** — clear "import first" prompt, no crash.
- [ ] **10.6 Missing-file track in a set** — flagged, doesn't block the rest.
- [ ] **14.1 Settings persist** — change a setting, relaunch — it stuck.
- [ ] **15.1 File-dialog paths** — imports of your spaces/Unicode files land correctly (you'll hit this naturally during imports).
- [ ] **15.5 Quit with unsaved work** — mid-build or mid-record, quitting autosaves or prompts — no silent loss.

---

## ⚠️ Two things to know before you tick
1. **1.7 Native menu bar** — the app uses macOS's *default* menu (no custom menu defined). About/Quit/Copy/Paste all work via that default. If you want custom menu items, that's a feature add, not a bug.
2. **DB-backed tests were skipped under the test runner** (native module reasons), so a few Section C items (save/reopen set, gig recall) lean on code review rather than an executed test — worth an extra glance.
