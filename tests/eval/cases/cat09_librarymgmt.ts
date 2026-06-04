/** Category 9 · Library Management (126–137). */
import type { EvalCase } from '../types'
import { countOf, everyTrack, hasId, nonEmptyTracks, someTrack, tracksOf } from './helpers'

export const cat09: EvalCase[] = [
  {
    id: '126',
    category: 'Library Management',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'how big is my library?',
    passWhen:
      'Returns total track count. Optionally shows total file size and the date range of imports.',
    check: (r, ctx) => {
      if (r.kind !== 'stats' && r.kind !== 'count')
        return 'should answer with a stats/count summary'
      const total = ctx.tracks.filter((t) => t.phantom !== true).length
      if (r.count != null) return r.count === total || `count ${r.count} != ${total}`
      const surfaced = (r.stats ?? []).some((s) => s.value.includes(String(total)))
      return surfaced || `should report total track count ${total}`
    }
  },
  {
    id: '127',
    category: 'Library Management',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'find tracks with missing BPM',
    passWhen:
      'Filters bpm IS NULL. Returns list with count. Suggests running BPM analysis on those tracks.',
    check: (r) =>
      (nonEmptyTracks(r) &&
        everyTrack(r, (t) => !t.bpm) &&
        hasId(r, 'miss3') &&
        hasId(r, 'amb1')) ||
      'every track should have missing/zero BPM (miss3, amb1)'
  },
  {
    id: '128',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'which tracks have no genre set?',
    passWhen: "Filters genre IS NULL or genre = ''. Returns list. Suggests tagging them.",
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => !t.genre) && hasId(r, 'miss1')) ||
      'every track should lack a genre (miss1)'
  },
  {
    id: '129',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'show me tracks with incomplete metadata',
    passWhen:
      'Checks for NULL values across: bpm, key, genre, year, artwork. Returns tracks missing any of those fields. Shows which specific fields are missing per track.',
    check: (r) => {
      const incomplete = (t: {
        bpm?: number
        key?: string
        genre?: string
        albumArtPath?: string
      }): boolean => !t.bpm || !t.key || !t.genre || !t.albumArtPath
      if (!nonEmptyTracks(r)) return 'should return tracks with incomplete metadata'
      if (!everyTrack(r, incomplete))
        return 'every returned track should be missing at least one field'
      // The three deliberate gaps must surface.
      if (!hasId(r, 'miss1')) return 'should surface miss1 (no genre)'
      if (!hasId(r, 'miss2')) return 'should surface miss2 (no key)'
      if (!hasId(r, 'miss3')) return 'should surface miss3 (no bpm)'
      // Must note WHICH fields are missing (per-track or in narration).
      const notesFields = /bpm|key|genre|year|art(work)?/i.test(r.narration)
      return notesFields || 'should note which specific fields are missing'
    }
  },
  {
    id: '130',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find broken file paths in my library',
    passWhen:
      'Checks file existence for all tracked paths. Returns tracks where the file no longer exists at the stored path. Shows count and file paths.',
    check: (r) =>
      (nonEmptyTracks(r) && everyTrack(r, (t) => t.missingFile === true) && hasId(r, 'broken1')) ||
      'every track should have missingFile === true (broken1)'
  },
  {
    id: '131',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'ACTION',
    prompt: 'remove all tracks I deleted from disk',
    passWhen:
      'Identifies tracks with broken file paths. Presents the list to the user and asks for explicit confirmation before deleting anything. Reports count removed after confirmation. Does not delete without confirmation.',
    check: (r) => {
      if (r.needsConfirmation !== true) return 'must ask for confirmation before deleting'
      return (
        someTrack(r, (t) => t.id === 'broken1' || t.missingFile === true) ||
        'should reference the broken-path track (broken1) it intends to remove'
      )
    }
  },
  {
    id: '132',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: "find tracks I've imported more than once",
    passWhen:
      'Identifies duplicates by file fingerprint or title + artist match. Groups them. Shows both copies.',
    check: (r) => {
      const ts = tracksOf(r)
      if (ts.length === 0) return 'should surface duplicate imports'
      const keys = ts.map((t) => `${t.title}|${t.artist}`.toLowerCase())
      const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i)
      if (dupKeys.length === 0) return 'should group same title+artist copies'
      // Both deliberate duplicate pairs should appear (both copies of each).
      const haveStrobe = hasId(r, 'mau5a') && hasId(r, 'dupA1')
      const haveLosing = hasId(r, 'fisher1') && hasId(r, 'dupB1')
      return (
        (haveStrobe && haveLosing) || 'should show both copies of dupA1/mau5a and dupB1/fisher1'
      )
    }
  },
  {
    id: '133',
    category: 'Library Management',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: "what's the average BPM of my library?",
    passWhen:
      'Returns mean BPM across all BPM-analyzed tracks. Notes how many tracks were included (analyzed tracks only, not nulls).',
    check: (r, ctx) => {
      if (r.kind !== 'stats' && r.kind !== 'count')
        return 'should answer with a stats/count summary'
      const analyzed = ctx.tracks.filter((t) => t.phantom !== true && t.bpm > 0)
      const mean = analyzed.reduce((s, t) => s + t.bpm, 0) / analyzed.length
      const rounded = Math.round(mean)
      const found = (val?: number, text?: string): boolean => {
        if (val != null) return Math.abs(val - mean) <= 1
        return (
          text != null &&
          (text.includes(String(rounded)) ||
            text.includes(String(rounded - 1)) ||
            text.includes(String(rounded + 1)))
        )
      }
      const hit =
        found(r.count, undefined) ||
        (r.stats ?? []).some((s) => found(undefined, s.value)) ||
        found(undefined, r.narration)
      return (
        hit ||
        `should report mean BPM ~${rounded} over ${analyzed.length} analyzed tracks (exclude bpm=0)`
      )
    }
  },
  {
    id: '134',
    category: 'Library Management',
    complexity: 'Beginner',
    type: 'DATA',
    prompt: 'show me the oldest track in my collection',
    passWhen:
      'Returns the track with the lowest year value. Displays year. If year data is missing for many tracks, notes the limitation.',
    check: (r, ctx) => {
      // Oldest known release year is 1987 (detroit1 "Strings of Life" / acid1 "Acid Trax").
      const oldestYear = Math.min(...Object.values(ctx.releaseYears))
      const reflects1987 = hasId(r, 'detroit1') || hasId(r, 'acid1') || /1987/.test(r.narration)
      // Track has no year field yet — honest acknowledgement of the gap is also acceptable.
      const honest =
        /year|release date|not (tracked|available|stored)|don'?t (have|track)|missing/i.test(
          r.narration
        )
      return (
        reflects1987 ||
        honest ||
        `should return the ${oldestYear} track (detroit1/acid1) or note that release-year data is missing`
      )
    }
  },
  {
    id: '135',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'how many tracks are in each playlist?',
    passWhen: 'Returns all playlists with track count per playlist. Sorted by count descending.',
    check: (r, ctx) => {
      if (r.kind !== 'stats' || (r.stats?.length ?? 0) === 0)
        return 'should list per-playlist counts'
      const stats = r.stats ?? []
      for (const pl of ctx.playlists) {
        const row = stats.find((s) => s.label.toLowerCase().includes(pl.name.toLowerCase()))
        if (!row) return `missing playlist "${pl.name}"`
        if (!row.value.includes(String(pl.trackIds.length)))
          return `"${pl.name}" should show count ${pl.trackIds.length}`
      }
      return true
    }
  },
  {
    id: '136',
    category: 'Library Management',
    complexity: 'Intermediate',
    type: 'DATA',
    prompt: 'find tracks that appear in multiple playlists',
    passWhen:
      'Returns tracks present in more than one playlist. Shows which playlists each track appears in.',
    check: (r) =>
      (nonEmptyTracks(r) && hasId(r, 'fisher1') && hasId(r, 'dc1')) ||
      'should return fisher1 (Peak Time + Warm Up) and dc1 (Peak Time + Techno Heat)'
  },
  {
    id: '137',
    category: 'Library Management',
    complexity: 'Advanced',
    type: 'ACTION',
    prompt: 'clean up duplicate entries',
    passWhen:
      'Identifies exact duplicates (same fingerprint or same title + artist + duration). Shows duplicates to the user. Asks for confirmation before removing. Reports count after cleanup. Does not auto-delete without confirmation.',
    check: (r) => {
      if (r.needsConfirmation !== true)
        return 'must ask for confirmation before removing duplicates'
      return (
        countOf(r) > 0 ||
        'should present the duplicate entries (dupA1/mau5a, dupB1/fisher1) before cleanup'
      )
    }
  }
]
