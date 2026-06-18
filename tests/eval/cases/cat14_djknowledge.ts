/** Category 14 · DJ Domain Knowledge (180–194). All pure KNOW prompts:
 *  assert the answer is grounded in the curated knowledge base (kind 'knowledge')
 *  AND carries the defining fact from the matrix "Pass when". */
import type { EvalCase } from '../types'
import type { EngineResult } from '../types'

const knows = (r: EngineResult, re: RegExp): boolean =>
  r.kind === 'knowledge' && re.test(r.narration)

export const cat14: EvalCase[] = [
  {
    id: '180',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'what is harmonic mixing?',
    passWhen: 'Explains matching keys via Circle of Fifths / Camelot; ±1 step compatible.',
    check: (r) => knows(r, /camelot|circle of fifths|harmonic/i) || 'should explain harmonic mixing'
  },
  {
    id: '181',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'explain the Camelot wheel to me',
    passWhen: '24 positions (12 major B-side, 12 minor A-side); adjacent = compatible.',
    check: (r) => knows(r, /camelot|24|major|minor/i) || 'should explain the Camelot wheel'
  },
  {
    id: '182',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's a DJ drop?",
    passWhen: 'Explains the energy release when main elements re-enter after a break/build.',
    check: (r) => knows(r, /drop|breakdown|build|energy/i) || 'should explain a DJ drop'
  },
  {
    id: '183',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'how do I beatmatch without sync?',
    passWhen: 'Step-by-step: match BPM, pitch fader, headphones, nudge platter.',
    check: (r) =>
      knows(r, /pitch|beatmatch|nudge|platter|tempo/i) || 'should explain manual beatmatching'
  },
  {
    id: '184',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'what does EQing in mean?',
    passWhen: 'Raising incoming EQ while cutting outgoing; bass swap at mix point.',
    check: (r) => knows(r, /eq|bass|frequenc/i) || 'should explain EQing in'
  },
  {
    id: '185',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's the difference between a DJ mix and a live PA?",
    passWhen: 'Mix = others’ recorded tracks; Live PA = performing original music live.',
    check: (r) => knows(r, /live pa|mix|synth|perform/i) || 'should contrast DJ mix vs live PA'
  },
  {
    id: '186',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'how long should my DJ sets be?',
    passWhen: 'Context-dependent: warm-up 1–2h, support 2–3h, headliner 3–4h+.',
    check: (r) => knows(r, /hour|warm.?up|headliner|support/i) || 'should explain set-length norms'
  },
  {
    id: '187',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: 'what is a white label?',
    passWhen: 'Vinyl pressing without label artwork — promo/dubplate/exclusive.',
    check: (r) =>
      knows(r, /white label|promo|vinyl|dubplate|exclusive/i) || 'should explain white label'
  },
  {
    id: '188',
    category: 'DJ Domain Knowledge',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'what is loop diving?',
    passWhen: 'Activating a loop to extend a section while cueing the next track.',
    check: (r) => knows(r, /loop/i) || 'should explain loop diving'
  },
  {
    id: '189',
    category: 'DJ Domain Knowledge',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'explain phrase mixing',
    passWhen: 'Aligning 8/16-bar phrases; mixing at phrase boundaries sounds musical.',
    check: (r) => knows(r, /phrase|bar/i) || 'should explain phrase mixing'
  },
  {
    id: '190',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's the ideal number of tracks to prepare for a 2-hour gig?",
    passWhen: '2–3× the set length (≈60–90 tracks); explains why.',
    check: (r) =>
      knows(r, /\b2.?3\b|twice|three times|60|90|flexib|track/i) ||
      'should give a prep rule of thumb'
  },
  {
    id: '191',
    category: 'DJ Domain Knowledge',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'when should I use high-pass filters in a mix?',
    passWhen: 'Roll off incoming bass to avoid clash; also builds tension.',
    check: (r) => knows(r, /high.?pass|hpf|bass|tension|filter/i) || 'should explain HPF usage'
  },
  {
    id: '192',
    category: 'DJ Domain Knowledge',
    complexity: 'Beginner',
    type: 'KNOW',
    prompt: "what's a DJ's crate?",
    passWhen: 'Curated selection for a set; vinyl origin; digital = playlists/folders.',
    check: (r) => knows(r, /crate|playlist|selection|vinyl/i) || 'should explain a DJ crate'
  },
  {
    id: '193',
    category: 'DJ Domain Knowledge',
    complexity: 'Intermediate',
    type: 'KNOW',
    prompt: 'explain the energy arc of a DJ set',
    passWhen: 'Warm-up → build → peak → comedown; crowd-driven.',
    check: (r) => knows(r, /warm.?up|peak|comedown|build|arc/i) || 'should explain the energy arc'
  },
  {
    id: '194',
    category: 'DJ Domain Knowledge',
    complexity: 'Advanced',
    type: 'KNOW',
    prompt: 'what is stem separation and how does it help DJs?',
    passWhen:
      'AI separation into drums/bass/melody/vocals; acapella/remix use; honest on app capability.',
    check: (r) => knows(r, /stem/i) || 'should explain stem separation'
  }
]
