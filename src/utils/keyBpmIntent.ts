/**
 * keyBpmIntent.ts — pure detector for precise key/BPM queries that the generic
 * parser handles too loosely (tight "at N BPM", harmonic compatibility,
 * "same key as X", flat/minor-only, "BPM of X"). Compute in
 * electron/algorithms/memory/keyBpm.ts.
 */

export type KeyBpmMetric =
  | 'bpm_of' // 023
  | 'exact_bpm' // 021 / 029 (+key)
  | 'same_key_as' // 034
  | 'key_of' // 011
  | 'harmonic_with' // 027
  | 'harmonic_mix_into' // 032
  | 'pitch_shift' // 033
  | 'flat_keys' // 035
  | 'minor_only' // 038
  | 'major_only'

export interface KeyBpmHit {
  metric: KeyBpmMetric
  seed?: string
  bpm?: number
  keyText?: string
}

export function detectKeyBpm(raw: string): KeyBpmHit | null {
  const q = raw.toLowerCase().trim()

  let m = q.match(/\b(?:what'?s |whats )?the bpm of\s+(.+)$/) || q.match(/\bbpm of\s+(.+)$/)
  if (m) return { metric: 'bpm_of', seed: m[1].replace(/[?."']+$/g, '').trim() }

  m = q.match(/\b(?:same key as|in the same key as|key as)\s+(.+)$/)
  if (m) return { metric: 'same_key_as', seed: m[1].replace(/[?."']+$/g, '').trim() }

  if (/\bflat keys?\b|in flat\b|tracks? in flats?\b/.test(q)) return { metric: 'flat_keys' }
  if (/\bminor keys? (only|alone)|only minor keys?|in minor keys?\b/.test(q))
    return { metric: 'minor_only' }
  if (/\bmajor keys? (only|alone)|only major keys?\b/.test(q)) return { metric: 'major_only' }

  // harmonically compatible with 8A
  m =
    q.match(/\b(?:compatible|harmonic\w*).{0,24}?(\d{1,2}[ab])\b/) ||
    q.match(/(\d{1,2}[ab])\b.{0,24}?\bcompatible/)
  if (m) return { metric: 'harmonic_with', keyText: m[1] }

  // "mix into a 128 BPM track in G major"
  m = q.match(/mix into a\s*(\d{2,3})\s*bpm track in\s+([a-g][#b]?\s*(?:major|minor|maj|min)?)/)
  if (m) return { metric: 'harmonic_mix_into', bpm: +m[1], keyText: m[2].trim() }

  // "pitch shift well to 132 BPM from around 128"
  m =
    q.match(/pitch shift.*to\s*(\d{2,3})\s*bpm.*from\s*(?:around\s*)?(\d{2,3})/) ||
    q.match(/shift.*to\s*(\d{2,3})\b.*from\s*(?:around\s*)?(\d{2,3})/)
  if (m) return { metric: 'pitch_shift', bpm: +m[1], seed: m[2] }

  // tight exact BPM ("tracks at 128 BPM", "exactly 128 bpm") + optional key
  m =
    q.match(/\b(?:at|exactly)\s*(\d{2,3})\s*bpm/) ||
    q.match(/\btracks?\s+(?:at\s+)?(\d{2,3})\s*bpm\b/)
  if (m && !/around|about|~|ish|roughly|between|to\s*\d/.test(q)) {
    const keyM =
      q.match(/\bin\s+([a-g][#b]?\s*(?:major|minor|maj|min)|[a-g]m\b|\d{1,2}[ab])\b/) ||
      q.match(/\b(a|b|c|d|e|f|g)[#b]?\s*(minor|major)\b/)
    return {
      metric: 'exact_bpm',
      bpm: +m[1],
      keyText: keyM ? keyM[0].replace(/^in\s+/, '').trim() : undefined
    }
  }

  // "key of Am" / "in the key of A minor"
  m = q.match(/\b(?:in (?:the )?key of|key of)\s+([a-g][#b]?\s*(?:major|minor|maj|min)?|[a-g]m)\b/)
  if (m) return { metric: 'key_of', keyText: m[1].trim() }

  return null
}
