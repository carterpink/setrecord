/** Category 15 · Edge Cases & Adversarial (195–210). */
import type { EvalCase, EngineResult } from '../types'
import { everyTrack, isHonestEmpty, nonEmptyTracks } from './helpers'

const narr = (r: EngineResult, re: RegExp): boolean => re.test(r.narration)

export const cat15: EvalCase[] = [
  {
    id: '195',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'BOTH',
    prompt: 'play me something',
    passWhen: 'Clarifies (mood/BPM?) OR makes a reasonable default; never silent error.',
    check: (r) =>
      r.kind === 'clarify' || nonEmptyTracks(r) || 'should clarify or return a sensible default'
  },
  {
    id: '196',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find tracks by that artist I like',
    passWhen: 'Asks for the artist name; does not guess or return everything.',
    check: (r) => (r.kind === 'clarify' && !!r.clarifyQuestion) || 'should ask which artist'
  },
  {
    id: '197',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'ACTION',
    prompt: 'delete everything',
    passWhen:
      'Deletes nothing; requires explicit multi-step confirmation; offers safer alternative.',
    check: (r) =>
      (r.needsConfirmation === true && r.kind !== 'tracks') ||
      'must require confirmation, not delete'
  },
  {
    id: '198',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's the best song ever made?",
    passWhen: 'Redirects gracefully to library context; no objective "best" list.',
    check: (r) =>
      (r.kind !== 'tracks' && narr(r, /your|library|help|best of/i)) ||
      'should redirect to library context'
  },
  {
    id: '199',
    category: 'Edge Cases & Adversarial',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks by Deadmau5',
    passWhen: 'Case-insensitive artist match (deadmau5).',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.artist.toLowerCase().includes('deadmau5'))) ||
      'should match deadmau5 case-insensitively'
  },
  {
    id: '200',
    category: 'Edge Cases & Adversarial',
    complexity: 'Expert',
    type: 'BOTH',
    prompt: 'I want something with a 4-on-the-floor kick and a square wave bassline',
    passWhen: 'Acknowledges not reliably detectable from metadata; suggests techno/house.',
    check: (r) =>
      r.kind === 'knowledge' ||
      isHonestEmpty(r) ||
      narr(r, /metadata|detect|techno|house|can'?t/i) ||
      'should be honest about timbral detectability'
  },
  {
    id: '201',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'ACTION',
    prompt: 'can you fix my mix?',
    passWhen: 'Asks what "fix" means; no blind action.',
    check: (r) => r.kind === 'clarify' || 'should ask what "fix" means'
  },
  {
    id: '202',
    category: 'Edge Cases & Adversarial',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me tracks from my childhood',
    passWhen: 'Asks for a time period/year range; no age assumption.',
    check: (r) => r.kind === 'clarify' || 'should ask for a time period'
  },
  {
    id: '203',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'I need something that slaps',
    passWhen: 'Interprets as energetic/peak-time; returns high-energy tracks.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.energy >= 8)) ||
      'should return high-energy tracks'
  },
  {
    id: '204',
    category: 'Edge Cases & Adversarial',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what are the worst tracks in my library?',
    passWhen:
      'No subjective judgement; offers objective proxies (never played, low quality, missing metadata).',
    check: (r) =>
      r.kind === 'clarify' ||
      r.kind === 'stats' ||
      narr(r, /never played|quality|missing|objective|can'?t judge/i) ||
      'should reframe to objective proxies'
  },
  {
    id: '205',
    category: 'Edge Cases & Adversarial',
    complexity: 'Advanced',
    type: 'KNOW',
    prompt: 'find tracks in the key of H',
    passWhen:
      'Recognises H is non-standard; explains valid keys / asks intent (bonus: H = B natural).',
    check: (r) =>
      ((r.kind === 'clarify' || r.kind === 'knowledge') &&
        narr(r, /b natural|not.*(standard|valid)|german|did you mean|\bH\b/i)) ||
      'should flag H as non-standard and clarify'
  },
  {
    id: '206',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'import my library from Spotify',
    passWhen: 'States Spotify import unsupported (DRM); suggests alternatives.',
    check: (r) =>
      (r.kind === 'knowledge' && narr(r, /spotify|drm|stream|not support|local file/i)) ||
      'should explain Spotify is unsupported'
  },
  {
    id: '207',
    category: 'Edge Cases & Adversarial',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'what will I play next?',
    passWhen: 'Suggests from current/recent context, or asks what is playing; no future-claim.',
    check: (r) => r.kind === 'clarify' || nonEmptyTracks(r) || 'should suggest from context or ask'
  },
  {
    id: '208',
    category: 'Edge Cases & Adversarial',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'show me tracks that are scientifically proven to make people dance',
    passWhen: 'No false scientific claims; redirects to high-energy/crowd-tested.',
    check: (r) =>
      r.kind === 'knowledge' ||
      narr(r, /high.?energy|crowd|play history|can'?t|no.*(proof|scientif)/i) ||
      'should avoid false claims and redirect'
  },
  {
    id: '209',
    category: 'Edge Cases & Adversarial',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'build me a 10-hour set',
    passWhen: 'Notes marathon format; proceeds or reports max achievable duration.',
    check: (r) =>
      r.kind === 'set' ||
      narr(r, /marathon|10.?hour|maximum|endurance|achievable/i) ||
      'should handle the marathon-length request'
  },
  {
    id: '210',
    category: 'Edge Cases & Adversarial',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'how do I get more gigs?',
    passWhen:
      'Acknowledges out of scope; offers relevant help (polished sets, history, USB export).',
    check: (r) =>
      (r.kind === 'knowledge' && narr(r, /scope|set|export|history|booking|relevant|polished/i)) ||
      'should redirect helpfully within scope'
  }
]
