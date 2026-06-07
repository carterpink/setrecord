/**
 * queryParser.ts — Pure, deterministic parser for the Recall "ask your library"
 * box. It maps common plain-English questions straight onto an engine intent +
 * slots WITHOUT any model — instant, reliable, offline. The local LLM is only a
 * fallback for phrasings this can't catch.
 *
 * Returns null when nothing is recognised (caller may then try the model).
 */

export type ParsedIntent =
  | 'forgotten_gems'
  | 'tracks_after'
  | 'best_closers'
  | 'best_openers'
  | 'top_sequences'
  | 'smart_filter'
  | 'lifecycle'
  | 'health'
  | 'identity'

export interface ParsedQuery {
  intent: ParsedIntent
  trackQuery?: string
  bpmMin?: number
  bpmMax?: number
  energyMin?: number
  energyMax?: number
  genre?: string
  neverPlayed?: boolean
  dormantMonths?: number
  minRating?: number
}

// Longest-first so "tech house" wins over "house", "drum and bass" over "bass".
const GENRES = [
  'progressive house',
  'melodic techno',
  'drum and bass',
  'liquid dnb',
  'tech house',
  'deep house',
  'afro house',
  'hard techno',
  'uk garage',
  'nu disco',
  'hip hop',
  'hip-hop',
  'amapiano',
  'afrobeats',
  'reggaeton',
  'breakbeat',
  'hardstyle',
  'psytrance',
  'dubstep',
  'techno',
  'trance',
  'garage',
  'electro',
  'minimal',
  'disco',
  'house',
  'jungle',
  'grime',
  'ambient',
  'downtempo',
  'hardcore',
  'breaks',
  'trap',
  'funk',
  'soul',
  'dnb',
  'd&b',
  'ukg',
  'bass',
  'acid'
]

function matchGenre(q: string): string | undefined {
  for (const g of GENRES) {
    // word-ish boundary so "house" doesn't match inside "warehouse"
    const re = new RegExp(`(?:^|[^a-z])${g.replace(/[+*]/g, '\\$&')}(?:$|[^a-z])`)
    if (re.test(q)) return g
  }
  return undefined
}

export function parseQuery(raw: string): ParsedQuery | null {
  const q = raw.toLowerCase().trim()
  if (!q) return null

  // ── "after <track>" → personal transition lookup
  const after = q.match(/\bafter\s+(.+)$/)
  if (after && after[1]) {
    const trackQuery = after[1].replace(/[?."']+$/g, '').trim()
    if (trackQuery.length >= 2) return { intent: 'tracks_after', trackQuery }
  }

  // ── Direct intents (keyword triggers)
  if (
    /\b(forgotten|forgot|gems?|heaters?|used to (play|spin)|haven'?t (played|spun)|rediscover|gathering dust)\b/.test(
      q
    )
  )
    return { intent: 'forgotten_gems' }
  if (/\b(clos(e|er|ers|ing)|finish(er|ers)?|last track|end (of|my) )/.test(q))
    return { intent: 'best_closers' }
  if (/\b(open(er|ers|ing)?|first track|start (of|my) (set|night))/.test(q))
    return { intent: 'best_openers' }
  if (
    /\b(transitions?|combos?|go.?to (pairs|transitions)|most (common|used) (transitions|pairs|runs)|my runs)\b/.test(
      q
    )
  )
    return { intent: 'top_sequences' }
  if (/\b(health|missing (files?|keys?|bpm)|duplicates?|broken|clean.?up)\b/.test(q))
    return { intent: 'health' }
  if (/\b(lifecycle|peak rotation|breakdown|how many .*(peak|active|forgotten|untested))\b/.test(q))
    return { intent: 'lifecycle' }
  if (/\b(my taste|identity|signature|my sound|wrapped|what genres|taste profile)\b/.test(q))
    return { intent: 'identity' }

  // ── Constraint-based filter (bpm / genre / energy / rating / dormancy / never-played)
  const slots: ParsedQuery = { intent: 'smart_filter' }
  let hasSlot = false

  // BPM range: "120-128 bpm", "between 120 and 128 bpm", "120 to 128 bpm"
  const range = q.match(/(\d{2,3})\s*(?:-|–|—|to|and)\s*(\d{2,3})\s*bpm/)
  const single = q.match(/(\d{2,3})\s*bpm/)
  if (range) {
    slots.bpmMin = Math.min(+range[1], +range[2])
    slots.bpmMax = Math.max(+range[1], +range[2])
    hasSlot = true
  } else if (single) {
    const t = +single[1]
    // A single tempo is rarely exact — give it ±2 so "128bpm" finds 126–130.
    slots.bpmMin = t - 2
    slots.bpmMax = t + 2
    hasSlot = true
  }

  const genre = matchGenre(q)
  if (genre) {
    slots.genre = genre
    hasSlot = true
  }

  if (/\b(peak|banger|bangers|hard|heavy|high.?energy|festival|big room)\b/.test(q)) {
    slots.energyMin = 8
    hasSlot = true
  } else if (/\b(chill|chilled|mellow|low.?energy|warm.?up|sleepy|ambient)\b/.test(q)) {
    slots.energyMax = 4
    hasSlot = true
  } else if (/\b(groovy|mid.?energy|medium energy|rolling)\b/.test(q)) {
    slots.energyMin = 4
    slots.energyMax = 6
    hasSlot = true
  }

  if (/\b(never (played|tested|spun)|untested|not (played|tested) live)\b/.test(q)) {
    slots.neverPlayed = true
    hasSlot = true
  }

  const rating = q.match(/\b([1-5])\s*star/)
  if (rating) {
    slots.minRating = +rating[1]
    hasSlot = true
  } else if (/\b(favou?rites?|top rated|best rated)\b/.test(q)) {
    slots.minRating = 4
    hasSlot = true
  }

  const dormant = q.match(
    /\bnot (?:played|spun) in (?:the last )?(\d+)\s*(month|months|year|years)/
  )
  if (dormant) {
    slots.dormantMonths = dormant[2].startsWith('year') ? +dormant[1] * 12 : +dormant[1]
    hasSlot = true
  }

  return hasSlot ? slots : null
}
