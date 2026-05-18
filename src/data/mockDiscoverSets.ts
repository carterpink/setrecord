import type { DiscoverSet, DiscoverTrack, TasteProfile } from '@/types'
import { deriveClarityReason } from '@/utils/clarityReason'
import { youtubeThumbnailUrl } from '@/utils/shopLinks'

export const MOCK_TASTE_PROFILE: TasteProfile = {
  favouriteArtists: ['Bicep', 'Four Tet', 'Floating Points', 'Skee Mask', 'Overmono'],
  favouriteGenres: ['Techno', 'House', 'Deep House', 'Minimal', 'Breakbeat'],
  followedDJs: ['Amelie Lens', 'Peggy Gou', 'Mall Grab'],
}

function track(
  position: number,
  artist: string,
  title: string,
  startSeconds: number,
  durationSeconds = 360,
  confidence = 0.95
): DiscoverTrack {
  return {
    id: `t-${position}`,
    position,
    artist,
    title,
    rawText: `${artist} - ${title}`,
    startSeconds,
    durationSeconds,
    confidence,
  }
}

// Helper to assemble a DiscoverSet (clarity computed against the mock taste profile)
function makeSet(input: Omit<DiscoverSet, 'clarity' | 'thumbnailUrl'>): DiscoverSet {
  return {
    ...input,
    thumbnailUrl: youtubeThumbnailUrl(input.videoId),
    clarity: deriveClarityReason(input, MOCK_TASTE_PROFILE),
  }
}

export const MOCK_DISCOVER_SETS: DiscoverSet[] = [
  // 1. Followed DJ (Amelie Lens)
  makeSet({
    id: 'mock-1',
    videoId: 'AzVhPYVE-CY',
    title: 'Amelie Lens @ Tomorrowland 2023',
    djName: 'Amelie Lens',
    eventName: 'Tomorrowland 2023',
    description:
      'Amelie Lens delivers a relentless 90-minute techno onslaught from the Atmosphere stage. Driving kicks, modular squelches, and crowd ID drops that will be talked about for months.',
    durationSeconds: 5400,
    viewCount: 1_240_000,
    likeCount: 38_000,
    uploadedAt: '2024-09-18T00:00:00Z',
    tags: ['Techno', 'Peak Time', 'Hard Techno'],
    tracklistConfidence: 0.92,
    tracklist: [
      track(1, 'Amelie Lens', 'Higher', 0, 360),
      track(2, 'Charlotte de Witte', 'Doppler', 360, 420),
      track(3, 'Adam Beyer', 'Your Mind', 780, 380),
      track(4, 'Reinier Zonneveld', 'Move Your Body to the Beat', 1160, 360),
      track(5, 'Klangkuenstler', 'Mensch Maschine', 1520, 420),
      track(6, 'Farrago', 'Stay With Me', 1940, 380),
      track(7, 'Sara Landry', 'Bend the Knee', 2320, 400),
      track(8, 'Amelie Lens', 'Voices of the Past', 2720, 380),
      track(9, 'Trym', 'Velocity', 3100, 360),
      track(10, 'ID', 'ID', 3460, 360, 0.3),
      track(11, 'Kobosil', 'Acid Eight', 3820, 400),
      track(12, 'Amelie Lens', 'In My Mind', 4220, 420),
    ],
  }),

  // 2. Plays Bicep
  makeSet({
    id: 'mock-2',
    videoId: '7sa6YJl7s6c',
    title: 'HAAi @ Glastonbury — Arcadia 2024',
    djName: 'HAAi',
    eventName: 'Glastonbury Arcadia 2024',
    description:
      'HAAi takes the Arcadia spider into deep, trippy territory with a tracklist that pulls equally from melodic techno and breakbeat-leaning IDM. Closes with a stunning Bicep blend.',
    durationSeconds: 4500,
    viewCount: 540_000,
    likeCount: 22_400,
    uploadedAt: '2024-07-02T00:00:00Z',
    tags: ['Techno', 'Breakbeat', 'Melodic'],
    tracklistConfidence: 0.88,
    tracklist: [
      track(1, 'HAAi', 'Pigeon Barron', 0, 360),
      track(2, 'Overmono', 'Is U', 360, 360),
      track(3, 'Skee Mask', 'CZ3000 Dub', 720, 420),
      track(4, 'Bicep', 'Atlas', 1140, 380),
      track(5, 'Four Tet', 'Baby', 1520, 360),
      track(6, 'Bicep', 'Glue', 1880, 420),
      track(7, 'Joy Orbison', 'flight fm', 2300, 360),
      track(8, 'Special Request', 'Spectral Frequency', 2660, 400),
      track(9, 'Kessler', 'Spell', 3060, 360),
      track(10, 'Bicep', 'Apricots', 3420, 420),
      track(11, 'HAAi', 'Channels', 3840, 360),
    ],
  }),

  // 3. Matches genre (Deep House) — DJ not followed, no fav artists in tracklist
  makeSet({
    id: 'mock-3',
    videoId: 'TgX4wo3kkSY',
    title: 'Larry Heard @ Boiler Room Detroit',
    djName: 'Larry Heard',
    eventName: 'Boiler Room Detroit 2023',
    description:
      'A masterclass in deep house from the man who invented the genre. Two hours of Mr. Fingers selections, unreleased dubs, and Chicago classics played out on an immaculate sound system.',
    durationSeconds: 7200,
    viewCount: 890_000,
    likeCount: 31_200,
    uploadedAt: '2023-11-04T00:00:00Z',
    tags: ['Deep House', 'House', 'Chicago'],
    tracklistConfidence: 0.78,
    tracklist: [
      track(1, 'Mr. Fingers', 'Can You Feel It', 0, 420),
      track(2, 'Larry Heard', 'Missing You', 420, 380),
      track(3, 'Fingers Inc.', 'Mystery of Love', 800, 420),
      track(4, 'Mr. Fingers', 'What About This Love', 1220, 400),
      track(5, 'Larry Heard', 'The Sun Cant Compare', 1620, 420),
      track(6, 'Robert Owens', 'Bring Down the Walls', 2040, 400),
      track(7, 'Mr. Fingers', 'Stars', 2440, 420),
      track(8, 'Larry Heard', 'Beyond the Clouds', 2860, 360),
    ],
  }),

  // 4. Trending (no match)
  makeSet({
    id: 'mock-4',
    videoId: 'cBwbpwzkE2k',
    title: 'Nina Kraviz @ Tresor 30',
    djName: 'Nina Kraviz',
    eventName: 'Tresor 30th Anniversary',
    description:
      'Nina Kraviz celebrates 30 years of Tresor with a vinyl-only set that traverses electro, trance, and pure Berlin techno. Filmed in the original Globus room.',
    durationSeconds: 6300,
    viewCount: 2_100_000,
    likeCount: 47_000,
    uploadedAt: '2025-04-12T00:00:00Z',
    tags: ['Techno', 'Electro', 'Trance'],
    tracklistConfidence: 0.55, // intentionally low → "Tracklist incomplete" badge
    tracklistSource: 'comments',
    tracklist: [
      track(1, 'Nina Kraviz', 'Ghetto Kraviz', 0, 380),
      track(2, 'Jeff Mills', 'The Bells', 380, 420),
      track(3, 'Surgeon', 'Klonk', 800, 400),
      track(4, 'Cybotron', 'Clear', 1200, 360),
      track(5, 'ID', 'ID', 1560, 420, 0.2),
      track(6, 'Drexciya', 'Wavejumper', 1980, 380),
      track(7, 'ID', 'ID', 2360, 400, 0.2),
    ],
  }),

  // 5. Followed DJ (Peggy Gou)
  makeSet({
    id: 'mock-5',
    videoId: 'q0u1ZksdLDQ',
    title: 'Peggy Gou @ Coachella 2024',
    djName: 'Peggy Gou',
    eventName: 'Coachella 2024',
    description:
      'Peggy Gou debuts unreleased material from her forthcoming album alongside classic Italo disco edits and Korean disco rarities. Pure feel-good festival energy.',
    durationSeconds: 4800,
    viewCount: 1_780_000,
    likeCount: 52_000,
    uploadedAt: '2024-04-15T00:00:00Z',
    tags: ['House', 'Disco', 'Italo'],
    tracklistConfidence: 0.9,
    tracklist: [
      track(1, 'Peggy Gou', '(It Goes Like) Nanana', 0, 360),
      track(2, 'Dam Swindle', '64 Ways', 360, 380),
      track(3, 'Folamour', 'The Power to the People', 740, 400),
      track(4, 'Honey Dijon', 'Downtown', 1140, 420),
      track(5, 'Peggy Gou', 'It Makes You Forget', 1560, 400),
      track(6, 'DJ Boring', 'Winona', 1960, 380),
      track(7, 'Mall Grab', 'Sun Ra', 2340, 360),
      track(8, 'Peggy Gou', 'I Hear You', 2700, 420),
    ],
  }),

  // 6. Plays Four Tet
  makeSet({
    id: 'mock-6',
    videoId: 'Ru7B5_5g7Lk',
    title: 'Caribou @ Printworks London',
    djName: 'Caribou',
    eventName: 'Printworks Closing 2023',
    description:
      'Dan Snaith aka Caribou closes out Printworks with a sublime four-hour set blending his own material with Daphni edits and rare collaborations.',
    durationSeconds: 14400,
    viewCount: 670_000,
    likeCount: 24_300,
    uploadedAt: '2023-05-22T00:00:00Z',
    tags: ['House', 'Deep House', 'Electronica'],
    tracklistConfidence: 0.83,
    tracklist: [
      track(1, 'Caribou', 'Volume', 0, 360),
      track(2, 'Daphni', 'Cherry', 360, 420),
      track(3, 'Four Tet', 'Two Thousand and Seventeen', 780, 400),
      track(4, 'Caribou', 'Home', 1180, 380),
      track(5, 'Floating Points', 'Vocoder', 1560, 420),
      track(6, 'Four Tet', 'Lush', 1980, 400),
      track(7, 'Daphni', 'Sea Lions', 2380, 380),
      track(8, 'Caribou', 'Never Come Back', 2760, 420),
      track(9, 'Floating Points', 'Last Bloom', 3180, 400),
      track(10, 'Four Tet', 'Romantics', 3580, 360),
    ],
  }),

  // 7. Followed DJ (Mall Grab)
  makeSet({
    id: 'mock-7',
    videoId: 'CDgD4u-uHmo',
    title: 'Mall Grab — Looking For Trouble Tour Dublin',
    djName: 'Mall Grab',
    eventName: 'Looking For Trouble Tour 2024',
    description:
      'Mall Grab brings his hardcore-influenced selections to Dublin with breakbeat and rave edits aplenty. Includes a stop at a UK garage tangent halfway through.',
    durationSeconds: 5400,
    viewCount: 412_000,
    likeCount: 18_900,
    uploadedAt: '2024-10-30T00:00:00Z',
    tags: ['Breakbeat', 'Hardcore', 'UKG'],
    tracklistConfidence: 0.81,
    tracklist: [
      track(1, 'Mall Grab', 'Looking for Trouble', 0, 360),
      track(2, 'Sammy Virji', 'Soundboy Burial', 360, 320),
      track(3, 'Interplanetary Criminal', 'Get You Off My Mind', 680, 360),
      track(4, 'Mall Grab', 'Pool Shark', 1040, 380),
      track(5, 'DJ Q', 'Brandy & Coke', 1420, 340),
      track(6, 'Mall Grab', 'Patience', 1760, 380),
    ],
  }),

  // 8. Plays Skee Mask
  makeSet({
    id: 'mock-8',
    videoId: 'XGuJZHsmRQE',
    title: 'Objekt @ Berghain Säule',
    djName: 'Objekt',
    eventName: 'Berghain Säule 2024',
    description:
      'Objekt delivers a typically genre-fluid set at Berghains Säule room, mixing IDM, leftfield techno, and dub-techno bombs with surgical precision.',
    durationSeconds: 9000,
    viewCount: 285_000,
    likeCount: 11_200,
    uploadedAt: '2024-01-08T00:00:00Z',
    tags: ['Techno', 'IDM', 'Dub Techno'],
    tracklistConfidence: 0.74,
    tracklist: [
      track(1, 'Objekt', 'Theme From Q', 0, 380),
      track(2, 'Skee Mask', 'Pevc', 380, 420),
      track(3, 'Pessimist', 'Bawl', 800, 400),
      track(4, 'Skee Mask', 'Rio Dub', 1200, 380),
      track(5, 'Errorsmith', 'Lightspeed', 1580, 360),
      track(6, 'Objekt', 'Ganzfeld', 1940, 400),
      track(7, 'Skee Mask', 'CZ4000', 2340, 420),
    ],
  }),

  // 9. Matches genre (Techno)
  makeSet({
    id: 'mock-9',
    videoId: 'M-9C2BqxQs0',
    title: 'Dax J @ Awakenings Festival',
    djName: 'Dax J',
    eventName: 'Awakenings 2024',
    description:
      'Dax J brings his Monnom Black sound to the main stage at Awakenings, delivering pulverising techno with industrial textures.',
    durationSeconds: 5400,
    viewCount: 478_000,
    likeCount: 16_400,
    uploadedAt: '2024-07-08T00:00:00Z',
    tags: ['Techno', 'Industrial', 'Peak Time'],
    tracklistConfidence: 0.86,
    tracklist: [
      track(1, 'Dax J', 'Confession', 0, 360),
      track(2, 'KAS:ST', 'Insomnia', 360, 380),
      track(3, 'Setaoc Mass', 'On the Threshold', 740, 400),
      track(4, 'Dax J', 'Imam', 1140, 380),
      track(5, 'Tham', 'Closer', 1520, 360),
      track(6, 'Dax J', 'Underworld', 1880, 420),
    ],
  }),

  // 10. Plays Overmono
  makeSet({
    id: 'mock-10',
    videoId: 'mqVT1Em3xww',
    title: 'Joy Orbison @ XOYO Residency Week 3',
    djName: 'Joy Orbison',
    eventName: 'XOYO Residency 2024',
    description:
      'Week three of Joy Orbisons XOYO residency, blending classic dubstep with modern UK funky and a stack of unreleased Overmono dubs.',
    durationSeconds: 7200,
    viewCount: 198_000,
    likeCount: 9_400,
    uploadedAt: '2024-03-21T00:00:00Z',
    tags: ['UKG', 'Dubstep', 'Breakbeat'],
    tracklistConfidence: 0.79,
    tracklist: [
      track(1, 'Joy Orbison', 'flight fm', 0, 320),
      track(2, 'Overmono', 'So U Kno', 320, 380),
      track(3, 'Pinch', 'Qawwali', 700, 420),
      track(4, 'Overmono', 'Good Lies', 1120, 380),
      track(5, 'Loefah', 'Mud', 1500, 360),
      track(6, 'Overmono', 'BBY', 1860, 380),
      track(7, 'Joy Orbison', 'Hyph Mngo', 2240, 380),
    ],
  }),

  // 11. Trending (none)
  makeSet({
    id: 'mock-11',
    videoId: 'Ej0pWHlfsHA',
    title: 'Helena Hauff @ Dekmantel Festival',
    djName: 'Helena Hauff',
    eventName: 'Dekmantel 2023',
    description:
      'Helena Hauff plays a vinyl-only set of EBM, electro, and acid at the UFO stage. Industrial, raw, and uncompromising.',
    durationSeconds: 4800,
    viewCount: 320_000,
    likeCount: 14_200,
    uploadedAt: '2023-08-07T00:00:00Z',
    tags: ['Electro', 'EBM', 'Acid'],
    tracklistConfidence: 0.71,
    tracklist: [
      track(1, 'Helena Hauff', 'No Qualms', 0, 380),
      track(2, 'DMX Krew', 'Ill Be There', 380, 360),
      track(3, 'Aux 88', 'Bass Magnetic', 740, 400),
      track(4, 'Helena Hauff', 'Spur', 1140, 380),
      track(5, 'Anthony Rother', 'Hacker', 1520, 420),
      track(6, 'Drexciya', 'Bubble Metropolis', 1940, 380),
    ],
  }),

  // 12. Matches genre (Minimal)
  makeSet({
    id: 'mock-12',
    videoId: 'kT9Eg1JHE_Q',
    title: 'Ricardo Villalobos @ Fabric London',
    djName: 'Ricardo Villalobos',
    eventName: 'Fabric 2024',
    description:
      'Ricardo Villalobos takes Fabric room one on an eight-hour journey through minimal, microhouse, and Latin-tinged grooves. Filmed in the early hours.',
    durationSeconds: 28800,
    viewCount: 156_000,
    likeCount: 8_700,
    uploadedAt: '2024-02-17T00:00:00Z',
    tags: ['Minimal', 'Microhouse', 'Tech House'],
    tracklistConfidence: 0.65,
    tracklist: [
      track(1, 'Ricardo Villalobos', 'Easy Lee', 0, 540),
      track(2, 'Luciano', 'Orange Mistake', 540, 480),
      track(3, 'Zip', 'Acclamation', 1020, 420),
      track(4, 'Sonja Moonear', 'Saw', 1440, 400),
      track(5, 'Ricardo Villalobos', 'Dexter', 1840, 600),
      track(6, 'Cabanne', 'Maybellene', 2440, 480),
    ],
  }),
]

/**
 * Phase 1 indirection — Phase 2 will swap this for an IPC call without changing the store.
 */
export async function loadDiscoverSets(): Promise<DiscoverSet[]> {
  // Simulate a tiny delay so the loading state is visible in dev
  await new Promise((r) => setTimeout(r, 120))
  return MOCK_DISCOVER_SETS
}
