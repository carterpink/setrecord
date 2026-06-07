codex audit:
prompt:
You are operating as an internal pre-launch review council for a high-potential startup product.

The goal is not to be polite, optimistic, or vague.

The goal is to identify:

* friction
* confusion
* weak UX
* retention risks
* emotional disconnects
* scalability concerns
* architecture weaknesses
* onboarding failures
* trust issues
* growth bottlenecks
* launch blockers
* hidden technical debt
* product positioning weaknesses
* monetisation mistakes
* “this feels cheap” moments
* “this feels magical” moments
* reasons users would churn
* reasons users would obsess over it

You are simulating the type of intense cross-functional review process that elite startups run before launch.

The environment should feel like:

* Andrej Karpathy
* Linear
* Cursor
* Raycast
* Arc
* early-stage AI-native startup teams
* product-led engineering cultures
* high standards
* taste-driven software development

You are NOT generating generic app feedback.

You are conducting:

* a deep operational audit
* a UX teardown
* a systems review
* a behavioural analysis
* a launch readiness assessment

Important behavioural instructions:

* Think independently.
* Disagree with other simulated reviewers when appropriate.
* Avoid consensus bias.
* Avoid corporate wording.
* Speak plainly and specifically.
* Do not sugarcoat problems.
* Prioritise signal density over politeness.
* Focus heavily on emotional experience and product feel.
* Focus heavily on whether users will actually care.

You must simulate REAL usage of the app.

Do not merely inspect files statically.

Mentally traverse:

* onboarding
* first-run experience
* empty states
* edge cases
* error states
* pricing exposure
* loading states
* navigation
* emotional momentum
* dopamine loops
* trust signals
* confusion moments
* activation friction
* retention mechanics
* performance perception
* visual hierarchy
* feature discoverability
* mobile ergonomics
* responsiveness
* perceived intelligence
* AI interaction quality
* transitions and polish

Assume this app is very close to launch.

Your job is to determine:

1. what could prevent breakout adoption
2. what feels unfinished
3. what feels exceptional
4. what users will remember
5. what experienced builders would immediately notice
6. what should be fixed before launch
7. what can wait until post-launch

You will receive:

* the codebase
* context files
* PRDs
* architecture
* change matrices
* implemented systems

You must deeply inspect before making conclusions.

Output quality requirements:

* extremely concrete
* plain English
* no fluff
* no startup jargon padding
* no vague “could improve UX”
* every criticism must explain:

  * why it matters
  * who it affects
  * severity
  * recommended fix
  * whether it is pre-launch critical

Always optimise for:

* clarity
* retention
* delight
* trust
* speed
* obsession-worthy UX
* perceived quality
* product coherence
* launch readiness

response:
Findings
P0: First-run import stacks two modals. I clicked Get started -> Find my library; the import dialog opened while onboarding stayed on top. Evidence: OnboardingModal.tsx (line 32), AppShell.tsx (line 329).
Affects: every new user. Why it matters: import is activation. This makes the app feel broken before the magic appears. Fix: close/hide onboarding before opening import, or make import a real onboarding step. Pre-launch critical: yes.

P0: The license private key is in the repo. Evidence: mint-license.mjs (line 22).
Affects: paid launch. Why it matters: anyone with that key can mint Pro licenses. Fix: rotate the keypair, remove it from repo/history, move license issuing to a secret-backed backend, and exclude scripts/** from packages. Pre-launch critical: yes.

P0: Release trust is not launch-ready. notarize: false, updates point to https://example.com/auto-updates, README is basically empty. Evidence: electron-builder.yml (line 33), electron-builder.yml (line 48), README.md (line 1).
Affects: macOS users, reviewers, anyone paying money. Why it matters: it screams unfinished. Fix: notarize, wire real update infra or remove it, add support/recovery docs, tighten packaging. Pre-launch critical: yes.

P0: Phantom Discover tracks can be exported as warnings. Evidence: usbValidator.ts (line 14), ExportModal.tsx (line 559).
Affects: users building sets from discovered/imported ideas. Why it matters: the product promise is “no CDJ surprises.” Exporting non-owned/non-local tracks breaks that promise at the worst possible moment. Fix: make phantom tracks blocking until linked to a real file. Pre-launch critical: yes.

P1: No-library states still dump users into dead surfaces. Recall says it is searching 0 tracks with no strong import CTA. Evidence: RecallAsk.tsx (line 96), LibraryPanel.tsx (line 542).
Affects: users who skip onboarding or explore first. Why it matters: they see an empty AI product, not a useful DJ tool. Fix: every empty intelligence surface should route hard to import, with a clear “this unlocks after your library is loaded.” Pre-launch critical: yes.

P1: “Discover” is misnamed. The top nav says Discover, but the product there is really Recall/library intelligence. Evidence: TopBar.tsx (line 17), uiStore.ts (line 90).
Affects: first-time users. Why it matters: “Discover” implies external music discovery; the actual magic is “ask my own library.” Fix: rename to Recall, Memory, or Library AI. Pre-launch critical: not blocking, but it weakens positioning.

P1: Missing-file stats may lie. getLibraryStats counts file_size IS NULL, while real file health uses missing_file. Evidence: queries.ts (line 221), schema.ts (line 95).
Affects: reliability-focused DJs. Why it matters: a false “library healthy” state kills trust. Fix: report missing_file = 1, and separate “unknown size” from “file missing.” Pre-launch critical: yes.

P1: Lint is red in a way experienced builders will notice. npm run lint failed with 83 errors and 3515 warnings, including React compiler issues in waveform/cue/editor flows.
Affects: engineering velocity and launch confidence. Why it matters: this looks like CI is either absent or ignored. Fix: exclude non-product .claude files from lint, then fix/refactor the real React rule violations. Pre-launch critical: yes for a release branch.

P1: Free tier risks hiding the first “aha.” Pro locks suggestions, Set Architect, Recall, and export. Evidence: entitlements.ts (line 11), TopBar.tsx (line 172).
Affects: conversion. Why it matters: users may import a library, hit locks, and never feel why SetSense is special. Fix: give a full 7-day Pro trial after import, or unlock one Set Architect build plus limited Recall/suggestions. Pre-launch critical: yes for paid growth.

What Feels Exceptional
The app has real taste. The dark cockpit UI, dense panels, safety score, set timeline, import fallback, local privacy language, Recall prompts, Combos, and “nothing leaves your Mac” line feel like a serious DJ tool, not a thin AI wrapper. The obsession hook is not Set Architect alone. It is: “this thing remembers my taste better than I do.”
What Feels Cheap
The double-modal onboarding bug, example.com updater, disabled notarization, empty README, private signing key, and lint wall are the obvious “not ready” signals. These are not feature gaps. They are trust leaks.
Can Wait
YouTube discovery polish, broader export targets, more mobile responsiveness, deeper analytics, richer onboarding education, and advanced recommendation tuning can wait. The core needs to feel trustworthy, local, and impossible to break first.
Verification
I simulated first-run usage in the local app preview and inspected the renderer/Electron code. npm test passed: 202 tests. npm run typecheck passed. npm run lint failed. My launch call: do not ship paid public launch yet. Ship a tight beta only after the P0s are fixed.


claude audit:
prompt:
Create a multi-agent internal review council.

Simulate the following reviewers independently.

Each reviewer should:

* analyse the product from their own worldview
* focus on different problems
* disagree when appropriate
* produce their own report section
* speak in plain English
* avoid repeating other reviewers

REVIEWERS:

1. Elite Product Designer

* obsessed with taste, simplicity, emotional feel
* notices friction instantly
* deeply cares about first impressions
* thinks like Linear / Arc / Raycast

2. Senior Frontend Engineer

* audits implementation quality
* identifies fragile systems
* notices UI inconsistency
* evaluates responsiveness/performance
* identifies technical shortcuts

3. AI Product Researcher

* evaluates whether AI interactions actually feel useful/intelligent
* identifies “AI gimmick” risks
* analyses trust and perceived intelligence
* analyses whether users will build habits

4. Growth + Retention Strategist

* analyses virality
* activation
* onboarding
* retention loops
* monetisation friction
* whether users will come back

5. Gen Z Power User

* brutally honest
* impatient
* compares everything to modern polished apps
* identifies cringe, friction, confusion, slow feeling UX
* identifies moments that feel “sick”

6. First-Time New User

* has no context
* gets confused easily
* reports emotional experience minute-by-minute
* identifies assumptions the product makes

7. Startup CTO

* analyses scalability
* backend readiness
* infra concerns
* observability
* auth/security concerns
* launch risk

8. Founder/Investor Perspective

* evaluates whether this has breakout potential
* identifies what makes the product defensible or forgettable
* identifies strongest differentiators
* evaluates whether this is “venture scale interesting”

For each reviewer:

* simulate actual app traversal
* describe emotional reactions
* identify strongest moments
* identify weakest moments
* list launch blockers
* list “probably fine post-launch” issues
* provide severity ratings:

  * Critical
  * Important
  * Minor
  * Nitpick

After all reviewers finish:
Create a final synthesis section:

* top 10 highest leverage improvements
* what absolutely must be fixed before launch
* what can safely wait
* biggest hidden risk
* biggest hidden strength
* probability users recommend this organically
* probability users churn after first session
* whether this feels genuinely differentiated

Most important:
Be brutally honest.

Do not protect my feelings.

Act like this product is about to launch publicly in 7 days and your reputation depends on the quality of the review.


response:
I'll ground this review in the actual product rather than guessing. Let me explore the codebase first — what SetSense actually is, its UI, AI features, backend, and monetization — then write the council review.

Read
setsense_change_matrix.md

Recalled a memory
Ran
Read package.json and list source files
This is a mature Electron/React DJ app with extensive prior research. Let me dig into the actual implementation — the new monetization layer, AI/Recall, onboarding, and the panels reviewers will judge.


Read 5 files
Strong licensing implementation. Now the critical launch questions: does checkout actually go anywhere, how is Pro enforced, what's the Discover tab's current state, and is the AI real. Let me check.


Read 5 files
Key finding: checkout is just an external URL to setsense.app, keys minted manually — there's no payment fulfillment loop. And the YouTube Discover tab the research said to kill is still shipping. Let me verify the tabs, Pro gating, the AI layer, and Settings copy.


Read 3 files, ran a command
Major finding: the Ed25519 private signing key is committed in the repo (scripts/mint-license.mjs), and there's a tab-routing mismatch. Let me confirm the mode wiring and scan Settings copy before writing the review.


Ran 2 commands
I've now traversed the actual implementation — shell, routing, licensing, onboarding, AI layer, and the monetization plumbing. A note on method before the council convenes: I reviewed this by reading the real code and tracing the wiring, not by clicking through a running build (it's a packaged Electron app, not browser-previewable here). Where a reviewer "feels" something, it's inferred from the actual component and state logic, not invented. I found things that are genuinely excellent and at least one thing that should stop the launch cold.

SetSense — Internal Review Council
8 independent reviewers. T-minus 7 days. No feelings protected.

1. Elite Product Designer
Lens: taste, simplicity, emotional feel, first impressions

Traversal. Cold open: an aurora gradient behind frosted "glass" panels, JetBrains Mono, a serif display face, a chartreuse accent. It reads intentional — this is not a Bootstrap dashboard. The onboarding is three calm steps (welcome → "how experienced are you?" → "find my library") and ends on a check-circle with "3,017 tracks loaded." That arc is genuinely good. The proficiency question is a quietly brilliant move: it sets Learn Mode without ever saying "tutorial."

Strongest moment. The "Set safety" badge living in the top bar as ambient status. The idea that the app is watching your set's gig-readiness the whole time is an emotional hook Rekordbox never gives you. It feels like a co-pilot.

Weakest moment. The top-bar tab says "Discover" but renders the Recall/memory panel (I traced it: setMode('Discover') → AppShell falls through to <RecallPanel/>). The single most-loved surface in your research — "ask your library," Combos, Identity — is hiding behind a label that promises something else entirely. You buried your crown jewel and labeled it with the name of the feature your own research told you to kill. This is a taste failure disguised as a routing bug.

Friction I noticed instantly. The bottom dock appears on mouse-proximity (fromBottom < 140px). Hidden chrome that materializes on hover is a discoverability tax — a first-timer will never find the cue editor. Linear/Arc never hide primary navigation behind a mouse gesture.

Critical: "Discover" label → Recall content mismatch. Rename the tab to Recall (or Memory). This is a 5-minute fix with outsized payoff.
Important: Proximity-revealed bottom dock hides core actions. At minimum, show it on first launch with a coachmark.
Minor: Two display typefaces + mono is one font too many; the serif feels borrowed.
Nitpick: "Go Pro" with a Sparkles icon is the most generic CTA in the app — beneath the rest of the craft.
2. Senior Frontend Engineer
Lens: implementation quality, fragility, consistency, performance

Traversal. The bones are strong: per-panel ErrorBoundary wrapping (library/timeline/suggestions independent — a crash in one won't take the app), @tanstack/react-virtual is a dependency (virtual scroll for 10k rows is handled), Zustand stores are clean, dnd-kit has real screen-reader announcements wired. This is a senior-level codebase, not a vibe-coded one.

Strongest moment. licenseService.ts: "we never cache a derived isPro boolean — every read re-verifies." That's the right instinct, and the signature covers the raw payload bytes rather than re-serialized JSON. Whoever wrote this understands the failure modes.

Weakest moment — three real issues:

Dead code shipping in the bundle. AppMode still has 'YouTubeDiscover', but nothing in the app ever sets it (grep confirms: only the type def and one unreachable branch). The entire discover/ tree — DiscoverPanel, youtubeClient, tracklistParser, discoveryService, apiKey — is orphaned but compiled and shipped. That's bundle weight, attack surface, and a maintenance lie.
The whole monetization layer is uncommitted. licenseService.ts, licensing/, mint-license.mjs, UpgradeModal, ProGate, licenseStore, entitlements are all untracked (git ls-files returns nothing). Seven days out, your revenue system exists only in someone's working tree with zero history.
Preview store fakes Pro. PREVIEW_PRO_STATE grants lifetime Pro whenever window.setsense is absent. Correct for design review — but it means every browser-context render is fully unlocked. If any build path ever serves the renderer without the Electron bridge, the paywall silently evaporates.
Critical: Commit the licensing layer with history before anything else. You cannot launch code that doesn't exist in git.
Important: Delete the orphaned YouTube/Discover tree or wire it back; don't ship unreachable code.
Important: Add a build-time assertion that production renderer always has the IPC bridge, so PREVIEW_PRO_STATE can never leak to a shipped build.
Minor: Mouse-move handler on the app root runs window.innerHeight - clientY math on every move with no throttle. Cheap, but it's the kind of thing that shows up in a flame graph.
Nitpick: mode === 'YouTubeDiscover' ? <DiscoverPanel/> : <RecallPanel/> — both ErrorBoundarys are labeled "discover". Copy-paste label.
3. AI Product Researcher
Lens: does the AI feel intelligent, gimmick risk, trust, habit formation

Traversal. This is the most honest AI integration I've reviewed in a long time, and I mean that as the highest compliment. The architecture (memoryAssistant.ts) is: a deterministic, tested engine produces the actual tracks; an optional local LLM only does intent-routing + slot-extraction under a JSON grammar constraint; a template narrates the real result. The model cannot invent a track that isn't in your library. That is the single biggest trust failure mode in AI products, and you designed it out at the architecture level. The branding choice — "SetSense Intelligence" / "Extended understanding" instead of "AI" — is mature.

Strongest moment. "Ask your library — nothing leaves your Mac," backed by an engine that genuinely runs locally. For a privacy-suspicious DJ (your Marcus persona with Wireshark), this is the difference between trust and a hostile Reddit thread.

Weakest moment — the 2GB wall. The "intelligence" that feels magical (free-text questions) requires a ~2GB Qwen download on first use. Everything works without it via the deterministic parser, but here's the trust trap: the deterministic parser is good but brittle — your own memory notes a history of count-parsing bugs. A user who hasn't downloaded the model types a slightly-off-grammar question, gets a literal/wrong result, and concludes "the AI is dumb" — never realizing the smart path was a 2GB download they declined. You're judged on your weakest interpreter, not your best. The gimmick risk isn't that the AI is fake; it's that the good AI is gated behind friction most users won't pay.

Habit formation. The Combos feature ("you've played Waterfalls after This Girl 7 times") is the real habit engine — it's a mirror, and mirrors are addictive. The "untested at next gig" loop is the retention mechanic. Both are stronger habit drivers than the search box.

Important: Make the deterministic-vs-model distinction invisible to users. Either bundle the model in the installer (you note electron-builder can) or make the deterministic parser's confidence visible ("I read that as: 124–128 BPM, never played live — refine?") so a miss feels like a dialogue, not a failure.
Important: Surface Combos/Identity by name in the nav (see Designer's #1). The intelligence that builds habits is the part you're hiding.
Minor: The 2GB download needs an unmissable "this happens once, offline forever after" framing, with size and time upfront.
Nitpick: "Extended understanding" is slightly mystical; "Smart search (offline)" would convert more.
4. Growth + Retention Strategist
Lens: virality, activation, onboarding, retention loops, monetization friction

Traversal. Activation is well-defended: auto-detect Rekordbox on first launch → import → "3,017 tracks loaded." That kills the #1 drop-off your research identified. Good.

The monetization model is where I get nervous. "Checkout" doesn't take a payment — license:checkout calls shell.openExternal('https://setsense.app/checkout?plan=...'). So the entire purchase flow leaves your app, lands on a website, and the user must (a) pay on some external provider, (b) receive a key by email, (c) come back and paste SES1.…. That's a three-context, copy-paste activation funnel with an email-delivery dependency in the middle. Every hop sheds 20–40% of buyers. For a $12/mo impulse, that funnel is too long.

Virality. You have the asset — IdentityShareCard exists — but I see no evidence the "DJ Wrapped" share-as-image loop is wired into a moment that prompts sharing. A share card nobody is nudged toward is a viral loop with no trigger. This is your cheapest growth lever and it's sitting idle.

Retention. The "untested at next gig → mark as tested after" loop (PostGigPromptModal exists) is a genuine weekly-return mechanic. If that prompt actually fires post-gig, it's your best retention asset. Verify it fires.

Critical: The buy→email→paste funnel will cap conversion brutally. Before launch, at minimum: after external checkout, deep-link the key back (setsense://activate?key=…) so the user clicks once instead of copy-pasting from email.
Important: Wire the Identity share card to a celebratory trigger (after first set built, after a Wrapped-style milestone). No trigger = no virality.
Important: Confirm the lifetime/sub split is presented well — your research says this demographic pays $89 once but won't hold a sub. The UpgradeModal does show both with "Lifetime = Best value." Good. Keep it.
Minor: The "tip the developer" path is charming and on-brand for the DJ-built-by-a-DJ story — lean into it in launch copy.
5. Gen Z Power User
Lens: brutally honest, impatient, compares to polished apps, finds cringe and slow

honestly? the app looks sick. the aurora + glass thing is clean, it doesn't look like every other dev tool. that's a win, i'd screenshot it.

but then i clicked the tab that says "Discover" expecting like, new music, and got... my own library stats? that's confusing as hell. either it's discovery or it's my stuff, pick one. the name is lying to me.

the bottom thing that pops up when my mouse goes near the bottom — i thought my trackpad was glitching. why is stuff hiding. just show me the buttons. that's not minimal, that's a scavenger hunt.

the AI search is cool until it told me it needs a 2 gig download to actually be smart. nobody is doing that. i'll type one weird question, get a mid answer, and bounce. if it's not instant it's not intelligent, idc about your architecture.

the Combos thing though — "you've played this after this 7 times" — okay THAT'S sick. that's the screenshot-and-post-to-my-group-chat moment. that's the only thing here i'd actually tell people about.

paying part: it opened a website. in 2026? i have to go to a website and then check my email for a code and paste it back? that's so 2009. i already closed it.

Critical: the website→email→paste-a-code purchase. dead on arrival for anyone under 30.
Important: rename the lying "Discover" tab.
Important: the 2GB AI gate. bundle it or drop it.
Minor: hidden bottom dock.
Nitpick: "Go Pro" button is corny. everything else is cooler than that button.
6. First-Time New User
Lens: no context, confused easily, minute-by-minute emotional log

0:00 — "Welcome to SetSense. Build better sets. Export to any Pioneer CDJ." Okay, I'm a wedding/mobile DJ, I think this is for me? Calm screen, not scary.
0:15 — "How much DJ experience do you have?" I pick "new to DJing." Nice, it's not judging me.
0:30 — "Find your library — we'll look for Rekordbox on this Mac." I click it. (If auto-detect works, magic. If it doesn't, I'm now staring at an Import modal I didn't ask for and I don't know what an XML is.) My whole experience hinges on this one click succeeding.
1:30 — I'm in. There are three panels. Lots of "9A," "124 BPM," colored dots. I don't know what 9A means. I don't know what the green and amber dots mean. Nobody told me. (Learn Mode is supposedly on for me — I need it to actually explain these inline, or I'm lost.)
2:30 — Top bar says "Set safety: Not validated" in a warning color. Did I do something wrong? I haven't even made a set. This makes me anxious for no reason.
3:30 — I click "Discover" hoping for help/new music. I get charts about myself. I have no data yet because I just started. Empty and confusing.
4:30 — I click "Go Pro" out of curiosity, a price screen appears, I close it. I haven't done anything yet so I don't know why I'd pay.
Strongest moment: the proficiency question made me feel seen.
Weakest moment: landing in a 3-panel pro tool with unexplained jargon and an anxiety-inducing "Not validated" badge before I've done anything.

Critical: If auto-detect fails, the fallback (raw Import modal) abandons the beginner. Need an illustrated "here's how to export from Rekordbox" path inside that failure.
Important: "Set safety: Not validated" reads as I broke something to a newcomer. When there's no set, it should say something inviting, not a warning-colored alert.
Important: Learn Mode must actually annotate the key chips and transition dots on first sight, or the beginner promise is hollow.
Minor: First-run Recall/Identity is empty for new users — needs a "this fills in as you play" empty state.
7. Startup CTO
Lens: scalability, backend readiness, infra, observability, auth/security, launch risk

The good. It's offline-first and local-first: SQLite (better-sqlite3 + sqlcipher available), no servers to scale, no per-user infra cost, no data-privacy liability because nothing leaves the machine. From an ops-cost standpoint this is the dream — you could have 100k users and run zero backend. The Ed25519 offline-license design is the correct architecture for a no-WiFi-at-the-venue product.

The launch-stopping problem. The Ed25519 private signing key is sitting in plaintext in scripts/mint-license.mjs, inside the project tree:

[REDACTED — private key removed and keypair rotated; see SECURITY note]
The file's own comment says it should "live only in the vendor's secrets vault." It doesn't — it's here. It's currently untracked, but it's not in .gitignore, so one git add -A commits your money-printing key to history forever. If this key ships in any build, leaks, or gets committed, anyone can mint unlimited valid Pro licenses and your revenue model is over. This is the single highest-severity finding in the entire review.

Second structural problem: licenses are bearer tokens with no revocation. Verification is purely offline against the embedded public key. That means:

A key is infinitely transferable. One person buys a $89 lifetime key, posts it on a DJ forum, and it works for everyone, forever.
Refunds and chargebacks can't revoke access — there's no revocation list and no phone-home.
Subscription expiry is enforced only by the embedded expiresAt vs Date.now() — set the system clock back and the subscription never expires.
These aren't bugs; they're inherent to a fully-offline bearer-license model. The fix isn't to abandon offline-first — it's to add device-binding to the payload and an optional online activation check that degrades gracefully offline.

Observability. There is essentially none. No crash reporting, no anonymous telemetry (consistent with the privacy promise, but it means on launch day you'll be blind to what's breaking on real machines). At least add opt-in crash reporting.

Untested-against-reality risks (flagged honestly in your own notes): the Rekordbox history-XML parser is unverified against real exports, and the local-LLM native module load is unverified on a real machine. Both are load-bearing for headline features.

Critical: Remove the private key from the repo now, add it to .gitignore, rotate the keypair (assume the committed one is burned), and confirm it has never been committed (git log -p --all -- scripts/mint-license.mjs).
Critical: Decide your stance on key-sharing/clock-rollback before launch. Minimum viable: bind keys to an order email + a device id, accept some friction.
Important: Add opt-in crash reporting so launch week isn't blind.
Important: Verify the Rekordbox history parser and the node-llama-cpp load against a real Mac + real export before relying on Combos/AI in marketing.
Minor: No automated key-revocation path; acceptable for v1 if device-binding lands.
8. Founder / Investor
Lens: breakout potential, defensibility, differentiation, venture scale

The thesis is real. Every DJ tool on the market helps you organize and play. Nobody helps you remember your own taste. "SetSense is a memory system for DJs — it shows you what you actually play, what you've forgotten, and what you keep reaching for" is a genuinely novel wedge. Combos (transition history mined from performance logs) and Identity ("Wrapped for DJs") are features no competitor has, and they get stronger the longer someone uses the app — that's a real data moat that compounds per-user.

What makes it defensible: the moat isn't the algorithm (copyable) — it's the accumulated personal history and the habit loop around it. Once a DJ has 6 months of "untested → tested" workflow and Combos data in here, switching cost is emotional and real. That's the venture-interesting part.

What makes it forgettable / what worries me:

It's a single-player, offline desktop app. Beautiful for privacy and cost, terrible for network effects, virality, and the usage data that would make you smarter. There's no inherent reason for user #2 to bring user #3. The "DJ Wrapped" share card is your only organic growth vector and it isn't triggered yet.
Distribution is capped by Rekordbox + macOS. You're a companion to one ecosystem on one OS. That's a defensible beachhead but a ceiling for "venture scale" unless there's a roadmap to Serato/Engine/Windows/mobile.
The monetization model is a leaky bucket (see CTO: shareable bearer keys). Defensible product, undefendable revenue, is a bad combination for an investor.
TAM question. Serious DJs who'll pay for a Rekordbox companion is a real but finite market — low hundreds of thousands, not tens of millions. This may be a wonderful $1–5M ARR indie business and not a venture-scale company. Be honest with yourself about which you're building, because the two need different decisions.
Strongest differentiator: Combos + the memory/Recall layer. Lead every piece of marketing with it. It's the only thing here a competitor can't screenshot and clone in a weekend.

Biggest forgettable risk: if a user only ever uses the "build a set + export" loop, you're a prettier Rekordbox and you'll churn. The memory layer is what makes you unforgettable — and it's the thing you've hidden behind a tab labeled "Discover."

Important (strategy): Pick your identity — lead with "DJ memory system," not "set builder." The set builder is table stakes; the memory is the company.
Important: Get the viral share loop live; it's the only growth engine in a single-player app.
Minor: Have an honest internal answer to "indie lifestyle business vs. venture" before you take money on a venture narrative.
Final Synthesis
Top 10 highest-leverage improvements
Remove the private signing key from the repo, gitignore it, and rotate the keypair. (Existential — CTO)
Commit the entire licensing layer to git with history. It currently exists only in a working tree. (Frontend/CTO)
Rename the "Discover" tab to "Recall"/"Memory" so your best feature isn't hidden behind a misleading label. 5 minutes, huge payoff. (Designer/Gen Z/everyone)
Fix the purchase funnel — kill website→email→paste; deep-link the key back via a custom URL scheme after checkout. (Growth/Gen Z)
Add device-binding (and ideally optional online activation) to licenses so keys aren't infinitely shareable and clock-rollback doesn't grant free subs. (CTO)
Trigger the "DJ Wrapped" share card at a celebratory moment — your only organic growth loop. (Growth/Founder)
Resolve the AI two-tier trust trap: bundle the model in the installer, or make deterministic-parse confidence visible so misses feel like dialogue. (AI)
Make Learn Mode actually annotate key chips + transition dots on first sight, or the beginner promise is empty. (New User)
Delete the orphaned YouTube/Discover code (or rewire it) — don't ship unreachable surface area. (Frontend)
Add opt-in crash reporting so launch week isn't flown blind. (CTO)
What absolutely must be fixed before launch
The private key in the repo. Nothing else matters if this leaks. Rotate it.
Commit the monetization layer. You can't launch code with no git history.
The buy→activate funnel. If people can't easily pay, the launch has no revenue regardless of how good the product is.
The "Discover" → Recall mislabel. It actively misrepresents your strongest feature; trivial to fix.
Auto-detect failure fallback for beginners. Your largest segment dies here if detection misses.
What can safely wait
Custom crate rule builder, inverse Combos, BPM-zone key charts, compact list density, USB direct-copy, the orphaned-code cleanup (as long as it's truly unreachable), most P2/P3 polish in your own matrix. None of these block trust or revenue.
Biggest hidden risk
Infinitely-shareable bearer licenses with no revocation. The product can be a hit and the revenue still bleeds out through one forum post sharing a lifetime key. It's invisible because the crypto looks rigorous — and it is, for forgery; it does nothing for sharing. (The committed private key is more severe but it's not "hidden" once you look — this one will quietly cost you money even if everything else goes right.)

Biggest hidden strength
The honesty of the AI architecture + the Combos memory layer. The model literally cannot hallucinate a track, the engine works fully offline, and Combos surfaces a truth about the DJ no other tool reveals. That combination is both a trust asset and the real moat — and you've under-marketed and under-surfaced it.

Probability users recommend organically
~35%. The Combos/Identity "screenshot moment" is real and several reviewers independently flagged it as share-worthy — but the share loop isn't triggered, it's a single-player offline app, and the best feature is hidden behind a mislabeled tab. Wire the share card + rename the tab and this jumps toward 55–60%.

Probability users churn after first session
~45%. Activation is well-defended (auto-import), but new users land in a jargon-heavy 3-panel tool with an anxiety-inducing "Not validated" badge and unexplained chips, and the payment wall is a website detour. The memory features that create stickiness are exactly the ones hidden. Fix the tab label, the Learn Mode annotations, and the empty states and this drops toward 30%.

Is it genuinely differentiated?
Yes — on the memory/Recall/Combos layer, unambiguously. No competitor does transition-history mining or a personal-taste mirror, and it compounds per user. No — on the set-builder/export layer, which is table-stakes parity with Rekordbox dressed in much better design. Your entire strategic job between now and launch is to make sure the world experiences you as the former and not the latter. Right now your own navigation does the opposite.

Bottom line: This is a real product with genuine craft and one genuinely novel idea — not a prototype. It is not launch-ready in 7 days, but the blockers are sharp and fixable: a leaked-grade secret in the repo, an uncommitted revenue system, a leaky license model, a broken purchase funnel, and a self-inflicted decision to hide your best feature behind the name of your worst one. Fix those five and you have a launch. Ignore the private-key one and you have a free product.

Want me to spin up fixes for the unambiguous, low-risk ones — gitignore + key rotation, the tab rename, the orphaned-code deletion — or draft the device-binding license change in more detail?