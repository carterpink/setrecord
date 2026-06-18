/** Category 13 · Venue & Crowd Context (170–179). */
import type { EvalCase } from '../types'
import { everyTrack, ids, nonEmptyTracks } from './helpers'

const isKnowledge = (r: { kind: string; narration: string }, re: RegExp): boolean =>
  r.kind === 'knowledge' && re.test(r.narration)

export const cat13: EvalCase[] = [
  {
    id: '170',
    category: 'Venue & Crowd Context',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'what should I play tonight at a wedding?',
    passWhen: 'Explains wedding considerations: all ages, broad taste, requests.',
    check: (r) =>
      isKnowledge(r, /wedding|all ages|broad|request/i) || 'should give wedding DJ guidance'
  },
  {
    id: '171',
    category: 'Venue & Crowd Context',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: "I'm playing a small bar with 30 people — what vibe?",
    passWhen: 'Lower energy, mid-tempo, crowd-warming; candidates from library.',
    check: (r) =>
      r.kind === 'knowledge' ||
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 6)) ||
      'should recommend a lower-energy bar vibe'
  },
  {
    id: '172',
    category: 'Venue & Crowd Context',
    complexity: 'Advanced',
    type: 'KNOW',
    prompt: "I'm supporting a headliner at a festival — what's the strategy?",
    passWhen: 'Build the crowd, avoid headliner style, don’t peak too early.',
    check: (r) =>
      isKnowledge(r, /headliner|build|peak|room|support/i) || 'should explain support-slot strategy'
  },
  {
    id: '173',
    category: 'Venue & Crowd Context',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'what did I play the last time I was at a warehouse party?',
    passWhen: 'Queries warehouse-named session; returns its tracks.',
    check: (r) => {
      const fromSession = r.sessions?.some((s) => s.id === 's-warehouse') ?? false
      const trackList = ['plastik1', 'surgeon1', 'body3', 'dc2'].every((id) => ids(r).includes(id))
      return fromSession || trackList || 'should return the warehouse session tracklist'
    }
  },
  {
    id: '174',
    category: 'Venue & Crowd Context',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'build a set for a 500-person club at 2am',
    passWhen: 'Peak-time, high energy, BPM 130–135, sequenced.',
    check: (r) =>
      (r.kind === 'set' &&
        (r.set?.length ?? 0) > 0 &&
        (r.set ?? []).every((t) => t.bpm >= 128 && t.energy >= 7)) ||
      'should build a peak-time 2am set'
  },
  {
    id: '175',
    category: 'Venue & Crowd Context',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'what tracks work well outdoors in daytime?',
    passWhen: 'Lighter energy, melodic, organic house/balearic; from library.',
    check: (r) =>
      r.kind === 'knowledge' ||
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 7)) ||
      'should recommend lighter daytime tracks'
  },
  {
    id: '176',
    category: 'Venue & Crowd Context',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "I'm playing a corporate event — keep it safe",
    passWhen: 'Mid-tempo, mainstream-adjacent; avoids heavy techno/aggression.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy <= 7)) ||
      'should return a safe mid-energy selection'
  },
  {
    id: '177',
    category: 'Venue & Crowd Context',
    complexity: 'Advanced',
    type: 'KNOW',
    prompt: 'what should I NOT play for a first gig at Tresor?',
    passWhen: 'Describes Tresor aesthetic; advises against commercial/vocal/slow.',
    check: (r) =>
      isKnowledge(r, /tresor|hard techno|berlin|commercial|vocal|cheese/i) ||
      'should describe Tresor’s aesthetic and what to avoid'
  },
  {
    id: '178',
    category: 'Venue & Crowd Context',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: "build a set for a New Year's Eve countdown moment",
    passWhen: 'Climactic peak at the countdown; structured build.',
    check: (r) => (r.kind === 'set' && (r.set?.length ?? 0) > 0) || 'should build a countdown set'
  },
  {
    id: '179',
    category: 'Venue & Crowd Context',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's the difference between playing a rave and a club night?",
    passWhen: 'Explains rave vs club differences practically.',
    check: (r) => isKnowledge(r, /rave|club/i) || 'should contrast rave vs club'
  }
]
