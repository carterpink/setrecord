/**
 * fuzzy.ts — tiny, dependency-free fuzzy string matching for query robustness.
 *
 * Damerau–Levenshtein (optimal string alignment) with an early-exit budget, plus
 * a vocabulary matcher used to repair misspelled tokens ("fihser" → "fisher",
 * "tecno" → "techno") before the deterministic intent cascade runs. Pure and
 * renderer-safe.
 */

/**
 * Optimal-string-alignment distance (Levenshtein + adjacent transposition),
 * capped at `max` — returns max + 1 as soon as the budget is provably blown.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  if (la === 0) return lb
  if (lb === 0) return la

  let prevPrev: number[] = []
  let prev: number[] = []
  let curr: number[] = []
  for (let j = 0; j <= lb; j++) prev[j] = j

  for (let i = 1; i <= la; i++) {
    curr = [i]
    let rowMin = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1)
      }
      curr[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prevPrev = prev
    prev = curr
  }
  return prev[lb]
}

/**
 * Edit budget for a token of this length. Deliberately tight: distance 1 covers
 * virtually all real typos (transposition, one wrong/missing letter) while
 * distance 2 on mid-length words starts mangling REAL words into vocabulary
 * ("mixing" → "mixes"), so 2 is reserved for long tokens only.
 */
export function maxEditsFor(len: number): number {
  if (len <= 3) return 0
  if (len <= 8) return 1
  return 2
}

/**
 * Best fuzzy match for `token` among `words`, or null when nothing lands within
 * the length-scaled budget. Requires loose first-letter agreement (direct match
 * or a leading transposition) so "house" never "corrects" to "mouse"-adjacent
 * vocabulary from a cold start.
 */
/** True when `a`'s characters appear in `b` in order (a is a subsequence). */
function isSubsequence(a: string, b: string): boolean {
  let i = 0
  for (let j = 0; j < b.length && i < a.length; j++) if (b[j] === a[i]) i++
  return i === a.length
}

export function bestMatch(
  token: string,
  words: Iterable<string>,
  maxOverride?: number
): string | null {
  const budget = maxOverride ?? maxEditsFor(token.length)
  if (budget === 0) return null
  let best: string | null = null
  // Score = (distance, typo-class, length gap) — lower wins. Typo-class prefers
  // dropped-letter fixes ("playd" → "played", where the token is a subsequence
  // of the candidate) over truncations ("playd" → "play") and substitutions.
  let bestScore = Number.MAX_SAFE_INTEGER
  const t0 = token[0]
  const t1 = token[1]
  for (const w of words) {
    if (w.length < 2 || Math.abs(w.length - token.length) > budget) continue
    // Loose anchor: same first letter, or the first two letters are swapped.
    if (w[0] !== t0 && !(w[0] === t1 && w[1] === t0)) continue
    const d = editDistance(token, w, budget)
    if (d > budget) continue
    const cls = isSubsequence(token, w) ? 0 : isSubsequence(w, token) ? 1 : 2
    const score = d * 100 + cls * 10 + Math.abs(w.length - token.length)
    if (score < bestScore) {
      bestScore = score
      best = w
    }
  }
  return best
}
