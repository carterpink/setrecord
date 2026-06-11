# SetRecord — The Building Report
### Everything I learned taking this from an idea to a real product

*Written 2026-06-10. Plain-English, no jargon-for-the-sake-of-it. This is the diary I wish I'd had at the start.*

---

## 0. What this document is

This is the honest story of building SetRecord (the DJ app that used to be called SetSense). It's not a brag sheet and it's not a postmortem — it's the collection of lessons, mistakes, lucky breaks, and "oh THAT'S how it works" moments from going from zero to a near-launch product, mostly by "vibecoding" — describing what I wanted and iterating fast.

If future-me forgets why a decision was made, or a friend asks "how did you actually do this?", this is the answer.

---

## 1. The idea, and how it got sharper over time

**The starting instinct:** DJs have huge music libraries and terrible memory of their own crates. Software treats your collection like a dumb filing cabinet. I wanted it to *think*.

**The line that finally made it click:** "Your crate is dumb. Make it think." And internally, the product is **"a DJ's memory."** That one phrase did more work than any feature list. The moment I could say the product in five words, everything else — what to build, what to cut, how to price — got easier.

### Lesson: positioning is a tool, not decoration
For ages the app was a pile of cool features (auto-tagging, set building, transitions). It only became *a product* when I picked one promise — "remember everything about your sets and your library, so you don't have to." Features became evidence for the promise instead of the point.

### Lesson: the front door matters more than the rooms
A big restructure (the "IA restructure") flipped the app so that **Library/memory is the front door** and the set-building tools support it — not the other way round. Early on I led with the flashy builder. Wrong. People connect with "this app *knows my music*" faster than "this app helps me arrange tracks." Lead with the emotional hook, put the power tools one step in.

---

## 2. Tech choices — what I picked and why (in human terms)

I'm going to translate the stack into what each piece actually *does for me*, because the names mean nothing on their own.

| The tech | What it actually is | Why it was the right call |
|---|---|---|
| **Electron** | Lets me build a desktop app (Mac/Windows) using website tools | I already think in web stuff; one codebase, real desktop app |
| **React** | The thing that draws the buttons and screens | Industry standard, endless help available, easy to vibecode |
| **TypeScript** | JavaScript that yells at you *before* things break | Caught a huge number of dumb mistakes before users ever saw them |
| **Vite** | Makes the app rebuild instantly while I work | Fast feedback = fast learning = momentum |
| **better-sqlite3** | A database that lives in a single file on the user's computer | No servers, no monthly bills, works offline, user owns their data |
| **Vitest** | Runs little tests that prove my code still works | My safety net when I change things and panic |

### The single best architectural decision: **local-first**
Everything lives on the user's machine. No accounts-required cloud, no server bills, music never leaves their computer. This was originally a constraint (I didn't want to run servers) but it turned into the **product's soul**: privacy, offline, "your data is yours." DJs are protective of their crates — local-first *is* the trust pitch.

### Lesson: boring, popular tech is a feature
Every time I reached for something trendy and niche, I paid for it in time spent debugging alone. Every time I used the boring popular thing (React, SQLite), there were a thousand answers when I got stuck. **When vibecoding, popularity = how much help exists when you're stuck.**

### Lesson: native modules will betray you at the worst time
Things like `better-sqlite3` and `keytar` are "native modules" — they have to be physically rebuilt for your computer after you install stuff (`npm run rebuild`). I lost real hours to "why is it broken" that was just "you forgot to rebuild." Now it's muscle memory. **Write down the gotcha the first time it bites — the note in CLAUDE.md about `npm run rebuild` has paid for itself many times.**

---

## 3. Working *with* AI to build this — the meta-lessons

Since this whole thing is vibecoded, the way I worked with the AI is itself a product.

- **CLAUDE.md is the cheat code.** A short file at the repo root that tells the AI the rules (the stack, "never commit to main", "rebuild native modules", "no console.log in production"). It means I don't re-explain the project every session. *If you remember one tip from this doc: keep a living instructions file.*
- **Memory files are gold.** I kept a `memory/` folder of one-fact-per-file notes ("here's why we picked Lemon Squeezy", "here's the audio bug we fixed"). Six months in, this is the only reason I remember *why* anything is the way it is.
- **Isolated worktrees stopped me clobbering my own work.** When running multiple AI tasks at once, each got its own private copy of the code. Early on, parallel changes stepped on each other. Isolation fixed it. **Don't let two streams of work edit the same files at once.**
- **CI is a non-negotiable gate, not a nag.** Every change has to pass four checks — typecheck → lint → test → build — before merging. It feels slow until the day it catches something embarrassing. It has, repeatedly.

### The biggest mindset shift
Early on I treated the AI like a magic vending machine: ask, receive, ship. The work got *good* when I started treating it like a fast junior dev who needs **clear constraints, a definition of done, and proof it works.** Vague asks → vague results. "Add X, make sure typecheck passes, show me it working" → actually good results.

---

## 4. Mistakes I actually made (the useful part)

1. **The "too bright / AI-looking" opening animation.** My first splash screen was a glowing orb. It screamed "generic AI app." Scrapped it for "The Cut" — a sharper, more editorial intro. **Lesson: looking AI-generated is a brand risk now. Polish and taste are the moat.**
2. **Leading with the power tool, not the feeling.** Covered above — had to flip the whole app's front door.
3. **Treating security as a "later" problem.** A proper adversarial audit found real holes: people could farm free trials by rolling back their clock, the app had risky permissions, etc. Fixing it meant anchoring the trial clock to the system keychain, locking down Electron, tightening permissions. **Lesson: if you're charging money, someone *will* try to cheat the paywall. Design for the adversary before launch, not after.**
4. **Underestimating the audio rabbit hole.** A bug where track URLs were encoded wrong silently killed all audio and waveforms. Audio/file-path handling is a swamp — budget more time than feels reasonable.
5. **Naming churn.** SetSense → SetRecord. Renaming late is annoying (it's everywhere in the code). Not fatal, but **pick the name you can defend before you sprinkle it through 200 files.**

### The meta-lesson on mistakes
Almost none of these were "wrong tech." They were **wrong order** (security late, name late) or **wrong emphasis** (tool before feeling). The code was rarely the problem. The judgment calls were.

---

## 5. What worked *really* well

- **One visual identity, applied everywhere.** The "grit" look — flat black, film grain, grainy neon glow-icons, a serif headline font (Fraunces) — started on the landing page and became the whole company's look. Picking *one* strong direction and committing made everything instantly feel like a real product instead of a hobby project. And I built it so the old look is one command away (`window.__setTheme('aurora')`) — **commit hard, but keep an escape hatch.**
- **Pricing with no dark patterns.** Free tier that's genuinely useful, then yearly / lifetime / a cheap "decoy" tier. The free tier gives unlimited "ask" and rear-view features. **Generous free tier = trust = word of mouth.** I deliberately avoided sneaky cancellation traps. It's the long game.
- **Features that feel like magic, not like work.** The "Set Flight Recorder" (auto-logs what you played, like a dashcam for your DJ sets), gig metadata ("songs I played at Hi Ibiza"), the Tinder-style "rediscover your own library" deck. These all share a theme: *the app does the remembering so the DJ doesn't have to.* On-brand magic beats off-brand power.
- **House animation as a standing rule.** Every new feature ships with consistent motion. Small thing, huge effect on "this feels expensive."
- **Going multi-language early-ish.** English, Spanish, German, French, Portuguese. DJ culture is global. Built the plumbing once so adding languages later is cheap.

---

## 6. The market choices (the business brain)

- **Who it's for:** working and aspiring DJs who already have a library and feel like their software doesn't *understand* it.
- **Why local-first is also a *market* choice:** no server costs means I can offer a lifetime price and actually keep the lights on. The tech decision *enabled* the pricing strategy.
- **Payment via Lemon Squeezy** (a "Merchant of Record" — they handle the global tax/VAT nightmare so I don't have to). There's a separate small server that hands out license keys. **Lesson: don't build your own payments/tax handling as a solo dev. Pay someone to eat that complexity.**
- **A landing page in its own repo**, "State of Sites" aesthetic, with a waitlist. Built the audience *before* the launch button exists.

### Lesson: distribution is a product, too
The app being good is necessary but not sufficient. The positioning line, the landing page, the waitlist, the pricing psychology — that's the other half of the job, and it took as much thought as any feature.

---

## 7. Where things stand right now (June 2026)

- The big "grit" redesign is the default look. All quality gates green.
- Core features shipped: library/memory front door, set building, auto-tagging, gig metadata, the Flight Recorder (tracklist + lo-fi audio + playback), import from Rekordbox/Serato, export to Engine DJ/Beatport.
- **Still blocking launch:** a couple of security/release items — verifying the payment webhook is genuinely from the payment provider (lives in the separate server repo), and a final "does the packaged app actually work when installed" smoke test.
- A real security audit has been done and the big holes are patched.

**Translation:** the product is *built*. What's left is the unglamorous launch-readiness work — the stuff that's boring but is exactly where products embarrass themselves if skipped.

---

## 8. What to expect over the next ~6 months (the optimistic, realistic forecast)

Here's the honest-but-hopeful map.

**Month 1 — Cross the launch line.**
Close the last security/release blockers (the webhook check + the packaged smoke test). These are *small* compared to what's done. Ship to the waitlist. Expect a flurry of "it crashed on my exact setup" bugs — that's normal and good; real users find what you can't.

**Months 2–3 — Listen and patch.**
The first real DJs will use it in real conditions (loud booths, weird libraries, huge crates). Expect the Flight Recorder's reaction-capture and the import paths to need real-world hardening. This is the phase where the product stops being *yours* and starts being *theirs*. Resist adding features; fix what hurts.

**Months 3–4 — Find the one feature people scream about.**
Every product has a "this alone is worth the price" feature. You won't know which one it is until people use it. Watch what they rave about, double down there, quietly retire what nobody touches.

**Months 4–6 — Turn the flywheel.**
The long-term thesis (the "impossible-to-fail" notes) is a *flywheel*: the more a DJ uses it, the more it remembers, the more valuable and harder to leave it becomes. That's the moat. By month six the goal isn't "more features" — it's that early users *can't imagine* DJing without their crate's memory, and they tell other DJs. Plus the bigger bets on the horizon (real-time back-to-back set co-editing, the emotional/identity layer) start moving from notes to prototypes.

### The honest caveats (so this isn't fantasy)
- Solo-dev launches are slower than you think. Double your time estimates.
- The first month after launch is support, not building. Make peace with it.
- Local-first means you can't see what's breaking on users' machines unless they tell you — the opt-in crash reporting matters a lot here.

### The reason for optimism
You took a vague feeling ("DJ software is dumb") and turned it into a *defensible, shippable, opinionated product* with a clear promise, a distinctive look, a sane business model, and a privacy story competitors can't easily copy. Most people never get past the idea. You have a thing that runs, passes its own tests, and has a reason to exist. That's the hard part, and it's behind you.

---

## 9. The five lessons I'd tattoo on my brain

1. **Say the product in five words before building feature six.** ("A DJ's memory.")
2. **Boring popular tech wins, because help wins.**
3. **Design for the cheater and the crasher *before* launch, not after.**
4. **Lead with the feeling, hide the power tools one click in.**
5. **The code was almost never the hard part — the judgment calls were.** Slow down on those.

---

*Keep this updated. Future-you will thank present-you, exactly like the memory files already have.*
