/**
 * Translation layer between a SetSense `DJSet` (the Zustand source of truth) and
 * the shared Yjs document. Three operations:
 *   • seedYDoc        — host populates a fresh doc from its current set
 *   • projectToDJSet  — build a DJSet from the doc, hydrated against THIS peer's
 *                       library (phantom fallback for tracks it doesn't own)
 *   • reconcileYDoc   — diff a DJSet INTO the doc (called inside a LOCAL_ORIGIN
 *                       transaction by the bridge); mirrors operations, not
 *                       snapshots, so concurrent adds/removes merge cleanly.
 *
 * Ordering is the Y.Array index — `position` is derived on projection and never
 * stored, which removes the whole "two DJs both set position=5" conflict class.
 */

import * as Y from 'yjs'
import type { Set as DJSet, SetTrack, SetVibe, VenueType, EnergyCurveType, CDJModel } from '@/types'
import {
  Y_META,
  Y_TRACKS,
  type SharedTrackMeta,
  toSharedMeta,
  phantomFromMeta
} from './sharedTypes'

type YSlot = Y.Map<unknown>
type YTracks = Y.Array<YSlot>
type YMeta = Y.Map<unknown>

/** Resolve a shared slot to a local Track, or null when the library lacks it. */
export type TrackResolver = (meta: SharedTrackMeta) => import('@/types').Track | null

function buildSlotMap(st: SetTrack): YSlot {
  const m = new Y.Map<unknown>()
  m.set('slotId', st.id)
  m.set('trackId', st.track.id)
  m.set('meta', toSharedMeta(st.track))
  m.set('locked', st.locked ?? false)
  m.set('energyOverride', st.energyOverride ?? null)
  m.set('notes', st.notes ?? null)
  return m
}

function setIfChanged(m: YSlot, key: string, value: unknown): void {
  if (m.get(key) !== value) m.set(key, value)
}

/** Populate a fresh Y.Doc from a set. Wrap the call in a transaction yourself. */
export function seedYDoc(doc: Y.Doc, set: DJSet, hostName: string): void {
  const meta = doc.getMap(Y_META) as YMeta
  meta.set('setId', set.id)
  meta.set('name', set.name)
  meta.set('targetBpmMin', set.targetBpmMin ?? null)
  meta.set('targetBpmMax', set.targetBpmMax ?? null)
  meta.set('vibe', set.vibe ?? null)
  meta.set('venue', set.venue ?? null)
  meta.set('energyCurveType', set.energyCurveType ?? null)
  meta.set('targetHardware', set.targetHardware ?? null)
  meta.set('slotTime', set.slotTime ?? null)
  meta.set('hostName', hostName)

  const tracks = doc.getArray(Y_TRACKS) as YTracks
  tracks.push(set.tracks.map(buildSlotMap))
}

/** True once the doc carries a seeded set (the host has populated `meta.setId`). */
export function isDocSeeded(doc: Y.Doc): boolean {
  return Boolean((doc.getMap(Y_META) as YMeta).get('setId'))
}

/**
 * Build a DJSet view of the shared doc, hydrating each slot against the local
 * library. `fallback` supplies identity/timestamps the CRDT doesn't carry.
 */
export function projectToDJSet(
  doc: Y.Doc,
  resolve: TrackResolver,
  fallback: { id: string; createdAt: string }
): DJSet {
  const meta = doc.getMap(Y_META) as YMeta
  const yTracks = doc.getArray(Y_TRACKS) as YTracks

  const tracks: SetTrack[] = yTracks.toArray().map((slot, index) => {
    const tmeta = slot.get('meta') as SharedTrackMeta
    const local = resolve(tmeta)
    const track = local ?? phantomFromMeta(tmeta)
    const energyOverride = slot.get('energyOverride')
    const notes = slot.get('notes')
    return {
      id: slot.get('slotId') as string,
      trackId: track.id,
      track,
      position: index,
      locked: (slot.get('locked') as boolean) || undefined,
      energyOverride: typeof energyOverride === 'number' ? energyOverride : undefined,
      notes: typeof notes === 'string' ? notes : undefined
    }
  })

  const asNum = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
  const asStr = <T extends string>(v: unknown): T | undefined =>
    typeof v === 'string' ? (v as T) : undefined

  return {
    id: (meta.get('setId') as string) || fallback.id,
    name: (meta.get('name') as string) || 'Shared set',
    createdAt: fallback.createdAt,
    updatedAt: new Date().toISOString(),
    tracks,
    targetBpmMin: asNum(meta.get('targetBpmMin')),
    targetBpmMax: asNum(meta.get('targetBpmMax')),
    vibe: asStr<SetVibe>(meta.get('vibe')),
    venue: asStr<VenueType>(meta.get('venue')),
    energyCurveType: asStr<EnergyCurveType>(meta.get('energyCurveType')),
    targetHardware: asStr<CDJModel>(meta.get('targetHardware')),
    slotTime: asStr(meta.get('slotTime'))
  }
}

/**
 * Diff a set INTO the doc. Targeted insert/delete (so concurrent adds/removes by
 * the other peer survive) + a selection-sort reorder pass + mutable-field
 * updates. MUST be called inside `doc.transact(fn, LOCAL_ORIGIN)`.
 */
export function reconcileYDoc(doc: Y.Doc, set: DJSet): void {
  // ── Set-level scalars ──
  const meta = doc.getMap(Y_META) as YMeta
  if (!meta.get('setId')) meta.set('setId', set.id)
  setIfChanged(meta, 'name', set.name)
  setIfChanged(meta, 'targetBpmMin', set.targetBpmMin ?? null)
  setIfChanged(meta, 'targetBpmMax', set.targetBpmMax ?? null)
  setIfChanged(meta, 'vibe', set.vibe ?? null)
  setIfChanged(meta, 'venue', set.venue ?? null)
  setIfChanged(meta, 'energyCurveType', set.energyCurveType ?? null)
  setIfChanged(meta, 'targetHardware', set.targetHardware ?? null)
  setIfChanged(meta, 'slotTime', set.slotTime ?? null)

  // ── Ordered slots ──
  const yTracks = doc.getArray(Y_TRACKS) as YTracks
  const target = set.tracks
  const targetIds = new Set(target.map((t) => t.id))

  // 1) Deletions (descending so indices stay valid).
  for (let i = yTracks.length - 1; i >= 0; i--) {
    if (!targetIds.has(yTracks.get(i).get('slotId') as string)) yTracks.delete(i, 1)
  }

  // 2) Insertions (append; order fixed in step 3). New slots are owned locally,
  //    so their meta/trackId come from the local Track.
  const liveIds = (): string[] => yTracks.toArray().map((m) => m.get('slotId') as string)
  let live = liveIds()
  for (const st of target) {
    if (!live.includes(st.id)) {
      yTracks.push([buildSlotMap(st)])
      live = liveIds()
    }
  }

  // 3) Reorder to target order. Move = delete + reinsert preserving the slot's
  //    identity (slotId/trackId/meta) so the originator's track survives a move.
  for (let i = 0; i < target.length; i++) {
    const wantId = target[i].id
    if ((yTracks.get(i).get('slotId') as string) === wantId) continue
    let j = -1
    for (let k = i + 1; k < yTracks.length; k++) {
      if ((yTracks.get(k).get('slotId') as string) === wantId) {
        j = k
        break
      }
    }
    if (j === -1) continue
    const moved = yTracks.get(j)
    const preserved = {
      slotId: moved.get('slotId'),
      trackId: moved.get('trackId'),
      meta: moved.get('meta')
    }
    const tgt = target[i]
    yTracks.delete(j, 1)
    const nm = new Y.Map<unknown>()
    nm.set('slotId', preserved.slotId)
    nm.set('trackId', preserved.trackId)
    nm.set('meta', preserved.meta)
    nm.set('locked', tgt.locked ?? false)
    nm.set('energyOverride', tgt.energyOverride ?? null)
    nm.set('notes', tgt.notes ?? null)
    yTracks.insert(i, [nm])
  }

  // 4) Mutable-field updates for slots already in place (cheap no-op when equal).
  for (let i = 0; i < target.length; i++) {
    const m = yTracks.get(i)
    const tgt = target[i]
    setIfChanged(m, 'locked', tgt.locked ?? false)
    setIfChanged(m, 'energyOverride', tgt.energyOverride ?? null)
    setIfChanged(m, 'notes', tgt.notes ?? null)
  }
}
