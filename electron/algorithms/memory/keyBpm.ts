/**
 * keyBpm.ts — pure precise key/BPM answers (harmonic compatibility, exact tempo,
 * same-key-as-track, flat/minor filters, BPM lookup).
 */

import type { Track } from '../../../src/types'
import type { KeyBpmHit } from '../../../src/utils/keyBpmIntent'

export interface KeyBpmAnswer {
  kind: 'tracks' | 'count' | 'empty'
  tracks?: Track[]
  count?: number
  sourceTrack?: Track | null
  narration: string
}

const NOTE_TO_CAMELOT: Record<string, string> = {
  abm: '1A',
  'g#m': '1A',
  ebm: '2A',
  'd#m': '2A',
  bbm: '3A',
  'a#m': '3A',
  fm: '4A',
  cm: '5A',
  gm: '6A',
  dm: '7A',
  am: '8A',
  em: '9A',
  bm: '10A',
  'f#m': '11A',
  gbm: '11A',
  'c#m': '12A',
  dbm: '12A',
  b: '1B',
  'f#': '2B',
  gb: '2B',
  db: '3B',
  'c#': '3B',
  ab: '4B',
  'g#': '4B',
  eb: '5B',
  'd#': '5B',
  bb: '6B',
  'a#': '6B',
  f: '7B',
  c: '8B',
  g: '9B',
  d: '10B',
  a: '11B',
  e: '12B'
}

function real(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.phantom !== true)
}
function toCamelot(text: string): string | null {
  const t = text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/maj(or)?/, '')
    .replace(/min(or)?/, 'm')
  if (/^\d{1,2}[ab]$/.test(t)) return t.toUpperCase()
  if (NOTE_TO_CAMELOT[t]) return NOTE_TO_CAMELOT[t]
  return null
}
function neighbours(key: string): string[] {
  const m = /^(\d{1,2})([AB])$/.exec(key)
  if (!m) return [key]
  const n = Number(m[1])
  const l = m[2]
  const wrap = (x: number): number => ((x - 1 + 12) % 12) + 1
  return [`${n}${l}`, `${wrap(n - 1)}${l}`, `${wrap(n + 1)}${l}`, `${n}${l === 'A' ? 'B' : 'A'}`]
}
function findTrack(seed: string, tracks: Track[]): Track | null {
  const toks = seed
    .toLowerCase()
    .replace(/\s*-\s*/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
  if (!toks.length) return null
  return (
    tracks.find((t) => toks.every((tk) => `${t.title} ${t.artist}`.toLowerCase().includes(tk))) ??
    null
  )
}

export function computeKeyBpm(hit: KeyBpmHit, tracksIn: Track[]): KeyBpmAnswer {
  const tracks = real(tracksIn)
  const list = (out: Track[], narration: string): KeyBpmAnswer => ({
    kind: out.length ? 'tracks' : 'empty',
    tracks: out,
    narration: out.length ? narration : 'Nothing in your library matches that.'
  })

  switch (hit.metric) {
    case 'bpm_of': {
      const t = hit.seed ? findTrack(hit.seed, tracks) : null
      if (!t) return { kind: 'empty', narration: `"${hit.seed}" isn't in your library.` }
      return {
        kind: 'tracks',
        tracks: [t],
        sourceTrack: t,
        narration: `${t.title} is ${Math.round(t.bpm)} BPM.`
      }
    }
    case 'same_key_as': {
      const src = hit.seed ? findTrack(hit.seed, tracks) : null
      if (!src) return { kind: 'empty', narration: `"${hit.seed}" isn't in your library.` }
      const out = tracks.filter((t) => t.id !== src.id && t.key === src.key)
      return {
        ...list(out, `Tracks in the same key as ${src.title} (${src.key}).`),
        sourceTrack: src
      }
    }
    case 'key_of': {
      const key = toCamelot(hit.keyText ?? '')
      if (!key) return { kind: 'empty', narration: `I couldn't read that key.` }
      return list(
        tracks.filter((t) => t.key === key),
        `Tracks in ${key}.`
      )
    }
    case 'harmonic_with': {
      const key = (hit.keyText ?? '').toUpperCase()
      const compat = neighbours(key)
      return list(
        tracks.filter((t) => compat.includes(t.key)),
        `Harmonically compatible with ${key}: ${compat.join(', ')} (±1 on the Camelot wheel + relative major/minor).`
      )
    }
    case 'harmonic_mix_into': {
      const key = toCamelot(hit.keyText ?? '')
      const bpm = hit.bpm ?? 0
      if (!key) return { kind: 'empty', narration: `I couldn't read that key.` }
      const compat = neighbours(key)
      return list(
        tracks.filter((t) => compat.includes(t.key) && Math.abs(t.bpm - bpm) <= 1),
        `To mix into a ${bpm} BPM track in ${key}: harmonically compatible (${compat.join(', ')}) tracks at ${bpm - 1}–${bpm + 1} BPM.`
      )
    }
    case 'pitch_shift': {
      const target = hit.bpm ?? 0
      const src = Number(hit.seed) || target
      const lo = Math.min(src, target) - 1
      const hi = Math.max(src, target) + 1
      return list(
        tracks.filter((t) => t.bpm >= lo && t.bpm <= hi),
        `Tracks at ${lo}–${hi} BPM — a shift to ${target} is roughly ${Math.round((Math.abs(target - src) / src) * 100)}%; beyond ~5% can degrade quality.`
      )
    }
    case 'exact_bpm': {
      const bpm = hit.bpm ?? 0
      let out = tracks.filter((t) => Math.abs(t.bpm - bpm) <= 0.5)
      let keyNote = ''
      if (hit.keyText) {
        const key = toCamelot(hit.keyText)
        if (key) {
          out = out.filter((t) => t.key === key)
          keyNote = ` in ${key}`
        }
      }
      return list(out, `Tracks at exactly ${bpm} BPM${keyNote}.`)
    }
    case 'flat_keys': {
      const out = tracks.filter((t) => /b/i.test(t.keyOpenNotation ?? ''))
      return list(out, `Tracks in flat keys (B♭/E♭/A♭/D♭/G♭ and their relative minors).`)
    }
    case 'minor_only':
      return list(
        tracks.filter((t) => /^\d{1,2}A$/.test(t.key)),
        `Your minor-key tracks (Camelot A-side).`
      )
    case 'major_only':
      return list(
        tracks.filter((t) => /^\d{1,2}B$/.test(t.key)),
        `Your major-key tracks (Camelot B-side).`
      )
    default:
      return { kind: 'empty', narration: 'No key/BPM answer for that.' }
  }
}
