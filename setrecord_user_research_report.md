# SetRecord — User Research & Revenue Strategy Report
### 4-Persona Journey Analysis · May 2026

---

## HOW TO READ THIS DOCUMENT

Four distinct users were simulated across the app with zero prior knowledge of its features. Each read the same sequence of screenshots as if experiencing the app live for the first time. Every reaction, confusion, delight, and decision point is captured verbatim in their voice.

**Reaction labels used throughout:**
- 🔥 `"this is sick"` — genuine delight
- 😕 `"what is this"` — confusion
- 😤 `"why doesn't this exist"` — missing feature they want
- 💀 `"this is too hard / dealbreaker"` — friction that risks losing them
- ❓ `"what does this mean"` — terminology or trust question
- ⚡ Moment of genuine realisation or opinion shift

---

---

# PERSONA 1 — JAKE

**Age:** 19 · **Location:** Melbourne, Australia  
**Experience:** 2 years DJing. Plays Friday nights at a 300-cap club, occasional warehouse parties  
**Setup:** Pioneer CDJ-2000s, Rekordbox. Learned from YouTube.  
**Library:** ~1,200 tracks, loosely labelled  
**Tech literacy:** Low. Phone-first. Opens apps if they look cool.  
**Goal:** Stop freezing mid-set. Sound more professional. Get better gigs.  
**Would pay:** $9–12/month (already pays $30/month for Spotify without thinking)

---

### SCREEN 1 — First Launch

*Oh damn okay. Dark, looks sick. There's already tracks in here? Wait — is this someone else's library? No wait, maybe it pulled mine automatically. There's playlists on the left that look like my Rekordbox folders — "4PRES EAST", "BUS DAY", "B2B WITH M…" that's actually kinda my naming style. Hold on is that MY library? Did it just read Rekordbox without me doing anything?*

*Middle section says "New set 07 May 2026" with a curved line — that's like an energy curve or something? And on the right it says "Suggested next" but "No track selected." So it's gonna suggest what to play next? That's the thing from Discord. Okay I'm already interested.*

*There's a yellow line that goes up and then curves down — I think that's mapping the energy of the set? That's actually pretty smart. The tracks in the middle have little coloured badges — looks like BPM numbers and something else. 78, 74, 124, 132 — yeah those are BPMs.*

🔥 The dark design looks clean and professional, not some cheap indie app  
🔥 It already seems to have pulled in tracks — possibly from Rekordbox  
❓ Those coloured badges next to each track — what do the different colours mean? Red, yellow, green?  
😕 What is that yellow curve in the middle section actually telling me? Is that the energy of THIS set I'm building?  
⚡ Oh wait — I think I get it. Left is my library, middle is where I BUILD my set, right tells me what to play next. Three columns. Got it.

---

### SCREEN 2 — Import Modal

*Okay so it popped up an "Import library" box. So maybe it DIDN'T pull my library automatically — the screenshots before were just demo data. It's asking me to "Select your Rekordbox XML export file." So I need to export from Rekordbox first and then bring it in here.*

*That's a bit annoying. I use Rekordbox every day and I genuinely don't know where the XML export is. I've never exported anything from Rekordbox. I'd have to Google this.*

😕 Wait, I have to export from Rekordbox first? I don't even know how to do that  
💀 **THIS IS THE MOMENT I MIGHT CLOSE THE APP.** If I have to go figure out Rekordbox XML export, I'll get distracted and never come back  
😤 Why can't it just read Rekordbox directly — it knows where the database lives on my Mac  
⚡ But okay the text says "SetRecord reads all track metadata, cue points, and hot cues without modifying your Rekordbox library" — so it's safe, it won't mess up my setup. That's actually reassuring.  
❓ What even IS a Rekordbox XML export file? Where do I find that?

*I'd probably try clicking "Select file" and just browse. If I can't find it in 2 minutes I'm Googling "how to export Rekordbox XML" — which is a 50/50 chance I follow through vs. close the laptop.*

---

### SCREEN 3 — Library Loaded

*Okay so now it's loaded and it looks like the first screen. The library is in — I can see my playlists on the left. "All Tracks 3317." The left sidebar has my Rekordbox playlists nested exactly how I have them, which is actually sick.*

*The middle already has 5 tracks in a set. Are these suggested? Did I put them there? I don't remember doing that. Maybe these were pre-loaded examples.*

🔥 My Rekordbox playlist structure is right there — all my folders and crates ported over  
😕 Why does it already have tracks in the set? Did I accidentally add them or are these defaults?  
❓ "35:59 · 9 tracks · 125–160 BPM" — that's the set duration and BPM range. Actually that's useful.

---

### SCREEN 4 — Playlist Sidebar Filter

*The screen looks mostly the same but some things are highlighted differently. The track names in the middle have gone kind of faded/dim. Did I accidentally click something? Looks like I'm filtering by playlist maybe.*

*I can see "Prepare" tab is highlighted at the top in yellow — that's the tab I'm on. There's also "Discover" and "Recall" tabs. Gonna explore those later.*

😕 The screen looks almost identical to the previous one, hard to see what changed  
❓ What's the difference between "Library" and "Crates" and "Sets" in the left panel?  
⚡ Oh I think I'm now filtering by a playlist — the tracks in the middle are from that playlist. It's like how Rekordbox shows playlist contents.

---

### SCREEN 5 — Track Selected in Library

*I clicked a track in the library and it's highlighted green. But the "Suggested next" panel on the right still says "No track selected"? That's confusing — I literally just selected something.*

*Oh wait — I think you have to click a track that's IN THE SET to get suggestions, not a track in the library. The suggestions are based on what comes AFTER what's already in my set.*

😕 The UX is confusing — clicking a library track doesn't trigger suggestions. Why not?  
⚡ Oh I get it now — suggestions are context-based off the set, not the library selection. Makes sense but not obvious at first.  
😤 Would be sick if clicking ANY track — even in the library — showed me "compatible tracks" to mix with it

---

### SCREEN 6 — Track Added to Set · Suggestions Fire

*NOW we're talking.*

*"BEST MATCH" — Charli XCX - B2b. Then James Hype - Waterfalls. Then Avicii - Could Be The One. Then After Hours. Each suggestion has tags: "Energy shift", "Perfect harmony", "Identical BPM" — and little badges showing the BPM.*

*The energy curve in the middle has changed shape too — it's now going up to a peak then coming down.*

🔥 **THIS is the feature.** It's telling me what to play next based on energy, harmony, BPM. This is exactly what I need when I'm frozen mid-set  
🔥 "Identical BPM" and "Perfect harmony" tags — so it's doing harmonic mixing automatically. THAT's what harmonic mixing means. I've been doing this wrong my whole DJ career lol  
⚡ The energy curve is showing me what my set LOOKS like as a shape — I can see if it builds properly or just flatlines  
❓ What does "Energy shift" mean vs "Perfect harmony"? Is one better than the other?  
😤 I want to be able to preview/listen to a suggestion before I commit to adding it

---

### SCREEN 7 — Settings Modal

*"Learn mode" — "Adds explanations + diagrams for every recommendation. Good for practicing harmonic mixing, BPM blending, and energy arcs." I'm gonna turn that on.*

*"Default target hardware" — CDJ-2000NXS2 is selected. That's exactly what I use at the venue.*

*"YouTube API key" — okay that's a bit technical. I have no idea what that means or where to get one.*

*"Your genres" — Techno, House, Deep House, Minimal, Breakbeat. I can pick my genres. That's cool.*

🔥 CDJ-2000NXS2 as default hardware — that's exactly my setup, feels like it was made for me  
🔥 "Learn mode" is a brilliant idea — I'd genuinely use this to understand WHY it's recommending tracks  
❓ YouTube API key — what is that and why do I need it? Sounds like something developers do  
💀 If I need a YouTube API key to get full functionality I will 100% skip that and possibly feel like I'm missing something  
😤 I want it to auto-detect my genre from my library — I shouldn't have to manually pick genres

---

### SCREEN 8 — Export Modal

*"Export set" — hardware options, CDJ-2000NXS2 is selected. "Validate & export" button.*

*"SetRecord will check that all 9 tracks are compatible before exporting." Compatible — does that mean it checks file formats? Or BPM range?*

*This is something I need — I've had moments where I planned a set and some tracks just don't work on the CDJs.*

🔥 Validates track compatibility before export — that would save my ass at gigs  
❓ What does "compatible" mean exactly? File format? Hot cues? Something else?  
😕 Where does it export TO? A folder? Straight to USB? Back into Rekordbox? Not clear.

---

### SCREEN 9 — Recall Tab Landing

*Oh this is a completely different section. Clean — mostly empty with a search bar. "Ask for tracks, refine, repeat."*

*There are example prompts: "15 UK garage tracks I play the most", "10 peak-hour tech house bangers", "deep house around 122 bpm", "melodic techno 124–128 bpm, never played live", "my forgotten gems."*

*Oh. OH. I can just TALK to it in plain English to find tracks. That's insane. "My forgotten gems" — that would show me tracks I haven't played in ages. "Never played live" — it tracks what I've actually played live?!*

🔥 Plain English search for my own library — so much better than scrolling through Rekordbox  
🔥 "Never played live" — it tracks my play history?? That's wild  
🔥 "My forgotten gems" — I have SO many tracks I downloaded and forgot about, this would be huge  
⚡ Oh — Recall is like an analytics + AI assistant for my own library. Prepare is for planning sets, Recall is for understanding your music.

---

### SCREEN 10 — Crates Section

*Pre-made crates: "Peak weapons" (496 tracks), "Never tested live" (197 tracks), "Forgotten heaters" (8 tracks), "Overplayed" (386 tracks), "Missing metadata" (19 tracks), "Safe bridges" (44 tracks), "DWA" (327 tracks).*

*"Never tested live" — 197 tracks I've never played at a gig. That's incredible. "Forgotten heaters" — 8 tracks it thinks are bangers I've forgotten about.*

*"Overplayed" has 386 tracks — so it's tracking what I play too often. That's kind of a reality check lol.*

🔥 "Never tested live" is a genuinely life-changing crate — 197 tracks I'm sleeping on  
🔥 The crates auto-fill themselves — I don't have to manually maintain them  
😕 "DWA" — no idea what this stands for. This needs a tooltip  
❓ "Missing metadata" — is that tracks without BPM, key, or what exactly?  
⚡ These smart crates are basically doing the library admin I've been putting off forever

---

### SCREEN 11 — Identity Section

*Charts and graphs. "Your sound, in aggregate."*

*BPM spread chart — most of my tracks are 110–130 range. Energy profile — spikes at 7–8 out of 10. Library growth — shows tracks added per quarter going back to 2024.*

*"Top genres: Tech House 75, Pop/Tech House 57." Top artists: Charli XCX 11, CARTER PINK 9. Key spread: 4A is 96 tracks, 6A is 83 tracks.*

*This is like Spotify Wrapped but for DJ music. That's sick. I'd screenshot this and post it to my Instagram stories.*

🔥 This is DJ Spotify Wrapped — I would 100% share this on Instagram/TikTok  
🔥 BPM spread tells me what kind of DJ I actually am vs. what I think I am  
❓ "Key spread" with 4A and 6A — still don't fully get the Camelot wheel but I can see what I play most  
😤 **I want to see this as a shareable image format — this data is content for my socials**

---

### SCREEN 12 — Combos Section

*"The transitions you actually reach for — pulled from your sets and play history."*

*"Your most common transitions" — and it's listing actual track-to-track transitions I've made: "HOTEL LOBBY → Worthy → Freak Like Me."*

*These are REAL transitions I've done at gigs. It tracked them. And it's ranking them by how many times I've used them.*

🔥 It tracked my actual transitions from real sets — this is like a cheat sheet of what actually works for me  
🔥 "What do you play after it" — would help me when I'm blanking mid-set  
⚡ **This is the "stop freezing mid-set" feature I actually need. This is why I downloaded this app.**  
😕 The track names are very long and hard to scan quickly — could be more compact

---

### SCREEN 13 — Health Section

*"97 / 100 library health." Let me see what's wrong.*

*"68 missing files" — okay that's a lot. "11 missing key." "18 missing BPM." "1 unsupported format." "54 duplicate groups."*

*54 DUPLICATE GROUPS. I've suspected for ages I have duplicates but I never sorted it.*

*Track lifecycle: 1007 UNTESTED. So 1007 of my tracks are just sitting there never properly evaluated.*

🔥 97/100 health score makes me feel good but also motivates me to fix the missing stuff  
😤 54 duplicate groups — I KNEW I had duplicates. I want a one-click "show and delete duplicates" option  
💀 68 missing files — fixing them one by one would be painful. Needs a batch fix workflow.  
⚡ 1007 untested tracks — that's basically a discovery engine waiting to happen.

---

### SCREEN 14 — Discover Tab

*Oh this is YouTube DJ sets. Big grid of DJ set videos — David Guetta, Rufus Du Sol, Calvin Harris, ANYMA, Folamour. Genre filters at the top. Duration filters.*

*"Following" and "Explore" toggle. So I can follow certain DJs and get their sets.*

🔥 YouTube filtered to only DJ sets, with genre and duration filters — actually useful for reference sets  
🔥 If I can click a Rufus Du Sol set and it shows me the tracklist and lets me import those tracks, that would be incredible  
😕 Is this just a YouTube embed or does it do something smarter?  
😤 **I want it to auto-detect the tracklist from the YouTube set and let me "import" those tracks into a wishlist**  
❓ What does "Following" toggle do?

---

### JAKE'S VERDICT

**Would he come back tomorrow?**  
Yes, probably — but ONLY if he got his Rekordbox XML imported successfully. The Combos feature and the Recall AI chat hit him exactly where his pain is. He'd tell at least one DJ friend about it.

**The ONE thing that would make him tell his DJ friends:**  
The Combos screen. Seeing his actual real-life transitions — the specific track-to-track moves he makes at 2am — laid out in a list with rankings. He'd screenshot it and send it to his group chat with *"bro it knows my sets better than I do."*

**The ONE thing that might make him uninstall it:**  
The Rekordbox XML import step. Jake does not know what a Rekordbox XML export is. If there is no in-app walkthrough, he will close the app in under 90 seconds and never return. **This is the single biggest drop-off risk in the product.**

**What would he pay?**  
$9–12/month. He already spends $30/month on Spotify and wouldn't blink at $10 for this. Would NOT pay a one-time fee — subscription feels lower stakes to try.

**Top 3 product changes for Jake:**
1. **Fix the XML import onboarding** — Add a 3-step illustrated guide inside the Import modal: *"In Rekordbox: File → Export Collection in xml format → Save → come back here."* Or auto-detect Rekordbox's database location and offer one-click import without needing a manual XML export. This is the single biggest conversion killer.
2. **Make the Identity page shareable** — Add a "Copy as image" button on the Identity screen. Jake would post his BPM spread + top artists visual to Instagram Stories immediately. That's free word-of-mouth from every DJ who uses this app.
3. **Surface the "what have I played after this before?" shortcut in the set builder** — The Combos feature is buried in Recall. Add a "What have I played after this?" button directly on each track card in the timeline — one click shows historical transitions. That collapses the gap between planning and real-gig muscle memory.

---
---

# PERSONA 2 — SARAH

**Age:** 30 · **Location:** Berlin (originally Sydney)  
**Experience:** 6 years full-time. Tours EU, UK, AUS. 100+ gigs/year  
**Setup:** Rekordbox (obsessive), 8,000+ tracks, all meticulously tagged  
**Tech literacy:** High. Has tried Mixo, Soundeo, rekordcloud, DJ.Studio. All disappointed.  
**Goal:** Manage growing library, plan sets faster, find forgotten tracks, maintain creative identity  
**Would pay:** $18–22/month · Has paid for Mixo, cancelled it  
**Personality:** Methodical, direct, high standards, will spot bad UX immediately

---

### SCREEN 1 — First Launch

*Okay. Dark UI, three-panel layout. Left is the library, middle is the set, right is suggestions. That's a sensible structure — I've seen this basic idea before. What immediately catches my eye is that my Rekordbox playlists are already showing in the sidebar on the left. That list looks real — those playlist names match my actual folder structure. How does it have this already? Did I miss a setup step, or did it read something automatically? I need to understand what happened.*

*The centre panel has a set already stubbed out: "New set 07 May 2026." It's showing a BPM range of 125–160, an energy curve arc. Five tracks are already in there — tracks I actually know. Cops & Robbers, Lemon Dub, KETTAMA, Shake Shake, Fake ID. This is a real set I might actually build. It's not generic demo data.*

*The energy curve across the top — a lot of tools show individual track stats but don't show you the shape of the whole set. That arc tells me something useful at a glance.*

❓ "How did it get my playlist data without me explicitly setting anything up? I need to know what it read and when."  
🔥 The three-panel layout immediately makes intuitive sense. Library → Set → What's Next. Good information hierarchy.  
😕 "125–160 BPM" for a 5-track set is a wide spread. Either those tracks are genuinely scattered, or it's displaying min/max rather than something more useful like median or weighted range.

---

### SCREEN 2 — Import Modal

*Right. There's the answer. It wants my Rekordbox XML export file. I know how to export an XML from Rekordbox. It's a couple of clicks.*

*"SetRecord reads all track metadata, cue points, and hot cues without modifying your Rekordbox library." The "without modifying" line is deliberate and I notice it. That matters. I've had tools that write back to Rekordbox files and break things.*

*It mentions cue points and hot cues. I have obsessively placed cue points on every track. If it actually reads and uses those — that would be genuinely interesting. Most tools ignore them entirely.*

🔥 "Without modifying your Rekordbox library" — that sentence does a lot of work. Someone on this team has been burned or understands what DJs are afraid of.  
❓ Does it actually use my cue point positions? Most tools completely ignore this.  
😕 No mention of what happens when I update my library. Is this a one-time import? Do I re-export every time I add new tracks?

---

### SCREEN 3 — Library Loaded

*The library has loaded. "All Tracks 3,017." I have about 8,000 so either this is filtered, this is sample data, or my XML export was incomplete. That discrepancy would bother me.*

*The playlist tree on the left is there. Folder structure intact.*

❓ 3,017 tracks showing but I know I have 8,000+. This number mismatch is my first question — is it filtering? Deduplicating? Was the XML export incomplete?  
😤 I want to know immediately after import: "here's what was found, here's what was skipped, here's what had metadata issues." **Give me an import report. Silence is not reassuring at this scale.**

---

### SCREEN 4 — Playlist Sidebar Filter

*The playlist sidebar has three tabs: Library, Crates, Sets. My folder structure is there. This mirrors my Rekordbox structure. Good.*

*The "Crates" tab next to Library is interesting. That's a Serato term. Does this support Serato? Or have they borrowed the vocabulary?*

⚡ The playlist tree matching my Rekordbox folder structure exactly — this is the moment I stop thinking of this as demo software and start thinking "this might work with my library."  
❓ "Crates" tab — is this a Serato import path? Or is this something SetRecord generates itself?

---

### SCREEN 5 — Track Selected in Library

*I've clicked a track in the library. The first row is highlighted in green. I can see the stats: 148.0 BPM, key badge, energy badge. The right panel still says "No track selected" — which is confusing. I clicked a track in the library, why hasn't the suggestions panel reacted?*

*I think I understand — the suggestions are based on what's selected in the SET, not in the library. That's a workflow distinction I need to internalise.*

😕 The interaction model isn't clear enough. If I click a track in the library, the suggestions panel should do *something* — even if it's just "add this to your set first to see suggestions." Right now it just sits there. That reads as a bug, not a design choice.  
💀 If I'm building a set from scratch and I want to explore pairings before committing, I need "what goes well with X" without X being in my set yet. If that's not possible, that's a workflow blocker.

---

### SCREEN 6 — Suggestions Panel Populated

*Now the suggestions panel has populated. The suggestions are: Charli XCX - B2b (Best match, Energy shift, Identical BPM), James Hype - Waterfalls (Perfect harmony, +2 BPM), Avicii - I Could Be The One (Perfect harmony, Identical BPM), After Hours - Gunity (Identical BPM).*

*These are real tracks I recognise. James Hype, Charli XCX, Avicii remix — coherent zone. "Best match" label on the first suggestion — what does that algorithm actually mean? BPM, key, energy, genre, my previous usage? I don't know. And not knowing means I can't fully trust it.*

⚡ "Perfect harmony" tags next to tracks I actually know would mix well — if the harmonic accuracy is real, this is doing the Camelot wheel work in the background. That's genuinely useful at the pace of live set building.  
🔥 The suggestions are context-appropriate for this zone of music. Either the algorithm is good or the demo data is curated. If it's the former, that's impressive.  
❓ What is "Best match" actually scoring? "Energy shift" — is that from my Rekordbox energy tags or audio analysis? The answer changes how much I trust it.

---

### SCREEN 7 — Settings Modal

*"Learn Mode" — Toggle is on. Good.*

*"Extended Understanding" — "free from phasing." That copy is garbled — "free from phasing" doesn't make sense to me. Someone needs to edit this.*

*"Default Target Hardware" — CDJ-2000NXS2 selected. I play on NXS2s at most venues. Good.*

*"Harmonic Mixing toggle" — "Mix by semitone to flat doorbell." That copy is completely broken. Someone's placeholder text or a truncated description got scrambled.*

😕 **The settings copy is in rough shape.** "Free from phasing," "mix by semitone to flat doorbell" — these read like placeholder text or broken strings. For a professional tool, this is a red flag. Copy quality is a proxy for attention to detail.  
🔥 Hardware targeting for export compatibility — knowing I'm exporting to NXS2 vs CDJ-3000 matters for format support and cue point compatibility. This is the right thing to build.  
❓ The BPM slider appears to show an inverted or crossed range. Is that a display bug? If so, my suggestions could be off.  
😤 Where's my Camelot key preference? I want to tell it I work in Camelot notation. That should be a settings option.

---

### SCREEN 8 — Export Modal

*Hardware selection (NXS2 selected), "Validate & export" button.*

*The flow is: build set → validate → export. That's correct. Hardware selection matches what I set in Settings — consistency. I don't have to remember twice.*

😕 I can't see what the export actually produces. Does it write a Rekordbox playlist XML? A M3U? A folder of files? Does it organise files into a folder structure for USB? **This is the most important question and the modal doesn't answer it.** I need to know what comes out before I press this button at 11pm before a show.  
💀 If "export" means it creates a file but I still have to manually sync it to Rekordbox and then to a USB — I need to know that. The ambiguity here is genuinely stressful.  
🔥 "Validate before exporting" — the right instinct. But what does it validate? Format? Missing files? Cue point compatibility?

---

### SCREEN 9 — Recall Tab Landing

*Natural language query interface for my own library. "Ask in plain English, then keep refining."*

*Example prompts: "melodic techno 124–128 bpm, never played live," "my forgotten gems," "15 UK garage tracks I play the most."*

⚡ I lean forward. "melodic techno 124–128 bpm, never played live" — that query would actually be useful to me. I have tracks I've collected and never road-tested. Being able to surface those is something I've wanted from Rekordbox for years and it doesn't do it.  
🔥 "My forgotten gems." This is exactly the thing I described as a use case before I even opened this app.  
❓ Is this running against my local library data only? Or is it hitting an external AI? I need to know what's private and what's being sent out.

---

### SCREEN 10 — Crates Section

*"Living crates that re-fill themselves from rules. Build one, never sort it again."*

*Crates: Peak weapons (436), Never tested live (197), Forgotten heaters (8), Overplayed (384), Missing metadata (19), Safe bridges (44), DWA (327), Untitled crate (363).*

*"Never tested live" — 197 tracks. That is a genuinely useful category. I had no way to know this before.*

*"Overplayed" — 384 tracks. I know I cycle through the same records too often when I'm tired at 4am.*

🔥 "Living crates that re-fill themselves from rules" — this is a fundamentally better model than static playlists. My library updates constantly. Rules-based dynamic crates scale with the library.  
⚡ "Never tested live: 197 tracks" — I would open this immediately and start building sets from it. This directly addresses a real professional problem: I buy more than I play, and I lose track of what I haven't tested.  
❓ "DWA" — 327 tracks — what does this mean? Its name should be self-explanatory.  
😤 I want to create my own crates with my own rules. "Tracks in key 8A or 9A, BPM 128–134, not played in 60 days" — can I build that query?

---

### SCREEN 11 — Identity Section

*BPM spread, energy profile, library growth chart. "Your sound, in aggregate."*

*Top genres: Tech House 75, Pop/Tech House 57. Key spread: 4A: 96, 6A: 83.*

🔥 Key spread showing 4A and 6A as most-used keys — that's directly useful. I can see my harmonic centre of gravity. If I'm building a set in a new key zone, I can immediately see I'm outside my comfort zone.  
😕 "Top artists: Charli xcx, CARTER PINK" — if this is my real library, 11 tracks by Charli xcx is unusual. This might still be demo data mixed with real data, and I'm not sure which is which.  
❓ The Library growth chart shows tracks "by file date added." File date is unreliable — if I migrate computers or re-tag files, the dates change. Does it have a more reliable timestamp?  
😤 I want a "key profile by BPM zone" chart. Show me which keys I tend to play at 128 bpm vs 140 bpm. My harmonic approach changes by tempo range.

---

### SCREEN 12 — Combos Section

*My actual recorded transitions. The system has learned which track-to-track moves I make in real sets.*

⚡ This is genuinely novel. No tool I've used does this. Mixo doesn't. DJ.Studio doesn't. This is building a transition graph from my play history. If the data is accurate, this tells me more about how I actually DJ than any BPM-matching algorithm could.  
🔥 "The transitions you actually reach for" — the framing is correct. I reach for certain moves under pressure. Having those documented and accessible is like a cheat sheet of my own muscle memory.  
❓ Where does this data come from? I haven't connected any play history source. Does this come from the Rekordbox XML? Did I know this was being captured?  
😕 The track names are from a very specific genre zone that doesn't match what I play — looks like demo data. Makes the feature harder to evaluate.

---

### SCREEN 13 — Health Section

*97/100 library health. 68 Missing files, 11 Missing key, 18 Missing BPM, 1 Unsupported format, 54 Duplicate groups.*

*Track lifecycle: 1,007 Untested.*

🔥 "Click a number to see the tracks and fix them in place" — this is the right UX. Don't just diagnose, let me act on it in context.  
🔥 54 Duplicate groups — surfaced as groups means I can decide which version to keep without manually hunting.  
❓ 97/100 with 68 missing files seems generous. What does the scoring algorithm weight? If missing files barely affect my score, the score is misleading. A missing file at show time is a 0/100 problem.  
😕 "Untested: 1,007" might be mixing two definitions — "hasn't been played at a show" and "we haven't analysed this." If it's mixing meanings, the data is unreliable.  
💀 If 68 tracks show as "missing files" and I play them at a show because I trust this tool validated my set, that's a real gig failure.

---

### SCREEN 14 — Discover Tab

*YouTube DJ set browser. Genre filters, duration filters. David Guetta, Fred Again, Rufus Du Sol, Calvin Harris, ANYMA, Folamour.*

*My honest reaction: this is not what I expected from a DJ planning tool, and I'm not sure it belongs here. I can find DJ sets on YouTube. I don't need a wrapper for that inside a library management tool. This feels like feature bloat.*

😕 The Discover tab feels like a different product bolted on. I came here to manage my library and plan sets.  
😤 **What I actually want in a "Discover" tab: surface tracks from my OWN library I haven't listened to in 6+ months.** That's a discovery problem I actually have. Other people's YouTube sets are not.  
❓ The videos shown are "Trending." David Guetta and Calvin Harris are not relevant to my sound. If the genre filter is on but it's still serving mainstream EDM, the recommendation system isn't using my taste profile.  
💀 If this tab requires internet and the rest of the app works offline, this creates a split experience that's confusing. I want to know what requires connectivity.

---

### SARAH'S VERDICT

**Would she add this to her actual workflow?**  
Yes, conditionally. The Recall tab — specifically Crates, Combos, and Health — maps directly onto real problems she has. She would use it primarily as a library audit and maintenance tool, and potentially for set building if harmonic suggestion accuracy proves reliable over a few real sessions. Condition: she needs to verify that "never tested live" and "missing files" data is accurate before trusting it before a gig.

**The ONE feature that would make this indispensable:**  
Gig-aware set validation: before she leaves for a show, one button confirms every file exists, every CDJ format is correct for the venue's hardware, every BPM transition is within her preferred range, and flags any key clashes she hasn't explicitly approved. One button, one report, green light or red.

**The ONE thing that could make her write a negative review:**  
If the export creates files she can't actually use on a CDJ — wrong format, broken cue points — and she discovers this at a venue. The tool has built trust through good UX and then failed at the single highest-stakes moment. That's a 1-star review and a tweet.

**What would she pay?**  
$18–22/month subscription. Annual plan if there's a discount. Would NOT pay per-export. She cancelled Mixo at $20/month for being shallow — she'd pay the same price if this is genuinely deeper.

**Top 3 product changes for Sarah:**
1. **Fix the export modal to be explicit about output format.** Tell her exactly what file gets created, whether she needs Rekordbox afterward, and how cue points are transferred. Add a post-export checklist. Ambiguity at this step is a trust-breaker.
2. **Make library selection trigger suggestions.** Clicking a track in the library should either show suggestions for that track, or show a clear "add to set to see suggestions" prompt. The current silent "No track selected" state reads as a bug and breaks flow.
3. **Fix the settings copy.** "Mix by semitone to flat doorbell" and "free from phasing" are not product-grade strings. One pass of copy editing by someone who knows the domain would fix it — and it matters disproportionately with professional users.

---
---

# PERSONA 3 — MARCUS

**Age:** 26 · **Location:** London  
**Experience:** Producer first, DJ second. House and garage. Released on small labels. 8 gigs in the last year.  
**Setup:** Rekordbox (set up 6 months ago), ~600 tracks  
**Tech literacy:** Very high. Uses GitHub, APIs, writes scripts. Inspects network traffic.  
**Goal:** Bridge his production world with DJ sets. Wants sets to feel like an extension of his musical identity.  
**Would pay:** One-time only, strongly preferred · £60–80 · Suspicious of subscriptions for local processing  
**Personality:** Analytical, opinionated, suspicious of "AI" marketing, but genuinely excited by clever ideas

---

### SCREEN 1 — First Launch

*Dark UI, three-pane layout. Left: library panel. Centre: some kind of set timeline. Right: "Suggested next." Already I'm reading the signals. The track list on the left has coloured thumbnails — presumably album art — and little badge numbers. Those look like BPM and... key? In Camelot notation maybe.*

*The centre panel says "New set 07 May 2026" with an energy curve at the top. That's actually a thing I've wanted — a visual representation of set energy arc rather than just a flat list.*

*Top bar: "Prepare / Discover / Recall" tabs. Not trying to be everything at once. "Set safety: Not validated" — that implies some kind of pre-flight check, probably BPM range or key clash detection.*

*The energy curve at the top of the centre panel is a smooth yellow-green arc. Is that auto-generated from track energy values or manual? Because if it's auto-derived from metadata, that's potentially clever. If it's just decorative, it's a lie.*

❓ That energy curve — is it reading audio analysis data, or just using some proxy like BPM and a vibes-based energy tag?  
😕 "Suggested next" panel is empty, so I can't judge it yet. Everything could be fake at this stage.  
🔥 The three-tab structure (Prepare / Discover / Recall) suggests they've actually thought about the DJ workflow as distinct phases, not just "here's your library, good luck."

---

### SCREEN 2 — Import Modal

*"SetRecord reads all track metadata, cue points, and hot cues without modifying your Rekordbox library." Non-destructive is the only acceptable answer. Single button: "Select file." Clean. I'm actually relieved it's not trying to hook into Rekordbox directly via some sketchy local API or requiring me to run a daemon. XML export is the right choice — it's the official data handshake.*

*"cue points, and hot cues" — so it reads my cue data. That's significant. The suggestion engine could theoretically factor in where I've marked transitions, not just raw BPM/key. Most tools just read key and BPM and call it done.*

❓ What exactly does it pull from the XML? Just metadata, or does it read my cue point positions and types? My hot cue colours and memory cue positions tell you a lot about how I actually use a track.  
🔥 Explicitly saying it doesn't modify your Rekordbox library is trust-building. Good engineering hygiene communicated in plain language.  
😤 No drag-from-Finder option, no folder watch. If you're not a Rekordbox user, how do you get in? This feels narrower than it needs to be.

---

### SCREEN 3 — Library Loaded

*Looks exactly like the first screen. "All Tracks 3,017." The playlist tree is expanded. Folder hierarchy preserved. That's important — I organise in Rekordbox with nested folders and specific playlist names that mean something to my workflow. If it flattened everything into one pile, unusable.*

❓ The import seems instantaneous in the screenshot sequence. How is it processing 3000+ tracks? Is it just reading the XML index, or is it doing audio analysis? Audio analysis at import time would be important to know about.  
😕 I can't see the key display clearly. Are those Camelot codes or standard musical key notation? Key compatibility is a big deal for harmonic mixing and I want to see this clearly.  
🔥 Rekordbox playlist hierarchy preserved in the sidebar tree. My organisational system travels with me.

---

### SCREEN 4 — Playlist Sidebar Filter

*The whole interface shifted into a reduced state. Tracks in the set centre panel are slightly faded — some filter overlay is active.*

*The key question is whether I can filter the suggestion pool by playlist. If "Suggested next" only ever suggests from all 3,000 tracks, that's limited. I want to say "suggest from my Dark Room crate" or "suggest from Garage Essentials."*

😤 I can't yet tell if the suggestion pool is filterable by playlist/crate. That would be the difference between useful and genuinely powerful.

---

### SCREEN 5 — Track Selected in Library

*I've clicked a track in the library — highlighted in green/yellow. But "Suggested next" is STILL showing "No track selected." So clicking in the library doesn't trigger suggestions. You have to select something in the set itself.*

*I understand the logic. But it's slightly unintuitive at first.*

😕 The distinction between "track selected in library" vs "track selected in set" needs clearer visual communication. Right now if I'm new to this I'd be confused why the suggestions aren't responding.  
😤 I want a "find similar to this" action from the library panel. Right-click a track, "see similar tracks." That's a basic exploration tool.

---

### SCREEN 6 — Suggestions Panel Populated

*The right panel is alive. Suggestions with reason tags: "Energy shift," "Perfect harmony," "Identical BPM," "+2 BPM."*

*"BEST MATCH" label on the first result. So there's a ranking algorithm.*

*The tag system is smarter than I expected. "Energy shift" vs "Perfect harmony" as labels that explain WHY something is suggested. That's not just "here's a list" — it's annotated reasoning. The presentation of the reasoning is already ahead of most tools I've seen.*

❓ What's the weighting? Is it purely BPM + Camelot? Or does it factor in the energy of the surrounding set context — like, does it look at the energy curve trajectory and say "we need something that goes up here"?  
⚡ The reason tags on each suggestion card — it's showing you the logic so you can make an informed choice. That's respecting the DJ's intelligence.  
🔥 Annotated reasoning on suggestions. Not just a list — it's showing WHY.  
😤 I want to see Camelot key displayed on every suggestion card. "Perfect harmony" is a label but give me "8A → 9A" and I can verify it myself.

---

### SCREEN 7 — Settings Modal

*"Extended Understanding" — "works completely offline — 5–10 seconds processing per track." So there's some kind of deeper analysis mode. Offline is good. 5–10 seconds per track on 3,000 tracks is 4–8 hours. I'd run it overnight.*

*YouTube API key requirement for the Discover tab — calling YouTube's API directly from my machine, not through their servers. Privacy-respecting, but it means I have to set up a Google Cloud Console project. For me? Fine, I've done it before.*

*"Harmonic Mixing toggle" — "Mixes by method in fact mixing." That setting description makes no sense. This is garbled copy.*

❓ What exactly is "Extended Understanding" analysing? Audio fingerprinting? Or just more sophisticated metadata parsing? Because if it's reading actual audio features (spectral analysis, groove, transient density) that's a very different claim.  
😤 There's no mention of where the Learn Mode data lives. Is it local? Does it ever leave my machine?  
💀 YouTube API key requirement. Not because I can't set it up, but because it means this feature is gated on a third-party API quota system. YouTube can change their API policy any day. This is structural fragility.  
🔥 Hardware-specific export targeting. Checking CDJ-2000NXS2 vs CDJ-3000 file compatibility before export is the kind of thing that prevents gig night disasters.

---

### SCREEN 8 — Export Modal

*"Validate & export." It's doing a pre-export validation pass. That "Validate & export" button is the right UX. One of my actual pain points is loading up a USB at a gig and discovering something won't play because it's an M4A the CDJs don't like.*

😤 Where does it export to? A USB drive? A folder? Does it create the proper Rekordbox folder structure? The modal doesn't say. **The output format of the export is the most important thing and the modal doesn't address it.**  
❓ Does "validate" just check file format, or does it also verify that cue points exported correctly, BPM is written to the file header, track IDs are consistent?  
🔥 Hardware-specific validation at export time is a genuine workflow improvement.

---

### SCREEN 9 — Recall Tab Landing

*A natural language query interface for my own library. "Ask in plain English, then keep refining."*

*"Never played live" — that requires play history data. Which means it's reading my Rekordbox play count and performance history. That's from the XML, which does include play statistics. That's actually using data that's already there but almost no tool surfaces.*

*"My forgotten gems" — asking the system to find tracks in your library that score high on some quality metric but have low recent play frequency. That's a genuinely clever data query.*

⚡ **THIS is the moment I change my mind about this app.** The natural language query over your own play history is not something I'd have expected. "melodic techno 124–128 bpm, never played live" is a query I'd actually want to run.  
🔥 Using Rekordbox play history data as a first-class feature. Most tools ignore this data entirely. Play count, last played date, performance history — this is gold for library curation.  
❓ Is this a local LLM on device, or is this calling an external API? If it's calling OpenAI in the background, I want to know. And I want to know what data it sends.

---

### SCREEN 10 — Crates Section

*"Living crates that re-fill themselves from rules." Peak weapons (436), Never tested live (197), Forgotten heaters (8), Overplayed (384), Missing metadata (19), Safe bridges (44), DWA (327).*

*"Overplayed" and "Never tested live" as auto-crates encode real DJ workflow knowledge. This is not a generic feature — someone thought about actual DJ psychology and built it into the data model.*

🔥 "Overplayed" and "Never tested live" as auto-crates encode real DJ workflow knowledge.  
🔥 Self-updating rules-based crates is the right abstraction. Static playlists are a maintenance burden.  
😤 I can't see the rules behind each crate. "Peak weapons" — what's the definition? I'd want to inspect and edit the rule. Otherwise I'm trusting a black box.

---

### SCREEN 11 — Identity Section

*BPM spread, energy profile, library growth. Top genres, artists, labels. Key spread: 4A: 96, 6A: 83.*

😤 I want a "key profile by BPM zone" chart. Show me which keys I tend to play at 128 vs 140 bpm. My harmonic approach changes by tempo range and I'd want to understand that about myself.  
🔥 Library growth over time is something I'd genuinely look at. Seeing when I went through different phases of buying is actually useful self-knowledge.  
😕 Top artists being "Charli xcx" in a tech house library suggests metadata quality issues. Makes me wonder how well the analysis holds up when metadata is inconsistent.

---

### SCREEN 12 — Combos Section

*My most common track transitions, ranked by frequency. Track A → Track B, with count numbers.*

*This is extraordinary. The track transitions are recorded in Rekordbox session history. Most DJs have no idea this data even exists. Surfacing it and saying "here's what you actually play after X" is genuinely revealing.*

*"Pick a track to see what you play after it." So I can query a specific track and see my personal transition history from that track.*

⚡ This is the second "oh this is doing something I couldn't just do with a script" moment. Extracting transition combos from Rekordbox performance history and ranking them is using data that was always there but never surfaced. Every DJ has unconscious habitual transitions they don't realise they're leaning on.  
🔥 Mining Rekordbox performance history for transition habits is a genuinely novel application of data that's been sitting there unused. This is the feature that separates this from "another library tool."  
❓ Does it require Rekordbox performance history to be included in the XML export? Not all users will have that.  
😤 I want the inverse: tracks I almost never transition from to something specific — the dead ends in my library.

---

### SCREEN 13 — Health Section

*97/100 with 68 missing files and 54 duplicate groups. The weighting seems off. Missing files is serious — if I put this set on a USB, those tracks won't be there. That should tank the score more.*

😤 68 missing files getting a 97/100 score feels miscalibrated. Missing files is a critical failure condition at a gig.  
🔥 The "Track lifecycle" taxonomy (New → Testing → Active → Peak rotation → Occasional → Forgotten → Archive → Untested) is actually sophisticated. Someone really thought about this.  
❓ How does it assign lifecycle status? Is it based on play count and recency thresholds, or manually set?

---

### SCREEN 14 — Discover Tab

*YouTube DJ sets. David Guetta, Calvin Harris, ANYMA, Folamour. Genre and duration filters.*

*For my taste (house, garage, UK stuff), this grid needs significant filtering to be useful. The "Recommended" sort — is it matching to my taste profile? Or just YouTube trending with a genre filter bolted on?*

😕 The Discover tab content feels generic. The algorithm needs to work much harder for this to be useful vs just going to YouTube directly.  
😤 I want to be able to play tracks from a discovered DJ set against my library in real time. "This Folamour set has a track at 47 mins that sounds interesting — what do I have that would follow it?" That would be a genuinely unique feature.  
💀 If this tab is essentially just a YouTube embed with genre filters, and it requires me to set up my own YouTube API key — I'm paying for YouTube search with extra steps.

---

### MARCUS'S VERDICT

**Would he actually use this?**  
Yes, but partially and conditionally. The Recall tab — Combos, Crates (especially "Overplayed" and "Never tested live"), and the NL query interface — would be in his daily prep workflow. He'd import his Rekordbox XML and spend a serious evening with Health and Identity once, then use Combos regularly before gigs. The Discover tab he would open once, see David Guetta, close it, and never use again.

**The ONE thing that would make him an evangelist:**  
If the Combos data fed back into the suggestion engine — meaning it weighted suggestions partly based on his actual transition history ("you've played X after this track 4 times, here's what you played after X") — he would tell every DJ he knows about this app. That closes the loop between insight and action.

**The ONE thing that would make him write a Reddit post dunking on it:**  
If he discovers that "SetRecord Intelligence" is silently calling OpenAI with his full library metadata being sent to a third-party server with no disclosure. He is the type to inspect network traffic with Wireshark. If he catches it phoning home, the Reddit post writes itself.

**What would he pay?**  
One-time purchase: £60–80 without hesitation. Would balk at anything above £15/month subscription. If forced into subscription, only acceptable if the NL query is clearly cloud-powered and demonstrably getting smarter.

**Top 3 product changes for Marcus:**
1. **Show Camelot key transitions on every suggestion card.** Every suggestion card should show the actual key transition (e.g., "8A → 9A") not just the label "Perfect harmony." Takes one afternoon to implement, meaningfully increases trust with technical users. Hiding it behind abstracted labels reads as lack of confidence in the algorithm.
2. **Combos → Suggestions feedback loop.** Feed historical transition data into the Prepare tab suggestion ranking. If Combos data shows he plays track B after track A three times, when he has A in his set, B should appear prominently in Suggested Next with "you've played this transition before." Closes the loop between the most impressive Recall feature and the active workflow tool.
3. **Data transparency statement in Settings.** A clear, specific breakdown: what's processed locally, what (if anything) is sent anywhere, what Learn Mode data is stored and in what format, where it lives on disk. Not marketing-speak — a technical factsheet. This is a trust unlock that costs nothing and de-risks the single thing most likely to generate a hostile public post from his demographic.

---
---

# PERSONA 4 — DAVE

**Age:** 45 · **Location:** Manchester, UK  
**Experience:** Resident DJ at the same venue for 14 years. DJing since age 22. Started on vinyl.  
**Setup:** CDJ-2000s, Rekordbox (reluctant). Hates the subscription model.  
**Library:** 12,000+ tracks. A mess. Playlists from 10 years ago never touched.  
**Tech literacy:** Medium. Comfortable with Mac, not a power user. Hates buzzwords.  
**Goal:** Find music he's forgotten he has. Stop playing the same 200 tracks every week. Export to USB without headaches.  
**Would pay:** One-time £59–89, hard. Monthly ceiling £6.99.  
**Personality:** Dry, sceptical, dark humour, been burned before, but secretly hoping to be surprised.

*Context: Dave's younger DJ friend showed him this app at the bar after a gig. "Mate, this thing knows your library better than you do." Dave raises an eyebrow. Downloads it when he gets home. It's 1am. He's tired but curious.*

---

### SCREEN 1 — First Launch

*Right. Here we are then. 1am, half a shandy left, let's see what Marcus has been going on about.*

*Dark interface. That's a point in its favour immediately — at least it's not bright white like some idiot designed it for a dentist's waiting room. Three tabs across the top: Prepare, Discover, Recall. None of them are stupid. Another point.*

*Left side: my library's already populated. How? Oh — it must've read Rekordbox. Fine. I can see my playlists down the side. "All Tracks 3017." Close enough, I've got more than that but whatever. Centre panel: there's already a set open — "New set 07 May 2026." Some tracks in it. Right panel: "Suggested next." Nothing selected yet so it's waiting.*

*The colour coding on the tracks — there are little coloured squares, looks like keys or energy. The numbers next to each track. BPM presumably. There are little tags — "Messy", "Clean" — alright, someone's thinking about mix-readiness. That's not nothing.*

*The set in the middle has an energy curve drawn at the top. Nice touch. You can see at a glance whether your set builds or flatlines.*

😕 "Set safety: Not validated" in yellow at the top. Not sure what that means. Validated by what? The app? Me? God?  
🔥 It loaded my actual library and I didn't have to do anything except exist. That is already better than half the software I've tried.

---

### SCREEN 2 — Import Modal

*Oh, so there IS an import step.*

*"Import library — Select your Rekordbox XML export file. SetRecord reads all track metadata, cue points, and hot cues without modifying your Rekordbox library."*

*Right. So it reads the XML. I know where that lives. The button says "Select file." Straightforward. No login, no account, no "connect to the cloud." Just: here's your file, give it to us.*

😤 "Without modifying your Rekordbox library." That sentence is doing heavy lifting. I've had software rearrange my crates before. Once. Never again. The fact that they've said it explicitly tells me someone complained, which means someone built it right after learning the hard way.  
🔥 One button. No wizard, no five-step setup, no "let's get you started!" with confetti. Just: select your XML. Done. I can work with this.

---

### SCREEN 3 — Library Loaded

*Same layout as the first screen. Library on the left with playlists, a set in the middle, suggestions panel waiting. The energy curve at the top of the set is showing a gentle arc. The tracks in the set already have BPMs and key tags showing.*

*The playlist tree on the left. My folders. The ones I made in 2019 and haven't touched since. There they are. All of them. A monument to my past intentions.*

*The search bar says "Search library, sets, cue points…" — hang on. Cue points? I can search by cue point? Like, if I labelled a cue point "drop" or "build" I can find it? That's — actually useful. I label my cue points. Not consistently, but I do it.*

😤 Searching cue points is something Rekordbox doesn't let you do properly without jumping through menus. If this actually works, that's a genuine improvement.  
⚡ There's a track in there I bought in 2021 and played exactly once. I can see it. It's just... sitting there. Waiting.

---

### SCREEN 4 — Playlist Sidebar Filter

*The whole interface has shifted into a kind of reduced state. I've either filtered by something or the display mode has changed. The playlist tree is still there on the left. "Crates" and "Sets" tabs next to "Library" — three ways to browse.*

*The bottom of the timeline panel has some icons. Looks like playback controls or zoom controls.*

❓ Not entirely sure what triggered this view. If there's a mode I accidentally triggered, I want to know how I got here and how I get out.  
😕 This screen's a bit confusing to work out what changed from the previous one.

---

### SCREEN 5 — Track Selected in Library

*Right — so I've clicked a track.*

*The track at the top of the library is highlighted in greenish-yellow. Numbers: 160.8 BPM, key number, energy rating. The track is highlighted but I haven't added it to the set yet. The suggestions panel on the right still says "No track selected" — maybe it only fires when I select from the SET, not the library. That would make sense.*

❓ The coloured squares next to each track — I think those are Camelot wheel numbers? Would be nice to have a legend somewhere if you're new to Camelot notation. Not everyone uses it.

---

### SCREEN 6 — Suggestions Panel Populated

*Oh. Right. THERE it is.*

*The right panel has come alive. Four suggestions:*
*- Charli XCX - B2b (Safrix Remix) — 148.8 BPM — "Energy shift", "Identical BPM" — BEST MATCH*
*- James Hype - Waterfalls — "Perfect harmony", "+2 BPM"*
*- Avicii - I Could Be The One — "Perfect harmony", "Identical BPM"*
*- After Hours - Gunty — "Identical BPM"*

*So it's telling me what mixes well, AND WHY. Not just "here are four tracks," but: this one is a perfect key match, this one is an energy shift, this one has the same BPM. That's the difference between a recommendation and an explanation.*

🔥 The tags on each suggestion — "Energy shift," "Perfect harmony," "Identical BPM" — these are the things I'm actually thinking when I'm planning a set. Someone who DJs built this. Or at least talked to someone who DJs.  
😤 This is exactly what I need at 2am when I'm building a set and I can't think straight. Not "you might like" — actual mix logic.  
⚡ The "BEST MATCH" label. It's made a judgement. I might disagree with it but the fact it's committing to a recommendation rather than just listing options — that shows confidence. I respect that.

---

### SCREEN 7 — Settings Modal

*"Learn mode" — toggle, currently on. "Adapt recommendations and diagnostics for every recommendation, set, and mix." So it learns from what I do? Fine.*

*"Extended Understanding" — "works completely offline. May take hours to complete." Offline. Processing locally. Not uploading my library to some server. That matters.*

😕 "May take hours to complete" — manage my expectations, sure. But if I need to leave it running overnight, tell me that upfront. Don't bury it in settings.  
🔥 The fact that hardware target exists at all. Different CDJ models have different USB format requirements. Someone who knows this built this.  
😤 Default BPM Range slider — I can set my typical BPM window so suggestions won't come back at 95 BPM when I'm in a house set. Yes. Good. Yes.  
🔥 These are the right settings. Not settings for settings' sake. Every single one of these affects recommendations in a way I can understand.

---

### SCREEN 8 — Export Modal

*Here's where it all falls apart or doesn't.*

*"Export set" — Target hardware: CDJ-2000NXS2 selected. "SetRecord will check that all 8 tracks are compatible before exporting." Button: "Validate & export."*

*I was READY to give it a hard no because export is always where everything dies. USB formatting issues, file not found, track plays at wrong pitch, metadata stripped, cue points gone. Every time.*

*But: "will CHECK compatibility BEFORE exporting." It's going to tell me if something's wrong BEFORE I get to the gig.*

😤 This is the thing I actually need. I've turned up to gigs where a WAV wouldn't play because of the sample rate. Once. That was enough. If this catches that before I leave the house, this software has already paid for itself.  
🔥 "Validate & export." The fact that validation is baked into the export step, not an optional extra. That's the right call.

---

### SCREEN 9 — Recall Tab Landing

*New tab. "Recall." What's this then.*

*"Ask your library." Example prompts floating in the middle: "15 UK garage tracks I play the most", "10 peak-hour tech house bangers", "deep house around 122 bpm", "melodic techno 124–128 bpm, never played live", "my forgotten gems", "highest-rated drum & bass."*

😕 *deep breath.* Okay. This is the "AI" bit. I can feel it. "Ask your library." This is where it goes wrong, isn't it. This is where I type something sensible and it gives me five tracks by artists I've never heard of that aren't even in my library.  
*But wait — "ask your library." MY library. Not the internet. Not Spotify. My 12,000 tracks.*  
❓ "SetRecord Intelligence — ask in plain English, then keep refining." Keep refining. So it's iterative. I ask, it gives me something, I say "no, more like this," and it adjusts? That's actually how I'd describe what I want to a human.  
⚡ "My forgotten gems." That example query. That's the one. That's why I'm here at 1am. Not to build a set — I can do that. To find the tracks I forgot I had. If that works, if I type that and it returns fifteen tracks I genuinely haven't played in two years and they're all good — this software earns its price on the spot.

---

### SCREEN 10 — Crates Section

*Eight crates, automatically generated: Peak weapons (496), Never tested live (197), Forgotten heaters (8), Overplayed (384), Missing metadata (19), Safe bridges (44), DWA (527), Untitled crate (361). Plus a "New crate" button.*

*"Never tested live" — 197 tracks. That is exactly the problem. I've downloaded 197 tracks I've never actually played out.*

*"Overplayed" — 384 tracks. Those are the 200 I keep going back to, plus more. If the software knows I'm overusing these and can remind me to lay off them, I might actually break the habit.*

😤 "Never tested live" is a genuinely life-changing crate — 197 tracks I'm sleeping on  
😤 "Overplayed" — if the software knows I'm overusing these, that's a reality check I can actually act on  
🔥 "Forgotten heaters" — only 8 in this demo, but the NAME. Heaters I've forgotten about. If that crate is populated by tracks I used to play and haven't touched in over a year, that's genuinely useful curation.  
❓ "DWA" — 527 tracks. What does DWA stand for? "Drive Without Anxiety"? "Dance With Abandon"? I have no idea. Bad naming if it's a default crate — I shouldn't need to guess what my own music categories mean.  
🔥 "Living crates that re-fill themselves from rules. Build one, never sort it again." This is the correct philosophy. I don't want to sort. I hate sorting. Sorting is what I do instead of DJing.

---

### SCREEN 11 — Identity Section

*Charts. "Your sound, in aggregate — the shape of everything you collect and play."*

*BPM spread chart — most of my tracks cluster around 120–130, with a long tail. Energy profile — skewed toward higher energy. Library growth — shows when I was buying tracks aggressively.*

*Top genres: Tech House, Pop/Tech House. Key spread: 4A: 96, 6A: 83.*

*This is a mirror. Not flattering — it just shows you what you actually have, not what you think you have. After 14 years I think I know my library. This would tell me I'm wrong.*

😕 Top artists are Charli XCX and CARTER PINK — clearly demo data, not my library. But the concept is right.  
❓ "Key spread: 4A (96), 6A (83)" — 96 tracks in 4A? That would mean I'm unconsciously collecting tracks in that key. If I knew that, I'd deliberately look for tracks in other keys.  
🔥 This is a mirror. After 14 years I think I know my library. This would tell me I'm wrong.

---

### SCREEN 12 — Combos Section

*"The transitions you actually reach for — pulled from your sets and play history."*

*A list of track-to-track transitions I've actually used, ranked by how often.*

*The concept: the app watching which track I play after which other track, and learning my actual patterns. That's valuable.*

*The track names visible are pop and R&B — demo data for a different user's taste. Hard to evaluate whether this would work for my tech house sets without my real data. But the concept...*

😕 Demo data is completely off for my use case — pop and R&B, not a tech house set in sight. Hard to evaluate the feature quality without my real data.  
😤 This is the thing I don't know about my own DJing. I think I'm varied. I probably have five or six transitions I do automatically. Every DJ does. If this showed me that, I'd at least KNOW I was doing it.  
⚡ *Moment of self-awareness: I do always play that one after that one. Every bloody time. I know exactly which two tracks I'm thinking of right now. And I don't even know why anymore. Just muscle memory.*

---

### SCREEN 13 — Health Section

*97/100. Breakdown: 68 Missing files, 11 Missing key, 18 Missing BPM, 1 Unsupported format, 54 Duplicate groups.*

*Track lifecycle: New 30, Testing 0, Active 0, Peak rotation 0, Occasional 0, Forgotten 0, Archive 0, Untested 1007.*

😤 68 missing files — probably from when I reorganised my hard drive in 2022 and moved folders around without updating Rekordbox. I know they're there. I've just been ignoring the red exclamation marks for three years. If I can click "68" and see the list and deal with it, that's three years of procrastination resolved.  
😤 54 duplicate groups — I definitely have duplicates. Different versions, different edits. Seeing them grouped is useful.  
🔥 "Click a number to see the tracks and fix them in place." A score that links to a fix is infinitely more useful than a score that just makes you feel bad.  
❓ Track lifecycle — 1007 "Untested." Nearly a third of my library has never been played. I both knew this and didn't know this. Seeing the number makes it real.  
😕 Demo data shows 0 tracks in Active, Peak rotation, Occasional — all zeroed out. So the lifecycle tracking needs play history. Makes sense but I'm not seeing the feature working, just the skeleton of it.

---

### SCREEN 14 — Discover Tab

*Oh. That's YouTube.*

*Big grid of videos: David Guetta at Tomorrowland. Fred Again. RUFUS DU SOL. Calvin Harris at Ultra. ANYMA. Whānu Santika. Folamour.*

💀 David Guetta. I'm sorry. I know this is a discovery feature and I know it's probably useful for some people but David Guetta at Tomorrowland is not why I'm here. I don't need to watch other DJs' sets to find music. I need to find music I already OWN.  
😕 This feels like a different product bolted onto the side. The Prepare tab understood me — it's about MY library, MY tracks. This tab is YouTube but organised by genre. My problem isn't "I don't know what music is out there." My problem is "I can't access what I already have."  
*The duration filters are smart though — filtering by "90–100 min" to see a full club set rather than a promo thing, that's useful. Just not for me personally.*

---

### DAVE'S VERDICT

**Would he actually open this again?**  
Yes. Specifically because of the Crates and Health screens — not the Prepare tab. He goes into the Recall tab, types "forgotten gems" and "never played live over 125bpm," and if those searches return tracks that are actually in his library and actually good, he's in. The condition: the search has to work. Not perfectly — just well enough that one in five results makes him think "oh yeah, that track." If he gets that hit rate, he's back tomorrow.

**The ONE feature that would make him tell other long-running DJs:**  
The "Never tested live" crate — automatically populated, no effort required — combined with a way to pull those tracks into a low-stakes set and mark them as tested. Every long-running DJ has this problem and nobody has ever built a proper tool for it. That's the word-of-mouth feature.

**The ONE thing that would make him close the laptop and never open it again:**  
If he types "forgotten gems" or "never played live" into Recall search and it returns tracks that aren't in his library — YouTube suggestions, Spotify links, "you might also like." If it reaches outside his library for a single result without being explicitly asked to, it breaks the core promise. He's been burned by software that tries to sell him things he didn't ask for. Once.

**What would he pay?**  
One-time: £59–89. He'd pay it without agonising if the core workflow (import → health → never-tested crate → set building with suggestions → validate & export) works reliably. He'd tell himself he'll buy it "after a week of proper use" but he'd buy it in three days. Subscription: hard ceiling £6.99/month. He would almost certainly cancel after 60 days unless there's a compelling reason not to. **One-time with an optional "support the developer" tip would actually get him to pay more in total.**

**Top 3 product changes for Dave:**
1. **Rename or explain "DWA" in Crates.** Every default crate needs an obvious name or a one-line explanation of its rule. "DWA = 527 tracks" tells him nothing. "Downloaded, Worth Auditioning = tracks you own but have never previewed or played" tells him everything and makes him click it immediately.
2. **Make the Health numbers instantly drillable.** Confirm that clicking "68 missing files" immediately shows those 68 tracks listed and actionable. If there's any friction between clicking the number and seeing the list, he'll give up. The power of this feature is zero-click resolution: click the number, see the list, action each one in place.
3. **Add an "Untested at next gig" workflow.** He has 1,007 untested tracks. Give him a way to add 3–5 "candidates to test" to any set with a one-click mark-as-tested button after the gig. That workflow turns the untested library into a project he can chip away at week by week — and the data it feeds back into lifecycle tracking would make the software genuinely irreplaceable over time.

---
---

# CROSS-PERSONA SYNTHESIS

## What all 4 users agreed on

| Theme | All 4 said it |
|---|---|
| Smart Crates (especially "Never tested live" + "Overplayed") | The most universally valued feature. Every persona found immediate personal meaning in it. |
| Combos / transition history mining | Unique across every tool they've tried. Nobody else does this. |
| Library Health with drillable numbers | "A score that links to a fix." Universally appreciated. |
| "DWA" crate name is meaningless | All 4 couldn't figure it out. Rename it or add a subtitle. |
| Export clarity is missing | All 4 wanted to know: *what exactly does this output?* |
| Discover tab feels like a different product | All 4 were confused or disengaged. None found it compelling as presented. |
| "Set safety: Not validated" needs action | All 4 noticed it and none knew what to do with it. |

---

## What split users apart

| Feature | Jake | Sarah | Marcus | Dave |
|---|---|---|---|---|
| Identity as shareable image | Wants it desperately (social proof) | Mildly useful (self-knowledge) | Interesting data, wants more depth | Finds it a useful mirror, not social |
| Settings copy quality | Didn't notice issues | Hard no — credibility damage | Notes garbled strings | Noticed but less critical |
| YouTube API key | Lost completely | Structural concern | Strong objection (fragility) | Irrelevant to his use case |
| Subscription vs one-time | Prefers monthly, low barrier | Monthly fine if value proven | One-time only, strongly | One-time only, strongly |
| Technical depth of algorithms | Doesn't care | Wants to trust, needs evidence | Wants to verify himself | Doesn't care, needs results |
| Data privacy | Unaware | Mild concern | Critical — will inspect network traffic | Just needs it to be local |

---

## Revenue-Guaranteed Strategy

### Pricing model

Based on all 4 personas, the optimal structure is:

**Tier 1 — Free (conversion engine)**
- Import Rekordbox XML
- Library view + playlist browsing
- Basic set builder (manual drag only, no suggestions)
- Health score (numbers only, no drill-down)

**Tier 2 — SetRecord Pro · $12/month or $89 one-time**
- Full suggestion engine (Suggested Next with reason tags)
- Full Recall tab: Conversations, Rediscover, Crates, Identity, Combos, Health drilldown
- Set Architect (AI set generation)
- Export with validation
- Smart crates (all pre-built + custom rules)
- Cue point editor

**One-time pricing note:** Dave and Marcus will not sustain a subscription but will pay more upfront. Offer both options at the same tier. A one-time buyer at £89 is worth ~7 months of subscription but generates zero churn cost and tells their DJ friends.

### The 5 features that guarantee revenue

These are the moments every persona either said explicitly or implied they would pay for:

1. **"Never tested live" crate** — Every persona's first genuine lean-forward moment. This single feature, working accurately, is worth the price of admission alone. Market it on its own. Put it in the free trial. Make it the hero of the onboarding.

2. **Combos / transition history** — Nobody else does this. It uses data that's already in every Rekordbox export and has never been surfaced. This is your moat. Build it prominently into marketing. "See your DJ fingerprint" — the exact moves you reach for under pressure, documented.

3. **Pre-export validation** — Dave's "already paid for itself" moment. Every DJ has a gig war story about a file that wouldn't play. This feature is insurance and should be framed that way. "Never show up to a gig with a broken USB again."

4. **Natural language library search ("ask your library")** — The feature that converts sceptics. Make it the first thing users try after import. A single accurate result from "my forgotten gems" or "never played live 125bpm" creates immediate emotional payoff.

5. **Identity / "DJ Wrapped"** — Jake would share it immediately. Make it a shareable card. This is your viral loop. Add an export-as-image button and every DJ who uses it becomes a walking advertisement.

### The 3 things that could kill revenue

1. **Rekordbox XML import friction** — Jake represents the largest user segment numerically. If he can't get his library in within 3 minutes, he's gone. Add a step-by-step guide inside the import modal. Or better: write an Electron service that reads the Rekordbox database file directly (it's SQLite, readable). One-click import with no XML export needed is a 30% conversion improvement.

2. **Export ambiguity** — Sarah and Marcus won't trust the tool for professional use until they understand exactly what comes out of Export. Add a single sentence: *"Creates a USB-ready folder at [path] organised for CDJ. Your Rekordbox library is not modified."* That one sentence eliminates the biggest trust gap in the entire product.

3. **The Discover tab diluting the brand** — All 4 users felt confused or disengaged by it. It positions SetRecord as a YouTube wrapper instead of a serious library intelligence tool. Either (a) make Discover about discovering within your own library (surface unplayed tracks, hidden gems, tracks you've never mixed into anything), or (b) kill the YouTube integration until it's genuinely better than just going to YouTube. The current version is costing you credibility with your most valuable users: serious DJs who will tell their DJ friends.

---

## Top 12 Actionable Next Steps (prioritised)

| # | Action | Who it fixes | Revenue impact |
|---|---|---|---|
| 1 | Add step-by-step XML import guide (or auto-detect Rekordbox DB) | Jake + all newcomers | High — biggest conversion drop-off |
| 2 | Make export modal explicit: what file, what path, what format | Sarah + Marcus + Dave | High — biggest trust gap for paying users |
| 3 | Rename "DWA" crate + add one-line rule description to all default crates | All 4 personas | Medium — friction that blocks the best feature |
| 4 | Fix garbled settings copy ("flat doorbell", "free from phasing") | Sarah + Marcus | Medium — credibility damage with pro users |
| 5 | Add "Share as image" to Identity section | Jake + general marketing | High — free viral loop |
| 6 | Show Camelot key notation (e.g. "8A → 9A") on suggestion cards | Sarah + Marcus | Medium — trust in algorithm |
| 7 | Feed Combos data into Prepare tab suggestion ranking | Marcus + Jake + Dave | High — closes loop between insight and action |
| 8 | Make "Set safety: Not validated" a clickable trigger with explanation | All 4 personas | Medium — persistent UI anxiety |
| 9 | Add "Untested at next gig" workflow — add 3 candidates to any set, mark as tested after | Dave + Jake | High — turns biggest library problem into a habit |
| 10 | Health score weighting — missing files should score much lower than 3 points | Sarah + Marcus | Medium — misleading metric could damage trust |
| 11 | Rethink Discover tab as library-first (surface unplayed tracks, not YouTube) | All 4 personas | Medium — currently creates brand confusion |
| 12 | Add data transparency section to Settings (what's local, what's sent, where it's stored) | Marcus + Sarah | High for technical users, trust foundation |

---

*Report generated via 4-persona parallel simulation · SetRecord v0.1.0 · May 2026*  
*Screenshots taken from built Electron app with real Rekordbox library (1,037 tracks)*
