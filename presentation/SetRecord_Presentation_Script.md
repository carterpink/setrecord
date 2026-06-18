# SetRecord — Presentation & Live-Demo Script

**Audience:** Digital Solutions teacher
**Format:** 19-slide deck (`SetRecord_DigitalSolutions.pptx`) + live demo of the app
**Runtime:** ~12–15 min talk + ~5–7 min demo
**Framing device:** the digital problem-solving process — *Investigate → Generate → Evaluate → Communicate*

> **How to use this script.** Each slide has a ⏱ pacing note, the **say-this** narration (speak it naturally, don't read it word-for-word), and 🎯 *delivery cues*. The live demo runs on **Slide 15** — everything before it sets up what the teacher is about to watch. Practice the demo path once beforehand with a real Rekordbox library loaded.

---

## Slide 1 — Title: *SetRecord*
⏱ ~40s

**Say this:**
"Thanks for making the time. I want to show you something I actually built — a real, shipping macOS application called **SetRecord**. The tagline is *‘Your crate is dumb — make it think.’* A DJ's music library is basically a giant spreadsheet that can't reason about itself, and SetRecord is the layer that gives it a brain. But I didn't just want to show you an app — I want to walk it through the exact problem-solving process you taught us: investigate, generate, evaluate. So this is part product demo, part case study."

🎯 *Open confident. Let the big serif title and the lime glow sit for a second before you talk — the visual identity is part of the pitch.*

---

## Slide 2 — Reading this through the problem-solving process
⏱ ~50s

**Say this:**
"Quick map of where we're going. Everything is organised under the four phases of the digital problem-solving process. **Investigate** — the problem, the users, the requirements and the criteria I'd judge success against. **Generate** — the actual solution: architecture, data, algorithms and the user experience. **Evaluate** — testing the prototype honestly against those criteria. And **Communicate** — the live demo, plus reflection on impact and what's next. SetRecord isn't a concept; it already sits between library management — Rekordbox — and live performance on the CDJs."

🎯 *Point at the four phase cards as you name them. This slide is the spine — it tells the teacher you understand the methodology, not just the code.*

---

## Slide 3 — The problem *(Investigate · 01)*
⏱ ~55s

**Say this:**
"Start with the problem. A working DJ's library runs into the tens of thousands of tracks, and the intelligence about how they fit together lives only in the DJ's head. That fails in four ways. You can't recall the right record by memory at that scale. Harmonic mixing — knowing which musical keys blend — becomes mental maths you do live, under pressure. USB exports to the Pioneer gear silently fail, and you find out *on stage*. And it all happens in the worst environment imaginable: 2am, a venue with no wifi, a laptop with one USB-C port. **The need:** give the crate a brain — locally — so the set and the USB are trustworthy before you ever touch the decks."

🎯 *The "2am, no wifi" line is your emotional hook — it justifies every technical decision that follows (especially 'no cloud'). Land it.*

---

## Slide 4 — Who it's for *(Investigate · 02)*
⏱ ~45s

**Say this:**
"Three user personas, but one shared need. The **mobile DJ** plays weddings and events across venues with no internet — they need a dependable USB. The **club resident** mixes in key across long sets — they need harmonic suggestions and a controlled energy arc. And the **bedroom DJ** is still building instinct — they need the app to *explain why* two tracks work together, in plain language. Boil it down and every persona is really saying the same thing: *‘I want to walk in knowing my set and my USB will just work.’* That sentence became my north star."

🎯 *Briefly point to each persona card. Mention that defining the user need up front is what kept the feature set honest.*

---

## Slide 5 — Solution requirements *(Investigate · 03)*
⏱ ~50s

**Say this:**
"From the need I derived requirements, split the way we were taught — **functional**, what it must *do*, and **non-functional**, how it must *behave* — under three product pillars: reliability, intelligence and clarity. On the functional side: import a Rekordbox library read-only, normalise keys for harmonic mixing, score transition risk, auto-build sets, and validate the USB export. On the non-functional side — and this is where the real design lives — it has to work fully offline, handle ten-thousand-plus tracks fast, never upload your audio, keep secrets in the system keychain, and stay accessible. The non-functional column is what makes it *good*, not just *working*."

🎯 *Don't read every cell. Read the column headers, then say "the non-functional column is where the real engineering decisions live" and give two examples.*

---

## Slide 6 — Criteria for success *(Investigate · 04)*
⏱ ~40s

**Say this:**
"Before building, I set measurable criteria — the bar I'd hold the finished prototype to. Data integrity: re-importing never loses your work. Privacy: nothing leaves the machine, and it has to be *verifiable*, not just promised. Performance across ten-thousand tracks. Export safety — every USB validated before it's written. Explainable intelligence — every suggestion states *why*. And robustness — a corrupt library is quarantined, not deleted. Keep these six in mind; on Slide 16 I'll come back and grade the app against them honestly."

🎯 *Flag the callback to the evaluation slide — it shows the teacher you closed the loop, which is exactly what the process rewards.*

---

## Slide 7 — Solution architecture *(Generate · 01)*
⏱ ~55s

**Say this:**
"Now the solution. SetRecord is a two-process desktop app built on Electron. The key decision is on the right: the user interface never touches the disk or the database directly. Every request crosses a secured, typed bridge — `contextBridge` — into a separate main process that owns the database, the file analysis, the algorithms and the export. That separation is a *security* decision: the UI is sandboxed. Underneath it all is SQLite on your machine and audio files read in place. And the single biggest call: **no AI APIs.** Every suggestion and score is a deterministic local algorithm — which is the only reason it can work at a venue with no wifi."

🎯 *Trace the stack top-to-bottom with your finger: UI → bridge → services → data. The 'no cloud' point is the thesis of the whole project — say it slowly.*

---

## Slide 8 — Data model & structures *(Generate · 02)*
⏱ ~50s

**Say this:**
"The data. The library is *relational*, not a flat file — I chose SQLite over something like JSON or local storage because a ten-thousand-row library needs real queries: filter by BPM range, filter by key, fuzzy-search across everything, and survive a restart. Four core entities: tracks, playlists, sets, and play-sessions — which record *when and where* a track was played. The piece I'm proudest of is at the bottom: a key data transformation. A raw musical key like ‘F-sharp minor’ gets normalised to **Camelot notation** — 11A. That one transform turns a messy text field into something the harmonic-mixing algorithm can actually reason about, because adjacency on the Camelot wheel equals a compatible blend."

🎯 *The Camelot transformation is your best "data concept" example for a DS teacher — unstructured input → structured, queryable data. Dwell here.*

---

## Slide 9 — Import → transform → export *(Generate · 03 · Data exchange)*
⏱ ~50s

**Say this:**
"Data exchange — how SetRecord talks to the DJ's existing tools. Three stages. **Input:** it reads a Rekordbox library — either the XML export or the database — strictly read-only, and matches tracks by file path so re-importing never creates duplicates. **Transform:** in its own SQLite database it parses, normalises keys, analyses energy and scores transitions. **Output:** it writes a CDJ-ready USB, validated for Pioneer hardware *before a single byte is written*. The contract is that it's **non-destructive** — it never writes back to Rekordbox, and the export only ever copies files you already own."

🎯 *Walk left-to-right along the three cards following the arrows. "Read-only in, validated out" is the soundbite.*

---

## Slide 10 — Local-first, private by design *(Generate · 04 · Security & privacy)*
⏱ ~50s

**Say this:**
"Security and privacy — and my argument here is that the strongest guarantee is the one the architecture makes *impossible to break*. Your audio never leaves the device; it's served to the UI over an internal protocol, read straight from disk. Secrets — licence keys, any API keys — live in the macOS Keychain, never in a file. Licensing uses Ed25519 signatures, and crucially the app can *verify* a licence but can't *mint* one, because the private key never ships inside the app. And telemetry is opt-in only — the single thing that can ever leave is an anonymous crash report, documented line by line. Privacy isn't a setting here. It's the design."

🎯 *This is your strongest "ethics meets engineering" slide. Emphasise "verify but cannot mint" — it shows real cryptographic reasoning.*

---

## Slide 11 — Algorithms & logic *(Generate · 05 · Programming)*
⏱ ~50s

**Say this:**
"The actual programming — the intelligence is four deterministic algorithms, no black box. **Harmonic matching** uses Camelot adjacency to surface only compatible-key transitions. The **transition risk score** combines key distance, BPM gap and energy jump into a single weighted score, then labels it clean, messy or trainwreck — that's the flow along the bottom. **Set Architect** builds a whole set from a pool of tracks fitted to a target energy curve. And the **suggestion ranker** ranks the next track *and tells you why*. Because they're deterministic, every one of these is unit-testable and explainable — which matters for both trust and for the criteria I set."

🎯 *Trace the transition-score flow at the bottom: key distance + BPM + energy → weighted score → badge. That's your "algorithm decomposition" moment.*

---

## Slide 12 — Designing the experience *(Generate · 06 · UX)*
⏱ ~45s

**Say this:**
"User experience — usability principles made concrete. **Affordances:** the clean/messy/trainwreck badges and colour-coded key chips make compatibility readable at a glance. **Feedback:** a live energy-curve graph, waveform preview and one-click audition mean the DJ sees and hears the consequence of every choice. **Recognition over recall:** command-K search and suggestion chips surface options instead of forcing the DJ to remember them. And **accessibility:** WCAG-AA contrast is automatically validated across all three themes, and motion respects the operating-system's reduced-motion setting."

🎯 *Name the Nielsen-style heuristics explicitly (affordances, feedback, recognition over recall) — a DS teacher will clock that you're applying real UX theory, not vibes.*

---

## Slide 13 — A token-driven visual identity *(Generate · 07 · Design system)*
⏱ ~45s

**Say this:**
"A quick word on the design system, because it's the reason this deck looks like the app. The entire visual identity lives in one source of truth — a tokens file — that cascades to about a hundred-and-twenty-three components. Colour, type, spacing, all defined once. The look is deliberate: a flat black canvas, film grain, electric lime, and neon that lives in *background* blooms rather than in the buttons. Editorial serif for headlines, a geometric sans for the interface, mono for data. And because it's token-driven, the whole app's appearance can be reskinned with a single line of code. These exact tokens are what I used to build these slides."

🎯 *Gesture between the slide and your screen — "same palette, same fonts." It quietly proves design-system thinking.*

---

## Slide 14 — Built like production software *(Generate · 08 · Engineering)*
⏱ ~40s

**Say this:**
"Before I open it — proof this isn't a prototype held together with tape. It ships behind a four-stage quality gate: **862 automated tests**, **100% TypeScript** with no plain JavaScript, **four CI checks** on every single change — typecheck, lint, test, build — and **three themes that all pass WCAG-AA**. Nothing merges unless all four gates are green. This is the engineering discipline behind the pretty surface."

🎯 *Say the four numbers with a beat between each. This slide buys you credibility right before the demo — use it.*

---

## Slide 15 — 🔴 LIVE DEMO
⏱ ~5–7 min — **switch to the app**

**Say this (transition):**
"Enough slides — let me open it."

> **Demo path — rehearse this exact order:**
>
> 1. **Import a library.** Open the import flow, choose a Rekordbox XML (or master.db). Narrate: *"It's reading this read-only, parsing the tracks, normalising every key to Camelot, and analysing energy — all locally, nothing uploaded."*
> 2. **Browse the library.** Show search (⌘K), the colour-coded **key chips**, the **energy bars**, and click a track to **audition** it. Narrate the affordances from Slide 12.
> 3. **Build a set.** Open **Set Architect**, set parameters, generate a set. Then drag a track on the timeline and show the **energy-curve graph** react.
> 4. **Ask for the next track.** Show a suggestion and read its **match-reason chips** out loud — *"it's suggesting this because: perfect harmony, energy match, BPM in range."* This is "explainable intelligence" from your criteria.
> 5. **Export a USB.** Open export, show the **CDJ validation** step catching any issue *before* writing. Narrate: *"this is the slide-3 problem solved — no nasty surprise at 2am."*

🎯 *Delivery cues:*
- *Have the library pre-imported as a backup in case the live import is slow — but try the live import first; watching it work is the wow moment.*
- *Keep narrating which criterion each action satisfies. Tie every click back to a slide.*
- *If anything misbehaves, stay calm: "and that's exactly the kind of edge case the validation layer is built to catch." Then move on.*
- *Resize the window so the energy curve and waveform are clearly visible from where the teacher is sitting.*

**Say this (return to deck):**
"Let me jump back to the slides and grade it honestly."

---

## Slide 16 — Tested against the criteria *(Evaluate · 01)*
⏱ ~50s

**Say this:**
"Evaluation — and I wanted this to be honest, not a victory lap. Against the six criteria from Slide 6: data integrity — met, sets and cues survive re-import. Privacy — met, and verifiable in the network layer. Performance at ten-thousand tracks — met. Export safety — met, the validator blocks bad exports. Explainable suggestions — met, you saw the match-reason chips. And one I'm deliberately marking **open**: real-booth validation of the experimental reaction-capture feature still needs testing in a live venue. That's the next phase, and I'd rather flag it than pretend it's done."

🎯 *Lingering on the one OPEN item is a strength, not a weakness — it shows critical self-evaluation, which the process explicitly rewards. Own it.*

---

## Slide 17 — Social, ethical & legal lens *(Evaluate · 02)*
⏱ ~45s

**Say this:**
"Weighing it against impact on people, fairness and the law. **Privacy and data ethics:** local-first means a user's library — their taste, their history, their work — is never harvested; the default is dignity, not data collection. **Intellectual property:** it reads your own library read-only and never redistributes audio. **Accessibility and inclusion:** contrast and reduced-motion are enforced in CI, so accessibility is a gate, not an afterthought. And **fair licensing:** the anti-piracy checks are offline-friendly and never lock out a paying customer who happens to be offline. Every one of these was a deliberate trade-off, not an accident."

🎯 *This maps directly onto the "digital impacts" strand. Frame each as a conscious decision with a cost and a benefit.*

---

## Slide 18 — Reflection & what's next *(Communicate · 01)*
⏱ ~45s

**Say this:**
"Reflection. The architecture I chose — local-first, deterministic, token-driven — turned out to be a *platform* for everything coming next: a ‘flight recorder’ for sets, real-time back-to-back co-editing between two DJs over the local network, a searchable memory of where you played each track, and a multi-language UI. But the biggest lesson is this: **constraints are a design tool.** The decision to use *no cloud* didn't limit the project — it forced clearer algorithms, gave me a far stronger privacy story, and produced an app that actually works at 2am. The hardest constraint became the best feature."

🎯 *"Constraints are a design tool" is your closing intellectual takeaway. Say it like you mean it — it's the mark of design maturity.*

---

## Slide 19 — Thank you
⏱ ~20s

**Say this:**
"So that's SetRecord — investigated, generated and evaluated through the problem-solving process. *Your crate is dumb — make it think.* Thank you for teaching me the process that let me build it properly. I'd genuinely love your questions."

🎯 *Warm, sincere close. The thank-you to the teacher specifically lands well. Then open the floor.*

---

## Appendix — Anticipated questions & crisp answers

- **"Why Electron and not a native app?"** — Cross-platform reach later, one TypeScript codebase, and a mature ecosystem for the data and UI work; the security model (process separation, no nodeIntegration) closes Electron's usual gaps.
- **"Why no AI / cloud?"** — The target environment is an offline booth at 2am. Deterministic local algorithms are faster, private, fully testable, and explainable — and they never fail because the wifi did.
- **"How does it scale to big libraries?"** — SQLite with WAL and indexed columns; BPM/key/fuzzy queries stay instant at 10k+ rows where in-memory JSON would choke.
- **"Is the harmonic mixing 'real'?"** — Yes — keys are normalised to the Camelot wheel and compatibility is wheel-adjacency, the same system pro DJs use; it's deterministic, not a guess.
- **"What was the hardest part?"** — Making intelligence *explainable*: it's easy to rank tracks, hard to justify each suggestion in plain language the DJ trusts.
- **"What would you do differently?"** — Bring real-venue testing forward; I validated the algorithms in software before validating the experimental reaction-capture in a live booth.

---

## Pre-flight checklist (do this 10 min before)

- [ ] App running, **library pre-imported** as a fallback; a clean library file ready for the *live* import demo.
- [ ] A demo audio track that **actually plays** (file present at its path) for the audition step.
- [ ] Display mirrored/extended and the app window **sized large**; energy curve + waveform legible from the teacher's seat.
- [ ] Deck open in presenter view on this Mac (fonts render correctly here: Hoefler Text / Avenir Next / Menlo).
- [ ] Wifi **off** for the demo — then casually point out it still works. 🎤
