import { describe, it, expect } from 'vitest'
import { buildSet } from '../electron/algorithms/setArchitect'
import { getProfile } from '../electron/algorithms/genreProfiles'
import type { ArchitectParams, Track } from '../src/types'
import { makeTrack } from './fixtures'

const CAMELOT_RING = [
  '1A',
  '2A',
  '3A',
  '4A',
  '5A',
  '6A',
  '7A',
  '8A',
  '9A',
  '10A',
  '11A',
  '12A',
  '1B',
  '2B',
  '3B',
  '4B',
  '5B',
  '6B',
  '7B',
  '8B',
  '9B',
  '10B',
  '11B',
  '12B'
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
        duration: 320 + (i % 5) * 30
      })
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
  energyCurveType: 'rise'
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

  it('still deterministic when variationSeed is undefined (the default path)', () => {
    // Guards the opt-in nature of variation: omitting the seed must not change
    // behaviour vs. the historical builder.
    const seeded = buildSet({ ...PARAMS, variationSeed: undefined }, buildLibrary()).map(
      (st) => st.trackId
    )
    const plain = buildSet(PARAMS, buildLibrary()).map((st) => st.trackId)
    expect(seeded).toEqual(plain)
  })

  it('a given variationSeed is reproducible', () => {
    const a = buildSet({ ...PARAMS, variationSeed: 42 }, buildLibrary()).map((st) => st.trackId)
    const b = buildSet({ ...PARAMS, variationSeed: 42 }, buildLibrary()).map((st) => st.trackId)
    expect(a).toEqual(b)
  })

  it('a given seed is reproducible across the FULL param surface (locks + source + profile)', () => {
    // The reproducibility contract must hold with every axis engaged, not just
    // the bare params — locks and the bridge pass also consume the RNG.
    const lib = buildLibrary()
    const full: ArchitectParams = {
      ...PARAMS,
      variationSeed: 99,
      targetDuration: 90,
      lockedTracks: [
        { position: 0, trackId: 't-3' },
        { position: 4, trackId: 't-17' }
      ]
    }
    const a = buildSet(full, lib, getProfile('tech-house')).map((st) => st.trackId)
    const b = buildSet(full, lib, getProfile('tech-house')).map((st) => st.trackId)
    expect(a).toEqual(b)
    // And the locks still landed where requested.
    expect(a[0]).toBe('t-3')
    expect(a[4]).toBe('t-17')
  })

  it('seed pins variation, NOT the library: a changed pool may yield a different set', () => {
    // Documents the best-effort reproduction contract (FR-305). Same seed +
    // same params, but a track removed from the pool — the output is ALLOWED to
    // differ. This guards against anyone later filing library-drift as a bug.
    const seeded: ArchitectParams = { ...PARAMS, variationSeed: 7 }
    const full = buildSet(seeded, buildLibrary()).map((st) => st.trackId)

    // Drop a track the seeded build actually used, then rebuild with the same seed.
    const usedId = full[2]
    const shrunk = buildLibrary().filter((t) => t.id !== usedId)
    const after = buildSet(seeded, shrunk).map((st) => st.trackId)

    // The contract is "may differ" — at minimum the dropped track is gone.
    expect(after).not.toContain(usedId)
  })

  it('different variationSeeds can yield a different arrangement within constraints', () => {
    const lib = buildLibrary()
    const variants = [1, 2, 3, 4, 5, 6].map((seed) =>
      buildSet({ ...PARAMS, variationSeed: seed }, lib).map((st) => st.trackId)
    )
    // At least one seed must differ from the deterministic baseline.
    const baseline = buildSet(PARAMS, lib).map((st) => st.trackId)
    const anyDifferent = variants.some(
      (v) => v.length !== baseline.length || v.some((id, i) => id !== baseline[i])
    )
    expect(anyDifferent).toBe(true)

    // Every variant must still respect the BPM window (locks aside, none here).
    const byId = new Map(lib.map((t) => [t.id, t]))
    for (const v of variants) {
      for (const id of v) {
        const t = byId.get(id)!
        expect(t.bpm).toBeGreaterThanOrEqual(PARAMS.bpmMin - 5)
        expect(t.bpm).toBeLessThanOrEqual(PARAMS.bpmMax + 5)
      }
    }
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
        { position: 2, trackId: 't-17' }
      ]
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
    lib.push(
      makeTrack({ id: 't-slow', title: 'Slow', bpm: 90, key: '8A', energy: 5, duration: 360 })
    )
    const lockedParams: ArchitectParams = {
      ...PARAMS,
      lockedTracks: [{ position: 0, trackId: 't-slow' }]
    }
    const out = buildSet(lockedParams, lib)
    expect(out[0]?.trackId).toBe('t-slow')
    expect(out[0]?.locked).toBe(true)
  })

  it('extends the set length to cover a lock past the duration-derived count', () => {
    const lib = buildLibrary()
    const shortParams: ArchitectParams = {
      ...PARAMS,
      targetDuration: 30, // ~5 tracks
      lockedTracks: [{ position: 9, trackId: 't-5' }]
    }
    const out = buildSet(shortParams, lib)
    expect(out.length).toBeGreaterThanOrEqual(10)
    expect(out[9].trackId).toBe('t-5')
    expect(out[9].locked).toBe(true)
  })

  // A library split into two tempo clusters (~122 and ~142) with a >16 BPM gap
  // between them. The genre profile's maxStep governs whether the builder may
  // bridge that gap.
  function clusteredLibrary(): Track[] {
    const tracks: Track[] = []
    for (let i = 0; i < 12; i++) {
      tracks.push(
        makeTrack({
          id: `lo-${i}`,
          bpm: 122 + (i % 3),
          key: CAMELOT_RING[i % CAMELOT_RING.length],
          energy: 3 + (i % 7)
        })
      )
      tracks.push(
        makeTrack({
          id: `hi-${i}`,
          bpm: 142 + (i % 3),
          key: CAMELOT_RING[(i + 5) % CAMELOT_RING.length],
          energy: 3 + (i % 7)
        })
      )
    }
    return tracks
  }

  it('respects the genre profile maxStep between adjacent tracks', () => {
    const lib = clusteredLibrary()
    const wide: ArchitectParams = { ...PARAMS, bpmMin: 120, bpmMax: 146, targetDuration: 90 }
    const dnb = getProfile('dnb') // maxStep 10 — cannot bridge the ~20 BPM cluster gap

    const out = buildSet(wide, lib, dnb)
    expect(out.length).toBeGreaterThan(1)

    const byId = new Map(lib.map((t) => [t.id, t]))
    for (let i = 1; i < out.length; i++) {
      const prev = byId.get(out[i - 1].trackId)!
      const cur = byId.get(out[i].trackId)!
      expect(Math.abs(cur.bpm - prev.bpm)).toBeLessThanOrEqual(dnb.bpm.maxStep)
    }
  })

  it('builds a valid set under an explicit genre profile', () => {
    const out = buildSet(PARAMS, buildLibrary(), getProfile('tech-house'))
    expect(out.length).toBeGreaterThan(3)
    expect(out.map((st) => st.position)).toEqual(out.map((_, i) => i))
  })
})
