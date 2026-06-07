/**
 * clarifyIntent.ts — pure detector for underspecified / adversarial / destructive
 * requests. Returns a clarify question, a confirm-first action, or a graceful
 * reframe — never a blind guess or a destructive auto-action.
 */

export interface ClarifyResult {
  mode: 'clarify' | 'action' | 'reframe'
  question?: string
  narration?: string
  needsConfirmation?: boolean
}

export function detectClarify(raw: string): ClarifyResult | null {
  const q = raw.toLowerCase().trim()

  // Destructive — never auto-run.
  if (
    /\b(delete|wipe|erase|clear|remove) (everything|all (my )?(tracks|music|library)|the whole library)|delete my (whole )?library|wipe my library/.test(
      q
    )
  )
    return {
      mode: 'action',
      needsConfirmation: true,
      narration:
        "I won't delete anything without an explicit confirm. That would remove your entire library — are you sure? A safer option is to archive or hide tracks instead. Type DELETE to confirm a full wipe."
    }

  // Underspecified → ask.
  if (/\bthat artist i (like|love)|the artist i (like|mentioned)|find.*that artist\b/.test(q))
    return {
      mode: 'clarify',
      question: 'Which artist did you mean? Tell me the name and I’ll pull their tracks.'
    }
  if (/\bfix my mix|can you fix (my|the) mix|fix the mix\b/.test(q))
    return {
      mode: 'clarify',
      question:
        'What needs fixing — a BPM mismatch, a key clash, or the energy flow? Tell me and I’ll help.'
    }
  if (/\b(from )?my childhood|when i was (a kid|young)|childhood (tracks|songs)/.test(q))
    return {
      mode: 'clarify',
      question:
        'What time period counts as your childhood? Give me a year range and I’ll find tracks from then.'
    }
  if (/\bwhat (will|should) i play next\b|what'?s next\b|what do i play next\b/.test(q))
    return {
      mode: 'clarify',
      question:
        "What's playing right now (or the last track)? Tell me and I'll suggest a compatible next track."
    }

  // Reframe — refuse the subjective/false framing, offer what's real.
  if (/\b(worst|best) (tracks?|songs?) in my (library|collection)\b/.test(q))
    return {
      mode: 'reframe',
      narration:
        "I won't judge your tracks as best/worst — that's subjective. I can rank by objective proxies instead: never-played, lowest file quality, or missing metadata. Want one of those?"
    }

  return null
}
