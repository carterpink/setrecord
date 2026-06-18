/**
 * knowledge.ts — curated, offline DJ-domain knowledge base.
 *
 * Pure + renderer-safe. The local model is a TRANSLATOR, never a source of
 * facts, so DJ theory is answered from vetted entries here (not model recall).
 * detectKnowledge() classifies a question to a topic and returns the vetted
 * answer; the model may rephrase it but stays grounded to this text.
 *
 * Also handles dynamic "can I mix X into Y" harmonic-compatibility questions via
 * the Camelot wheel.
 */

export interface KnowledgeAnswer {
  topic: string
  answer: string
}

interface Entry {
  topic: string
  test: RegExp
  answer: string
}

// Ordered: more specific patterns first.
const ENTRIES: Entry[] = [
  // ── Harmonic mixing / keys ───────────────────────────────────────────────
  {
    topic: 'harmonic-mixing',
    test: /\b(what is|what's|explain).*(harmonic mixing|mixing in key)|how does harmonic mixing/,
    answer:
      "Harmonic mixing means blending tracks whose musical keys are compatible, using the Camelot Wheel (a DJ-friendly map of the Circle of Fifths). Compatible keys sit within ±1 step on the wheel, or are the relative major/minor of each other. Example: 8A (A minor) mixes smoothly into 7A, 9A, or 8B. SetRecord shows each track's Camelot key so you can line them up."
  },
  {
    topic: 'camelot-wheel',
    test: /\b(explain|what is|what's|how does).*(camelot wheel|camelot system)|the camelot wheel/,
    answer:
      'The Camelot Wheel has 24 positions: 12 minor keys on the A side (1A–12A) and 12 major keys on the B side (1B–12B). Each number+letter maps to a musical key (e.g. 8A = A minor, 8B = C major). Adjacent positions are harmonically compatible: from 8A you can move to 7A, 9A (±1 on the wheel) or 8B (relative major). It turns key-matching into simple number/letter moves.'
  },
  // ── Techniques ───────────────────────────────────────────────────────────
  {
    topic: 'dj-drop',
    test: /\b(what is|what's|explain)\s+(a |the )?(dj )?drop\b|what'?s a drop\b/,
    answer:
      'The drop is the moment the main elements (kick, bassline, lead) re-enter after a breakdown or build — the big energy release the floor is waiting for. In DJing you often mix so the incoming track\'s drop lands cleanly as the outgoing track falls away. (It\'s related to but distinct from the pop "the drop".)'
  },
  {
    topic: 'beatmatching',
    test: /\b(how (do|to)).*beatmatch|beatmatch.*(without|no) sync|manual beatmatch/,
    answer:
      "To beatmatch without sync: 1) find both tracks' BPM, 2) start the incoming track in your headphones, 3) adjust its pitch/tempo fader until its BPM matches the live track, 4) nudge the platter/jog to align the downbeats so the kicks land together, 5) let them run and fine-tune the pitch until they stay locked, then bring it in."
  },
  {
    topic: 'eqing-in',
    test: /\b(what does|what's|explain).*(eq(ing)? in)|eq(ing)? a track in/,
    answer:
      "EQing in means gradually raising the incoming track's EQ bands while cutting the outgoing track's, so the blend stays clean. The key move is the bass swap: cut the bass on one track and bring up the bass on the other at the mix point, because two basslines at once clash and sound muddy."
  },
  {
    topic: 'mix-vs-live-pa',
    test: /\b(difference between|what's the difference).*(dj (set|mix)).*(live pa|live set)|dj mix.*live pa/,
    answer:
      "A DJ mix is blending other artists' finished recordings together. A live PA (personal appearance) is performing your own music live with synths, drum machines, samplers and controllers — building the tracks in the moment rather than playing finished files. Hybrid sets that combine both are common."
  },
  {
    topic: 'set-length',
    test: /\bhow long (should|are).*(dj )?sets?\b|ideal set length|how long.*my sets be/,
    answer:
      "It depends on the slot: a warm-up is ~1–2 hours, a support set ~2–3 hours, a headliner 3–4+ hours, and residents vary. If you're starting out, aim for a tight, well-prepared 1–2 hour set."
  },
  {
    topic: 'white-label',
    test: /\b(what is|what's).*(white label)|white[- ]?label\b/,
    answer:
      "A white label is a vinyl pressing with a plain (white) label and no artwork or release info — typically a promo, a dubplate, or a DJ exclusive handed out before release. The concept doesn't map directly to digital files, where exclusivity is handled differently."
  },
  {
    topic: 'loop-diving',
    test: /\b(what is|what's|explain).*(loop diving|loop roll)/,
    answer:
      'Loop diving is activating a loop during a mix to extend a section — for example looping a breakdown or groove — to buy yourself time to find the next track\'s cue point or to stretch a moment on the floor. You "dive" into a loop, then release it back to the track.'
  },
  {
    topic: 'phrase-mixing',
    test: /\b(explain|what is|what's).*(phrase mixing|phrasing)|phrase mix/,
    answer:
      'Phrase mixing means aligning the 8-, 16- or 32-bar phrases of two tracks so transitions land on phrase boundaries — that\'s where the music naturally "resets". Count beats in groups of 4 to a bar, and bars in groups of 8/16 to a phrase; bringing the new track in at the start of a phrase sounds far more musical than mixing mid-phrase.'
  },
  {
    topic: 'tracks-to-prepare',
    test: /\b(how many tracks|ideal number of tracks).*(prepare|gig|set|bring)|tracks to (prepare|bring)/,
    answer:
      "A good rule of thumb is 2–3× the set length in tracks — roughly 60–90 tracks for a 2-hour gig. The extra gives you room to read the crowd, change direction, and have backups if a track doesn't land."
  },
  {
    topic: 'high-pass-filter',
    test: /\b(when|how|why).*(high.?pass|hpf)\b|high.?pass filters? in a mix/,
    answer:
      'Use a high-pass filter to roll the bass off the incoming track before you introduce it — that avoids two basslines clashing during the blend. High-pass sweeps are also a tension tool: filtering a track up during a build and dropping the filter on the downbeat releases energy.'
  },
  {
    topic: 'crate',
    test: /\b(what is|what's).*(a )?(dj'?s )?crate\b|what'?s a crate\b/,
    answer:
      'A crate is a curated selection of tracks prepared for a set — the term comes from carrying records in physical crates. The digital equivalent is a playlist or folder in your DJ software; in SetRecord your crates and playlists serve the same purpose.'
  },
  {
    topic: 'energy-arc',
    test: /\b(explain|what is|what's).*(energy arc|energy curve)|energy arc of (a|my) set/,
    answer:
      'The energy arc is how a set rises and falls over time: a low-energy warm-up, a gradual build, a peak, and a comedown. Not every set uses all four phases, and the shape is ultimately crowd-driven — think of it as a curve you steer rather than a fixed script.'
  },
  {
    topic: 'stem-separation',
    test: /\b(what is|what's|explain).*(stem separation|stems)|stem separation.*dj/,
    answer:
      "Stem separation uses AI to split a finished track into component stems — typically drums, bass, melody and vocals. For DJs that enables acapella layering, on-the-fly remixing, and cleaner transitions (e.g. dropping one track's vocal over another's instrumental). Several tools and some hardware do this; quality varies by track."
  },
  // ── Transitions theory ───────────────────────────────────────────────────
  {
    topic: 'ramp-bpm',
    test: /\bhow (do|to).*(transition|go|get).*(from )?\d{2,3}\s*bpm.*(to|into)\s*\d{2,3}\s*bpm/,
    answer:
      'To move a long way in tempo (e.g. 128 → 140 BPM), ramp gradually across several tracks rather than in one jump: nudge the pitch up a couple of BPM per track, use energy builds and breakdowns to mask the change, and mix over 8–16 bars. A breakdown or a half-time/double-time track makes a big jump feel natural.'
  },
  {
    topic: 'techno-to-house',
    test: /\b(best way|how) (to )?(drop|go|transition) (from )?techno (to|into) house/,
    answer:
      'Techno usually sits around 130–138 BPM and house around 120–128, so bridge the tempo gap: drop into a breakdown and bring house in underneath, use a half-time feel, or filter the techno out while easing the house in. Match keys where you can to keep it smooth.'
  },
  {
    topic: 'time-signature-mix',
    test: /\b(how|transition).*(4\/4).*(3\/4)|mix.*(3\/4|odd time|time signature)/,
    answer:
      "Mixing 4/4 into 3/4 is genuinely hard — the phrases don't line up and the triplet feel fights a straight kick. The most practical approach is to break the beatmatch entirely: use a breakdown, an ambient/atmospheric passage, or a moment of near-silence as a bridge, then start the new time feel fresh rather than trying to beat-align across it."
  },
  // ── Venues / context ─────────────────────────────────────────────────────
  {
    topic: 'venue-tresor',
    test: /\b(not|don'?t|shouldn'?t|avoid).*play.*tresor|tresor.*(not|avoid|first gig)/,
    answer:
      'Tresor is Berlin underground: hard, stripped-back, hypnotic techno with a dark aesthetic and no cheese. For a first gig there, avoid commercial house, big prominent vocals, melodic/euphoric anthems and slow BPMs. Keep it raw, driving and percussive, and read the room rather than reaching for obvious peak-time tracks.'
  },
  {
    topic: 'wedding',
    test: /\b(what|how).*(play|set).*wedding|wedding (dj|set|gig)/,
    answer:
      'Weddings are all-ages, broad-taste crowds, so play accessible, recognisable music across eras, keep content clean, and expect (and accommodate) requests. Read the room between dinner and party phases, have crowd-pleasers ready, and avoid niche or aggressive material that clears the floor.'
  },
  {
    topic: 'support-slot',
    test: /\b(support|warm.?up|opening).*(headliner|festival).*(strategy|what|how)|supporting a headliner/,
    answer:
      "As support, your job is to build the crowd, not steal the show: stay a notch below peak energy, avoid the headliner's signature tracks and style, don't peak too early, and leave somewhere for them to take it bigger. Hand over with momentum, not exhaustion."
  },
  {
    topic: 'rave-vs-club',
    test: /\b(difference between|what's the difference).*(rave).*(club)|rave (and|vs) club/,
    answer:
      "A rave tends to mean longer, looser sets with more freedom, often outdoor or unlicensed, and a crowd there for the music. A club night is more structured: fixed set times, a mixed crowd, licensing and noise constraints, and a stage-managed schedule. You'll prepare and pace a rave set very differently from a tight club slot."
  },
  // ── Import / export ──────────────────────────────────────────────────────
  {
    topic: 'import-rekordbox',
    test: /\bhow (do|to).*import.*rekordbox|import my rekordbox/,
    answer:
      'To import from Rekordbox: in Rekordbox, export your collection as an XML (File → Export Collection in xml format), then in SetRecord open the import flow and point it at that XML. SetRecord can also read a Rekordbox database directly. Your tracks, playlists, BPM and keys come across.'
  },
  {
    topic: 'import-serato',
    test: /\b(can i|how (do|to)).*import.*serato|serato.*import/,
    answer:
      'Yes — Serato import is supported. Serato stores its library in a "_Serato_" folder (in Music on macOS, or alongside your drives), including crates and per-file cues/beatgrids. Point SetRecord\'s import at your Serato library and it will bring in your tracks, crates, cue points and beatgrids where available.'
  },
  {
    topic: 'usb-cdjs',
    test: /\b(usb|export).*(pioneer|cdj|engine)|playlists? (onto|to) (a )?usb/,
    answer:
      'For Pioneer CDJs, SetRecord exports a gig-ready Engine DJ USB (it copies the audio and writes the database). Format the USB as FAT32 or exFAT first. Plug it into the CDJs and your playlists, BPM and cues are there. (USB export is a Pro feature.)'
  },
  {
    topic: 'hotcues-not-importing',
    test: /\b(why|hot ?cues?).*(not import|aren'?t import|missing).*(rekordbox)?|rekordbox.*hot ?cues?.*import/,
    answer:
      "Rekordbox 7 changed its database encryption (the cipher uses a passphrase, not the old format) and its schema, so hot cues sometimes don't come through from a direct DB read. The reliable workaround is to export a collection XML from Rekordbox and import that, which carries cues across; SetRecord handles the v7 cipher where it can."
  },
  {
    topic: 'backup',
    test: /\b(export|back ?up|backup).*(library|collection|everything).*(backup)?|how (do|to).*back ?up my (library|collection)/,
    answer:
      "SetRecord can export a full backup of your library — tracks, metadata, playlists and play history. Backups are encrypted by default; you choose the destination. Keep a copy off your main drive so a disk failure can't take your collection and gig history with it."
  },
  // ── Adversarial / honest redirects ───────────────────────────────────────
  {
    topic: 'best-song-ever',
    test: /\b(best|greatest) (song|track|tune) ever( made)?\b/,
    answer:
      'There\'s no objective "best song ever" — it\'s all taste. What I can do is help you find the best tracks in YOUR library: your most-played, your highest-rated, or the ones that land hardest with your crowd. Want me to pull those?'
  },
  {
    topic: 'timbre-undetectable',
    test: /\b(4.?on.?the.?floor|square wave|kick and a|bassline|sub bass).*(find|something|want)|find.*(square wave|4.?on.?the.?floor)/,
    answer:
      "A \"4-on-the-floor kick with a square-wave bassline\" is a structural/timbral description that isn't reliably detectable from standard track metadata, so I can't filter on it directly. What I can do is narrow to genres where that's common — techno and house — and you take it from there."
  },
  {
    topic: 'key-of-h',
    test: /\b(key of h|in the key of h)\b/,
    answer:
      'There\'s no standard key called "H" in most Western notation — did you mean B or B♭? (Fun fact: in German and Nordic notation, "H" actually means B natural, while "B" means B♭.) Tell me which you meant and I\'ll find those tracks.'
  },
  {
    topic: 'spotify-import',
    test: /\b(import|sync).*(from )?spotify|spotify.*(import|library)/,
    answer:
      "Spotify import isn't possible — streaming tracks are DRM-protected and there are no local audio files to read, so they can't be loaded into a DJ library. The alternative is to buy the tracks you love (Beatport, Bandcamp, etc.) and import them, or bring them in from Rekordbox/Serato."
  },
  {
    topic: 'scientifically-proven',
    test: /\b(scientifically|science).*(proven|proof).*(dance|move)|proven to make people dance/,
    answer:
      'I won\'t claim anything is "scientifically proven" to make people dance — that\'s not a real, reliable metric. What I can do is surface high-energy tracks or the ones that have actually worked for your crowd based on your play history. Want those?'
  },
  {
    topic: 'get-more-gigs',
    test: /\bhow (do|to|can i).*(get|land|book).*(more )?gigs|more gigs\b/,
    answer:
      'Booking is a bit outside what SetRecord does, but the things that get you gigs are things it helps with: tight, well-built sets, a recorded mix that shows your sound, knowing your library cold, and being CDJ-ready with USB exports. I can help you build a standout set or polish your selection — want to start there?'
  }
]

/** Camelot helpers for dynamic "mix X into Y" compatibility questions. */
const NOTE_TO_CAMELOT: Record<string, string> = {
  abm: '1A',
  'g#m': '1A',
  ebm: '2A',
  'd#m': '2A',
  bbm: '3A',
  'a#m': '3A',
  fm: '4A',
  cm: '5A',
  gm: '6A',
  dm: '7A',
  am: '8A',
  em: '9A',
  bm: '10A',
  'f#m': '11A',
  gbm: '11A',
  'c#m': '12A',
  dbm: '12A',
  b: '1B',
  'f#': '2B',
  gb: '2B',
  db: '3B',
  'c#': '3B',
  ab: '4B',
  'g#': '4B',
  eb: '5B',
  'd#': '5B',
  bb: '6B',
  'a#': '6B',
  f: '7B',
  c: '8B',
  g: '9B',
  d: '10B',
  a: '11B',
  e: '12B'
}

function toCamelot(token: string): string | null {
  const t = token
    .toLowerCase()
    .replace(/\s|maj|major/g, '')
    .replace(/min(or)?/g, 'm')
    .trim()
  if (/^\d{1,2}[ab]$/.test(t)) return t.toUpperCase()
  if (NOTE_TO_CAMELOT[t]) return NOTE_TO_CAMELOT[t]
  // bare note without quality → assume major
  if (NOTE_TO_CAMELOT[t.replace(/m$/, '')] && !t.endsWith('m')) return NOTE_TO_CAMELOT[t]
  return null
}

function camelotDistance(
  a: string,
  b: string
): { compatible: boolean; steps: number; sameLetter: boolean } {
  const na = parseInt(a, 10)
  const la = a.slice(-1)
  const nb = parseInt(b, 10)
  const lb = b.slice(-1)
  const raw = Math.abs(na - nb)
  const steps = Math.min(raw, 12 - raw)
  const sameLetter = la === lb
  const compatible = (sameLetter && steps <= 1) || (na === nb && !sameLetter)
  return { compatible, steps, sameLetter }
}

function tryMixCompat(q: string): KnowledgeAnswer | null {
  const m = q.match(
    /\b(?:can i |is it ok to |ok to )?mix(?:ing)?\s+([a-g][#b]?m?|[a-g][#b]?\s*(?:maj|major|min|minor)?|\d{1,2}[ab])\s+(?:into|with|to)\s+([a-g][#b]?m?|[a-g][#b]?\s*(?:maj|major|min|minor)?|\d{1,2}[ab])/
  )
  if (!m) return null
  const a = toCamelot(m[1])
  const b = toCamelot(m[2])
  if (!a || !b) return null
  const { compatible, steps } = camelotDistance(a, b)
  const answer = compatible
    ? `Yes — ${m[1].toUpperCase()} (${a}) and ${m[2].toUpperCase()} (${b}) are ${steps === 0 ? 'the same/relative key' : 'adjacent'} on the Camelot wheel, so they're harmonically compatible.`
    : `${m[1].toUpperCase()} (${a}) and ${m[2].toUpperCase()} (${b}) are ${steps} positions apart on the Camelot wheel — harmonically incompatible. Mix it only as an effect, or route through a shared neighbouring key (a compatible intermediate) first.`
  return { topic: 'mix-compatibility', answer }
}

/** Classify a DJ-knowledge question → vetted answer, or null if not knowledge. */
export function detectKnowledge(raw: string): KnowledgeAnswer | null {
  const q = raw.toLowerCase().trim()
  const mix = tryMixCompat(q)
  if (mix) return mix
  for (const e of ENTRIES) if (e.test.test(q)) return { topic: e.topic, answer: e.answer }
  return null
}
