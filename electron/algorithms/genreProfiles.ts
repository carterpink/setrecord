import type { Track, EnergyCurveType, GenreProfileSummary } from '../../src/types'

/**
 * Per-genre mixing intelligence.
 *
 * Every electronic style mixes by its own conventions: house builds slowly and
 * harmonically, techno rolls hypnotically and tolerates moodier drops, DnB sits
 * in a tight high-BPM band, trance lives on long emotional builds. Rather than
 * scoring every transition with one universal model, we encode each style as a
 * `MixingProfile` of parameters that nudge the existing BPM / energy / key
 * scoring (see transitionScore.ts) and steer Set Architect's energy arc.
 *
 * The profiles are deliberately *soft modifiers*: the `generic` profile is the
 * identity (it reproduces the original scoring exactly), so behaviour only
 * changes once a real genre is detected from the library or chosen by the DJ.
 */
export interface MixingProfile {
  /** Canonical, stable id used across IPC + persistence. */
  id: string
  /** Display label, e.g. "Tech House". */
  label: string
  /** Plain-language fragment for user-facing copy: "This set follows {blurb}." */
  blurb: string
  bpm: {
    /** Typical low/high tempo for the style — seeds the Architect BPM range. */
    typicalMin: number
    typicalMax: number
    /** Preferred BPM step between neighbouring tracks. */
    idealStep: number
    /**
     * Largest BPM jump still considered mixable. Drives the suggestion
     * candidate window AND scales the BPM scoring ladder (scale = maxStep/16,
     * so generic's 16 keeps the original ladder unchanged).
     */
    maxStep: number
  }
  energy: {
    /** Multiplier on the "+1 energy = crowd building" bonus (generic = 1). */
    buildBias: number
    /** Multiplier on the sharp-drop penalty (generic = 1; <1 = more tolerant). */
    dropTolerance: number
    /** Style favours gradual energy moves over jumps (informational/curve hint). */
    preferGradual: boolean
  }
  flow: {
    /** Multiplier on harmonic (key) points (generic = 1; techno <1, trance >1). */
    harmonicWeight: number
    /** Canonical energy arc the Architect defaults to for this style. */
    curve: EnergyCurveType
  }
}

// ───────── The identity profile ─────────
// Values here MUST reproduce the original (pre-genre) scoring exactly:
// maxStep 16 → bpm scale 1, all multipliers 1. Guarded by a regression test.
export const GENERIC_PROFILE: MixingProfile = {
  id: 'generic',
  label: 'Auto',
  blurb: 'a balanced flow',
  bpm: { typicalMin: 120, typicalMax: 130, idealStep: 4, maxStep: 16 },
  energy: { buildBias: 1, dropTolerance: 1, preferGradual: false },
  flow: { harmonicWeight: 1, curve: 'rise' }
}

// ───────── Genre registry ─────────

const PROFILE_LIST: MixingProfile[] = [
  GENERIC_PROFILE,
  {
    id: 'tech-house',
    label: 'Tech House',
    blurb: 'a tech-house build',
    bpm: { typicalMin: 122, typicalMax: 128, idealStep: 2, maxStep: 12 },
    energy: { buildBias: 1.2, dropTolerance: 1.1, preferGradual: true },
    flow: { harmonicWeight: 1.05, curve: 'rise' }
  },
  {
    id: 'house',
    label: 'House',
    blurb: 'a house groove',
    bpm: { typicalMin: 120, typicalMax: 126, idealStep: 2, maxStep: 12 },
    energy: { buildBias: 1.1, dropTolerance: 1, preferGradual: true },
    flow: { harmonicWeight: 1.05, curve: 'rise' }
  },
  {
    id: 'deep-house',
    label: 'Deep House',
    blurb: 'a deep-house flow',
    bpm: { typicalMin: 118, typicalMax: 124, idealStep: 2, maxStep: 10 },
    energy: { buildBias: 1, dropTolerance: 0.8, preferGradual: true },
    flow: { harmonicWeight: 1.1, curve: 'wave' }
  },
  {
    id: 'melodic-techno',
    label: 'Melodic Techno',
    blurb: 'a melodic build',
    bpm: { typicalMin: 120, typicalMax: 126, idealStep: 2, maxStep: 12 },
    energy: { buildBias: 1.2, dropTolerance: 0.9, preferGradual: true },
    flow: { harmonicWeight: 1.2, curve: 'peak-sustain' }
  },
  {
    id: 'techno',
    label: 'Techno',
    blurb: 'a driving techno build',
    bpm: { typicalMin: 128, typicalMax: 138, idealStep: 3, maxStep: 14 },
    energy: { buildBias: 1.3, dropTolerance: 0.6, preferGradual: false },
    flow: { harmonicWeight: 0.85, curve: 'peak-sustain' }
  },
  {
    id: 'trance',
    label: 'Trance',
    blurb: 'a trance build',
    bpm: { typicalMin: 132, typicalMax: 140, idealStep: 2, maxStep: 12 },
    energy: { buildBias: 1.6, dropTolerance: 1.3, preferGradual: true },
    flow: { harmonicWeight: 1.2, curve: 'peak-sustain' }
  },
  {
    id: 'progressive-house',
    label: 'Progressive House',
    blurb: 'a progressive build',
    bpm: { typicalMin: 124, typicalMax: 130, idealStep: 2, maxStep: 12 },
    energy: { buildBias: 1.3, dropTolerance: 1.1, preferGradual: true },
    flow: { harmonicWeight: 1.15, curve: 'rise' }
  },
  {
    id: 'dnb',
    label: 'Drum & Bass',
    blurb: 'a drum & bass roller',
    bpm: { typicalMin: 170, typicalMax: 178, idealStep: 2, maxStep: 10 },
    energy: { buildBias: 1.3, dropTolerance: 0.7, preferGradual: false },
    flow: { harmonicWeight: 0.9, curve: 'peak-sustain' }
  },
  {
    id: 'bass',
    label: 'Bass / Dubstep',
    blurb: 'a bass-driven flow',
    bpm: { typicalMin: 140, typicalMax: 150, idealStep: 4, maxStep: 20 },
    energy: { buildBias: 1.2, dropTolerance: 0.5, preferGradual: false },
    flow: { harmonicWeight: 0.8, curve: 'wave' }
  },
  {
    id: 'hardstyle',
    label: 'Hard Dance',
    blurb: 'a hard-dance build',
    bpm: { typicalMin: 145, typicalMax: 155, idealStep: 3, maxStep: 14 },
    energy: { buildBias: 1.4, dropTolerance: 0.8, preferGradual: false },
    flow: { harmonicWeight: 0.9, curve: 'peak-sustain' }
  },
  {
    id: 'disco',
    label: 'Disco / Funk',
    blurb: 'a disco groove',
    bpm: { typicalMin: 110, typicalMax: 124, idealStep: 4, maxStep: 18 },
    energy: { buildBias: 1.1, dropTolerance: 1, preferGradual: false },
    flow: { harmonicWeight: 1, curve: 'wave' }
  }
]

const PROFILES_BY_ID = new Map(PROFILE_LIST.map((p) => [p.id, p]))

/** Renderer-facing summary of one profile. */
export function toSummary(p: MixingProfile): GenreProfileSummary {
  return { id: p.id, label: p.label, blurb: p.blurb }
}

/** All selectable profiles (generic first), for the manual override UI. */
export function listProfileSummaries(): GenreProfileSummary[] {
  return PROFILE_LIST.map(toSummary)
}

/** Resolve a profile by id, falling back to the identity profile. */
export function getProfile(id?: string | null): MixingProfile {
  if (!id) return GENERIC_PROFILE
  return PROFILES_BY_ID.get(id) ?? GENERIC_PROFILE
}

// ───────── Genre tag normalisation ─────────
// Ordered keyword matcher: the FIRST entry whose keyword appears in the
// (lower-cased) raw tag wins. Multi-word styles are listed before their
// substrings so "tech house" never falls through to "house", etc.
const GENRE_MATCHERS: Array<{ id: string; keywords: string[] }> = [
  { id: 'tech-house', keywords: ['tech house', 'tech-house', 'techhouse'] },
  { id: 'deep-house', keywords: ['deep house', 'deep-house'] },
  { id: 'progressive-house', keywords: ['progressive', 'prog house', 'prog-house'] },
  {
    id: 'melodic-techno',
    keywords: ['melodic techno', 'melodic house', 'melodic', 'organic house']
  },
  {
    id: 'dnb',
    keywords: [
      'drum & bass',
      'drum and bass',
      'drum n bass',
      'dnb',
      'd&b',
      'jungle',
      'liquid',
      'neurofunk',
      'breakbeat'
    ]
  },
  { id: 'techno', keywords: ['techno', 'schranz', 'minimal'] },
  { id: 'trance', keywords: ['trance', 'psy', 'uplifting', 'goa'] },
  { id: 'hardstyle', keywords: ['hardstyle', 'hardcore', 'hard dance', 'rawstyle', 'gabber'] },
  { id: 'bass', keywords: ['dubstep', 'riddim', 'future bass', 'bass music', 'trap', 'grime'] },
  { id: 'disco', keywords: ['disco', 'funk', 'boogie', 'soul'] },
  { id: 'house', keywords: ['house', 'garage', 'afro', 'amapiano', 'speed garage'] }
]

/** Map a raw genre tag to a canonical profile id, or null if unrecognised. */
export function normaliseGenre(raw: string): string | null {
  const g = raw.toLowerCase().trim()
  if (g === '') return null
  for (const { id, keywords } of GENRE_MATCHERS) {
    if (keywords.some((k) => g.includes(k))) return id
  }
  return null
}

/**
 * Detect the library's dominant style by taking the mode of the normalised
 * genre tags. Returns the identity profile when nothing recognisable is tagged.
 */
export function detectDominantProfile(tracks: Track[]): MixingProfile {
  const counts = new Map<string, number>()
  for (const t of tracks) {
    if (!t.genre || t.genre.trim() === '') continue
    const id = normaliseGenre(t.genre)
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let bestId: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestId = id
    }
  }
  return getProfile(bestId)
}

/** BPM-ladder scale derived from the style's max mixable step (generic → 1). */
export function bpmScale(profile: MixingProfile): number {
  return profile.bpm.maxStep / GENERIC_PROFILE.bpm.maxStep
}
