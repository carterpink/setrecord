/** Category 12 · Crate Digging (158–169). */
import type { EvalCase } from '../types'
import { countOf, everyTrack, hasId, isHonestEmpty, nonEmptyTracks } from './helpers'

export const cat12: EvalCase[] = [
  {
    id: '158',
    category: 'Crate Digging',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'surprise me',
    passWhen: 'Returns one random track with a brief rationale.',
    check: (r) =>
      (countOf(r) === 1 && r.narration.length > 0) ||
      'should return exactly one track with rationale'
  },
  {
    id: '159',
    category: 'Crate Digging',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'dig into my collection and find a hidden gem',
    passWhen: 'Low play_count (0–2), imported >3 months ago, decent metadata.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.playCount <= 2)) ||
      'should surface a low-play-count hidden gem'
  },
  {
    id: '160',
    category: 'Crate Digging',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what’s a track in my library I probably forgot I had?',
    passWhen: 'play_count = 0 and date_added > 90 days ago.',
    check: (r, ctx) => {
      const cutoff = ctx.now.getTime() - 90 * 86400000
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => t.playCount === 0 && new Date(t.dateAdded).getTime() < cutoff)) ||
        'should return a never-played, long-owned track'
      )
    }
  },
  {
    id: '161',
    category: 'Crate Digging',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "give me 10 random tracks I've never played",
    passWhen: 'Exactly 10 tracks with play_count = 0 (fewer if pool smaller, state count).',
    check: (r) =>
      (countOf(r) > 0 &&
        countOf(r) <= 10 &&
        everyTrack(r, (t) => t.playCount === 0 && !t.lastPlayed)) ||
      'should return up to 10 never-played tracks'
  },
  {
    id: '162',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'what would a totally different DJ play from my collection?',
    passWhen: 'Tracks from least-played genres/BPM ranges; explains the logic.',
    check: (r) => nonEmptyTracks(r) || 'should surface out-of-comfort-zone tracks'
  },
  {
    id: '163',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'find me something I bought on Beatport but never mixed',
    passWhen:
      'If source tracking exists: source=beatport AND play_count=0; else state the limitation.',
    check: (r) =>
      isHonestEmpty(r) ||
      everyTrack(r, (t) => t.source === 'beatport' && t.playCount === 0) ||
      'should filter by source or state limitation'
  },
  {
    id: '164',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me tracks I added during lockdown',
    passWhen: 'date_added ~ Mar 2020 – Jun 2021; states the range assumed.',
    check: (r) => {
      const lo = new Date('2020-03-01').getTime()
      const hi = new Date('2021-06-30').getTime()
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => {
            const d = new Date(t.dateAdded).getTime()
            return d >= lo && d <= hi
          }) &&
          hasId(r, 'lock1')) ||
        'should return tracks added in the lockdown window'
      )
    }
  },
  {
    id: '165',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'what would work as a b-side to my usual set style?',
    passWhen: 'Same BPM neighbourhood, different genre; explains "b-side".',
    check: (r) => nonEmptyTracks(r) || 'should suggest adjacent-but-different tracks'
  },
  {
    id: '166',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'recommend something based on what I played last night',
    passWhen: 'Uses most recent session profile; returns unplayed matches.',
    check: (r) => nonEmptyTracks(r) || 'should recommend from the last session profile'
  },
  {
    id: '167',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "give me a mystery set — don't tell me what the tracks are",
    passWhen: 'Set returned but titles withheld (count, duration, vibe only).',
    check: (r) =>
      (r.kind === 'set' && (r.set?.length ?? 0) > 0) || 'should build a (hidden-title) set'
  },
  {
    id: '168',
    category: 'Crate Digging',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'show me tracks I downloaded from SoundCloud years ago',
    passWhen: 'If source tracking exists, filter; else state limitation honestly.',
    check: (r) =>
      isHonestEmpty(r) ||
      everyTrack(r, (t) => (t.source as string) === 'soundcloud') ||
      'should filter by source or state limitation'
  },
  {
    id: '169',
    category: 'Crate Digging',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks in my library that no one else is probably playing',
    passWhen: 'Obscure labels / unusual genres / very low play count; acknowledges approximation.',
    check: (r) => nonEmptyTracks(r) || 'should surface obscure/low-play tracks'
  }
]
