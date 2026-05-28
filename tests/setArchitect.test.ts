import { describe, it, expect } from 'vitest'
import { buildSet } from '../electron/algorithms/setArchitect'
import type { ArchitectParams, Track } from '../src/types'
import { makeTrack } from './fixtures'

const CAMELOT_RING = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B',
]

function buildLibrary(): Track[] {
  const tracks: Track[] = []
  // 30 tracks evenly spread across the Camelot wheel, BPM 122-130, energy 3-9.
  // Deterministic IDs so two buildSet() runs operate on identical input.
  for (let i = 0; i < 30; i++) {
    tracks.push(
      makeTrack({
        id: `t-${i}`,
        title: `Track ${i}`,
        artist: `Artist ${i % 8}`,
        bpm: 122 + (i % 9),
        key: CAMELOT_RING[i % CAMELOT_RING.length],
        energy: 3 + (i % 7),
        duration: 320 + (i % 5) * 30,
      }),
    )
  }
  return tracks
}

const PARAMS: ArchitectParams = {
  targetDuration: 60,
  vibe: 'peak',
  slotTime: 'peak',
  crowdAge: 'mixed',
  venueType: 'club',
  bpmMin: 122,
  bpmMax: 130,
  harmonicMixing: true,
  followEnergyCurve: true,
  energyCurveType: 'rise',
}

describe('buildSet', () => {
  it('produces a non-empty set when the library has enough candidates', () => {
    const out = buildSet(PARAMS, buildLibrary())
    expect(out.length).toBeGreaterThan(3)
    // Positions must be monotonically increasing from 0
    expect(out.map((st) => st.position)).toEqual(out.map((_, i) => i))
  })

  it('is deterministic on track selection: same library + params → same track sequence', () => {
    // SetTrack IDs come from crypto.randomUUID() and will differ between runs;
    // determinism is about WHICH tracks land at WHICH positions.
    const a = buildSet(PARAMS, buildLibrary()).map((st) => st.trackId)
    const b = buildSet(PARAMS, buildLibrary()).map((st) => st.trackId)
    expect(a).toEqual(b)
  })

  it('returns an empty set when no track matches the BPM window', () => {
    const tooFast: ArchitectParams = { ...PARAMS, bpmMin: 170, bpmMax: 180 }
    expect(buildSet(tooFast, buildLibrary())).toEqual([])
  })

  it('preserves locked tracks at their exact positions', () => {
    const lib = buildLibrary()
    const lockedParams: ArchitectParams = {
      ...PARAMS,
      lockedTracks: [
        { position: 0, trackId: 't-3' },
        { position: 2, trackId: 't-17' },
      ],
    }
    const out = buildSet(lockedParams, lib)
    expect(out.length).toBeGreaterThan(3)
    expect(out[0].trackId).toBe('t-3')
    expect(out[0].locked).toBe(true)
    expect(out[2].trackId).toBe('t-17')
    expect(out[2].locked).toBe(true)
    // The bridge slot (position 1) should NOT be a locked track and must be different from both locks.
    expect(out[1].locked).toBeFalsy()
    expect(out[1].trackId).not.toBe('t-3')
    expect(out[1].trackId).not.toBe('t-17')
  })

  it('bypasses BPM filtering for locked tracks (an out-of-range lock still survives)', () => {
    const lib = buildLibrary()
    // Inject an off-BPM lock target; algorithm must accept it anyway.
    lib.push(makeTrack({ id: 't-slow', title: 'Slow', bpm: 90, key: '8A', energy: 5, duration: 360 }))
    const lockedParams: ArchitectParams = {
      ...PARAMS,
      lockedTracks: [{ position: 0, trackId: 't-slow' }],
    }
    const out = buildSet(lockedParams, lib)
    expect(out[0]?.trackId).toBe('t-slow')
    expect(out[0]?.locked).toBe(true)
  })

  it('extends the set length to cover a lock past the duration-derived count', () => {
    const lib = buildLibrary()
    const shortParams: ArchitectParams = {
      ...PARAMS,
      targetDuration: 30,  // ~5 tracks
      lockedTracks: [{ position: 9, trackId: 't-5' }],
    }
    const out = buildSet(shortParams, lib)
    expect(out.length).toBeGreaterThanOrEqual(10)
    expect(out[9].trackId).toBe('t-5')
    expect(out[9].locked).toBe(true)
  })
})
