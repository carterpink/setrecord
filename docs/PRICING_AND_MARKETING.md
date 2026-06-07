# SetSense — Pricing, Tiers & Marketing Copy

_Last updated 2026-06-04. Source of truth for prices: `electron/services/licensing/signingKey.ts` (`PRICING`) and `src/utils/entitlements.ts` (`PRO_PRICING`)._

---

## 1. Overview

SetSense is a DJ **memory system** — it remembers every gig you've played, maps
your sound, and builds your next set. Pricing follows one principle:

> **Give away the rear-view mirror. Charge for the windshield.**

The free tier lets a DJ import their whole world and fall in love with seeing it
reflected back — their history, their "Wrapped", their forgotten gems, unlimited
AI questions. You upgrade at the moment you want to **act**: build a set, export
to your CDJs, or keep your work.

Positioned against the market: the closest comparable (Lexicon, a DJ library
manager) is **$9.99/mo or $199 lifetime**; a single-purpose utility (Mixed In
Key) is **$58–99 one-time**. SetSense does more than either, priced in between.

---

## 2. Plans

| Plan | Price | Effective | Billing | Badge |
|---|---|---|---|---|
| **Monthly** | **$9 / mo** | $108 / yr | recurring monthly | — (decoy) |
| **Annual** | **$79 / yr** | **$6.58 / mo** | recurring yearly | ⭐ Recommended |
| **Lifetime** | **$199** | pay once | one-time | Pay once, yours forever |

- **Annual** is the default and centre-stage card — the best everyday value.
- **Monthly** exists mostly to make Annual's saving obvious ("save $29 a year").
- **Lifetime** anchors the page and serves DJs who hate subscriptions.
- A **7-day full-Pro trial** auto-starts on first library import. No card required.

> Why not cheaper / one-time-only? A one-time fee can't fund the ongoing work of
> keeping imports alive as Rekordbox, Serato and Engine change their formats.
> A maintained tool needs maintained revenue — and a real price signals the app
> is alive, not abandonware.

---

## 3. What's included at each tier

**Everything in the free tier is the "memory" hook. Pro adds the building, exporting and keeping.**

### ✅ Free — the rear-view mirror
- Import from Rekordbox, Serato & Engine DJ
- Browse, search & filter your whole library
- **Ask the AI box anything — unlimited** (it runs locally, so it's genuinely free)
- Gig history — "what did I play at Hi Ibiza?"
- Identity / **Wrapped for DJs** — your genres, keys, BPM signature
- Rediscover & Uncover — forgotten gems from your own crate
- Combos — "what do I play after this track?"
- Library Health headline + Tags browsing

### 💎 Pro — the windshield (build, export, keep)
- **Save your conversations** (free chats are ephemeral)
- **Set Architect** — build a full, beat-matched set in one click
- **Suggested Next** — ranked transitions with harmonic/BPM/energy reasons
- **Smart Crates** — custom rule builder
- **Cue point editor** — default + hot cues A–H on a full waveform
- **Export & validate** — Rekordbox XML / Engine USB, checked against your CDJs
- **Library Health drill-down** — click a number, fix the exact tracks
- **Tags** — edit and send straight to Rekordbox

_The full feature matrix is in `docs/pricing_tiers.csv` (opens in any spreadsheet)._

---

## 4. Marketing copy

### Hero
- **Headline:** *Your DJ brain, remembered.*
- **Sub:** SetSense remembers every set you've played, maps your sound, and
  builds your next one. Import your library free — keep the magic with Pro.
- **CTA:** Import your library → (secondary) See pricing

### Alt headlines (A/B)
- *Every gig you've ever played, finally in one place.*
- *Stop digging. Start remembering.*
- *The library brain Rekordbox forgot to build.*

### Plan-card microcopy
- **Monthly — $9/mo** · "Billed monthly. Cancel anytime."
- **Annual — $79/yr** · "$6.58/mo, billed yearly. **Save $29 a year.**" · ⭐ Recommended
- **Lifetime — $199** · "Pay once. Yours forever, including future updates."

### Paywall one-liners (by moment)
- **Trial counting down:** "Your Pro trial ends in {n} days — you'll lose Set
  Architect, AI set-building and export. Keep Pro."
- **Saving a chat:** "Free chats clear when you close SetSense. Keep your history
  with Pro."
- **Building / exporting:** "Go Pro to build this set and export it to your CDJs."
- **After a free answer (edge bar):** "Go Pro to save this conversation, build
  sets from these results and export them."

### FAQ
- **Is it really free?** Yes — import, search, your full history and unlimited AI
  questions are free forever. Pro unlocks building, exporting and saving.
- **Can I cancel?** Anytime. Annual and monthly both stop at the end of the term;
  nothing auto-charges without a clear renewal.
- **Does it work offline?** Completely. Your library never leaves your machine,
  and Pro is validated locally — no internet needed at the gig.
- **Why a subscription at all?** So imports keep working as Rekordbox/Serato/
  Engine evolve. Prefer one payment? Lifetime is $199, forever.

### Honesty guardrails (do **not** ship)
- ❌ Fake "Most popular" / "23 DJs bought this" while customers are ~0 — false
  advertising. Use **"Recommended"** / **"Best value"** (defensibly true).
- ❌ Fake countdown timers, hidden cancel, confirmshaming — illegal under FTC /
  EU / CA dark-pattern rules and they tank lifetime value.
- ✅ Real trial deadline, real savings math, the user's own numbers — all fair game.

---

## 5. Conversion & retention mechanics already built in

| Mechanic | Where | Lever |
|---|---|---|
| Endowment value-strip (your real track/set/gig counts above the price) | UpgradeModal | Nunes–Drèze endowment + loss aversion |
| Annual pre-selected, centre-stage, "Recommended" | UpgradeModal | Default bias + centre-stage effect |
| Monthly decoy makes annual look cheap | UpgradeModal / pricing | Asymmetric dominance (Ariely) |
| Unlimited free asking, ephemeral chats | HomeSurface / homeStore | Zeigarnik open-loop |
| "Edge" upsells at capture moments (save / export / build) | Home edge-bar, History drawer | Pay at peak intent, never block the taste |
| Trial chip urgency scales ≤2 days, loss-framed | TopBar | Honest deadline salience |
| 14-day pre-expiry renewal nudge | TopBar / `computeRenewal` | Cut involuntary churn |
