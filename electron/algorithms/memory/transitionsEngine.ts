/**
 * transitionsEngine.ts — pure transition/sequencing answers.
 *
 * Resolves a TransitionHit into harmonically/BPM-compatible follow-ons,
 * historical predecessors, openers/closers by character, recurring pairs,
 * warm-up history, and honest answers for breakdown/acapella requests.
 */

import type { Track } from '../../../src/types'
import type { TransitionHit } from '../../../src/utils/transitionIntent'

export interface TransitionSession {
  performedAt: string
  trackIds: string[]
}

export interface TransitionAnswer {
  kind: 'tracks' | 'combos' | 'sequences' | 'empty'
  tracks?: Track[]
  sequences?: { tracks: Track[]; count: number }[]
  sourceTrack?: Track | null
  narration: string
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function findTrack(seed: string, tracks: Track[]): Track | null {
  const tokens = seed
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (!tokens.length) return null
  return (
    tracks.find((t) =>
      tokens.every((tok) => `${t.title} ${t.artist}`.toLowerCase().includes(tok))
    ) ?? null
  )
}
/** Camelot-compatible neighbours of a key: same, ±1 same letter, relative major/minor. */
function camelotNeighbours(key: string): string[] {
  const m = /^(\d{1,2})([AB])$/.exec(key)
  if (!m) return [key]
  const n = Number(m[1])
  const l = m[2]
  const wrap = (x: number): number => ((x - 1 + 12) % 12) + 1
  const other = l === 'A' ? 'B' : 'A'
  return [`${n}${l}`, `${wrap(n - 1)}${l}`, `${wrap(n + 1)}${l}`, `${n}${other}`]
}

export function computeTransition(
  hit: TransitionHit,
  tracksIn: Track[],
  sessions: TransitionSession[],
  now: Date
): TransitionAnswer {
  const tracks = real(tracksIn)

  switch (hit.metric) {
    case 'after': {
      const src = hit.seed ? findTrack(hit.seed, tracks) : null
      if (src) {
        const compat = camelotNeighbours(src.key)
        const out = tracks.filter(
          (t) => t.id !== src.id && compat.includes(t.key) && Math.abs(t.bpm - src.bpm) <= 6
        )
        return {
          kind: out.length ? 'tracks' : 'empty',
          tracks: out,
          sourceTrack: src,
          narration: out.length
            ? `After ${src.title} (${src.key}, ${Math.round(src.bpm)} BPM): harmonically (${compat.join('/')}) and tempo-compatible picks.`
            : `Nothing in your library mixes cleanly out of ${src.title} on key + BPM.`
        }
      }
      // genre seed (e.g. "after drum and bass"): bridge to a different genre.
      const g = (hit.seed ?? '').toLowerCase()
      const out = tracks.filter((t) => !(t.genre ?? '').toLowerCase().includes(g))
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 15),
        narration: `Coming out of ${hit.seed || 'that style'}, these bridge into a different genre (half-time often helps from fast styles like DnB).`
      }
    }
    case 'before': {
      const src = hit.seed ? findTrack(hit.seed, tracks) : null
      if (!src) return { kind: 'empty', narration: `"${hit.seed}" isn't in your library.` }
      const preced = new Map<string, number>()
      for (const s of sessions) {
        const i = s.trackIds.indexOf(src.id)
        if (i > 0) preced.set(s.trackIds[i - 1], (preced.get(s.trackIds[i - 1]) ?? 0) + 1)
      }
      if (preced.size === 0)
        return {
          kind: 'empty',
          sourceTrack: src,
          narration: `No set history leading into ${src.title} yet.`
        }
      const out = Array.from(preced.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t)
      return {
        kind: 'tracks',
        tracks: out,
        sourceTrack: src,
        narration: `You most often reach ${src.title} from ${out[0].title}.`
      }
    }
    case 'opener': {
      const out = tracks
        .filter((t) => t.energy <= 6 && t.bpm > 0 && t.bpm <= 126)
        .sort((a, b) => a.playCount - b.playCount || a.energy - b.energy)
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 10),
        narration: out.length
          ? 'Lower-energy, lower-BPM openers (fresh picks first).'
          : 'No obvious openers found.'
      }
    }
    case 'closer': {
      const out = tracks
        .filter((t) => t.energy <= 6 && t.bpm <= 128)
        .sort((a, b) => a.energy - b.energy)
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 10),
        narration: out.length
          ? 'Melodic, lower-energy tracks that work as set closers.'
          : 'No obvious closers found.'
      }
    }
    case 'bridge_two': {
      const out = tracks.filter((t) => t.energy >= 4 && t.energy <= 7).slice(0, 10)
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out,
        narration:
          'Mid-energy bridge candidates — name the two tracks and I can match key + BPM to both.'
      }
    }
    case 'bridge_genres': {
      const a = (hit.genreA ?? '').toLowerCase()
      const b = (hit.genreB ?? '').toLowerCase()
      // Prefer the distinctive descriptor word (e.g. "minimal", "melodic") over
      // the generic head ("house"/"techno") so we don't pull in unrelated genres.
      const GENERIC = new Set(['house', 'techno', 'music', 'dj', 'set', 'edm', 'bass'])
      const words = [...a.split(/\s+/), ...b.split(/\s+/)].filter((t) => t.length > 2)
      const descriptors = words.filter((w) => !GENERIC.has(w))
      const toks = descriptors.length ? descriptors : words
      const out = tracks.filter((t) => {
        const g = (t.genre ?? '').toLowerCase()
        return toks.some((tok) => g.includes(tok)) || g === a || g === b
      })
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 15),
        narration: `Tracks touching ${hit.genreA} or ${hit.genreB} — the crossover between the two.`
      }
    }
    case 'pairs': {
      const edges = new Map<string, number>()
      for (const s of sessions)
        for (let i = 0; i < s.trackIds.length - 1; i++) {
          const k = `${s.trackIds[i]}→${s.trackIds[i + 1]}`
          edges.set(k, (edges.get(k) ?? 0) + 1)
        }
      const top = Array.from(edges.entries())
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
      if (top.length === 0)
        return { kind: 'empty', narration: 'No recurring transition pairs in your history yet.' }
      const seqs = top.slice(0, 10).map(([k, count]) => {
        const [from, to] = k.split('→')
        const ft = tracks.find((t) => t.id === from)
        const tt = tracks.find((t) => t.id === to)
        return { tracks: [ft, tt].filter((t): t is Track => !!t), count }
      })
      return {
        kind: 'sequences',
        sequences: seqs,
        narration: `Your ${seqs.length} most-used transition pairs.`
      }
    }
    case 'warmup_history': {
      const cutoff = now.getTime() - 182 * 86400000
      const ids = new Set<string>()
      for (const s of sessions) {
        if (new Date(s.performedAt).getTime() < cutoff) continue
        s.trackIds.slice(0, 2).forEach((id) => ids.add(id))
      }
      const out = tracks.filter((t) => ids.has(t.id))
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out,
        narration: out.length
          ? `Tracks you've opened with in the last 6 months.`
          : `No warm-up-position history in the last 6 months.`
      }
    }
    case 'breakdown': {
      const out = tracks.filter((t) => t.energy >= 7).sort((a, b) => b.energy - a.energy)
      return {
        kind: out.length ? 'tracks' : 'empty',
        tracks: out.slice(0, 12),
        narration:
          'High-energy entries that punch out of a breakdown well. (Structural drop detection is approximate — based on energy, not bar-level analysis.)'
      }
    }
    case 'acapella':
      return {
        kind: 'empty',
        narration:
          'I can\'t reliably detect acapella intros from audio metadata, so I won\'t guess. Tag tracks with an "acapella intro" tag and I can list them precisely.'
      }
    default:
      return { kind: 'empty', narration: 'No transition answer for that.' }
  }
}
