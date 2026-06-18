/** Category 1 · Basic Library Search (001–020). */
import type { EvalCase } from '../types'
import {
  artistContains,
  countOf,
  everyTrack,
  expected,
  hasId,
  isHonestEmpty,
  nonEmptyTracks,
  someTrack,
  titleContains,
  tracksOf
} from './helpers'

export const cat01: EvalCase[] = [
  {
    id: '001',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me all my tracks',
    passWhen: 'Returns the full library list; total count shown.',
    check: (r, ctx) =>
      countOf(r) >= ctx.tracks.length || `returned ${countOf(r)} of ${ctx.tracks.length}`
  },
  {
    id: '002',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find Burial',
    passWhen: 'Returns tracks where artist/album contains "Burial"; no fabrication.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => artistContains(t, 'burial'))) ||
      'should return only Burial tracks'
  },
  {
    id: '003',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'do I have any Aphex Twin?',
    passWhen: 'Returns Aphex Twin tracks (or clear zero).',
    check: (r, ctx) => {
      const want = expected(ctx, (t) => artistContains(t, 'aphex'))
      if (want === 0) return isHonestEmpty(r) || 'expected honest zero'
      return (
        (nonEmptyTracks(r) && everyTrack(r, (t) => artistContains(t, 'aphex'))) ||
        'should return only Aphex Twin'
      )
    }
  },
  {
    id: '004',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "search for tracks with 'dark' in the title",
    passWhen: 'Title contains "dark" (not artist/album only).',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => titleContains(t, 'dark'))) ||
      'every title should contain "dark"'
  },
  {
    id: '005',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "what's in my library?",
    passWhen: 'Total count + brief summary; does not list everything.',
    check: (r) =>
      r.kind === 'stats' ||
      r.count != null ||
      /\d/.test(r.narration) ||
      'should summarise with a count'
  },
  {
    id: '006',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find all my Drumcode releases',
    passWhen: 'Filters by label containing "Drumcode".',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => (t.label ?? '').toLowerCase().includes('drumcode'))) ||
      'should filter by label = Drumcode'
  },
  {
    id: '007',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me tracks I added this week',
    passWhen: 'date_added within last 7 days.',
    check: (r, ctx) => {
      const cutoff = ctx.now.getTime() - 7 * 86400000
      return (
        (nonEmptyTracks(r) &&
          everyTrack(r, (t) => new Date(t.dateAdded).getTime() >= cutoff) &&
          hasId(r, 'recent1')) ||
        'should return only tracks added in the last 7 days'
      )
    }
  },
  {
    id: '008',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'anything by Ricardo Villalobos',
    passWhen: 'Artist-matched; handles accents/case.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => artistContains(t, 'villalobos'))) ||
      'should return Villalobos tracks'
  },
  {
    id: '009',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me tracks longer than 8 minutes',
    passWhen: 'duration > 480s, sorted desc.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.duration >= 480)) ||
      'every track should be 8+ minutes'
  },
  {
    id: '010',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find remixes of Leftfield - Leftism',
    passWhen: 'Searches Leftfield + Leftism; returns remix versions.',
    check: (r) =>
      someTrack(r, (t) => artistContains(t, 'leftfield') && titleContains(t, 'remix')) ||
      'should find the Leftism remix'
  },
  {
    id: '011',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what tracks do I have in the key of Am?',
    passWhen: 'key = A minor (8A), accepts Am / 8A.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.key === '8A')) || 'every track should be 8A'
  },
  {
    id: '012',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me everything I imported from Rekordbox',
    passWhen: 'Filters import_source = rekordbox, or states the limitation.',
    check: (r) =>
      isHonestEmpty(r) ||
      everyTrack(r, (t) => t.source === 'rekordbox') ||
      'should filter by source or state limitation'
  },
  {
    id: '013',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks without artwork',
    passWhen: 'artwork is null/missing.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => !t.albumArtPath)) ||
      'every track should lack artwork'
  },
  {
    id: '014',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me my most played track',
    passWhen: 'Single highest play_count (or ties), count shown.',
    check: (r) =>
      (hasId(r, 'topplay1') && everyTrack(r, (t) => t.playCount === 99)) ||
      'should return the most-played track (topplay1)'
  },
  {
    id: '015',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "list tracks I've never played",
    passWhen: 'play_count = 0 OR last_played IS NULL.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.playCount === 0 && !t.lastPlayed)) ||
      'every track should be never-played'
  },
  {
    id: '016',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks by Four Tet released after 2019',
    passWhen: 'artist = Four Tet AND year > 2019.',
    check: (r, ctx) =>
      (nonEmptyTracks(r) &&
        everyTrack(
          r,
          (t) => artistContains(t, 'four tet') && (ctx.releaseYears[t.id] ?? 0) > 2019
        ) &&
        hasId(r, 'ft1') &&
        !hasId(r, 'ft2')) ||
      'should apply both artist and year>2019'
  },
  {
    id: '017',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me duplicates in my library',
    passWhen: 'Groups same title+artist; shows both copies.',
    check: (r) => {
      const ts = tracksOf(r)
      const keys = ts.map((t) => `${t.title}|${t.artist}`.toLowerCase())
      const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i)
      return dupKeys.length > 0 || 'should surface duplicate title+artist groups'
    }
  },
  {
    id: '018',
    category: 'Basic Library Search',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find tracks shorter than 5 minutes',
    passWhen: 'duration < 300s.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.duration <= 300)) ||
      'every track should be under 5 minutes'
  },
  {
    id: '019',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'what labels are in my collection?',
    passWhen: 'Distinct labels with counts.',
    check: (r) =>
      (r.kind === 'stats' && (r.stats?.length ?? 0) > 0) ||
      'should list distinct labels with counts'
  },
  {
    id: '020',
    category: 'Basic Library Search',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "find tracks I tagged as 'peak time'",
    passWhen: 'Filters tag "peak time", or explains tagging needed.',
    check: (r) =>
      isHonestEmpty(r) ||
      everyTrack(r, (t) => (t.tags ?? []).some((x) => x.value.toLowerCase().includes('peak'))) ||
      'should filter by tag or explain tagging'
  }
]
