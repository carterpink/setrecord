/**
 * transitionIntent.ts — pure detector for transition / sequencing questions.
 * Compute lives in electron/algorithms/memory/transitionsEngine.ts.
 */

export type TransitionMetric =
  | 'after' // 039/042 — what to play after X (track or genre)
  | 'before' // 047 — what precedes X in set history
  | 'opener' // 046
  | 'closer' // 048
  | 'bridge_two' // 041
  | 'bridge_genres' // 050
  | 'pairs' // 051
  | 'warmup_history' // 052
  | 'breakdown' // 044
  | 'acapella' // 053

export interface TransitionHit {
  metric: TransitionMetric
  seed?: string
  genreA?: string
  genreB?: string
}

function clean(s: string): string {
  return s
    .replace(/[?."']+\s*$/g, '')
    .replace(/\b(in my (set )?(history|collection|library)|from my (collection|library))\b/g, ' ')
    .replace(/^(?:the\s+)?(?:track|song|tune)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectTransition(raw: string): TransitionHit | null {
  const q = raw.toLowerCase().trim()

  if (/\ba ?capp?ella\b/.test(q)) return { metric: 'acapella' }

  if (
    /\b(out of|after|transition.*out of) a breakdown|tracks? that (transition|come in).*breakdown/.test(
      q
    )
  )
    return { metric: 'breakdown' }

  if (
    /\b(most.?used|go.?to|favou?rite|recurring).*(transition|pair|combo|run)|transition pairs|my (combos|runs)/.test(
      q
    )
  )
    return { metric: 'pairs' }

  if (
    /\bwarm.?up\b.*(last|past|6|six) months|used as (a )?warm.?up|warm.?ups? (i'?ve|in the last)/.test(
      q
    )
  )
    return { metric: 'warmup_history' }

  let m =
    q.match(/\b(?:what comes|what came|what'?s|whats) before\s+(.+)$/) ||
    q.match(/\bbefore\s+(.+?)\s+in my set history$/)
  if (m) return { metric: 'before', seed: clean(m[1]) }

  // bridge between two genres
  m =
    q.match(/\bbridge\s+(.+?)\s+and\s+(.+?)(?:\s+in my|$)/) ||
    q.match(/\bcross between\s+(.+?)\s+and\s+(.+?)(?:\s+in my|$)/)
  if (m) return { metric: 'bridge_genres', genreA: clean(m[1]), genreB: clean(m[2]) }

  if (/\b(between (these )?two tracks|something to play between|play between)\b/.test(q))
    return { metric: 'bridge_two' }

  if (/\b(opener|opening track)\b|find me an opener|an opener (track|tune)/.test(q))
    return { metric: 'opener' }
  if (
    /\b(closer|closing track|set[- ]?clos|finish(er)?|last track of (my|the) (set|night)|end (my|the) (set|night))\b/.test(
      q
    )
  )
    return { metric: 'closer' }

  // "what (can|do|should) i play after X" / "X plays well after Y" / "mix out of X"
  m =
    q.match(/\bwhat (?:can|do|should|to)? ?i? ?play (?:well )?after\s+(.+)$/) ||
    q.match(/\bplays? well after\s+(.+)$/) ||
    q.match(/\bafter\s+(.+?)\s+(?:can i play|what)/) ||
    q.match(/\bmix(?:ing)? out of\s+(.+)$/) ||
    q.match(/\bwhat (?:can|do|should) i play after\s+(.+)$/)
  if (m) return { metric: 'after', seed: clean(m[1]) }
  if (/\bwhat (plays|works) (well )?after\b/.test(q)) {
    const after = q.match(/after\s+(.+)$/)
    return { metric: 'after', seed: after ? clean(after[1]) : undefined }
  }

  return null
}
