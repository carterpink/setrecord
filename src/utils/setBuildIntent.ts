/**
 * setBuildIntent.ts — pure detector + slot parser for "build me a set" requests.
 * Compute lives in electron/algorithms/memory/setBuilder.ts.
 */

export type EnergyArc = 'rise' | 'peak' | 'story' | 'flat'

export interface SetBuildHit {
  lengthMinutes?: number
  count?: number
  targetBpm?: number
  bpmStart?: number
  bpmEnd?: number
  genre?: string
  arc: EnergyArc
  neverPlayed?: boolean
  venue?: string
  anchor?: string
  durationMinSec?: number
  noVocals?: boolean
  vinylOnly?: boolean
  multi?: number // build N distinct sets
  optionsCount?: number // "three opening tracks to choose from"
  openers?: boolean
  avoidRecentDays?: number
}

const GENRES = [
  'progressive house',
  'melodic techno',
  'drum and bass',
  'tech house',
  'deep house',
  'afro house',
  'hard techno',
  'detroit techno',
  'acid house',
  'uk garage',
  'big room',
  'techno',
  'house',
  'trance',
  'minimal',
  'disco',
  'dnb',
  'electro',
  'breakbeat',
  'dubstep'
]

function findGenre(q: string): string | undefined {
  for (const g of GENRES) if (new RegExp(`\\b${g}\\b`).test(q)) return g
  return undefined
}
function parseMinutes(q: string): number | undefined {
  const hr = q.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)s?\b/)
  if (hr) return Math.round(parseFloat(hr[1]) * 60)
  const min = q.match(/(\d{1,3})\s*(?:-|–|to)?\s*min(?:ute)?s?\b/)
  if (min) return +min[1]
  return undefined
}

const BUILD_VERB = /\b(build|make|create|put together|craft|assemble|generate|give me)\b/
const SET_NOUN = /\b(set|mix|warm[- ]?up|journey|playlist|b2b|back[- ]?to[- ]?back|pool)\b/

export function isBuildRequest(q: string): boolean {
  const dur = /\b\d+\s*(?:-|–|to)?\s*(?:min(?:ute)?s?|hours?|hrs?)\b/.test(q)
  if (/\bwarm[- ]?up\b/.test(q) && (BUILD_VERB.test(q) || dur)) return true
  if (BUILD_VERB.test(q) && (SET_NOUN.test(q) || dur)) return true
  if (SET_NOUN.test(q) && dur) return true
  if (/\b(sunrise|festival|peak time) set\b/.test(q)) return true
  if (/\b(\d+|two|three|four|five)\s+(?:different\s+)?(opening|opener) tracks?\b/.test(q)) return true
  return false
}

export function detectSetBuild(raw: string): SetBuildHit | null {
  const q = raw.toLowerCase().trim()
  if (!isBuildRequest(q)) return null

  const hit: SetBuildHit = { arc: 'rise' }
  hit.lengthMinutes = parseMinutes(q)

  // explicit track count ("30 tracks", "create a pool of 30")
  const cnt = q.match(/\b(\d{1,3})\s*(?:tracks?|tunes?|cuts?)\b/) || q.match(/pool of\s+(\d{1,3})/)
  if (cnt) hit.count = +cnt[1]

  // BPM arc "starts at 124 ... ends at 132" / "124 to 132 bpm"
  const arcBpm =
    q.match(/start(?:s|ing)?\s*(?:at)?\s*(\d{2,3}).*end(?:s|ing)?\s*(?:at)?\s*(\d{2,3})/) ||
    q.match(/(\d{2,3})\s*(?:to|–|-)\s*(\d{2,3})\s*bpm/)
  if (arcBpm) {
    hit.bpmStart = +arcBpm[1]
    hit.bpmEnd = +arcBpm[2]
  } else {
    const single = q.match(/(\d{2,3})\s*bpm/) || q.match(/\b(?:at|around|~)\s*(\d{2,3})\b/)
    if (single && +single[1] >= 90 && +single[1] <= 200) hit.targetBpm = +single[1]
  }

  hit.genre = findGenre(q)

  // arc / vibe
  if (
    /dark.*(euphoric|euphoria|uplifting).*(down|back|comedown|melodic)|tells? a story|start dark/.test(
      q
    )
  )
    hit.arc = 'story'
  else if (/\b(peak[- ]?time|peak hour|festival|main stage|2 ?am|500|big room|banger)\b/.test(q))
    hit.arc = 'peak'
  else if (/\b(warm[- ]?up|sunrise|slow burn|build|gradual|opener|background)\b/.test(q))
    hit.arc = 'rise'
  else if (/\bsteady|flat|consistent|even\b/.test(q)) hit.arc = 'flat'

  if (
    /\b(never|haven'?t) (played|spun)|unplayed|i haven'?t played before|i've never played\b/.test(q)
  )
    hit.neverPlayed = true

  const venue = q.match(
    /\b(?:at|from)\s+([a-z0-9][a-z0-9'&.\s]{1,30}?)(?=\s+(?:only|set|tracks?)|[?,.]|$)/
  )
  if (venue && /\b(at|played at|tracks i'?ve played at)\b/.test(q)) {
    const v = venue[1].replace(/[?!.,]+$/, '').trim()
    if (v && !['home', 'least', 'peak'].includes(v)) hit.venue = v
  }

  const anchor = q.match(
    /\b(?:start(?:ed|ing)? (?:with|on|from)|anchor(?:ed)? (?:on|with)|if i started my set with)\s+(.+?)(?:[?.]|$|,| and build| build)/
  )
  if (anchor && anchor[1].trim().length >= 2) hit.anchor = anchor[1].trim()

  if (/\b(longer than|over|more than|above)\s+(\d{1,2})\s*min/.test(q)) {
    const m = q.match(/\b(?:longer than|over|more than|above)\s+(\d{1,2})\s*min/)
    if (m) hit.durationMinSec = +m[1] * 60
  }
  if (/\bno vocals?|instrumental|without vocals\b/.test(q)) hit.noVocals = true
  if (/\bvinyl[- ]?only|only vinyl|vinyl set\b/.test(q)) hit.vinylOnly = true

  const multi = q.match(/\b(\d+)\s+(?:different|distinct|separate)\s+.*sets?\b/)
  if (multi) hit.multi = +multi[1]

  const opts = q.match(/\b(\d+|three|two|four)\s+(?:different\s+)?(?:opening|opener)\s+tracks?\b/)
  if (opts) {
    const word: Record<string, number> = { two: 2, three: 3, four: 4 }
    hit.optionsCount = (word[opts[1]] ?? +opts[1]) || 3
    hit.openers = true
  }

  const avoid = q.match(
    /\b(?:avoid|not|except).*(?:last|past)\s+(\d+)?\s*(month|months|week|weeks|day|days)/
  )
  if (avoid || /\bavoid anything i('?ve)? played (in|recently)/.test(q)) {
    const n = avoid?.[1] ? +avoid[1] : 1
    const unit = avoid?.[2] ?? 'month'
    hit.avoidRecentDays = unit.startsWith('week') ? n * 7 : unit.startsWith('day') ? n : n * 30
  }

  return hit
}
