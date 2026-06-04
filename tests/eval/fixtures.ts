/**
 * The eval "ground-truth world".
 *
 * A compact but deliberately-shaped library + gig history that makes every
 * entity-specific prompt in setsense_ai_eval_matrix.md objectively checkable.
 * Dates are derived relative to a captured `now` so time-relative prompts
 * ("added this week", "last Saturday", "this year") have deterministic answers.
 *
 * When you add a case that needs a specific track/venue/date to exist, add it
 * HERE (with a comment naming the matrix ids it serves) — never assert against
 * data the world doesn't contain.
 *
 * NOTE: Track has no release-year field yet (see EvalCtx.releaseYears). Encode
 * release years in the RELEASE_YEARS map below, not on the track.
 */

import type { Track, AudioFormat } from '../../src/types'
import type { FixtureSession, EvalCtx } from './types'

let _seq = 0
function t(over: Partial<Track> & { title: string; artist: string }): Track {
  _seq += 1
  const base: Track = {
    id: over.id ?? `fx-${String(_seq).padStart(3, '0')}`,
    title: over.title,
    artist: over.artist,
    bpm: 124,
    key: '8A',
    energy: 5,
    duration: 360,
    filePath: `/Music/${over.artist} - ${over.title}.mp3`.replace(/\s+/g, '_'),
    format: 'mp3' as AudioFormat,
    cuePoints: [],
    hotCues: [],
    playCount: 0,
    rating: 0,
    dateAdded: '2024-01-01T00:00:00.000Z',
    missingFile: false
  }
  return { ...base, ...over }
}

function iso(d: Date): string {
  return d.toISOString()
}
function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * 86400000)
}
function monthsAgo(now: Date, n: number): Date {
  const d = new Date(now)
  d.setMonth(d.getMonth() - n)
  return d
}
/** Most recent past Saturday (strictly before today). */
function lastSaturday(now: Date): Date {
  const d = new Date(now)
  const dow = d.getDay() // 0=Sun..6=Sat
  const back = (dow - 6 + 7) % 7 || 7
  return daysAgo(now, back)
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Ground-truth release years (see EvalCtx.releaseYears). */
const RELEASE_YEARS: Record<string, number> = {
  aphex2: 1992,
  ft1: 2020,
  ft2: 2010,
  detroit1: 1987,
  detroit2: 1991,
  acid1: 1987,
  old1: 1990,
  sasha1: 1999,
  caribou1: 2014,
  mau5a: 2009,
  bicep1: 2017
}

export function buildWorld(now: Date = new Date()): EvalCtx {
  _seq = 0
  const thisYear = now.getFullYear()

  const tracks: Track[] = [
    // ── Fisher (the original complaint: "give me 10 Fisher songs") ──────────
    t({
      id: 'fisher1',
      title: 'Losing It',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 125,
      key: '7A',
      energy: 8,
      label: 'Catch & Release',
      playCount: 12,
      rating: 5,
      duration: 380
    }),
    t({
      id: 'fisher2',
      title: 'Stop It',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 126,
      key: '8A',
      energy: 8,
      label: 'Dirtybird',
      playCount: 7,
      duration: 350
    }),
    t({
      id: 'fisher3',
      title: 'You Little Beauty',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 124,
      key: '9A',
      energy: 7,
      playCount: 3,
      duration: 340
    }),
    t({
      id: 'fisher4',
      title: 'Crowd Control',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 127,
      key: '8A',
      energy: 8,
      playCount: 0,
      duration: 360
    }),
    t({
      id: 'fisher5',
      title: 'Just Feels Tight',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 126,
      key: '6A',
      energy: 7,
      playCount: 0,
      duration: 355
    }),

    // ── Burial (002 find Burial) ────────────────────────────────────────────
    t({
      id: 'burial1',
      title: 'Archangel',
      artist: 'Burial',
      genre: 'Dubstep',
      bpm: 138,
      key: '5A',
      energy: 4,
      album: 'Untrue',
      duration: 480,
      playCount: 2
    }),
    t({
      id: 'burial2',
      title: 'Untrue',
      artist: 'Burial',
      genre: 'Dubstep',
      bpm: 130,
      key: '3A',
      energy: 3,
      album: 'Untrue',
      duration: 360
    }),

    // ── Aphex Twin (003) ────────────────────────────────────────────────────
    t({
      id: 'aphex1',
      title: 'Windowlicker',
      artist: 'Aphex Twin',
      genre: 'Electro',
      bpm: 100,
      key: '11A',
      energy: 5,
      duration: 366
    }),
    t({
      id: 'aphex2',
      title: 'Xtal',
      artist: 'Aphex Twin',
      genre: 'Ambient',
      bpm: 96,
      key: '2A',
      energy: 2,
      duration: 290
    }),

    // ── "dark" in title (004) ───────────────────────────────────────────────
    t({
      id: 'dark1',
      title: 'Dark Allies',
      artist: 'Light Asylum',
      genre: 'Darkwave',
      bpm: 120,
      key: '1A',
      energy: 6
    }),
    t({
      id: 'dark2',
      title: 'Into the Dark',
      artist: 'Robert Hood',
      genre: 'Techno',
      bpm: 132,
      key: '4A',
      energy: 7,
      label: 'Drumcode'
    }),

    // ── Drumcode label (006) ────────────────────────────────────────────────
    t({
      id: 'dc1',
      title: 'Spektre',
      artist: 'Adam Beyer',
      genre: 'Techno',
      bpm: 132,
      key: '5A',
      energy: 8,
      label: 'Drumcode',
      playCount: 9
    }),
    t({
      id: 'dc2',
      title: 'Your Mind',
      artist: 'Adam Beyer',
      genre: 'Techno',
      bpm: 134,
      key: '6A',
      energy: 9,
      label: 'Drumcode'
    }),

    // ── Ricardo Villalobos (008) + long track (009) + minimal (120) ─────────
    t({
      id: 'villa1',
      title: 'Dexter',
      artist: 'Ricardo Villalobos',
      genre: 'Minimal',
      bpm: 126,
      key: '7A',
      energy: 5,
      duration: 560
    }),

    // ── Leftfield - Leftism remix (010) ─────────────────────────────────────
    t({
      id: 'left1',
      title: 'Song of Life (Remix)',
      artist: 'Leftfield',
      album: 'Leftism',
      genre: 'Progressive House',
      bpm: 122,
      key: '9A',
      energy: 6
    }),

    // ── Four Tet (016 after 2019) ───────────────────────────────────────────
    t({
      id: 'ft1',
      title: 'Teenage Birdsong',
      artist: 'Four Tet',
      genre: 'Electronica',
      bpm: 120,
      key: '10A',
      energy: 5
    }),
    t({
      id: 'ft2',
      title: 'Angel Echoes',
      artist: 'Four Tet',
      genre: 'Electronica',
      bpm: 110,
      key: '11A',
      energy: 4
    }),

    // ── Autechre - Gantz Graf (023 BPM lookup) ──────────────────────────────
    t({
      id: 'ae1',
      title: 'Gantz Graf',
      artist: 'Autechre',
      genre: 'IDM',
      bpm: 90,
      key: '1A',
      energy: 6,
      duration: 240
    }),

    // ── Sasha - Xpander (034 same key) ──────────────────────────────────────
    t({
      id: 'sasha1',
      title: 'Xpander',
      artist: 'Sasha',
      genre: 'Progressive House',
      bpm: 132,
      key: '4A',
      energy: 7,
      duration: 540
    }),
    t({
      id: 'sasha2',
      title: 'Baja',
      artist: 'Sasha',
      genre: 'Progressive House',
      bpm: 130,
      key: '4A',
      energy: 6
    }),

    // ── Bicep - Glue (039 transitions) ──────────────────────────────────────
    t({
      id: 'bicep1',
      title: 'Glue',
      artist: 'Bicep',
      genre: 'Breakbeat',
      bpm: 128,
      key: '8A',
      energy: 6,
      playCount: 5
    }),

    // ── Orbital - Halcyon (047 what comes before) ───────────────────────────
    t({
      id: 'orbital1',
      title: 'Halcyon',
      artist: 'Orbital',
      genre: 'Ambient House',
      bpm: 118,
      key: '9A',
      energy: 5,
      duration: 540
    }),

    // ── Plastikman - Spastik (073 anchor) ───────────────────────────────────
    t({
      id: 'plastik1',
      title: 'Spastik',
      artist: 'Plastikman',
      genre: 'Techno',
      bpm: 130,
      key: '5A',
      energy: 8,
      duration: 600
    }),

    // ── Surgeon - Magneze (078 last played) ─────────────────────────────────
    t({
      id: 'surgeon1',
      title: 'Magneze',
      artist: 'Surgeon',
      genre: 'Techno',
      bpm: 135,
      key: '6A',
      energy: 9
    }),

    // ── Speedy J - De-orbit (079 play count) ────────────────────────────────
    t({
      id: 'speedy1',
      title: 'De-orbit',
      artist: 'Speedy J',
      genre: 'Techno',
      bpm: 133,
      key: '7A',
      energy: 8,
      playCount: 4
    }),

    // ── Caribou - Can't Do Without You (102 similar) ────────────────────────
    t({
      id: 'caribou1',
      title: "Can't Do Without You",
      artist: 'Caribou',
      genre: 'House',
      bpm: 122,
      key: '10A',
      energy: 6
    }),
    t({
      id: 'caribou2',
      title: 'Odessa',
      artist: 'Caribou',
      genre: 'House',
      bpm: 120,
      key: '10A',
      energy: 5
    }),

    // ── Deadmau5 (199 case-insensitive) ─────────────────────────────────────
    t({
      id: 'mau5a',
      title: 'Strobe',
      artist: 'deadmau5',
      genre: 'Progressive House',
      bpm: 128,
      key: '8A',
      energy: 7,
      duration: 640,
      playCount: 20,
      rating: 5
    }),
    t({
      id: 'mau5b',
      title: 'Ghosts n Stuff',
      artist: 'deadmau5',
      genre: 'Electro House',
      bpm: 128,
      key: '11A',
      energy: 8
    }),

    // ── Detroit techno / labels (118) ───────────────────────────────────────
    t({
      id: 'detroit1',
      title: 'Strings of Life',
      artist: 'Derrick May',
      genre: 'Detroit Techno',
      bpm: 122,
      key: '7B',
      energy: 7,
      label: 'Transmat'
    }),
    t({
      id: 'detroit2',
      title: 'Jaguar',
      artist: 'Underground Resistance',
      genre: 'Detroit Techno',
      bpm: 130,
      key: '5A',
      energy: 8,
      label: 'Underground Resistance'
    }),

    // ── UK garage (119) ─────────────────────────────────────────────────────
    t({
      id: 'ukg1',
      title: 'Flowers',
      artist: 'Sweet Female Attitude',
      genre: 'UK Garage',
      bpm: 132,
      key: '2A',
      energy: 6
    }),

    // ── Acid (124) ──────────────────────────────────────────────────────────
    t({
      id: 'acid1',
      title: 'Acid Trax',
      artist: 'Phuture',
      genre: 'Acid House',
      bpm: 120,
      key: '3A',
      energy: 6
    }),

    // ── Breakbeat (125) ─────────────────────────────────────────────────────
    t({
      id: 'break1',
      title: 'Renegade Snares',
      artist: 'Omni Trio',
      genre: 'Breakbeat',
      bpm: 160,
      key: '4A',
      energy: 7
    }),

    // ── Ambient / intro (095) + zero bpm ────────────────────────────────────
    t({
      id: 'amb1',
      title: 'An Ending',
      artist: 'Brian Eno',
      genre: 'Ambient',
      bpm: 0,
      key: '',
      energy: 1,
      duration: 300
    }),

    // ── Classics before 2000 (059) / oldest (134) ───────────────────────────
    t({
      id: 'old1',
      title: 'Energy Flash',
      artist: 'Joey Beltram',
      genre: 'Techno',
      bpm: 130,
      key: '6A',
      energy: 8
    }),

    // ── Lockdown adds (164: Mar 2020 – Jun 2021) ────────────────────────────
    t({
      id: 'lock1',
      title: 'Quarantine Groove',
      artist: 'Stay Home',
      genre: 'House',
      bpm: 122,
      key: '9A',
      energy: 5,
      dateAdded: '2020-09-01T00:00:00.000Z'
    }),

    // ── Missing-metadata maintenance set (013/030/127/128/129) ──────────────
    t({
      id: 'miss1',
      title: 'No Genre Tune',
      artist: 'Unknown One',
      bpm: 124,
      key: '8A',
      energy: 5 /* genre undefined */
    }),
    t({
      id: 'miss2',
      title: 'No Key Tune',
      artist: 'Unknown Two',
      genre: 'House',
      bpm: 124,
      key: '',
      energy: 5
    }),
    t({
      id: 'miss3',
      title: 'No BPM Tune',
      artist: 'Unknown Three',
      genre: 'House',
      bpm: 0,
      key: '8A',
      energy: 5
    }),
    t({
      id: 'miss4',
      title: 'No Art Tune',
      artist: 'Unknown Four',
      genre: 'House',
      bpm: 124,
      key: '8A',
      energy: 5 /* albumArtPath undefined */
    }),

    // ── Broken path (130/131) ───────────────────────────────────────────────
    t({
      id: 'broken1',
      title: 'Ghost File',
      artist: 'Lost Track',
      genre: 'House',
      bpm: 124,
      key: '8A',
      energy: 5,
      missingFile: true
    }),

    // ── Flat-key coverage (035) ─────────────────────────────────────────────
    t({
      id: 'flat1',
      title: 'Flat Mover',
      artist: 'Bb Crew',
      genre: 'House',
      bpm: 124,
      key: '6B',
      keyOpenNotation: 'Bbm',
      energy: 5
    }),

    // ── 5-star favourites (favourites/top rated) ────────────────────────────
    t({
      id: 'fav1',
      title: 'Reference Track',
      artist: 'Top Tier',
      genre: 'Techno',
      bpm: 130,
      key: '5A',
      energy: 8,
      rating: 5,
      playCount: 15
    }),

    // ── Duplicate imports (017/132/137): same title+artist, diff quality ────
    t({
      id: 'dupA1',
      title: 'Strobe',
      artist: 'deadmau5',
      genre: 'Progressive House',
      bpm: 128,
      key: '8A',
      energy: 7,
      format: 'aiff',
      bitrate: 1411,
      duration: 640
    }),
    t({
      id: 'dupB1',
      title: 'Losing It',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 125,
      key: '7A',
      energy: 8,
      format: 'mp3',
      bitrate: 320,
      duration: 380
    }),

    // ── Generic body: spread across bpm/key/energy/genre for filters ────────
    t({
      id: 'body1',
      title: 'House Roller',
      artist: 'Groover',
      genre: 'House',
      bpm: 122,
      key: '5A',
      energy: 5,
      playCount: 6
    }),
    t({
      id: 'body2',
      title: 'Tech Groove',
      artist: 'Roller',
      genre: 'Tech House',
      bpm: 126,
      key: '8A',
      energy: 6,
      playCount: 4
    }),
    t({
      id: 'body3',
      title: 'Peak Hammer',
      artist: 'Banger Co',
      genre: 'Hard Techno',
      bpm: 138,
      key: '6A',
      energy: 10,
      playCount: 2
    }),
    t({
      id: 'body4',
      title: 'Deep Pool',
      artist: 'Deepy',
      genre: 'Deep House',
      bpm: 120,
      key: '9A',
      energy: 4,
      playCount: 1
    }),
    t({
      id: 'body5',
      title: 'DnB Roller',
      artist: 'Junglist',
      genre: 'Drum and Bass',
      bpm: 174,
      key: '4A',
      energy: 8
    }),
    t({
      id: 'body6',
      title: 'Short One',
      artist: 'Quicky',
      genre: 'House',
      bpm: 124,
      key: '8A',
      energy: 5,
      duration: 180
    }),
    t({
      id: 'body7',
      title: 'Eight Minute Epic',
      artist: 'Longy',
      genre: 'Progressive House',
      bpm: 124,
      key: '8A',
      energy: 5,
      duration: 520
    }),
    t({
      id: 'body8',
      title: 'Never Spun',
      artist: 'Fresh Import',
      genre: 'Tech House',
      bpm: 126,
      key: '8A',
      energy: 6,
      playCount: 0,
      dateAdded: '2023-01-01T00:00:00.000Z'
    })
  ]

  // Time-relative tracks (depend on `now`) ─────────────────────────────────
  tracks.push(
    // added this week (007) + most recent import (085)
    t({
      id: 'recent1',
      title: 'Fresh Drop',
      artist: 'New Kid',
      genre: 'Tech House',
      bpm: 126,
      key: '8A',
      energy: 7,
      dateAdded: iso(daysAgo(now, 2))
    }),
    // most played (014) + most-played artist context (148)
    t({
      id: 'topplay1',
      title: 'Anthem',
      artist: 'Fisher',
      genre: 'Tech House',
      bpm: 126,
      key: '8A',
      energy: 8,
      playCount: 99,
      rating: 5
    }),
    // dormant / forgotten gem (lastPlayed long ago, decent rating, playCount>0)
    t({
      id: 'gem1',
      title: 'Old Favourite',
      artist: 'Dusty',
      genre: 'House',
      bpm: 122,
      key: '8A',
      energy: 6,
      playCount: 8,
      rating: 5,
      lastPlayed: iso(monthsAgo(now, 14)),
      dateAdded: '2021-01-01T00:00:00.000Z'
    })
  )

  const byId = new Map(tracks.map((tr) => [tr.id, tr]))

  // ── Gig history (sessions) ───────────────────────────────────────────────
  const sessions: FixtureSession[] = [
    // Last Saturday (075)
    {
      id: 's-lastsat',
      name: `Set ${ymd(lastSaturday(now))}`,
      performedAt: ymd(lastSaturday(now)),
      venue: 'The Cause',
      city: 'London',
      eventType: 'club',
      durationSec: 2 * 3600,
      trackIds: ['fisher1', 'bicep1', 'body2', 'dc1']
    },
    // Hi Ibiza, this year July (077)
    {
      id: 's-hi',
      name: 'Hi Ibiza Closing',
      performedAt: `${thisYear}-07-15`,
      venue: 'Hi Ibiza',
      city: 'Ibiza',
      country: 'Spain',
      eventType: 'club',
      setSlot: 'peak',
      durationSec: 2.5 * 3600,
      trackIds: ['fisher1', 'fisher2', 'mau5a', 'dc1', 'body2']
    },
    // Fabric, this year March (061 + 083 birthday gig)
    {
      id: 's-fabric1',
      name: 'Fabric Room One',
      performedAt: `${thisYear}-03-08`,
      venue: 'Fabric',
      city: 'London',
      eventType: 'club',
      durationSec: 1.5 * 3600,
      trackIds: ['surgeon1', 'plastik1', 'dc2', 'speedy1', 'orbital1']
    },
    {
      id: 's-fabric2',
      name: 'Fabric Returns',
      performedAt: `${thisYear}-05-20`,
      venue: 'Fabric',
      city: 'London',
      eventType: 'club',
      durationSec: 2 * 3600,
      trackIds: ['bicep1', 'orbital1', 'caribou1', 'body1']
    },
    // Warehouse party (173)
    {
      id: 's-warehouse',
      name: 'Hidden Warehouse Rave',
      performedAt: `${thisYear}-02-11`,
      venue: 'Warehouse Project',
      city: 'Manchester',
      eventType: 'club',
      durationSec: 3 * 3600,
      trackIds: ['plastik1', 'surgeon1', 'body3', 'dc2']
    },
    // Festival
    {
      id: 's-festival',
      name: 'Sunset Festival',
      performedAt: `${thisYear}-06-21`,
      venue: 'Lost Village',
      city: 'Lincoln',
      eventType: 'festival',
      setSlot: 'peak',
      durationSec: 1.5 * 3600,
      trackIds: ['mau5a', 'fisher1', 'body3']
    },
    // Longest set ever (080) — most tracks + longest duration
    {
      id: 's-marathon',
      name: 'All Night Long',
      performedAt: `${thisYear - 1}-12-31`,
      venue: 'The Cause',
      city: 'London',
      eventType: 'club',
      durationSec: 6 * 3600,
      trackIds: [
        'fisher1',
        'fisher2',
        'fisher3',
        'bicep1',
        'dc1',
        'dc2',
        'mau5a',
        'mau5b',
        'plastik1',
        'surgeon1',
        'speedy1',
        'orbital1',
        'caribou1',
        'body1',
        'body2',
        'body3'
      ]
    }
  ]

  const sequences = sessions.map((s) => s.trackIds)

  // ── Playlists (135 counts / 136 multi-playlist membership) ──────────────
  // 'fisher1' and 'dc1' deliberately appear in two playlists each.
  const playlists = [
    { name: 'Peak Time', trackIds: ['fisher1', 'dc1', 'dc2', 'body3'] },
    { name: 'Warm Up', trackIds: ['body4', 'caribou1', 'fisher1'] },
    { name: 'Techno Heat', trackIds: ['dc1', 'surgeon1', 'plastik1'] }
  ]

  return { tracks, sessions, byId, sequences, releaseYears: { ...RELEASE_YEARS }, playlists, now }
}
