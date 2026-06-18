/** Category 2 · BPM & Key Queries (021–038). */
import type { EvalCase } from '../types'
import { everyTrack, hasId, nonEmptyTracks, someTrack, tracksOf } from './helpers'

const inRange = (n: number, lo: number, hi: number): boolean => n >= lo && n <= hi

export const cat02: EvalCase[] = [
  {
    id: '021',
    category: 'BPM & Key Queries',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me tracks at 128 BPM',
    passWhen: 'BPM within ±0.5 of 128.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => inRange(t.bpm, 127.5, 128.5))) ||
      'should be a tight ±0.5 match, not a wide window'
  },
  {
    id: '022',
    category: 'BPM & Key Queries',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find tracks between 124 and 128 BPM',
    passWhen: 'BPM >= 124 AND <= 128.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => inRange(t.bpm, 124, 128))) ||
      'every track should be 124–128 BPM'
  },
  {
    id: '023',
    category: 'BPM & Key Queries',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "what's the BPM of Autechre - Gantz Graf?",
    passWhen: 'Returns the stored BPM (90) or not-found.',
    check: (r) =>
      /\b90\b/.test(r.narration) || hasId(r, 'ae1') || 'should return Gantz Graf BPM (90)'
  },
  {
    id: '024',
    category: 'BPM & Key Queries',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me my fastest tracks',
    passWhen: 'Sorted by BPM descending.',
    check: (r) => {
      const ts = tracksOf(r)
      if (ts.length === 0) return 'no tracks returned'
      const desc = ts.every((t, i) => i === 0 || ts[i - 1].bpm >= t.bpm)
      return (desc && ts[0].bpm >= 160) || 'should be sorted fastest-first'
    }
  },
  {
    id: '025',
    category: 'BPM & Key Queries',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'anything around 140?',
    passWhen: 'BPM ~140 with ±3 tolerance.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => inRange(t.bpm, 137, 143))) ||
      'should interpret as ~140 BPM'
  },
  {
    id: '026',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'find tracks in 6A',
    passWhen: '6A = G minor; returns 6A tracks.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.key === '6A')) || 'every track should be 6A'
  },
  {
    id: '027',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'BOTH',
    prompt: 'show me tracks in harmonically compatible keys with 8A',
    passWhen: 'Returns 7A, 9A, 8B (neighbours of 8A) and explains.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => ['8A', '7A', '9A', '8B'].includes(t.key)) &&
        someTrack(r, (t) => t.key !== '8A')) ||
      'should include harmonic neighbours of 8A'
  },
  {
    id: '028',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what key is most common in my library?',
    passWhen: 'Returns most frequent key with count.',
    check: (r) =>
      r.kind === 'stats' || /8A/i.test(r.narration) || 'should report the most common key'
  },
  {
    id: '029',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks at 128 BPM in A minor',
    passWhen: 'BPM 127.5–128.5 AND key 8A.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => t.key === '8A' && inRange(t.bpm, 127.5, 128.5)) &&
        hasId(r, 'bicep1') &&
        hasId(r, 'mau5a')) ||
      'should apply both 128 BPM and 8A'
  },
  {
    id: '030',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "show me tracks where the BPM hasn't been analyzed",
    passWhen: 'bpm IS NULL (0/unset).',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => !t.bpm) && hasId(r, 'miss3')) ||
      'should return un-analyzed (bpm=0) tracks'
  },
  {
    id: '031',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find all techno tracks between 130 and 135 BPM',
    passWhen: 'genre techno AND bpm 130–135.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(
          r,
          (t) => (t.genre ?? '').toLowerCase().includes('techno') && inRange(t.bpm, 130, 135)
        )) ||
      'should apply both techno and 130–135 BPM'
  },
  {
    id: '032',
    category: 'BPM & Key Queries',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'what tracks can I mix into a 128 BPM track in G major?',
    passWhen: 'Harmonic neighbours of G major (9B) at 127–129 BPM.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(
          r,
          (t) => ['9B', '8B', '10B', '9A'].includes(t.key) && inRange(t.bpm, 127, 129)
        )) ||
      'should return harmonic + BPM-compatible tracks'
  },
  {
    id: '033',
    category: 'BPM & Key Queries',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me tracks that would pitch shift well to 132 BPM from around 128',
    passWhen: 'Tracks 127–133 BPM; notes pitch-shift %.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => inRange(t.bpm, 127, 133))) ||
      'should return 127–133 BPM candidates'
  },
  {
    id: '034',
    category: 'BPM & Key Queries',
    complexity: 'Advanced',
    type: 'DATA',
    prompt: 'find tracks in the same key as Sasha - Xpander',
    passWhen: 'Looks up Xpander key (4A); returns 4A tracks.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.key === '4A')) ||
      'should return tracks sharing Xpander’s key (4A)'
  },
  {
    id: '035',
    category: 'BPM & Key Queries',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'show me all my tracks in flat keys',
    passWhen: 'Flat keys only (Bb/Eb/Ab/Db/Gb + relative minors).',
    check: (r) =>
      (hasId(r, 'flat1') && everyTrack(r, (t) => /b/.test(t.keyOpenNotation ?? ''))) ||
      'should return only flat-key tracks'
  },
  {
    id: '036',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what percentage of my library has been key-analyzed?',
    passWhen: 'Returns a percentage with raw numbers.',
    check: (r) =>
      r.kind === 'stats' || /%/.test(r.narration) || 'should report a key-analyzed percentage'
  },
  {
    id: '037',
    category: 'BPM & Key Queries',
    complexity: 'Advanced',
    type: 'BOTH',
    prompt: 'find tracks that are good to loop at 126 BPM',
    passWhen: '~126 BPM (±2); transparent about approximation.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => inRange(t.bpm, 124, 128))) ||
      'should return ~126 BPM candidates'
  },
  {
    id: '038',
    category: 'BPM & Key Queries',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me tracks in minor keys only',
    passWhen: 'All minor keys (Camelot A-side).',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => /^\d{1,2}A$/.test(t.key))) ||
      'every track should be a minor (A-side) key'
  }
]
