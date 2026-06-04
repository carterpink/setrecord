# SetSense AI Eval Matrix

210 prompts a real user might type into SetSense, rated by complexity, tagged by test type, with a testable success criterion for each.

---

## How to use

Each prompt carries:
- **Complexity** — Beginner / Intermediate / Advanced / Expert
- **Type** — `[DATA]` (requires querying the user's library), `[KNOW]` (DJ domain knowledge), `[BOTH]` (needs both), `[ACTION]` (triggers a write/delete/export)
- **Pass when** — the minimum bar for a correct response

Run DATA prompts against the live in-app AI. Run KNOW prompts against the raw LLM. BOTH prompts need both.

---

## Category Index

1. Basic Library Search (001–020)
2. BPM & Key Queries (021–038)
3. Transitions (039–054)
4. Set Building (055–074)
5. Gig History & Recall (075–086)
6. Energy, Mood & Vibe (087–101)
7. Similarity & Discovery (102–113)
8. Genre & Style (114–125)
9. Library Management (126–137)
10. Import & Export (138–145)
11. Stats & Analytics (146–157)
12. Crate Digging (158–169)
13. Venue & Crowd Context (170–179)
14. DJ Domain Knowledge (180–194)
15. Edge Cases & Adversarial (195–210)

---

## 1 · Basic Library Search

---

### 001 · Beginner · [DATA]
> "show me all my tracks"

**Pass when:** Returns the full library list with track name, artist, BPM, and key visible for each entry. Total count shown.

---

### 002 · Beginner · [DATA]
> "find Burial"

**Pass when:** Returns all tracks where artist or album contains "Burial". Case-insensitive. Partial match accepted. If none, responds "No tracks found for Burial" — does not fabricate results.

---

### 003 · Beginner · [DATA]
> "do I have any Aphex Twin?"

**Pass when:** Returns tracks by Aphex Twin. If none, responds clearly with zero results. Does not suggest tracks not in the library.

---

### 004 · Beginner · [DATA]
> "search for tracks with 'dark' in the title"

**Pass when:** Returns tracks where the title field contains "dark" (case-insensitive). Does not search artist or album fields exclusively.

---

### 005 · Beginner · [DATA]
> "what's in my library?"

**Pass when:** Returns total track count plus a brief summary (e.g., genre spread, BPM range). Does not attempt to list every track if the library is large. Offers to filter or drill in.

---

### 006 · Beginner · [DATA]
> "find all my Drumcode releases"

**Pass when:** Filters by label field containing "Drumcode". Returns matching tracks with label column visible.

---

### 007 · Beginner · [DATA]
> "show me tracks I added this week"

**Pass when:** Filters by date_added within the last 7 days. Returns list sorted by date_added descending.

---

### 008 · Beginner · [DATA]
> "anything by Ricardo Villalobos"

**Pass when:** Returns artist-matched results. Handles accented characters ("Villalobos") correctly. Case-insensitive.

---

### 009 · Intermediate · [DATA]
> "show me tracks longer than 8 minutes"

**Pass when:** Filters by duration > 480 seconds. Returns results with duration displayed. Sorted by duration descending.

---

### 010 · Intermediate · [DATA]
> "find remixes of Leftfield - Leftism"

**Pass when:** Searches for "Leftfield" AND "Leftism" across title, artist, and album fields. Returns remix versions specifically. Notes if none found — does not invent results.

---

### 011 · Intermediate · [DATA]
> "what tracks do I have in the key of Am?"

**Pass when:** Returns tracks where key = A minor. Accepts "Am", "A minor", and Camelot notation "8A" as equivalent inputs. Displays key in results.

---

### 012 · Intermediate · [DATA]
> "show me everything I imported from Rekordbox"

**Pass when:** Filters by import_source = 'rekordbox'. Returns list. If source tracking is unavailable, states the limitation clearly rather than returning all tracks.

---

### 013 · Intermediate · [DATA]
> "find tracks without artwork"

**Pass when:** Filters where artwork is null or missing. Returns list with file path shown. Practical for library maintenance.

---

### 014 · Beginner · [DATA]
> "show me my most played track"

**Pass when:** Returns the single track with the highest play_count. Displays the count. If there is a tie, returns all tied tracks.

---

### 015 · Intermediate · [DATA]
> "list tracks I've never played"

**Pass when:** Filters where play_count = 0 OR last_played IS NULL. Returns list with count shown.

---

### 016 · Intermediate · [DATA]
> "find tracks by Four Tet released after 2019"

**Pass when:** Filters artist = "Four Tet" AND year > 2019. Both conditions applied. Results display year.

---

### 017 · Intermediate · [DATA]
> "show me duplicates in my library"

**Pass when:** Identifies tracks with the same title + artist combination or identical file fingerprint. Groups duplicates together. Shows both copies.

---

### 018 · Beginner · [DATA]
> "find tracks shorter than 5 minutes"

**Pass when:** Filters duration < 300 seconds. Returns list with duration displayed.

---

### 019 · Intermediate · [DATA]
> "what labels are in my collection?"

**Pass when:** Returns distinct label values with count per label. Sorted by count descending or alphabetically. Does not return duplicates.

---

### 020 · Intermediate · [DATA]
> "find tracks I tagged as 'peak time'"

**Pass when:** Filters by tag containing "peak time". Returns matching tracks. If no tags exist in library, explains that tagging is needed rather than returning random high-energy tracks.

---

## 2 · BPM & Key Queries

---

### 021 · Beginner · [DATA]
> "show me tracks at 128 BPM"

**Pass when:** Returns tracks where BPM is within ±0.5 of 128. BPM column visible in results.

---

### 022 · Beginner · [DATA]
> "find tracks between 124 and 128 BPM"

**Pass when:** Filters BPM >= 124 AND <= 128. Both bounds applied correctly.

---

### 023 · Beginner · [DATA]
> "what's the BPM of Autechre - Gantz Graf?"

**Pass when:** Returns the stored BPM for that specific track. If the track is not in the library, responds "Track not found in your library" — does not fabricate a BPM value.

---

### 024 · Beginner · [DATA]
> "show me my fastest tracks"

**Pass when:** Returns tracks sorted by BPM descending. Shows top 10–20. BPM displayed.

---

### 025 · Beginner · [DATA]
> "anything around 140?"

**Pass when:** Interprets as BPM ~140. Applies a tolerance of at least ±3 BPM. Returns results. States the range used.

---

### 026 · Intermediate · [BOTH]
> "find tracks in 6A"

**Pass when:** Correctly interprets "6A" as Camelot notation for G minor. Returns tracks with key = G minor. Does not confuse with a different key.

---

### 027 · Intermediate · [BOTH]
> "show me tracks in harmonically compatible keys with 8A"

**Pass when:** Correctly identifies 8A as A minor. Returns tracks in adjacent Camelot positions: 7A (D minor), 9A (E minor), and 8B (C major). Explains the harmonic relationship briefly.

---

### 028 · Intermediate · [DATA]
> "what key is most common in my library?"

**Pass when:** Aggregates the key field across all analyzed tracks. Returns the most frequent key with count. Handles both standard and Camelot notation.

---

### 029 · Intermediate · [DATA]
> "find tracks at 128 BPM in A minor"

**Pass when:** Applies BOTH BPM (127.5–128.5) AND key (A minor / 8A) filters simultaneously. Both conditions visible in results.

---

### 030 · Intermediate · [DATA]
> "show me tracks where the BPM hasn't been analyzed"

**Pass when:** Filters where bpm IS NULL. Returns list. Suggests running analysis on those tracks.

---

### 031 · Intermediate · [DATA]
> "find all techno tracks between 130 and 135 BPM"

**Pass when:** Filters genre/tag containing "techno" AND bpm between 130–135. Both filters applied. Not just one.

---

### 032 · Advanced · [BOTH]
> "what tracks can I mix into a 128 BPM track in G major?"

**Pass when:** Returns tracks in harmonically compatible keys with G major (9B on Camelot: adjacent positions are 8B, 10B, 9A) at 127–129 BPM. Explains each harmonic relationship. Does not include incompatible keys.

---

### 033 · Advanced · [BOTH]
> "show me tracks that would pitch shift well to 132 BPM from around 128"

**Pass when:** Returns tracks at 127–133 BPM. Notes the expected pitch shift percentage (~3%). Flags tracks where a shift above 5% is needed as potentially degrading quality.

---

### 034 · Advanced · [DATA]
> "find tracks in the same key as Sasha - Xpander"

**Pass when:** Looks up the stored key for Sasha - Xpander in the library. Returns other tracks sharing that key. If the track is not found, states so clearly.

---

### 035 · Advanced · [BOTH]
> "show me all my tracks in flat keys"

**Pass when:** Returns tracks in keys that use flats: Bb, Eb, Ab, Db, Gb major and their relative minors. Does not include sharp keys. List count shown.

---

### 036 · Intermediate · [DATA]
> "what percentage of my library has been key-analyzed?"

**Pass when:** Returns (tracks with non-null key) / total track count as a percentage. Shows both raw numbers. Suggests analyzing the remainder.

---

### 037 · Advanced · [BOTH]
> "find tracks that are good to loop at 126 BPM"

**Pass when:** Returns tracks at approximately 126 BPM (±2). Notes that suitability for looping depends on track structure which may not be fully analyzed. Returns candidates and is transparent about the approximation.

---

### 038 · Intermediate · [DATA]
> "show me tracks in minor keys only"

**Pass when:** Filters all minor keys — equivalent to the A-side of the Camelot wheel (1A through 12A). Returns list with count.

---

## 3 · Transitions

---

### 039 · Intermediate · [BOTH]
> "what can I play after Bicep - Glue?"

**Pass when:** Finds Bicep - Glue in the library. Returns harmonically and BPM-compatible suggestions from the library. Shows the key and BPM match reasoning for each suggestion.

---

### 040 · Beginner · [KNOW]
> "how do I transition from 128 BPM to 140 BPM?"

**Pass when:** Explains gradual BPM ramping over multiple tracks, using energy builds and breakdowns. Mentions typical 4–8 bar mixing approach. Does not recommend specific tracks not in the user's library.

---

### 041 · Advanced · [BOTH]
> "suggest something to play between these two tracks: track A and track B"

**Pass when:** Returns "bridge" tracks from the library compatible with both A and B in key and BPM. Explains the compatibility for each suggestion.

---

### 042 · Advanced · [BOTH]
> "what plays well after drum and bass in my collection?"

**Pass when:** Understands the genre and BPM context of DnB (~170 BPM). Suggests tracks that bridge DnB to a next genre (half-time technique noted). Returns candidates from library.

---

### 043 · Intermediate · [KNOW]
> "is it ok to mix F# into G?"

**Pass when:** Correctly identifies that G major (9B) and F# major (2B) are 5 positions apart on the Camelot wheel and are harmonically incompatible. Advises against a direct mix. Suggests routing via a compatible key instead.

---

### 044 · Advanced · [BOTH]
> "show me tracks that transition well out of a breakdown"

**Pass when:** Returns tracks with strong drops or high-energy entries. Notes that structural analysis may be approximate. Returns candidates and is transparent.

---

### 045 · Intermediate · [KNOW]
> "what's the best way to drop from techno to house?"

**Pass when:** Explains the BPM difference (techno typically 130–138, house 120–128). Suggests techniques: half-time drop, breakdown swap, filter transition. Does not hallucinate specific track recommendations from the library.

---

### 046 · Intermediate · [BOTH]
> "find me an opener track from my collection"

**Pass when:** Returns lower-energy, lower-BPM tracks. Favours play_count = 0 (fresh). Shows energy level and BPM for each suggestion.

---

### 047 · Advanced · [DATA]
> "what comes before Orbital - Halcyon in my set history?"

**Pass when:** Queries transition history to find what track most frequently preceded Orbital - Halcyon across recorded sessions. If no history exists for that track, states so.

---

### 048 · Intermediate · [BOTH]
> "suggest a closing track from my library"

**Pass when:** Returns melodic, emotional, or lower-energy tracks appropriate for a set ending. Does not return peak-time or high-BPM tracks as closers.

---

### 049 · Intermediate · [KNOW]
> "can I mix 11B into 12B?"

**Pass when:** Correctly identifies 11B (A major) and 12B (E major) as adjacent on the Camelot wheel. Confirms yes — they are compatible. Gives a brief explanation.

---

### 050 · Advanced · [BOTH]
> "what tracks bridge minimal techno and melodic house in my collection?"

**Pass when:** Identifies tracks tagged or genre-matched to both styles, or known crossover genres. Returns candidates with genre and energy attributes visible.

---

### 051 · Advanced · [DATA]
> "show me my most-used transition pairs"

**Pass when:** Queries transition history. Returns top N [track A → track B] pairs by frequency. If no transition history exists, states so clearly.

---

### 052 · Advanced · [DATA]
> "find tracks I've used as a warm-up in the last 6 months"

**Pass when:** Queries play sessions where track appeared early in the set order, within a 6-month window. Returns list. If session position data is unavailable, states the limitation.

---

### 053 · Advanced · [BOTH]
> "what tracks in my collection have a good acapella intro?"

**Pass when:** Acknowledges it cannot reliably detect acapella intros from audio metadata alone unless they are tagged. Suggests a tagging approach for the user. Does not fabricate a list of tracks with acapellas.

---

### 054 · Expert · [KNOW]
> "how do I transition from 4/4 to 3/4 time?"

**Pass when:** Explains that time signature mixing is genuinely difficult. Mentions phrase-boundary misalignment, the triplet feel challenge, and breakdown/silence techniques as the most practical solution. Honest about the difficulty.

---

## 4 · Set Building

---

### 055 · Beginner · [DATA]
> "build me a 1-hour set"

**Pass when:** Returns a sequenced playlist of 12–16 tracks (averaging 4–5 minutes each). BPM arc visible. Genre consistent or progressively shifting.

---

### 056 · Intermediate · [DATA]
> "build me a 2-hour peak time techno set"

**Pass when:** Returns ~24–28 tracks. BPM range 130–138. Energy profile peaks mid-set. Genre filter applied to techno.

---

### 057 · Intermediate · [DATA]
> "create a warm-up set for a bar, 90 minutes, housey"

**Pass when:** Returns ~18–22 tracks. BPM 118–124. House genre filter applied. Energy builds gradually over the duration.

---

### 058 · Advanced · [DATA]
> "build a sunrise set using only tracks I haven't played before"

**Pass when:** Filters play_count = 0 OR last_played IS NULL. Melodic or atmospheric genre. BPM arc starts low (~118) and rises. Set progression shown.

---

### 059 · Intermediate · [DATA]
> "make me a set of just classics from before 2000"

**Pass when:** Filters year < 2000. Returns sequenced playlist. Year visible for each track.

---

### 060 · Advanced · [DATA]
> "build a set that starts at 124 BPM and ends at 132 BPM"

**Pass when:** Generates a BPM arc from 124 to 132 across the set. Sequences tracks to match. BPM shown per track.

---

### 061 · Advanced · [DATA]
> "create a 45-minute set using only tracks I've played at Fabric"

**Pass when:** Queries gig metadata for venue containing "Fabric". Pools those tracks. Sequences ~9–11 of them. If no Fabric sessions exist, states so — does not invent tracks.

---

### 062 · Advanced · [DATA]
> "build a b2b set — split the tracks into two halves"

**Pass when:** Generates a full set then divides into two equal segments. Labels each half. Notes the energy handoff point between the two halves.

---

### 063 · Advanced · [DATA]
> "make a set that tells a story — start dark, go euphoric, come back down"

**Pass when:** Produces a three-arc structure: dark/minimal intro → euphoric/energetic peak → melodic/emotional outro. Arc labels shown.

---

### 064 · Intermediate · [DATA]
> "generate three different opening tracks for me to choose from"

**Pass when:** Returns exactly three low-energy track candidates. Provides a brief rationale for each. Does not return peak-time tracks.

---

### 065 · Advanced · [DATA]
> "what's the longest set I could build from tracks I've never played?"

**Pass when:** Counts tracks with play_count = 0. Sums their durations. Returns the maximum possible set duration in hours and minutes.

---

### 066 · Advanced · [DATA]
> "build a set but avoid anything I've played in the last month"

**Pass when:** Filters last_played IS NULL OR last_played < 30 days ago. Builds set from the remaining pool only.

---

### 067 · Advanced · [DATA]
> "create a pool of 30 tracks for a 2-hour back-to-back"

**Pass when:** Returns exactly 30 tracks with a spread of energy levels (low, mid, high). Notes the energy distribution. Flexible ordering for b2b use.

---

### 068 · Advanced · [DATA]
> "make me a festival set — big room, peak hour, no vocals"

**Pass when:** Filters genre toward big room / techno / tech house. BPM 130+. Notes if vocal filtering is approximate (depends on tagging). Returns a sequenced set.

---

### 069 · Advanced · [DATA]
> "build a vinyl-only set from my collection"

**Pass when:** Filters tracks marked as vinyl or from a vinyl source if that field exists. If no such field is tracked, states the limitation and suggests a tagging approach.

---

### 070 · Beginner · [DATA]
> "I have 20 minutes to fill — what do I play?"

**Pass when:** Returns 4–5 tracks with a combined duration of approximately 20 minutes. Quick, no excessive explanation.

---

### 071 · Advanced · [DATA]
> "create a set that works for both dancing and background listening"

**Pass when:** Returns mid-energy tracks (BPM ~118–124). Not aggressive enough to alienate listeners. Works as ambient or dance floor. This duality noted in the response.

---

### 072 · Intermediate · [DATA]
> "build a set using only tracks longer than 7 minutes"

**Pass when:** Filters duration > 420 seconds. Sequences those tracks. Notes the lower track count per hour.

---

### 073 · Advanced · [DATA]
> "what if I started my set with Plastikman - Spastik? build from there"

**Pass when:** Uses Plastikman - Spastik as the anchor (first track). Finds BPM and key compatible follow-ons from the library. Builds outward from that seed. If the track is not in library, states so.

---

### 074 · Expert · [DATA]
> "build me 5 different one-hour sets from the same library"

**Pass when:** Returns 5 distinct playlists with different vibes, genres, or BPM arcs. Minimal track repetition across the five sets. Each set labeled clearly.

---

## 5 · Gig History & Recall

---

### 075 · Beginner · [DATA]
> "what did I play last Saturday?"

**Pass when:** Queries play sessions for the most recent Saturday date. Returns tracks played in that session. If no session was recorded, states so.

---

### 076 · Beginner · [DATA]
> "show me all my gigs this year"

**Pass when:** Returns play sessions where year = current year. Sorted by date. Venue and date shown for each.

---

### 077 · Intermediate · [DATA]
> "what songs did I play at Hi Ibiza?"

**Pass when:** Queries gig metadata where venue matches "Hi Ibiza" (case-insensitive). Returns all tracks from those sessions grouped by date.

---

### 078 · Intermediate · [DATA]
> "when did I last play Surgeon - Magneze?"

**Pass when:** Returns the last_played date for that specific track. If never played, states "No play history found for this track."

---

### 079 · Intermediate · [DATA]
> "how many times have I played Speedy J - De-orbit?"

**Pass when:** Returns the play_count for that track. If the track is not in the library, states so.

---

### 080 · Advanced · [DATA]
> "show me my longest set ever"

**Pass when:** Queries all play sessions. Calculates duration per session. Returns the longest one with date, venue, and duration.

---

### 081 · Beginner · [DATA]
> "what venues have I played?"

**Pass when:** Returns distinct venue values from play sessions. Shows visit count per venue. Sorted by frequency descending.

---

### 082 · Advanced · [DATA]
> "show me tracks I played more than 3 times in the last year"

**Pass when:** Filters play events within the last 12 months. Groups by track. Returns only tracks with count > 3. Shows count per track.

---

### 083 · Advanced · [DATA]
> "what was my setlist for my birthday gig in March?"

**Pass when:** Queries play sessions in March of the most recent year. Returns the closest matching session. If multiple March sessions exist, lists all of them for the user to choose.

---

### 084 · Advanced · [DATA]
> "which tracks have I never repeated at the same venue?"

**Pass when:** Cross-references track plays with venue. Identifies tracks that appear exactly once per venue across all sessions. If this is too complex to compute exactly, returns an approximation and states that clearly.

---

### 085 · Beginner · [DATA]
> "show me my most recent import"

**Pass when:** Returns the most recently added track(s) by date_added. If a batch was imported at the same time, returns all tracks from that batch.

---

### 086 · Intermediate · [DATA]
> "what's my average set length?"

**Pass when:** Averages session durations across all recorded play sessions. Returns the mean in hours and minutes. Shows the number of sessions used in the calculation.

---

## 6 · Energy, Mood & Vibe

---

### 087 · Beginner · [DATA]
> "show me dark tracks"

**Pass when:** Filters tags or genre containing "dark". Returns list. If no tracks are tagged, explains that auto-tagging or manual tagging is needed rather than returning a random selection.

---

### 088 · Intermediate · [BOTH]
> "find something euphoric for the peak"

**Pass when:** Returns high-energy tracks. Considers BPM (130+), major keys, and melodic content. "Euphoric" interpreted via tags or energy score. Does not return minimal or low-energy tracks.

---

### 089 · Intermediate · [BOTH]
> "I need something melancholic and slow"

**Pass when:** Filters low BPM (~100–118), minor keys, and tags like "melancholic", "sad", or "emotional". Returns candidates.

---

### 090 · Advanced · [BOTH]
> "find the most hypnotic tracks in my collection"

**Pass when:** Filters tracks tagged "hypnotic", "repetitive", or "minimal". Alternatively returns the longest tracks in the library (longer duration correlates with hypnotic/repetitive structure). Returns list. Is transparent about the proxy used.

---

### 091 · Advanced · [BOTH]
> "show me tracks good for a 6am crowd"

**Pass when:** Understands 6am context = late-night into early morning. Returns melodic, atmospheric tracks — not aggressive peak-time. Considers play history at late-session timestamps if available.

---

### 092 · Advanced · [DATA]
> "find something aggressive for a festival main stage drop"

**Pass when:** Returns high-energy, high-BPM (133+) tracks. Hard techno or industrial-adjacent genre preferred. Does not return ambient or low-energy results.

---

### 093 · Advanced · [BOTH]
> "what's the most emotional track in my library?"

**Pass when:** Returns tracks tagged "emotional" or similar. If no emotional tags exist, approximates using minor keys and lower BPM. Is transparent about the approximation.

---

### 094 · Advanced · [BOTH]
> "find tracks that build tension"

**Pass when:** Returns tracks tagged "tension" or "build". Acknowledges that structural analysis (identifying long builds) may be limited. Does not fabricate structural information.

---

### 095 · Intermediate · [BOTH]
> "show me something I could use as an ambient intro"

**Pass when:** Filters very low BPM or no BPM (ambient tracks), long duration, low energy. Returns list.

---

### 096 · Intermediate · [BOTH]
> "find uplifting tracks for a daytime festival crowd"

**Pass when:** Filters BPM 120–128, major keys, melodic or house genre, medium-high energy. Returns list.

---

### 097 · Advanced · [BOTH]
> "I want tracks that feel like being underwater"

**Pass when:** Maps the metaphor to: atmospheric, reverb-heavy, slow, possibly minor key. Returns candidates tagged "atmospheric", "ambient", or "deep". Acknowledges this is a creative interpretation.

---

### 098 · Advanced · [BOTH]
> "what's the most club-ready track in my library right now?"

**Pass when:** Considers BPM 128–133, high energy, peak-hour tags, and recent import date (freshness). Returns top candidate with brief reasoning.

---

### 099 · Advanced · [BOTH]
> "show me tracks that are good for reading the crowd"

**Pass when:** Returns versatile, mid-energy tracks that work across crowd types. If the user appears to be a beginner, briefly explains what "reading the crowd" means. Returns from library.

---

### 100 · Intermediate · [BOTH]
> "find something cinematic"

**Pass when:** Maps "cinematic" to orchestral, film-score-adjacent, or tracks with dramatic builds. Returns tracks tagged "cinematic" or matching genre. States the interpretation used.

---

### 101 · Beginner · [BOTH]
> "show me chill tracks for a beach party"

**Pass when:** Filters lower BPM (100–120), warm organic sound (afro house, balearic, melodic). Returns list.

---

## 7 · Similarity & Discovery

---

### 102 · Intermediate · [BOTH]
> "find tracks similar to Caribou - Can't Do Without You"

**Pass when:** Locates Caribou - Can't Do Without You in the library. Returns tracks with similar BPM, key, and genre. If the track is not in the library, states so and does not fabricate alternatives.

---

### 103 · Advanced · [BOTH]
> "what's in my library that sounds like early Daft Punk?"

**Pass when:** Maps "early Daft Punk" to: French house, 120–128 BPM, filtered bass, vocoders, 1997–2001 era. Returns candidates matching genre, tag, or year. Explains the mapping used.

---

### 104 · Intermediate · [DATA]
> "show me something I haven't discovered yet in my own library"

**Pass when:** Returns tracks with play_count = 0 sorted by date_added descending (recently imported, never played). Frames the result as a discovery moment.

---

### 105 · Advanced · [DATA]
> "what do I have that's similar to what I played at my last gig?"

**Pass when:** Queries the most recent play session. Extracts the genre, BPM, and key profile. Returns library tracks matching that profile that were NOT in the last session.

---

### 106 · Advanced · [BOTH]
> "find tracks that share a vibe with Joy Division"

**Pass when:** Maps Joy Division to: post-punk, dark, minor keys, cold wave adjacent. Searches tags and genre. Returns closest matches. Acknowledges the approximation is subjective.

---

### 107 · Intermediate · [DATA]
> "recommend me something from my collection I've been ignoring"

**Pass when:** Returns tracks with play_count = 0 AND date_added more than 90 days ago. Surfaces neglected imports. Count shown.

---

### 108 · Advanced · [DATA]
> "what's the most unique track in my library?"

**Pass when:** Returns tracks with an unusual BPM, key, or genre combination relative to the rest of the library — outliers. Alternatively, tracks that have never appeared in any transition. Explains the uniqueness metric used. Does not claim a definitive answer.

---

### 109 · Advanced · [BOTH]
> "find tracks in my library that don't fit any of my usual genres"

**Pass when:** Identifies genres with fewer than 2% of total play count as "unusual for you". Returns tracks in those genres. Framing makes the selection logic clear.

---

### 110 · Intermediate · [DATA]
> "show me tracks I haven't touched since I imported them"

**Pass when:** Filters play_count = 0 AND date_added older than some threshold (e.g., 60 days). Sorts by date_added ascending (oldest untouched first).

---

### 111 · Intermediate · [BOTH]
> "what tracks remind me of summer?"

**Pass when:** Maps "summer" to balearic, tropical, afro house, or melodic — major keys, BPM 120–128. Returns tagged or genre-matched tracks. States the interpretation.

---

### 112 · Advanced · [DATA]
> "find something I would have played 5 years ago but don't play anymore"

**Pass when:** Is honest about the limitation — play history only goes back to first use of SetSense. If data is available, returns high-play-count tracks from the oldest sessions with zero recent plays.

---

### 113 · Advanced · [BOTH]
> "show me tracks from my collection that Radiohead fans would love"

**Pass when:** Maps Radiohead fans to: art rock, melancholic, experimental, odd time signatures. Returns tracks with compatible tags or genre. Acknowledges the interpretation is subjective.

---

## 8 · Genre & Style

---

### 114 · Beginner · [DATA]
> "show me all my techno tracks"

**Pass when:** Filters genre containing "techno" (case-insensitive). Returns list with count.

---

### 115 · Beginner · [DATA]
> "how much house music do I have?"

**Pass when:** Returns the count of tracks where genre contains "house". Shows percentage of total library.

---

### 116 · Advanced · [BOTH]
> "find tracks that cross between techno and ambient"

**Pass when:** Searches for tracks tagged or genre-matched as both, or known crossover genres like "ambient techno" or "industrial ambient". Returns candidates.

---

### 117 · Beginner · [DATA]
> "what genres are in my collection?"

**Pass when:** Returns distinct genre values with track count per genre. Sorted by count descending. No duplicates.

---

### 118 · Advanced · [BOTH]
> "I want classic Detroit techno only"

**Pass when:** Filters genre = "detroit techno" or tags = "detroit". Considers known Detroit labels (Transmat, KMS, Underground Resistance) if label data is present. Optional year filter 1987–1995. Returns list.

---

### 119 · Intermediate · [DATA]
> "find me some UK garage"

**Pass when:** Filters genre containing "UK garage" or "2-step". Returns results. If none found, responds "No UK garage found in your library" — does not substitute another genre.

---

### 120 · Intermediate · [DATA]
> "show me all minimal tracks"

**Pass when:** Filters genre or tags containing "minimal". Returns list. If "minimal" is not a genre in the library, checks tags before returning empty.

---

### 121 · Advanced · [DATA]
> "what's the most niche genre in my collection?"

**Pass when:** Returns the genre with the lowest track count (minimum 2 tracks to qualify). Shows the genre name and those tracks.

---

### 122 · Advanced · [BOTH]
> "find tracks that blend deep house and jazz"

**Pass when:** Searches for tags containing both "deep house" and "jazz", or known sub-genres like "jazz house". Returns candidates.

---

### 123 · Intermediate · [DATA]
> "how much of my library is electronic vs non-electronic?"

**Pass when:** Attempts a genre-based split. Non-electronic includes folk, rock, classical, hip-hop (non-electronic). Returns a percentage split. Notes the approximation if genre tagging is inconsistent.

---

### 124 · Intermediate · [DATA]
> "show me all my acid tracks"

**Pass when:** Filters genre or tags containing "acid", "acid house", or "acid techno". Returns list.

---

### 125 · Intermediate · [DATA]
> "find breakbeat tracks in my collection"

**Pass when:** Filters genre containing "breakbeat", "breaks", or "UK breaks". Returns list with count.

---

## 9 · Library Management

---

### 126 · Beginner · [DATA]
> "how big is my library?"

**Pass when:** Returns total track count. Optionally shows total file size and the date range of imports.

---

### 127 · Beginner · [DATA]
> "find tracks with missing BPM"

**Pass when:** Filters bpm IS NULL. Returns list with count. Suggests running BPM analysis on those tracks.

---

### 128 · Intermediate · [DATA]
> "which tracks have no genre set?"

**Pass when:** Filters genre IS NULL or genre = ''. Returns list. Suggests tagging them.

---

### 129 · Intermediate · [DATA]
> "show me tracks with incomplete metadata"

**Pass when:** Checks for NULL values across: bpm, key, genre, year, artwork. Returns tracks missing any of those fields. Shows which specific fields are missing per track.

---

### 130 · Intermediate · [DATA]
> "find broken file paths in my library"

**Pass when:** Checks file existence for all tracked paths. Returns tracks where the file no longer exists at the stored path. Shows count and file paths.

---

### 131 · Intermediate · [ACTION]
> "remove all tracks I deleted from disk"

**Pass when:** Identifies tracks with broken file paths. Presents the list to the user and asks for explicit confirmation before deleting anything. Reports count removed after confirmation. Does not delete without confirmation.

---

### 132 · Intermediate · [DATA]
> "find tracks I've imported more than once"

**Pass when:** Identifies duplicates by file fingerprint or title + artist match. Groups them. Shows both copies.

---

### 133 · Beginner · [DATA]
> "what's the average BPM of my library?"

**Pass when:** Returns mean BPM across all BPM-analyzed tracks. Notes how many tracks were included (analyzed tracks only, not nulls).

---

### 134 · Beginner · [DATA]
> "show me the oldest track in my collection"

**Pass when:** Returns the track with the lowest year value. Displays year. If year data is missing for many tracks, notes the limitation.

---

### 135 · Intermediate · [DATA]
> "how many tracks are in each playlist?"

**Pass when:** Returns all playlists with track count per playlist. Sorted by count descending.

---

### 136 · Intermediate · [DATA]
> "find tracks that appear in multiple playlists"

**Pass when:** Returns tracks present in more than one playlist. Shows which playlists each track appears in.

---

### 137 · Advanced · [ACTION]
> "clean up duplicate entries"

**Pass when:** Identifies exact duplicates (same fingerprint or same title + artist + duration). Shows duplicates to the user. Asks for confirmation before removing. Reports count after cleanup. Does not auto-delete without confirmation.

---

## 10 · Import & Export

---

### 138 · Beginner · [KNOW]
> "how do I import my Rekordbox library?"

**Pass when:** Returns clear step-by-step instructions: export XML from Rekordbox, then import via SetSense's import flow. Does not fabricate UI paths that do not exist.

---

### 139 · Beginner · [KNOW]
> "can I import from Serato?"

**Pass when:** Confirms Serato import is supported. Explains where Serato library files are located on disk. Gives import steps.

---

### 140 · Intermediate · [ACTION]
> "export this set to Rekordbox"

**Pass when:** Triggers or explains the export flow for Rekordbox compatibility. Confirms completion or shows progress. Does not silently fail.

---

### 141 · Advanced · [ACTION]
> "export my top 50 most played tracks as a CSV"

**Pass when:** Generates a CSV with track name, artist, BPM, key, play_count, and last_played. Sorted by play_count descending. Top 50 only. File saved or download triggered.

---

### 142 · Intermediate · [BOTH]
> "can I get my playlists onto a USB for Pioneer CDJs?"

**Pass when:** Explains the Engine DJ export flow. Mentions USB formatting requirements (FAT32 or exFAT). Gives steps. Notes if this is a Pro-gated feature.

---

### 143 · Intermediate · [KNOW]
> "why are my Rekordbox hot cues not importing?"

**Pass when:** Explains known compatibility limits (e.g., Rekordbox 7 cipher differences, schema changes). Suggests a workaround or honestly acknowledges the limitation without deflecting.

---

### 144 · Intermediate · [ACTION]
> "import the folder /Music/New Drops"

**Pass when:** Initiates folder import for the specified path. Reports tracks found. Asks how to handle duplicates. Confirms import count on completion.

---

### 145 · Intermediate · [BOTH]
> "export my entire library as a backup"

**Pass when:** Triggers or explains the backup flow. States what is included (tracks, metadata, playlists, history). Mentions encrypted backup option. Confirms destination.

---

## 11 · Stats & Analytics

---

### 146 · Beginner · [DATA]
> "what's my most played genre?"

**Pass when:** Aggregates play events by genre. Returns the top genre with total play count and percentage of all plays.

---

### 147 · Intermediate · [DATA]
> "show me my listening stats for this month"

**Pass when:** Returns: total tracks played, total play time, most played track, and most played genre — all scoped to the current calendar month.

---

### 148 · Beginner · [DATA]
> "which artist do I play the most?"

**Pass when:** Aggregates play_count by artist. Returns the top artist with total play count.

---

### 149 · Advanced · [DATA]
> "how has my BPM range changed over time?"

**Pass when:** Groups sets or sessions by month. Shows average BPM per month as a trend. If data doesn't span long enough, states the available range honestly.

---

### 150 · Advanced · [DATA]
> "show me my peak hour — what time do I usually play my biggest tracks?"

**Pass when:** Analyzes play sessions by time-of-day. Correlates with high-energy tracks. Returns the most common time window for peak-energy plays. Requires session timestamp data — states if unavailable.

---

### 151 · Intermediate · [DATA]
> "what percentage of my library do I actually play?"

**Pass when:** Returns (tracks with play_count > 0) / total track count as a percentage. Shows both raw numbers.

---

### 152 · Beginner · [DATA]
> "how many tracks have I added to my library in the past 6 months?"

**Pass when:** Filters date_added >= 6 months ago. Returns count. Optionally breaks down by month.

---

### 153 · Intermediate · [DATA]
> "what's my most productive importing month?"

**Pass when:** Groups date_added by month. Returns the month with the highest import count with the count shown.

---

### 154 · Advanced · [DATA]
> "show me how my genre preferences have shifted over 2 years"

**Pass when:** Groups play events by month and genre. Describes or displays the trend of which genres were most played per period. If data doesn't go back 2 years, reports what range is available.

---

### 155 · Beginner · [DATA]
> "what's the total duration of my library?"

**Pass when:** Sums duration of all tracks. Returns total in hours and minutes. Shows total track count.

---

### 156 · Beginner · [DATA]
> "how many gigs have I played this year?"

**Pass when:** Counts distinct play sessions where year = current year. Returns count.

---

### 157 · Intermediate · [DATA]
> "show me a breakdown of keys in my library"

**Pass when:** Returns count per key across all 24 major/minor keys. Sorted by count. Presented as a list or described clearly.

---

## 12 · Crate Digging

---

### 158 · Beginner · [DATA]
> "surprise me"

**Pass when:** Returns one random track from the library. Brief rationale given ("you haven't played this in a while" / "this fits your recent style"). Playful tone.

---

### 159 · Intermediate · [DATA]
> "dig into my collection and find a hidden gem"

**Pass when:** Returns a track with low play_count (0–2), imported more than 3 months ago, with quality tags or above-average metadata completeness. Presents it as a discovery moment.

---

### 160 · Intermediate · [DATA]
> "what's a track in my library I probably forgot I had?"

**Pass when:** Returns a track with play_count = 0 and date_added more than 90 days ago. Shows when it was imported. Framed as rediscovery.

---

### 161 · Beginner · [DATA]
> "give me 10 random tracks I've never played"

**Pass when:** Returns exactly 10 tracks where play_count = 0. Randomised — not ranked by quality or BPM. Returns fewer if the unplayed pool is smaller than 10 and states the actual count.

---

### 162 · Advanced · [DATA]
> "what would a totally different DJ play from my collection?"

**Pass when:** Returns tracks from the least-played genres and BPM ranges in the user's history. "Outside your comfort zone" framing. Explains the selection logic.

---

### 163 · Advanced · [DATA]
> "find me something I bought on Beatport but never mixed"

**Pass when:** If import source tracking exists, filters source = 'beatport' AND play_count = 0. If source tracking is unavailable, states the limitation rather than guessing.

---

### 164 · Advanced · [DATA]
> "show me tracks I added during lockdown"

**Pass when:** Interprets "lockdown" as approximately March 2020 – June 2021. Filters date_added in that range. Returns list. States the date range assumed.

---

### 165 · Advanced · [BOTH]
> "what would work as a b-side to my usual set style?"

**Pass when:** Analyses the most common genre, BPM, and key in play history. Returns tracks that are adjacent but different — same BPM neighbourhood, different genre. Explains the "b-side" concept briefly.

---

### 166 · Advanced · [DATA]
> "recommend something based on what I played last night"

**Pass when:** Finds the most recent play session. Extracts its genre, BPM, and key profile. Returns unplayed tracks from the library matching that profile.

---

### 167 · Advanced · [DATA]
> "give me a mystery set — don't tell me what the tracks are"

**Pass when:** Generates a set but withholds track titles, returning only track count, total duration, and genre/vibe description. "Press play and discover" framing. This is a deliberate creative feature test.

---

### 168 · Advanced · [DATA]
> "show me tracks I downloaded from SoundCloud years ago"

**Pass when:** Checks source tracking field. If available, filters accordingly. If not, states the limitation honestly and suggests checking file metadata or tags.

---

### 169 · Intermediate · [DATA]
> "find tracks in my library that no one else is probably playing"

**Pass when:** Returns tracks from obscure labels (low library count), unusual genres, or very low overall play count. Acknowledges this is an approximation — "obscure" is relative. Does not claim certainty about what other DJs play.

---

## 13 · Venue & Crowd Context

---

### 170 · Beginner · [KNOW]
> "what should I play tonight at a wedding?"

**Pass when:** Explains wedding DJ considerations: all ages, broad taste, avoid offensive content, expect requests. Returns broadly accessible tracks from the library if any exist. Practical tips included.

---

### 171 · Intermediate · [BOTH]
> "I'm playing a small bar with 30 people — what vibe?"

**Pass when:** Recommends lower energy, not full peak-time. Mid-tempo. House or disco adjacent. Crowd-warming tracks. Returns candidates from library.

---

### 172 · Advanced · [KNOW]
> "I'm supporting a headliner at a festival — what's the strategy?"

**Pass when:** Explains: build the crowd, avoid headliner's signature style, don't peak too early, leave the headliner room to go bigger. Returns suitable warm-up tracks from library.

---

### 173 · Advanced · [DATA]
> "what did I play the last time I was at a warehouse party?"

**Pass when:** Queries gig metadata for venue type or name suggesting a warehouse (partial name match). Returns tracks from that session. If no matching session, states so.

---

### 174 · Advanced · [DATA]
> "build a set for a 500-person club at 2am"

**Pass when:** Peak-time context. High energy. BPM 130–135. Returns a sequenced set with that arc and track count appropriate for the time slot.

---

### 175 · Intermediate · [BOTH]
> "what tracks work well outdoors in daytime?"

**Pass when:** Maps outdoor/daytime to lighter energy, melodic, organic house or balearic. Returns from library.

---

### 176 · Intermediate · [DATA]
> "I'm playing a corporate event — keep it safe"

**Pass when:** Filters toward mid-tempo, mainstream-adjacent tracks. Avoids heavy techno and aggressive content. Returns a practical selection.

---

### 177 · Advanced · [KNOW]
> "what should I NOT play for a first gig at Tresor?"

**Pass when:** Correctly describes Tresor's aesthetic — hard techno, Berlin underground, dark, no cheese. Advises against: commercial house, prominent vocals, slow BPM. Specific and honest.

---

### 178 · Advanced · [DATA]
> "build a set for a New Year's Eve countdown moment"

**Pass when:** Constructs a set with a climactic peak at the countdown point. Suggests structure: build toward midnight, anthemic drop, euphoric continuation. Returns tracks sequenced accordingly.

---

### 179 · Beginner · [KNOW]
> "what's the difference between playing a rave and a club night?"

**Pass when:** Explains: rave = longer sets, more freedom, less structure, often unlicensed or outdoor; club = fixed schedule, mixed crowd, licensing constraints, stage-managed. Practical for new DJs.

---

## 14 · DJ Domain Knowledge

---

### 180 · Beginner · [KNOW]
> "what is harmonic mixing?"

**Pass when:** Explains matching musical keys using the Circle of Fifths or Camelot Wheel. Compatible keys are ±1 step on the wheel. Gives a concrete example (e.g., 8A → 9A or 7A or 8B). Mentions SetSense key display.

---

### 181 · Beginner · [KNOW]
> "explain the Camelot wheel to me"

**Pass when:** Explains 24 positions (12 major = B side, 12 minor = A side). Each number + letter corresponds to a musical key. Adjacent positions = compatible. Gives a concrete example.

---

### 182 · Beginner · [KNOW]
> "what's a DJ drop?"

**Pass when:** Explains the moment when the main elements re-enter after a breakdown or build. Describes the energy release. Distinguishes from the generic pop term "the drop" if asked.

---

### 183 · Beginner · [KNOW]
> "how do I beatmatch without sync?"

**Pass when:** Step-by-step: find BPM of both tracks, adjust pitch fader to match, use headphones to listen, nudge the platter to align phrases, let them run together. Practical and sequential.

---

### 184 · Beginner · [KNOW]
> "what does EQing in mean?"

**Pass when:** Explains: gradually raising EQ frequencies of the incoming track while reducing them on the outgoing track. Typically the bass EQ is swapped at the mix point to avoid clashing low end.

---

### 185 · Beginner · [KNOW]
> "what's the difference between a DJ mix and a live PA?"

**Pass when:** Mix = playing other artists' recorded tracks. Live PA = performing original music live using synths, drum machines, etc. Notes that hybrid formats exist. Clear and concise.

---

### 186 · Beginner · [KNOW]
> "how long should my DJ sets be?"

**Pass when:** Explains context-dependence: warm-up = 1–2 hours, support = 2–3 hours, headliner = 3–4+ hours, residents vary. Recommends 1–2 hours as a practical starting point for beginners.

---

### 187 · Beginner · [KNOW]
> "what is a white label?"

**Pass when:** Explains: a vinyl pressing without label artwork or info — typically a promo, dubplate, or DJ exclusive. Notes this concept doesn't apply to digital files in the same way.

---

### 188 · Intermediate · [KNOW]
> "what is loop diving?"

**Pass when:** Explains: activating a loop during a mix to extend a section (e.g., looping the breakdown) while you find the cue point for the next track. A technique for buying time.

---

### 189 · Intermediate · [KNOW]
> "explain phrase mixing"

**Pass when:** Explains aligning 8- or 16-bar phrases between tracks. Mixing at phrase boundaries sounds more musical. Explains how to count bars and identify phrase starts.

---

### 190 · Beginner · [KNOW]
> "what's the ideal number of tracks to prepare for a 2-hour gig?"

**Pass when:** Rule of thumb is 2–3× the set length = 60–90 tracks for a 2-hour gig. Explains why: crowd reading, selection flexibility, backup options.

---

### 191 · Intermediate · [KNOW]
> "when should I use high-pass filters in a mix?"

**Pass when:** Explains: rolling off bass on the incoming track before introducing it avoids low-end clashing. Also used to build tension within a mix. Gives a practical example of the technique.

---

### 192 · Beginner · [KNOW]
> "what's a DJ's crate?"

**Pass when:** Explains: a curated selection of tracks for a set. Physical origin is vinyl crates. The digital equivalent is playlists or folders in DJ software. Connects to SetSense context.

---

### 193 · Intermediate · [KNOW]
> "explain the energy arc of a DJ set"

**Pass when:** Describes warm-up (low energy) → build → peak → comedown structure. Notes that not every set has all four phases. Emphasises crowd-driven nature. Uses a graph analogy.

---

### 194 · Advanced · [KNOW]
> "what is stem separation and how does it help DJs?"

**Pass when:** Explains AI separation of audio into component stems (drums, bass, melody, vocals). Enables acapella layering, creative remixing, smoother mixing. Mentions available tools. Is honest about SetSense's current capability rather than over-claiming.

---

## 15 · Edge Cases & Adversarial

---

### 195 · Beginner · [BOTH]
> "play me something"

**Pass when:** Either requests clarification (what mood, what BPM?) OR makes a reasonable default (random track, or something matching recent play history). Does not silently fail or return an error without explanation.

---

### 196 · Beginner · [DATA]
> "find tracks by that artist I like"

**Pass when:** Asks for the artist name. Does not guess, does not hallucinate an artist name, does not return all tracks.

---

### 197 · Beginner · [ACTION]
> "delete everything"

**Pass when:** Does not delete anything. Asks for explicit confirmation of intent. Explains what would be deleted. Offers a safer alternative (archive or hide). Requires multi-step confirmation before executing any destructive action.

---

### 198 · Beginner · [KNOW]
> "what's the best song ever made?"

**Pass when:** Redirects gracefully to library context ("I can help you find your best tracks"). Does not generate a list of "best songs" presented as objective fact.

---

### 199 · Intermediate · [DATA]
> "find tracks by Deadmau5"

**Pass when:** Handles "Deadmau5" correctly. Also tries "deadmau5" (lowercase) and "dead mouse" if no results. Returns results with case-insensitive matching confirmed.

---

### 200 · Expert · [BOTH]
> "I want something with a 4-on-the-floor kick and a square wave bassline"

**Pass when:** Acknowledges this is a structural and timbral description that is not reliably detectable from standard metadata alone. Suggests filtering techno and house genres which commonly have these elements. Does not fabricate detailed structural data it doesn't have.

---

### 201 · Beginner · [ACTION]
> "can you fix my mix?"

**Pass when:** Asks what "fix" means in context — BPM mismatch, key clash, energy problem? Does not attempt a blind action on an underspecified request.

---

### 202 · Intermediate · [DATA]
> "show me tracks from my childhood"

**Pass when:** Asks for a time period or year range to interpret "childhood". Does not assume the user's age. Does not return a random selection without context.

---

### 203 · Beginner · [DATA]
> "I need something that slaps"

**Pass when:** Correctly interprets "slaps" as energetic, heavy bass, or peak-time. Returns high-energy tracks from the library. Does not flag the phrasing as inappropriate.

---

### 204 · Intermediate · [DATA]
> "what are the worst tracks in my library?"

**Pass when:** Does not make subjective quality judgements about the user's tracks. Instead offers objective proxies: never played, lowest file quality, missing metadata. Reframes the question helpfully.

---

### 205 · Advanced · [KNOW]
> "find tracks in the key of H"

**Pass when:** Recognises that H is not a standard key in most Western notation. Explains valid key names. Asks what was intended (B natural? B flat?). Bonus credit: correctly notes that H = B natural in German and Nordic music notation.

---

### 206 · Beginner · [KNOW]
> "import my library from Spotify"

**Pass when:** States clearly that Spotify import is not supported due to streaming DRM. Explains why (no local files). Suggests alternatives such as purchasing tracks and importing from Rekordbox or Serato.

---

### 207 · Intermediate · [BOTH]
> "what will I play next?"

**Pass when:** Returns a suggestion based on current or most recent track context if available. If no context is present, asks what is currently playing. Does not claim to predict the future.

---

### 208 · Intermediate · [KNOW]
> "show me tracks that are scientifically proven to make people dance"

**Pass when:** Does not make false scientific claims. Explains it can return high-energy or crowd-tested tracks based on play history instead. Redirects to what it can actually do.

---

### 209 · Advanced · [DATA]
> "build me a 10-hour set"

**Pass when:** Notes that a 10-hour set is an endurance or marathon format. Proceeds if confirmed. Draws from the full library. If the library does not have enough tracks for 10 hours, reports the maximum achievable duration.

---

### 210 · Beginner · [KNOW]
> "how do I get more gigs?"

**Pass when:** Acknowledges this is outside SetSense's scope. Offers what IS relevant: building polished sets, tracking gig history, exporting to CDJ-ready USB. Keeps the response useful without pretending to be a booking agent.

---

*210 prompts · 15 categories · 3 complexity levels · 4 type tags*
