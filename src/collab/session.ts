/**
 * Session engine — wires a Y.Doc + CollabProvider to the SetRecord stores.
 *
 * The bridge is two one-way bindings guarded against feedback:
 *   • outbound: setStore.currentSet change → reconcileYDoc INSIDE a LOCAL_ORIGIN
 *     transaction. Remote-origin doc updates are ignored here so we never echo.
 *   • inbound: doc update (origin ≠ LOCAL_ORIGIN) → projectToDJSet →
 *     setStore.applyRemoteSet, fenced by `isApplyingRemote` so the resulting
 *     store mutation doesn't bounce straight back out.
 *
 * collabStore owns the user-facing UI/IPC; this module owns the CRDT plumbing.
 */

import * as Y from 'yjs'
import type { Set as DJSet, Track } from '@/types'
import { useSetStore } from '@/stores/setStore'
import { useLibraryStore } from '@/stores/libraryStore'
import { useCollabStore } from '@/stores/collabStore'
import { useToastStore } from '@/stores/toastStore'
import { CollabProvider, type CollabStatus } from './provider'
import { projectToDJSet, reconcileYDoc, seedYDoc, type TrackResolver } from './projection'
import {
  Y_META,
  makeMatchKey,
  type CollabAwarenessState,
  type CollabPeer,
  type SharedTrackMeta
} from './sharedTypes'

/** Tags transactions we author locally so inbound projection can ignore them. */
const LOCAL_ORIGIN = Symbol('setrecord-collab-local')

interface ActiveSession {
  doc: Y.Doc
  provider: CollabProvider
  role: 'host' | 'guest'
  /** The shared set id. Known up-front for a host; learned on first sync for a guest. */
  setId: string | null
  createdAt: string
  selfName: string
  selfColor: string
  cleanups: Array<() => void>
}

let active: ActiveSession | null = null
let isApplyingRemote = false
let projectScheduled = false

/** Match shared slots to local Tracks by matchKey, with a length-keyed cache. */
function makeResolver(): TrackResolver {
  let cache: { size: number; map: Map<string, Track> } | null = null
  return (meta: SharedTrackMeta): Track | null => {
    const tracks = useLibraryStore.getState().tracks
    if (!cache || cache.size !== tracks.length) {
      const map = new Map<string, Track>()
      for (const tr of tracks) map.set(makeMatchKey(tr.artist, tr.title, tr.bpm), tr)
      cache = { size: tracks.length, map }
    }
    return cache.map.get(meta.matchKey) ?? null
  }
}

function readPeers(provider: CollabProvider): CollabPeer[] {
  const self = provider.doc.clientID
  const peers: CollabPeer[] = []
  provider.awareness.getStates().forEach((state, clientId) => {
    if (clientId === self) return
    const s = state as Partial<CollabAwarenessState>
    if (!s.user) return
    peers.push({
      clientId,
      name: s.user.name,
      color: s.user.color,
      editingSlotId: s.editingSlotId ?? null
    })
  })
  return peers
}

function mapStatus(s: CollabStatus): void {
  const store = useCollabStore.getState()
  if (s === 'connected') store.setStatus('connected')
  else if (s === 'reconnecting') store.setStatus('reconnecting')
  else if (s === 'connecting') store.setStatus('connecting')
  else if (s === 'error') store.setStatus('reconnecting')
  else if (s === 'closed') {
    // Terminal: the relay/host is gone. End the session and keep our copy.
    // (Guarded by `active` so the destroy() that follows leave() is a no-op.)
    if (active) void store.leave()
  }
}

function wireBridge(session: ActiveSession): void {
  const { doc, provider } = session
  const resolve = makeResolver()

  const project = (): void => {
    const seededId = (doc.getMap(Y_META).get('setId') as string | undefined) ?? null
    const fallbackId = session.setId ?? seededId ?? crypto.randomUUID()
    const next: DJSet = projectToDJSet(doc, resolve, {
      id: fallbackId,
      createdAt: session.createdAt
    })
    session.setId = next.id
    isApplyingRemote = true
    try {
      useSetStore.getState().applyRemoteSet(next)
    } finally {
      isApplyingRemote = false
    }
  }

  const scheduleProject = (): void => {
    if (projectScheduled) return
    projectScheduled = true
    queueMicrotask(() => {
      projectScheduled = false
      if (active === session) project()
    })
  }

  // ── inbound: remote doc change → local store ──
  const onDocUpdate = (_update: Uint8Array, origin: unknown): void => {
    if (origin === LOCAL_ORIGIN) return
    scheduleProject()
  }
  doc.on('update', onDocUpdate)
  session.cleanups.push(() => doc.off('update', onDocUpdate))

  // ── outbound: local set change → doc ──
  const unsubSet = useSetStore.subscribe((state, prev) => {
    if (isApplyingRemote) return
    if (state.currentSet === prev.currentSet) return
    const cur = state.currentSet
    if (!cur) return
    // A guest hasn't adopted the shared set id until first sync — don't push its
    // pre-join set into the shared doc.
    if (session.setId && cur.id !== session.setId) return
    if (!session.setId && session.role === 'guest') return
    doc.transact(() => reconcileYDoc(doc, cur), LOCAL_ORIGIN)
  })
  session.cleanups.push(unsubSet)

  // ── presence (with join/leave toasts — the "your partner is here" cue) ──
  let prevPeers = new Map<number, string>()
  const onAwareness = (): void => {
    if (active !== session) return
    const peers = readPeers(provider)
    const next = new Map(peers.map((p) => [p.clientId, p.name]))
    const toast = useToastStore.getState()
    for (const [id, name] of next) if (!prevPeers.has(id)) toast.push({ kind: 'info', message: `${name} joined` })
    for (const [id, name] of prevPeers) if (!next.has(id)) toast.push({ kind: 'info', message: `${name} left` })
    prevPeers = next
    useCollabStore.getState().setPeers(peers)
  }
  provider.awareness.on('change', onAwareness)
  session.cleanups.push(() => provider.awareness.off('change', onAwareness))
  onAwareness()

  // ── local selection → awareness "editing track N" ──
  let lastSel: string | null = useSetStore.getState().selectedTrackId
  const unsubSel = useSetStore.subscribe((state) => {
    if (state.selectedTrackId === lastSel) return
    lastSel = state.selectedTrackId
    setLocalEditing(lastSel)
  })
  session.cleanups.push(unsubSel)
}

export interface StartHostArgs {
  url: string
  name: string
  color: string
  set: DJSet
}

export function startHostSession({ url, name, color, set }: StartHostArgs): void {
  leaveActiveSession()
  const doc = new Y.Doc()
  doc.transact(() => seedYDoc(doc, set, name))
  const provider = new CollabProvider(url, doc)
  const session: ActiveSession = {
    doc,
    provider,
    role: 'host',
    setId: set.id,
    createdAt: set.createdAt,
    selfName: name,
    selfColor: color,
    cleanups: []
  }
  active = session
  provider.onStatus = mapStatus
  provider.awareness.setLocalState({ user: { name, color }, editingSlotId: null })
  wireBridge(session)
}

export interface StartGuestArgs {
  url: string
  name: string
  color: string
}

export function startGuestSession({ url, name, color }: StartGuestArgs): void {
  leaveActiveSession()
  const doc = new Y.Doc()
  const provider = new CollabProvider(url, doc)
  const session: ActiveSession = {
    doc,
    provider,
    role: 'guest',
    setId: null,
    createdAt: new Date().toISOString(),
    selfName: name,
    selfColor: color,
    cleanups: []
  }
  active = session
  provider.onStatus = mapStatus
  provider.awareness.setLocalState({ user: { name, color }, editingSlotId: null })
  wireBridge(session)
}

/** Broadcast which slot this peer is focused on (drives "X is editing track N"). */
export function setLocalEditing(slotId: string | null): void {
  if (!active) return
  active.provider.awareness.setLocalStateField('editingSlotId', slotId)
}

export function leaveActiveSession(): void {
  if (!active) return
  const session = active
  active = null
  for (const c of session.cleanups) {
    try {
      c()
    } catch {
      /* best-effort teardown */
    }
  }
  session.provider.destroy()
  session.doc.destroy()
}

export function isSessionActive(): boolean {
  return active !== null
}
