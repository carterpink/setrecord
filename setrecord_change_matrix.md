# SetRecord — Complete Change & Feature Prioritisation Matrix
*Synthesised from 4-persona user research simulation · May 2026*
*Every negative signal, requested feature, and inferred gap. Nothing omitted.*

---

## How to read this

- **P0** — Breaks trust or kills conversion. Must be fixed before any public launch or paid tier.
- **P1** — Significantly improves retention and willingness to pay. Build immediately after P0.
- **P2** — Quality-of-life; improves polish and power-user confidence.
- **P3** — Future consideration; low urgency but worth tracking.
- ★ — Referenced by 3 or more personas independently.
- **[J]** Jake · **[S]** Sarah · **[M]** Marcus · **[D]** Dave · **[I]** Inferred from patterns not explicitly stated.

Features marked **NOT IN PRD** are new scope that emerged from the research. Everything else maps to PRD v1 or Phase 8 polish.

---

## SECTION 1 — Onboarding & Import - COMPLETE

### P0

**Add a step-by-step XML import guide inside the ImportModal** ★ [J, all newcomers]
- Jake represents the single largest user segment (low-tech, phone-first, less than 3 years DJing). He does not know what a Rekordbox XML export is. If there is no walkthrough, he closes the app in under 90 seconds.
- Minimum fix: 3-step illustrated guide inside the modal — "In Rekordbox: File → Export Collection in xml format → Save → come back here. Takes 30 seconds."
- Ideal fix: auto-detect Rekordbox's SQLite database at `~/Library/Application Support/Pioneer/rekordbox/master.db` and offer one-click import with no XML export needed at all. Rekordbox's database is SQLite and readable. This removes the single biggest conversion drop-off in the product.
- This is listed as the #1 revenue-killer in the cross-persona synthesis.

**Demo data on first launch must be unambiguously labelled or removed** ★ [J, S, D]
- All three personas thought the pre-populated set timeline was either their real data or tracks they accidentally added. Jake: "Is this someone else's library?" Sarah: "I'm not sure which is demo and which is real." Dave: "It must've read Rekordbox."
- Either: label the pre-populated set clearly as "Sample data — import your library to begin", or show a proper empty state on first launch with no fake tracks in the timeline at all.
- Demo data mixed with real data after import is equally dangerous — Sarah specifically noted she couldn't tell which tracks were hers and which were demo.

### P1

**Import completion report** [S]
- After import completes, Sarah (and all power users) expect a summary: "3,017 tracks imported · 45 skipped (missing title or artist) · 12 flagged (unsupported format) · 68 file paths not found on this machine."
- Silence after a 10-second import process is not reassuring at scale. Professional users need to audit what came in.
- This already partially exists as LibraryStats — it needs to be surfaced prominently after every import, not buried.

**Re-import / incremental sync workflow** [S, I]
- Currently completely unclear: is this a one-time import or do you re-export from Rekordbox every time you add tracks?
- Add a "Re-sync library" button in the ImportModal, Settings, or top bar that re-runs the import on the previously selected XML path.
- Behavior on re-import must be defined and communicated: does it merge new tracks only? Overwrite all data? Preserve cue points set in SetRecord?
- Ideally: detect if the source XML has been modified since last import and show a badge or prompt automatically.

**Progress detail during large imports** [I]
- During a 10k-track import, show what's currently being processed: "Parsing track 1,247 of 10,432 — Bicep — Glue.wav"
- Makes the wait feel accurate and builds confidence the import is working correctly.

### P2

**Drag-from-Finder to import** [M]
- Allow dragging an XML file directly onto the app window to trigger import. Standard Mac app behaviour that a high-tech user (Marcus) will expect.

**Folder watch / auto-detect new XML** [M, I]
- Monitor a folder for updated Rekordbox XML exports and offer to re-sync automatically.

---

## SECTION 2 — Library Panel - COMPLETE

### P0

**Clicking a library track must produce a meaningful response in the Suggestions panel** ★ [J, S, M]
- Current state: clicking a library track shows "No track selected" in the Suggestions panel. All three technical personas flagged this as reading like a bug, not a design choice.
- Sarah: "That reads as a bug, not a design choice — and it's a workflow blocker if I'm exploring pairings before committing."
- Marcus: "I want a 'find similar to this' action from the library panel."
- Fix options:
  1. Show suggestions as if this track were the last in the set ("What would mix well after this?") — most powerful.
  2. Show a clear inline prompt: "Add this track to your set to see what comes next →" — simpler but still removes the dead-end silence.
- Option 1 is significantly more valuable; the suggestion engine already runs this logic.

### P1

**Camelot notation explainer / legend for newcomers** [D, J, I]
- Not every DJ uses Camelot notation. Jake sees "9A" and doesn't know what the colours mean. Dave wonders if there should be a legend.
- Add a "?" tooltip or popover on any key chip showing: "9A = Am (A minor). Camelot notation shows harmonic key. Tracks with adjacent numbers mix harmonically."
- Or: a one-time "first time you see a key chip" tooltip that explains the system.

**Surface the cue point search capability** [D]
- Dave noticed "Search library, sets, cue points…" in the search placeholder and was genuinely excited. This is a compelling differentiator from Rekordbox.
- The feature is currently communicated only via placeholder text — extremely easy to miss.
- Add a small feature chip or   callout near the search bar: "Also searches your cue point labels."

**Sort controls** [I]
- Currently sorted by artist by default. Add sort options: BPM, energy, key, date added, play count, duration, rating.
- These are baseline expectations from DJs coming from Rekordbox.

**Filter chips in library header** [I]
- BPM range, key, energy range, format, genre filters.
- Needed for large libraries (10k+ tracks). A DJ planning a set at a specific BPM window should be able to narrow the library instantly.

**Track row compact mode** [I]
- At 56px height with 10k tracks, scrolling performance and visual density become concerns.
- Add a density toggle: standard (56px) / compact (40px).

### P2

**Right-click context menu on library track** [M, I]
- "Preview" — starts audio preview at double-click position
- "Find similar tracks" — BPM-compatible + Camelot-compatible results
- "Add to set"
- "Edit cue points"
- "What have I played after this?" — shows historical Combos for this track

**"What have I played after this?" shortcut** [J, I]
- Jake asked for this on timeline cards; it belongs equally in the library panel.
- One-click to see historical transitions from Combos data, inline, without navigating to the Recall tab.

---

## SECTION 3 — Set Timeline

### P0

**"Set safety: Not validated" badge must be clickable and actionable** ★ [J, S, M, D]
- All 4 personas noticed it. None knew what to do with it.
- The badge creates persistent ambient anxiety without offering any resolution path.
- Clicking it should trigger validation immediately (either inline or opening the Export/Validation modal).
- Add a tooltip on hover: "Click to validate this set for CDJ-2000NXS2 before export."
- After validation: badge updates to "Set validated · 0 issues" (green) or "2 warnings · click to review" (amber) or "1 blocking issue" (red).

### P1

**"What have I played after this?" button on each timeline card** [J]
- Jake's most explicit feature request for the Prepare tab.
- Small inline icon on TimelineTrackCard → opens a popover showing historical Combos data for this track.
- Bridges the gap between the Recall and Prepare tabs without requiring navigation.

**Transition indicator UX clarity** [J, D, I]
- A small legend or tooltip explaining the quality dots: green = clean mix, amber = messy, red = trainwreck.
- Jake saw "Messy" and "Clean" labels and called them "not nothing" — but first-time users won't know what the dots mean without a legend.

### P2

**BPM range display in timeline header** [S]
- Sarah: "125–160 BPM for a 5-track set is a wide spread. This reads as either scattered tracks or misleading display."
- Show median or weighted average BPM as the primary value; min–max as secondary (smaller, dimmer text).
- e.g., "avg 133 BPM (125–160)"

**Ghost track card label** [I]
- The ghost card at the bottom of the timeline (representing the top suggestion) should be clearly labelled.
- Label: "Best suggestion — [track name]" and a clearly styled "+" to add it.
- Currently relies entirely on visual dimming to communicate "this isn't in the set yet" — not obvious enough.

---

## SECTION 4 — Suggestions Panel

### P1

**Show Camelot key transitions on every suggestion card** ★ [S, M]
- Current state: suggestion cards show "Perfect harmony" as an abstract label.
- Both Sarah and Marcus independently asked for the actual notation: "9A → 8A (Perfect harmony)".
- Marcus: "Hiding it behind abstracted labels reads as lack of confidence in the algorithm."
- This is a low-effort change with high trust payoff — a professional DJ can verify the harmonic relationship themselves instead of trusting a label.

**Explain what "Best match" actually scores** [S, M, D]
- Currently unexplained. DJs assume it's BPM + key but don't know how energy, format, or historical usage factor in.
- Add a tooltip or expandable info icon: "Ranked by BPM compatibility (35%), harmonic key (35%), energy match (20%), file quality (10%)."
- This is the kind of transparency that turns sceptics into advocates.


### P2

**Full score breakdown on hover / expand** [S, M]
- Expandable section on each suggestion card: BPM delta, key compatibility level, energy delta, format match, with their point values.
- Sarah needs evidence to trust the algorithm. Showing the working earns it.

---

## SECTION 5 — Cue Point Editor

### P1

**Second entry point from timeline cards** [I, PRD §7.6]
- PRD §7.6 says the editor is triggered by "clicking a track card in the timeline (expanded view) or from bottom dock."
- Currently only accessible from the bottom dock when a track is selected. Add a direct "Edit cues" action on the timeline card itself.

### P2

**Full keyboard shortcut support** [PRD Phase 8, I]
- Space = play/pause
- Left/Right arrow = nudge ±100ms
- A–H = set/clear hot cues A–H at current position
- Esc = close modal
- Delete/Backspace = clear selected cue

---

## SECTION 6 — Export & Validation

### P0

**Export modal must explicitly state what it produces** ★ [J, S, M, D]
- ALL 4 personas asked independently: "What does this output? A file? A USB folder? Does it go back into Rekordbox?"
- This is the single highest-stakes question in the entire product. Ambiguity here causes gig-night anxiety and trust failure.
- Add to the modal before the user presses "Validate & export":
  - "Creates a Rekordbox-compatible XML file you can import into Rekordbox or load directly to a USB drive."
  - "Your existing Rekordbox library is not modified."
  - Show the output file path and name before confirming.
- Add a post-export summary: file name, location, tracks included, any skipped tracks, next steps.

**Blocking vs warning distinction in validation results** [I, PRD §7.7]
- Must clearly separate: red = blocking (will not export), amber = warning (exports but with caveats the DJ must acknowledge).
- Vague issue lists will not satisfy Sarah or Marcus. Each issue needs: what it is, which track, why it matters, how to fix it.

### P1

**Pre-export "gig check" accessible from the Set Safety badge** [S, I]
- Sarah: "Before she leaves for a show, one button confirms every file exists, every CDJ format is correct, every BPM transition is within range, and flags any key clashes not explicitly approved."
- The Set Safety badge in the top bar should be the entry point for this: click it → instant validation panel.

**Validation progress detail** [I]
- During validation, show what's being checked: "Checking file existence (9/9)... Checking format compatibility... Checking BPM data..."
- A blank spinner during gig prep is unacceptable.

**USB detection and direct copy shortcut** [PRD §7.7, I]
- After successful export, detect mounted USB drives and offer "Copy to USB now" — saves the manual Finder step.
- Particularly valuable for Dave and Jake who may not know the Rekordbox USB import workflow.

**Hardware selection persists from Settings** [S, I]
- If CDJ-2000NXS2 is set in Settings → Default target hardware, the Export modal must pre-select it.
- Sarah noted "I don't have to remember twice" as a positive signal — ensure this is actually wired end-to-end.

### P2

**Cue point export verification** [M]
- Marcus asked: "Does 'validate' verify that cue points exported correctly? That BPM is written to the file header? That track IDs are consistent?"
- Add cue point count per track to the validation summary: "Track 3 — 4 hot cues exported."

---

## SECTION 7 — Settings Modal

### P0

**Fix all garbled settings copy** ★ [S, M]
- "Free from phasing" — meaningless.
- "Mix by semitone to flat doorbell" — not a real sentence.
- Sarah: "Copy quality is a proxy for attention to detail. For a professional tool, this is a red flag."
- Marcus noted the garbled strings directly.
- Every settings label and description must be plain English that a professional DJ can parse in under 3 seconds. Audit every single string. Delete or rewrite any placeholder text that survived to the UI.

### P1

**Data transparency section** [M, S]
- Marcus will inspect network traffic with Wireshark. If he finds undisclosed outbound calls, the Reddit post writes itself.
- Add a dedicated section in Settings: "Privacy & data"
  - What's processed locally (everything by default)
  - What Learn Mode stores, in what format, where on disk
  - Whether anything is ever sent externally (should be: nothing)
  - A link to a data location in Finder: "Your library data: ~/Library/Application Support/SetRecord/"
- This costs nothing and de-risks the single thing most likely to produce a hostile public post.

**Camelot vs open notation preference** [S, I]
- Sarah: "I want to tell it I work in Camelot notation."
- Many DJs trained on Serato or older workflows use open notation (Am, C#maj). Others are Camelot-native.
- Settings toggle: "Display keys in: Camelot (9A) / Open notation (Am)"

**Extended Understanding — set expectations upfront** [D]
- Dave: "'May take hours to complete' is buried in settings."
- When the user enables Extended Understanding, show immediately: "This will analyse [X] tracks. Estimated time: [Y hours] on this Mac. You can close the app — analysis continues in the background. Results persist across sessions."
- Do not bury the time estimate in a single phrase. Make it a confirmation step.

**Default BPM range slider is correctly wired** [D]
- Dave explicitly praised this setting.
- Ensure it actually filters the suggestion pool by default, not just stores a preference that does nothing.

### P2

**YouTube API key — UX cleanup or removal** [J, M]
- Jake: lost completely, thinks it means the app is broken or needs developer setup.
- Marcus: structural fragility concern — YouTube API policy can change any day.
- Options: (a) remove the YouTube integration from v1 entirely (recommended, see Section 13), (b) add a step-by-step setup guide with screenshots that makes the process take under 5 minutes, (c) make it clearly optional with graceful degradation ("Discover tab works without this — you'll see a limited selection.").

**Genre auto-detection from library** [J]
- Jake: "I want it to auto-detect my genre from my library — I shouldn't have to manually pick genres."
- After import, analyse genre tags in imported tracks and pre-populate the genre preference field.
- Show: "We detected these genres in your library: Tech House (47%), House (22%), Techno (18%). Edit below."

---

## SECTION 8 — Bottom Dock

### P1

**Disabled state tooltip on cue editor icon** [I]
- Currently: 0.35 opacity when no track is selected. No explanation.
- Add a tooltip: "Select a track in your timeline to edit its cue points."
- Without this, the click lands nowhere and the user doesn't know why.

### P2

**Chartreuse accent dots clearly legible** [I]
- Ensure active state dots below icon buttons are legible against the Glass 3 dock background at all times.
- Test against the aurora gradient variants (darker and lighter regions).

---

## SECTION 9 — Recall Tab *(NOT IN CURRENT PRD — new scope)*

This entire section appeared in the research screenshots and generated the strongest positive reactions across all 4 personas. It is not in the current PRD v1 but is the single most universally valued feature set in the app. Build this.

### P0 (when building)

**Natural language library search — "Ask your library"** ★ [J, S, M, D]
- Universally the moment where all 4 personas shifted from "interesting" to "I need this."
- Dave: "That example query — 'My forgotten gems.' That's the one. That's why I'm here at 1am."
- Must run entirely against local library data. No external AI API calls. Marcus will verify this with Wireshark.
- Supports: BPM range, key, genre tags, play count, play history, cue point label text, date ranges, track duration, rating.
- Example queries that must work: "forgotten gems", "never played live at 125bpm", "deep house around 122bpm", "highest-rated tracks I haven't played in 6 months", "melodic techno 124–128 bpm never played live."
- Iterative refinement: "keep refining" — the user can narrow a result set with follow-up queries.
- Must clearly communicate in the UI that this is local-only search: "Searching your library of 3,017 tracks — nothing leaves your Mac."

### P1

**Smart Crates — self-populating, rules-based** ★ [J, S, M, D]

All four personas found immediate personal meaning in these. Build all of the following as default crates:

| Crate name | Rule | Why it matters |
|---|---|---|
| Never tested live | play_count = 0 OR track never appeared in a saved set | Every DJ has hundreds of these; nobody has ever built a proper tool for surfacing them |
| Overplayed | Track appears in top 10% of play frequency in this library | Forces the DJ to see their own habits |
| Forgotten heaters | Energy ≥ 7, not played in 90+ days | High-quality tracks the DJ has moved on from |
| Peak weapons | Energy ≥ 8, BPM in top 30% of library's BPM range | Ready-to-deploy bangers |
| Missing metadata | Tracks with no key, no BPM, or no artwork | Actionable library health |
| Safe bridges | Key-neutral tracks (low Camelot-clash risk), wide BPM compatibility | Useful for getting out of harmonic corners mid-set |
| Downloaded, Worth Auditioning | Tracks imported but never previewed or played in the app | Rename from "DWA" — the name must explain itself |

- Every crate must show its rule as a one-line subtitle.
- Every default crate must be inspectable — the user can see the rule logic.
- Rules engine must re-evaluate on every library update or set save.

**Custom crate builder** [S, M]
- Sarah: "I want to create my own crates with my own rules — tracks in key 8A or 9A, BPM 128–134, not played in 60 days."
- Marcus: "I can't see the rules behind each crate. I'd want to inspect and edit the rule."
- Build a rule composer UI: field selector (BPM, key, energy, play count, last played, genre, format...) + operator (is, is not, >, <, within, contains) + value.
- Allow AND/OR combinations for multi-condition crates.

### P2

**"Untested at next gig" workflow** [D]
- Dave has 1,007 untested tracks. The problem is not surfacing them (crates do that) — the problem is doing something about them, week by week.
- Add a workflow: from the "Never tested live" crate, one-click to flag 3–5 tracks as "test at next gig."
- After the gig (or when the user returns), prompt: "Did you test these tracks? Mark as tested / not yet / archived."
- Each mark updates the track's lifecycle status and removes it from the untested crate.
- This is the feature Dave would use to chip away at 1,007 untested tracks over months. Once a DJ is doing this, they will never leave the product.

---

## SECTION 10 — Combos / Transition History *(NOT IN CURRENT PRD — new scope)*

Universally praised by all personas as genuinely novel. No other tool does this. It is the moat.

### P1

**Mine Rekordbox performance history from XML for transition patterns** [M, J, D]
- Rekordbox XML includes performance history — session logs showing which tracks were played and in what order.
- Parse these sessions into a directed graph: Track A → Track B, Track A → Track C, etc.
- Rank transitions by frequency: "You've played Waterfalls after This Girl 7 times."

**"What do I play after this track?" query** [J, D]
- From any track (in the timeline, in the library, or in a Crates view): show historical next-track choices ranked by frequency.
- Dave: "I do always play that one after that one. Every bloody time. And I don't even know why anymore. Just muscle memory." This feature makes that visible.

**Feed Combos data into Prepare tab suggestion ranking** ★ [J, M, D]
- This is Marcus's #1 most-wanted feature and was echoed by Jake and Dave.
- If Combos data shows the user has played Track B after Track A 3+ times, when Track A is the last track in the set, Track B should appear prominently in Suggested Next with tag "you've played this transition before."
- This closes the loop between the Recall tab insight and the active Prepare workflow — the highest-value integration in the product.
- Marcus: "That closes the loop between insight and action. I would tell every DJ I know about this app."

### P2

**Inverse combos: dead ends in the library** [M]
- "Tracks you almost never successfully transition FROM."
- Tracks that appear frequently as a terminal point in sets — where the DJ is forced to make an abrupt change.
- Marcus specifically asked for this. Useful for library maintenance.

**Compact Combos list view** [J, S]
- Both personas noted track names are too long and hard to scan quickly in the Combos list.
- Truncate titles at ~25 characters with full name on hover. Or: Artist + short title only.

---

## SECTION 11 — Identity / Analytics *(NOT IN CURRENT PRD — new scope)*

### P2

**Share as image — "DJ Wrapped"** ★ [J, S, M]
- Jake would post to Instagram Stories immediately. Free word-of-mouth from every DJ who uses it.
- "Copy as image" or "Export card" button on the Identity screen.
- Generates a shareable graphic: top BPM zone, key signature, top artists, energy profile, library size.
- This is the viral loop. Must be able to choose between desktop and mobile view share.

**Key profile by BPM zone chart** [S, M]
- Both Sarah and Marcus independently asked for this.
- "Show me which keys I tend to play at 128 BPM vs 140 BPM."
- A DJ's harmonic approach changes by tempo zone. Seeing this about yourself is genuinely novel.

**Use reliable timestamps for library growth** [S, M]
- Sarah: "File date is unreliable — if I migrate computers or re-tag files, the dates change."
- Use `date_added` from Rekordbox XML (which reflects the actual date the DJ added the track to their library, not the file's filesystem date).

---

## SECTION 12 — Library Health *(Partially in PRD as LibraryStats — needs significant expansion)*

### P0

**Health numbers are instantly drillable — zero friction** ★ [S, M, D]
- All three personas said this explicitly or implied it.
- Clicking "68 missing files" must immediately show a list of those 68 tracks with actions per row: "Locate file", "Remove from library", "Mark as ignored."
- Dave: "The power of this feature is zero-click resolution: click the number, see the list, action each one in place."
- If there is any navigation, loading step, or intermediary screen between clicking the number and seeing the list, the feature fails.

**Missing files score weighting recalibration** [S, M]
- A 97/100 health score with 68 missing files is misleading and dangerous.
- Sarah and Marcus both flagged this independently.
- Marcus: "68 missing files getting a 97/100 score feels miscalibrated. Missing files is a critical failure condition at a gig."
- Missing file = file will not play at show time. This is a 0/100 outcome in practice.
- Recalibrate: missing files should contribute heavily (e.g., −2 per missing file, capped at −40 points). A library with 10% missing files should never score above 60.

### P1

**Track lifecycle system** [D, M]
- States: New → Testing → Active → Peak rotation → Occasional → Forgotten → Archive → Untested
- Derived from: play_count, last_played, appearance in saved sets, manual user tagging.
- Dave: "1,007 untested — I both knew this and didn't know this. Seeing the number makes it real."
- Each lifecycle state feeds the Crates system (Never tested live, Forgotten, Overplayed).

**Duplicate groups — batch resolve workflow** [J, D]
- Dave: "54 duplicate groups — I've suspected this for ages but never sorted it."
- Show duplicates as grouped cards. User actions: keep this one (archive the others), keep all, delete all.
- Must be group-level resolution, not one-by-one — with 54 groups that's 54 decisions, not 108.
- Detect duplicates by: matching title + artist, matching file hash, or same Rekordbox ID.

**Lifecycle tracking — unified definition of "untested"** [S, D]
- Dave and Sarah both noticed the definition of "untested" could mean two things: "never played at a gig" OR "never analysed by the app."
- These are different states. Separate them clearly:
  - "Never played live" = play_count = 0 or not in any performance history
  - "Not analysed" = Extended Understanding hasn't processed this track
- Mixing these definitions makes the metric unreliable.

### P2

**Library health score — explain the weighting** [S, M]
- Show users what factors contribute to the score and how much.
- e.g., "Missing files: −2pt each (−68pts) · Missing key: −1pt each (−11pts) · Missing BPM: −1pt each..."
- Without this, a 97/100 with 68 missing files seems absurd and undermines trust.

---

## SECTION 13 — Discover Tab

### P0

**Rethink the Discover tab — the current version is net negative** ★ [J, S, M, D]
- ALL 4 personas were confused, disengaged, or actively opposed to the current concept.
- Sarah: "This feels like a different product bolted on."
- Marcus: "If this tab is essentially just a YouTube embed with genre filters, and it requires me to set up my own YouTube API key — I'm paying for YouTube search with extra steps."
- Dave: "David Guetta. I'm sorry." [immediately dismisses it]
- Jake: interested only if it could auto-detect tracklists and let him import tracks.
- The current Discover tab is actively damaging SetRecord's brand identity as a serious library intelligence tool.

Options (choose one):

**Option A — Remove from v1 (recommended):** Cut the YouTube integration entirely. Replace with a library-first discovery page: "Discover tracks in your own library you've overlooked." Shows: never-tested tracks, forgotten heaters, underplayed by BPM zone. This repurposes the tab's real estate for something all 4 personas wanted.

**Option B — Make it library-first:** Keep the "Discover" label but reorient entirely to the user's own library. "Explore 197 tracks you've never tested live." "Surface tracks from your collection you haven't played in 6+ months." Remove YouTube integration unless/until it adds genuine value.

**Option C — Make YouTube genuinely smart (future):** Auto-tracklist detection from DJ set videos, "what do I have that would follow this track?", taste-matched recommendations using user's Identity profile. This is significantly more expensive and should not be v1.

### P1 (if keeping any YouTube integration)

**Genre filter must respect user's actual taste profile** [M, I]
- "Recommended" sort showing David Guetta and Calvin Harris to a tech house DJ is a trust-breaker.
- The filter must cross-reference the user's top genres from Identity and default to those.

---

## SECTION 14 — General / Cross-Cutting

### P1

**Learn Mode — visible, functional, and discoverable** [J, D]
- Jake would turn it on immediately.
- Dave praised the concept.
- Learn Mode should add inline explanations to: suggestion reason chips (why is "Energy shift" a good thing?), transition quality indicators (what makes a mix "messy"?), energy curve (what does the shape mean for the crowd?), key chips (what is a Camelot key?).
- Consider: a "?" overlay toggle in the top bar that makes every annotatable element tappable for a brief explanation.

**All loading states and empty states implemented** [PRD Phase 8]
- Every panel must have both a skeleton loader and a meaningful empty state.
- No blank panels, no silent failures, no spinners with no context.
- The library panel skeleton (shimmer rows), timeline empty state (illustrated CTA), suggestions panel empty state ("Select a track in your set") — all must be production-quality.

**Error boundaries on all panels** [PRD Phase 8]
- If the library panel has a rendering crash, the timeline should still work.
- Each of the three main panels should be wrapped independently.

**Performance audit — 10k track library at 60fps** [PRD Phase 8, I]
- Virtual scrolling must be implemented in LibraryPanel before any wide-scale use.
- At 10k rows, a non-virtualised list will visibly lag on scroll.
- Use react-window or @tanstack/virtual.
- Test with a realistic large dataset (not just the import from the user's own library).
 
**Keyboard shortcuts** [PRD Phase 8]
- ⌘K: focus search
- Space: play/pause preview
- ⌘Z: undo last set action
- Arrow keys in cue editor: nudge ±100ms
- Esc: close any open modal

### P2

**Transition quality dot legend** [J, D, I]
- A small persistent legend somewhere in the timeline panel (or a tooltip on first hover) explaining: green = clean, amber = messy, red = trainwreck.
- Non-obvious to users who haven't read documentation.

**Track title truncation in list views** [J, S]
- Long track names break compact views in Combos, Suggestions, and timeline cards.
- Truncate with ellipsis at appropriate width, full title on hover tooltip.

**"Set safety" badge updates in real time** [I]
- After every track add, reorder, or remove — the safety badge should update its state.
- Invalidate validation if set changes; require re-validation.

**Multi-library / merge behaviour clearly communicated** [S, I]
- Sarah has 8,000 tracks, Dave has 12,000. If they import a second XML, does it merge? Overwrite? The current behaviour is completely undocumented.
- Define and communicate: "Re-importing updates existing tracks and adds new ones. Cue points set in SetRecord are preserved."

### P3

**Inverse / negative library intelligence** [M, I]
- "Tracks that consistently lead to trainwreck transitions."
- "Tracks you've never successfully used as a set opener."
- "Tracks you've never successfully transitioned INTO."
- Data-driven negative patterns are as useful as positive ones for experienced DJs.

**Session history / play history log** [M, D, I]
- If Rekordbox XML includes performance history, surface it as a timeline: "Gigs you've played, when, how long, which tracks."
- Feeds Combos, Lifecycle, and the Untested workflow.

**"Copy to USB" shortcut** [PRD §7.7]
- After export success, detect mounted USB drives and offer direct copy.

**Onboarding flow for first launch** [PRD Phase 8, J]
- Jake's entire first-launch experience is defined by whether he gets his library in.
- A proper first-launch flow: (1) explain what SetRecord does in 2 sentences, (2) import library step with XML guide or auto-detect, (3) land in the library panel with their real tracks visible.
- This is the difference between a 90-second drop-off and a converted user.

---

## SECTION 15 — Removals & Hard Decisions

| Item | Decision | Reason |
|---|---|---|
| "DWA" as a crate label | Rename to "Downloaded, Worth Auditioning" or equivalent | ALL 4 personas couldn't decode it. An unexplained label on a default crate is a UX failure. |
| Discover tab YouTube integration | Remove from v1 OR replace with library-first discovery | ALL 4 disengaged. Currently damages the product's brand as a serious tool. |
| Garbled placeholder copy in Settings | Delete and rewrite every string | Two personas flagged it as a credibility failure. It reads like the app is unfinished. |
| Demo data masquerading as real data | Replace with explicit empty states | ALL 4 were confused. Trust is broken the moment a user thinks they're looking at their own data and they're not. |
| "Set safety: Not validated" as decorative badge | Make it clickable with a clear action | ALL 4 noticed it, none could act on it. An advisory UI element with no affordance creates anxiety without resolution. |

---

## SECTION 16 — Revenue Model Alignment

Based on all 4 personas, the research report recommends a dual pricing model that the feature matrix above directly supports:

**Free tier** (conversion engine)
- Import Rekordbox XML
- Library view + playlist browsing
- Basic set builder (manual drag only, no suggestions)
- Library Health score (headline number only, no drill-down)
- This tier exists to get DJs past the import step and let them see their library in the app.

**SetRecord Pro — $12/month or $89 one-time**
- Full suggestion engine (Suggested Next with reason tags)
- Full Recall tab (NL search, Crates, Combos, Identity, Health drill-down)
- Set Architect
- Export with validation
- Smart Crates (all default + custom rule builder)
- Cue point editor

**Pricing note**: Dave and Marcus will not maintain a subscription but will pay more upfront. Always offer both options at the same tier. A one-time buyer at $89 generates zero churn cost and tells their DJ friends. "Optional tip / support the developer" has been shown to generate more total revenue than forced subscription with this demographic.

---

## MASTER PRIORITY STACK — Top 25 Actions

| # | Action | Priority | Personas |
|---|---|---|---|
| 1 | Rekordbox XML import guide OR auto-detect RB database | P0 | J + all newcomers |
| 2 | Demo data clearly labelled or replaced with empty states on first launch | P0 | J, S, D |
| 3 | Clicking library track triggers suggestions or clear affordance | P0 | J, S, M |
| 4 | "Set safety" badge is clickable with clear validation trigger | P0 | All 4 |
| 5 | Export modal explicitly states what it produces, where it goes, what format | P0 | All 4 |
| 6 | Fix all garbled settings copy | P0 | S, M |
| 7 | Health numbers instantly drillable — click → list → fix, zero friction | P0 | S, M, D |
| 8 | Missing files health score weighting recalibrated (currently too lenient) | P0 | S, M |
| 9 | Camelot key transitions shown on suggestion cards (8A → 9A) | P1 | S, M |
| 10 | Import completion report (what came in, what was skipped, what was flagged) | P1 | S |
| 11 | Re-sync library workflow | P1 | S, I |
| 12 | Data transparency section in Settings | P1 | M, S |
| 13 | Smart Crates system with rule descriptions and custom builder | P1 | All 4 |
| 14 | Rename DWA → "Downloaded, Worth Auditioning"; add one-line rules to all default crates | P1 | All 4 |
| 15 | Natural language library search — local only, no external API | P1 | All 4 |
| 16 | Feed Combos data into Prepare tab suggestion ranking | P1 | J, M, D |
| 17 | Mine Rekordbox performance history for Combos transition data | P1 | M, J, D |
| 18 | Remove or replace Discover tab with library-first discovery | P1 | All 4 |
| 19 | Preview audio from suggestion card before committing | P1 | J |
| 20 | "Untested at next gig" workflow with mark-as-tested post-gig | P1 | D, J |
| 21 | First-launch onboarding flow (2-step: explain → import) | P1 | J |
| 22 | Learn Mode — visible inline explanations on all annotatable elements | P1 | J, D |
| 23 | Explain "Best match" scoring via tooltip or expandable info | P1 | S, M, D |
| 24 | Identity / analytics: BPM spread, key spread, energy profile, library growth | P1 | All 4 |
| 25 | Share Identity as image ("DJ Wrapped" shareable card) | P2 | J, S, M |

---

*Every item in this document traces to at least one of: a direct quote from a persona, a repeated theme across multiple personas, a stated product requirement from the PRD, or a logical inference from patterns in the data. Nothing is invented.*
