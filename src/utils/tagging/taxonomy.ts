/**
 * Tag taxonomy — the single source of truth for every tag identity in SetRecord.
 *
 * Tags are deliberately a small, curated, plain-language vocabulary so they map
 * cleanly onto Smart-Crate filters, Rekordbox MyTags, and a simple override UI.
 * The engine (electron/services/tagging/tagRules.ts) only ever emits slugs that
 * appear here; the UI only ever renders `label`s from here. Nothing in the app
 * should hard-code a tag string anywhere else.
 *
 * Pure data + helpers — safe to import from both the renderer and the Electron
 * main process.
 */

import type { TagCategory } from '../../types'

export interface TagDef {
  /** Stable kebab-case identifier persisted in the DB and Rekordbox. Never change. */
  slug: string
  /** Plain-language display text. Safe to retune for wording. */
  label: string
}

export interface TagCategoryDef {
  category: TagCategory
  /** Plain-language category label, e.g. "Vibe". */
  label: string
  /** One-line helper shown in the override UI — plain language, no DSP terms. */
  description: string
  /** false = exactly one value (single-select); true = up to {@link maxValues}. */
  multi: boolean
  /** Cap on how many tags the auto-tagger emits for this category. */
  maxValues: number
  /** Accent colour for chips (hex). Distinct per category for fast scanning. */
  accent: string
  tags: TagDef[]
}

/**
 * Category definitions, in display order. Order here is the order shown in the
 * Tags view and the override popover.
 */
export const TAG_CATEGORIES: readonly TagCategoryDef[] = [
  {
    category: 'vibe',
    label: 'Vibe',
    description: 'The overall feel of the track.',
    multi: true,
    maxValues: 2,
    accent: '#A855F7',
    tags: [
      { slug: 'dark', label: 'Dark' },
      { slug: 'moody', label: 'Moody' },
      { slug: 'driving', label: 'Driving' },
      { slug: 'hypnotic', label: 'Hypnotic' },
      { slug: 'warm', label: 'Warm' },
      { slug: 'euphoric', label: 'Euphoric' },
      { slug: 'dreamy', label: 'Dreamy' },
      { slug: 'raw', label: 'Raw' }
    ]
  },
  {
    category: 'energy',
    label: 'Energy',
    description: 'How hard the track hits on the floor.',
    multi: false,
    maxValues: 1,
    accent: '#F97316',
    tags: [
      { slug: 'warm-up', label: 'Warm-up' },
      { slug: 'builder', label: 'Builder' },
      { slug: 'peak-time', label: 'Peak-time' },
      { slug: 'cooldown', label: 'Cooldown' }
    ]
  },
  {
    category: 'bestFor',
    label: 'Best for',
    description: 'Where in a set this track shines.',
    multi: true,
    maxValues: 2,
    accent: '#22C55E',
    tags: [
      { slug: 'opener', label: 'Opener' },
      { slug: 'peak', label: 'Peak' },
      { slug: 'closer', label: 'Closer' },
      { slug: 'tool', label: 'Tool' }
    ]
  },
  {
    category: 'time',
    label: 'Time of night',
    description: 'When in the night this track lands best.',
    multi: false,
    maxValues: 1,
    accent: '#3B82F6',
    tags: [
      { slug: 'sunset', label: 'Sunset' },
      { slug: 'prime', label: 'Prime' },
      { slug: 'late-night', label: 'Late-night' },
      { slug: 'after-hours', label: 'After-hours' }
    ]
  },
  {
    category: 'vocals',
    label: 'Vocals',
    description: 'How prominent the vocals are.',
    multi: false,
    maxValues: 1,
    accent: '#06B6D4',
    tags: [
      { slug: 'instrumental', label: 'Instrumental' },
      { slug: 'vocal-touches', label: 'Vocal touches' },
      { slug: 'vocal-led', label: 'Vocal-led' }
    ]
  },
  {
    category: 'genreBlend',
    label: 'Genre blend',
    description: 'The styles this track draws from.',
    multi: true,
    maxValues: 2,
    accent: '#EAB308',
    // The curated genre lexicon. Genre-blend tags are constrained to these so the
    // optional LLM pass can never emit free-form noise.
    tags: [
      { slug: 'house', label: 'House' },
      { slug: 'tech-house', label: 'Tech House' },
      { slug: 'deep-house', label: 'Deep House' },
      { slug: 'melodic-house', label: 'Melodic House' },
      { slug: 'progressive', label: 'Progressive' },
      { slug: 'techno', label: 'Techno' },
      { slug: 'melodic-techno', label: 'Melodic Techno' },
      { slug: 'minimal', label: 'Minimal' },
      { slug: 'afro-house', label: 'Afro House' },
      { slug: 'disco', label: 'Disco' },
      { slug: 'funk', label: 'Funk' },
      { slug: 'nu-disco', label: 'Nu-Disco' },
      { slug: 'indie-dance', label: 'Indie Dance' },
      { slug: 'breaks', label: 'Breaks' },
      { slug: 'garage', label: 'Garage' },
      { slug: 'drum-and-bass', label: 'Drum & Bass' },
      { slug: 'trance', label: 'Trance' },
      { slug: 'electro', label: 'Electro' },
      { slug: 'downtempo', label: 'Downtempo' },
      { slug: 'ambient', label: 'Ambient' },
      { slug: 'hip-hop', label: 'Hip-Hop' },
      { slug: 'pop', label: 'Pop' }
    ]
  }
] as const

// ───────── derived lookups ─────────

const CATEGORY_BY_ID = new Map<TagCategory, TagCategoryDef>(
  TAG_CATEGORIES.map((c) => [c.category, c])
)

/** Every category in display order. */
export function allCategories(): readonly TagCategoryDef[] {
  return TAG_CATEGORIES
}

export function getCategoryDef(category: TagCategory): TagCategoryDef | undefined {
  return CATEGORY_BY_ID.get(category)
}

export function getTagDef(category: TagCategory, slug: string): TagDef | undefined {
  return CATEGORY_BY_ID.get(category)?.tags.find((t) => t.slug === slug)
}

/** Plain-language label for a tag, falling back to a humanised slug. */
export function tagLabel(category: TagCategory, slug: string): string {
  const def = getTagDef(category, slug)
  if (def) return def.label
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

// Slugs are unique across categories, so a flat slug → { category, label }
// index lets callers resolve a bare slug (e.g. a tag filter token).
const SLUG_INDEX = new Map<string, { category: TagCategory; label: string }>()
for (const cat of TAG_CATEGORIES) {
  for (const t of cat.tags) SLUG_INDEX.set(t.slug, { category: cat.category, label: t.label })
}

/** Resolve a bare tag slug to its category, or undefined if unknown. */
export function categoryForSlug(slug: string): TagCategory | undefined {
  return SLUG_INDEX.get(slug)?.category
}

/** Plain-language label for a bare tag slug. */
export function labelForSlug(slug: string): string {
  return SLUG_INDEX.get(slug)?.label ?? slug.replace(/-/g, ' ')
}

/** Accent colour for a tag's category. */
export function tagAccent(category: TagCategory): string {
  return CATEGORY_BY_ID.get(category)?.accent ?? '#888888'
}

/** True if `slug` is a valid member of `category`. */
export function isValidTag(category: TagCategory, slug: string): boolean {
  return getTagDef(category, slug) !== undefined
}

/** Genre-blend lexicon slugs, for the LLM grammar constraint. */
export function genreLexicon(): readonly string[] {
  return CATEGORY_BY_ID.get('genreBlend')?.tags.map((t) => t.slug) ?? []
}

const CATEGORY_ORDER = TAG_CATEGORIES.map((c) => c.category)

/** Sort tags into the canonical category display order. */
export function orderTags<T extends { category: TagCategory }>(tags: T[]): T[] {
  return [...tags].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  )
}

/**
 * Pick the most useful few tags for a compact row: at most one per category, in
 * the priority order Energy → Vibe → Best for → Time → Vocals → Genre, capped.
 */
export function rowDisplayTags<T extends { category: TagCategory; value: string }>(
  tags: T[],
  max = 3
): T[] {
  const priority: TagCategory[] = ['energy', 'vibe', 'bestFor', 'time', 'vocals', 'genreBlend']
  const out: T[] = []
  for (const cat of priority) {
    const hit = tags.find((t) => t.category === cat && t.value)
    if (hit) out.push(hit)
    if (out.length >= max) break
  }
  return out
}
