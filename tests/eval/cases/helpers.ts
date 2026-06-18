/** Shared assertion helpers for eval cases. A check returns `true` to pass or a
 *  short failure reason string to fail. */
import type { Track } from '../../../src/types'
import type { EngineResult, EvalCtx } from '../types'

/** The track payload of a result, regardless of which kind produced it. */
export function tracksOf(r: EngineResult): Track[] {
  return r.tracks ?? r.set ?? []
}
export function countOf(r: EngineResult): number {
  return tracksOf(r).length
}
export function ids(r: EngineResult): string[] {
  return tracksOf(r).map((t) => t.id)
}
export function hasId(r: EngineResult, id: string): boolean {
  return ids(r).includes(id)
}
export function everyTrack(r: EngineResult, pred: (t: Track) => boolean): boolean {
  const ts = tracksOf(r)
  return ts.length > 0 && ts.every(pred)
}
export function someTrack(r: EngineResult, pred: (t: Track) => boolean): boolean {
  return tracksOf(r).some(pred)
}
export function artistContains(t: Track, name: string): boolean {
  return `${t.artist} ${t.album ?? ''}`.toLowerCase().includes(name.toLowerCase())
}
export function titleContains(t: Track, s: string): boolean {
  return t.title.toLowerCase().includes(s.toLowerCase())
}
/** True when the result is a non-empty track list. */
export function nonEmptyTracks(r: EngineResult): boolean {
  return (r.kind === 'tracks' || r.kind === 'combos' || r.kind === 'set') && countOf(r) > 0
}
/** True when the engine clearly signalled "understood but nothing matched". */
export function isHonestEmpty(r: EngineResult): boolean {
  return r.kind === 'empty'
}
/** Expected count of tracks in the fixture world matching a predicate. */
export function expected(ctx: EvalCtx, pred: (t: Track) => boolean): number {
  return ctx.tracks.filter((t) => t.phantom !== true && pred(t)).length
}
