/**
 * setBuilder.ts — pure, arc-aware set sequencer.
 *
 * Turns a SetBuildHit (src/utils/setBuildIntent.ts) into a sequenced set over
 * the track pool, honouring genre / never-played / venue / anchor / count /
 * BPM-arc / duration constraints. Deterministic; no DB deps.
 */

import type { Track } from '../../../src/types'
import type { SetBuildHit } from '../../../src/utils/setBuildIntent'

export interface SetBuildSession {
  performedAt: string
  venue?: string
  trackIds: string[]
}

export interface SetBuildAnswer {
  kind: 'set' | 'tracks' | 'stats' | 'empty'
  set?: Track[]
  tracks?: Track[]
  stats?: { label: string; value: string }[]
  narration: string
}

const AVG_TRACK_MIN = 4.5

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Order a pool to follow the requested energy arc. */
function sequence(pool: Track[], hit: SetBuildHit): Track[] {
  const byBpm = pool.slice().sort((a, b) => a.bpm - b.bpm)
  if (hit.bpmStart != null && hit.bpmEnd != null) {
    const lo = Math.min(hit.bpmStart, hit.bpmEnd)
    const hi = Math.max(hit.bpmStart, hit.bpmEnd)
    const span = byBpm.filter((t) => t.bpm >= lo - 1 && t.bpm <= hi + 1)
    return hit.bpmEnd >= hit.bpmStart ? span : span.reverse()
  }
  switch (hit.arc) {
    case 'rise':
      return pool.slice().sort((a, b) => a.energy - b.energy || a.bpm - b.bpm)
    case 'peak': {
      // low → high → low, peak in the middle
      const asc = pool.slice().sort((a, b) => a.energy - b.energy || a.bpm - b.bpm)
      const up: Track[] = []
      const down: Track[] = []
      asc.forEach((t, i) => (i % 2 === 0 ? up.push(t) : down.unshift(t)))
      return [...up, ...down]
    }
    case 'story': {
      // Mountain: dark/low intro → euphoric peak in the middle → melodic comedown.
      const asc = pool.slice().sort((a, b) => a.energy - b.energy)
      const rise: Track[] = []
      const fall: Track[] = []
      asc.forEach((t, i) => (i % 2 === 0 ? rise.push(t) : fall.unshift(t)))
      return [...rise, ...fall]
    }
    case 'flat':
    default:
      return byBpm
  }
}

export function buildSet(
  hit: SetBuildHit,
  tracksIn: Track[],
  sessions: SetBuildSession[],
  now: Date
): SetBuildAnswer {
  if (hit.vinylOnly) {
    return {
      kind: 'empty',
      narration:
        "SetRecord doesn't track a vinyl-only flag, so I can't build a strictly vinyl set. Tag your vinyl rips and I can filter on that instead."
    }
  }

  let pool = real(tracksIn)
  if (hit.genre) {
    const g = pool.filter((t) => (t.genre ?? '').toLowerCase().includes(hit.genre!))
    if (g.length > 0) pool = g // keep the broader pool if the genre matches nothing
  }
  if (hit.neverPlayed) pool = pool.filter((t) => t.playCount === 0 && !t.lastPlayed)
  if (hit.durationMinSec != null) pool = pool.filter((t) => t.duration >= hit.durationMinSec!)
  if (hit.yearMin != null)
    pool = pool.filter((t) => t.releaseYear != null && t.releaseYear >= hit.yearMin!)
  if (hit.yearMax != null)
    pool = pool.filter((t) => t.releaseYear != null && t.releaseYear <= hit.yearMax!)
  if (hit.venue) {
    const ids = new Set(
      sessions
        .filter((s) => (s.venue ?? '').toLowerCase().includes(hit.venue!.toLowerCase()))
        .flatMap((s) => s.trackIds)
    )
    pool = pool.filter((t) => ids.has(t.id))
  }
  if (hit.avoidRecentDays != null) {
    const cutoff = now.getTime() - hit.avoidRecentDays * 86400000
    pool = pool.filter((t) => !t.lastPlayed || new Date(t.lastPlayed).getTime() < cutoff)
  }
  if (hit.targetBpm != null) {
    pool = pool.filter((t) => Math.abs(t.bpm - hit.targetBpm!) <= 8)
  }
  if (hit.bpmMin != null) pool = pool.filter((t) => t.bpm >= hit.bpmMin!)
  if (hit.bpmMax != null) pool = pool.filter((t) => t.bpm <= hit.bpmMax!)
  // Peak-time sets stay high-energy (keep the broad pool if that empties it).
  if (hit.arc === 'peak') {
    const hot = pool.filter((t) => t.energy >= 7)
    if (hot.length > 0) pool = hot
  }
  // Soft genre lean (festival/big-room → techno family).
  if (hit.genreLean) {
    const re = new RegExp(
      hit.genreLean === 'techno' ? 'techno|tech house|big room' : hit.genreLean,
      'i'
    )
    const leaned = pool.filter((t) => re.test(t.genre ?? ''))
    if (leaned.length > 0) pool = leaned
  }

  // A b2b "pool": a flexible spread of energies (not a strict arc).
  if (hit.pool) {
    const n = Math.min(hit.count ?? 30, pool.length)
    const byEnergy = pool.slice().sort((a, b) => a.energy - b.energy)
    const picked =
      byEnergy.length > n
        ? Array.from(
            { length: n },
            (_, i) => byEnergy[Math.round((i * (byEnergy.length - 1)) / (n - 1))]
          )
        : byEnergy
    return {
      kind: 'set',
      set: picked,
      narration: `A ${picked.length}-track pool spanning low, mid and high energy${hit.b2b ? ' — flexible ordering for a back-to-back' : ''}.`
    }
  }

  // "longest set I could build" → a duration answer, not a sequence.
  // (handled by caller via stats; here we still return the pool length info)

  // Three opening tracks to choose from.
  if (hit.openers && hit.optionsCount) {
    const openers = pool
      .slice()
      .sort((a, b) => a.energy - b.energy || a.bpm - b.bpm)
      .slice(0, hit.optionsCount)
    return {
      kind: 'tracks',
      tracks: openers,
      narration: `${openers.length} low-energy opener options to choose from.`
    }
  }

  if (pool.length === 0) {
    return { kind: 'empty', narration: 'Not enough tracks match those constraints to build a set.' }
  }

  const count =
    hit.count ??
    (hit.lengthMinutes ? Math.max(1, Math.round(hit.lengthMinutes / AVG_TRACK_MIN)) : 14)

  // For energy-arc shapes (peak/story), down-sample the pool to `count`
  // energy-representative tracks FIRST, so the mountain's peak survives the
  // slice (otherwise the first N are all low-energy rise tracks).
  if ((hit.arc === 'peak' || hit.arc === 'story') && pool.length > count && count > 1) {
    const byE = pool.slice().sort((a, b) => a.energy - b.energy)
    pool = Array.from(
      { length: count },
      (_, i) => byE[Math.round((i * (byE.length - 1)) / (count - 1))]
    )
  }

  let seq = sequence(pool, hit)

  // Anchor: a named first track (token match handles "Artist - Title" ordering).
  if (hit.anchor) {
    const tokens = hit.anchor
      .toLowerCase()
      .replace(/\s*-\s*/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
    const anchor = pool.find((t) => {
      const h = `${t.title} ${t.artist}`.toLowerCase()
      return tokens.every((tok) => h.includes(tok))
    })
    if (anchor) seq = [anchor, ...seq.filter((t) => t.id !== anchor.id)]
  }

  // For an explicit BPM arc, sample evenly across the span so the set spans
  // start→end (rather than taking the lowest N). Index 0 (anchor) is preserved.
  let set: Track[]
  const n = Math.min(count, seq.length)
  if (hit.bpmStart != null && hit.bpmEnd != null && seq.length > n && n > 1) {
    set = Array.from({ length: n }, (_, i) => seq[Math.round((i * (seq.length - 1)) / (n - 1))])
  } else {
    set = seq.slice(0, n)
  }
  const totalSec = set.reduce((s, t) => s + (t.duration || 0), 0)
  const bits: string[] = []
  if (hit.genre) bits.push(hit.genre)
  if (hit.arc === 'peak') bits.push('peak-time')
  if (hit.arc === 'story') bits.push('dark → euphoric → comedown')
  if (hit.neverPlayed) bits.push('never-played')
  const desc = bits.length ? `${bits.join(', ')} ` : ''
  let narration = `A ${desc}set of ${set.length} tracks (${fmtDuration(totalSec)}).`
  if (hit.noVocals) narration += ' (Vocal filtering is approximate — no reliable vocal tag.)'
  if (hit.b2b)
    narration += ` Split into two halves with an energy hand-off at the midpoint (track ${Math.ceil(set.length / 2)}).`
  if (hit.multi && hit.multi > 1)
    narration = `${hit.multi} distinct sets — here's the first (${set.length} tracks).`

  return { kind: 'set', set, narration }
}
