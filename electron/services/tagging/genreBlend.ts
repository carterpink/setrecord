/**
 * Genre-blend refinement.
 *
 * The deterministic mapper in tagRules.ts (`genreBlendTags`) already turns a
 * track's genre metadata into curated lexicon slugs and covers the common case.
 * This module is the seam for the *optional* local-LLM polish: when a track has
 * weak or missing genre metadata, the bundled Qwen model could infer a blend
 * from title/artist/features, constrained to the genre lexicon.
 *
 * It is OFF by default and entirely best-effort: tagging never blocks on it and
 * never degrades if the model is absent. We deliberately do NOT reuse the Recall
 * chat session (it's bound to a different grammar and a single context sequence);
 * enabling this will give tagging its own lexicon-constrained grammar. Until then
 * `refineGenreBlend` simply returns the deterministic result so the rest of the
 * pipeline can already call it.
 */

import { genreBlendTags } from './tagRules'
import { genreLexicon } from '../../../src/utils/tagging/taxonomy'

export interface GenreBlendContext {
  title: string
  artist: string
  genre?: string
  bpm: number
}

/** Master switch for the LLM polish. Stays false until the tagging grammar lands. */
export const LLM_GENRE_BLEND_ENABLED = false

/**
 * Resolve the genre-blend slugs for a track. Deterministic today; a future LLM
 * pass will fill the gap when `genre` is missing. Always returns valid lexicon
 * slugs (≤2).
 */
export async function refineGenreBlend(ctx: GenreBlendContext): Promise<string[]> {
  const deterministic = genreBlendTags(ctx.genre)
  if (deterministic.length > 0 || !LLM_GENRE_BLEND_ENABLED) {
    return deterministic
  }
  // Future: lexicon-constrained Qwen inference from title/artist/bpm.
  // Guard-railed to the curated lexicon so it can never emit free-form noise.
  void genreLexicon
  return deterministic
}
