/**
 * discoveryIntent.ts — pure detector for similarity & discovery questions.
 * Compute lives in electron/algorithms/memory/discovery.ts.
 */

export type DiscoveryMetric =
  | 'similar_to' // 102/103/106/111/113 (track seed OR creative vibe mapping)
  | 'last_gig' // 105/166
  | 'discovery' // 104/107/110/160
  | 'hidden_gem' // 159
  | 'surprise' // 158
  | 'lockdown' // 164
  | 'b_side' // 165
  | 'obscure' // 169
  | 'unique' // 108
  | 'outside_genres' // 109/162
  | 'five_years' // 112 (honest limitation)

export interface DiscoveryHit {
  metric: DiscoveryMetric
  seed?: string
}

function clean(s: string): string {
  return s
    .replace(/[?."']+\s*$/g, '')
    .replace(
      /\b(tracks?|songs?|stuff|something|music|in my (library|collection)|from my (library|collection))\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectDiscovery(raw: string): DiscoveryHit | null {
  const q = raw.toLowerCase().trim()

  if (/\b(\d+\s*)?years? ago\b/.test(q) && /\b(play|played|used to)\b/.test(q))
    return { metric: 'five_years' }

  if (/\bsurprise me|pick (me )?(a|one) random|random track|play me anything\b/.test(q))
    return { metric: 'surprise' }
  if (
    /\bhidden gem|dig (into|through|deep).*(collection|gem|crate)|crate ?dig|buried (gem|treasure)/.test(
      q
    )
  )
    return { metric: 'hidden_gem' }
  if (/\b(during |in )?lockdown\b|during the pandemic|covid (era|times)/.test(q))
    return { metric: 'lockdown' }
  if (/\bb[- ]?side\b/.test(q)) return { metric: 'b_side' }
  if (
    /\bno one else.*(playing|plays)|nobody else.*play|obscure|under the radar|deep cuts? no one/.test(
      q
    )
  )
    return { metric: 'obscure' }

  if (
    /\bbased on (?:what i played )?(?:last|my last) (?:night|gig|set)|similar to .*last (gig|night|set)|like what i played.*last/.test(
      q
    )
  )
    return { metric: 'last_gig' }

  if (
    /\b(don'?t fit|outside).*(usual )?genres|unusual for (me|you)|totally different dj|outside (my|your) comfort/.test(
      q
    )
  )
    return { metric: 'outside_genres' }

  if (/\bmost unique|unusual track|outlier|weirdest|most distinctive/.test(q))
    return { metric: 'unique' }

  if (
    /\b(haven'?t discovered|undiscovered|forgot i had|forgotten i had|been ignoring|ignoring|i'?ve been neglecting|untouched since|haven'?t touched|never (touched|listened)|probably forgot)\b/.test(
      q
    )
  )
    return { metric: 'discovery' }

  // similarity / creative vibe — seed is whatever follows the phrase
  let m = q.match(/([a-z0-9'&.\s]+?)\s+fans would love/)
  if (m) return { metric: 'similar_to', seed: clean(m[1]) }
  m = q.match(
    /\b(?:similar to|sounds? like|more like|tracks like|reminds? me of|remind me of|vibe (?:with|of|like)|share a vibe with)\s+(.+)$/
  )
  if (m) return { metric: 'similar_to', seed: clean(m[1]) }

  return null
}
