# SetRecord — Launch Plan (positioning, pricing, distribution)

The product is over-built and under-distributed. The work now is **audience**,
not features. This doc is the playbook.

---

## 1. Positioning — the wedge

You are not competing with **Lexicon** (library *sync* between Rekordbox/Serato/
Engine) or **Mixed In Key** (key/energy *analysis*). They prove DJs pay for
desktop tools; don't fight them on their turf.

**Your category of one:**

> **SetRecord is the DJ's memory — a second brain for your crates and your career.**

- Lexicon *manages your files.*
- Mixed In Key *analyzes your tracks.*
- **SetRecord *remembers your life as a DJ.***

The "memory" features are the front door: gig history ("what did I play at Hi
Ibiza last August?"), reverse-Shazam, the Black Box crowd-reaction recorder,
forgotten-gems recall, set intelligence. Import/sync/export are the supporting
cast — present, not the headline.

**One-liner for the site / store / DMs:**
"SetRecord remembers every set you've played and every track that moved a crowd —
so your next set is your best. Runs entirely on your Mac. Nothing leaves your
machine."

---

## 2. Pricing — lifetime-hero (your decision)

DJs distrust subscriptions (the Serato/Rekordbox backlash). On-device AI means
your marginal cost per user is ~$0 — so a generous free tier is cheap for you and
removes the #1 freemium objection from the reels (LLM bills) entirely.

| Tier | Price | What it is |
|---|---|---|
| **Free** | $0 | The **magic demo, uncrippled**. Full import + the "memory" aha on the user's real library. This is your conversion engine; do not nerf it. |
| **Pro — Lifetime** | **$199** (hero) | Own it forever. The star CTA. DJs love owning. |
| **Pro — Annual** | $79/yr (anchor) | Makes $199 lifetime look obviously correct. |
| ~~Weekly~~ | — | **Never offer.** Signals "disposable app" to pros. |

**Gate the pro *workflow*, not the *wow*:**
- Free: import, browse, recall, gig memory, "what did I play at X", forgotten gems.
- Pro: exports (Engine/Beatport/Rekordbox write-back), Set Architect, Black Box,
  B2B collab, unlimited saved sets/tags.
- **7-day Pro trial arms on first import** (already built) — it lights up the aha
  during the honeymoon. Keep it.

Paywall *after* the first "memory" moment, not on launch of the app. The reels'
correct core — charge confidently, push annual/lifetime over monthly, gate right
after the aha — all still applies; you're just doing it for a community that buys
differently than a mobile-AI consumer.

---

## 3. Distribution — the part to stop avoiding

You ship a notarized DMG / direct download, **not** an App Store app. DJs don't
discover tools in the App Store — they discover them in communities and on
YouTube/TikTok. Your distribution is **founder-led content**, and your unfair
advantage is that **you are the customer.**

Priority order:

1. **Founder content (start NOW, 3 weeks before "ready").** TikTok + IG Reels +
   YouTube Shorts, you as a working DJ, showing the memory features on real gigs.
   The cheapest, best marketing is the owner. Post before/during/after launch.
2. **DJ YouTube educators** — Crossfader/We Are Crossfader, DJcityTV, Phil Harris,
   DJ TechTools. One good review > a month of ads. Offer them lifetime keys + a
   first look.
3. **Communities** — r/DJs, r/Beatmatch, DJ Facebook groups (huge), Discord
   servers. *Participate and show, don't spam.* Build in public; ask for feedback.
4. **Product Hunt + Hacker News** — your local-first / on-device-AI / privacy
   angle overperforms on HN. Free, high-intent traffic. Drafts below.
5. **Beatport / label adjacencies** later.

**Pre-launch gate:** launch the day ~300 people are *watching*, not the day the
build compiles.

---

## 4. Demo-Reel scripts (each is a 15–30s vertical video)

**Reel A — Gig memory (the hook):**
> "I played a festival 8 months ago and forgot what closed it." *(screen: type
> "what did I play at [festival] in October")* "…there it is. Every set I've ever
> played, searchable. My laptop remembers my career better than I do."
CTA: "SetRecord. Link in bio."

**Reel B — Black Box (the viral one — nobody else has this):**
> "I let my laptop listen to the crowd during my set." *(screen: reaction timeline,
> a spike)* "This track? The room went off. This one? Dead. Now I know what
> *actually* works — not what I think works."
CTA: "It records the room, not the music. SetRecord."

**Reel C — Forgotten gems / Uncover:**
> "I have 14,000 tracks and play the same 200." *(swipe deck)* "SetRecord
> resurfaces the bangers I forgot I owned. Found my next 3 openers in 30 seconds."
CTA: "Rediscover your own library. SetRecord."

Film 3 of these *this week* on your phone. Raw > polished. Post, watch
retention/saves, double down on whichever pops.

---

## 5. Launch posts (drafts)

**Product Hunt — tagline:** "SetRecord — the memory layer for DJs. Remembers
every set you've played, and what moved the crowd. 100% on-device."

**Product Hunt — first comment:**
> Hey PH 👋 I'm a DJ. I built SetRecord because my library was a graveyard and my
> gig history lived in my head. It remembers every set I've played, lets me ask
> "what did I play at [venue] in [month]", resurfaces tracks I forgot I owned, and
> — the part I'm proudest of — can record the *crowd's* reaction during a set so I
> learn what actually works. It runs entirely on your Mac; your library and audio
> never leave your machine (the AI is on-device). Lifetime license, no
> subscription required. Would love feedback from anyone who's ever lost a track
> they swore they had.

**Hacker News — Show HN title:** "Show HN: SetRecord — a local-first DJ memory
tool with fully on-device AI"

**HN — body (lead with the engineering, HN's audience rewards it):**
> SetRecord is a desktop app (Electron + better-sqlite3) that acts as a "second
> brain" for DJs. Everything runs locally: a bundled on-device model for the
> recall/assistant features, on-device DSP for audio fingerprinting and a
> crowd-reaction recorder (echo-cancellation to isolate the room from the music),
> and no cloud for any user data. The only network calls are license activation, a
> GitHub update check, and an optional model download — audio and library never
> leave the machine. Licensing is offline Ed25519 verification (the app embeds
> only the public key). Happy to go deep on the local-first architecture, the
> on-device fingerprinting, or why I avoided a backend entirely.

---

## 6. What to expect (honest)

- High-margin **lifestyle-to-real-business**, not a venture rocket. On-device AI =
  ~no cloud bills = you keep most of revenue.
- Comparables (Lexicon, Mixed In Key) suggest a serious solo DJ tool can reach
  **$5k–50k/mo** over 1–3 years *if* distribution is consistent.
- It will **not** be a $10M-ARR consumer app — TAM (serious paying DJs) is
  hundreds of thousands, not hundreds of millions. That's a feature: no investors,
  total ownership, defensible niche.
- **Most likely failure mode is not security or scale — it's that you keep
  building and never consistently market.**

---

## 7. Scale refactor plan (the one deferred engineering item)

The library-load path freezes at large libraries. This needs the running app to
verify safely, so it's planned, not done. Sequenced fix:

1. **DB: add FTS5** virtual table mirroring `tracks(title, artist, album, genre)`
   with triggers to keep it in sync (new migration → bump `LATEST_SCHEMA_VERSION`,
   guarded by `tests/configInvariants.test.ts`). Add a covering index on
   `(artist, title)` for the default sort.
2. **IPC: paginate.** Replace `library:get-all` (whole table → renderer) with
   `library:page({ offset, limit, sort, filter })` and a `library:search(query)`
   that runs FTS in SQL, returning only the visible window + total count.
3. **Renderer: window it.** `libraryStore` holds the current page + count, not the
   whole array; the existing `@tanstack/react-virtual` list requests pages as it
   scrolls. Debounce search (~150ms) and hit `library:search`, not the in-memory
   O(n) `fuzzySearch`.
4. **Verify** with a 100k-track fixture: cold load < ~300ms, keystroke search
   < ~50ms, no main-thread stall. Add a packaged smoke test.

This is a focused, separately-verified effort — worth doing before you market to
power DJs, who are exactly the ones with 50k+ track libraries.
