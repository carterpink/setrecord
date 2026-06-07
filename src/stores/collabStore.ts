/**
 * collabStore — user-facing state for live "Back-to-Back" sessions.
 *
 * Owns the session lifecycle from the UI's perspective (host / join / leave),
 * the invite payload to display, presence peers, and which collab modal is open.
 * The CRDT plumbing lives in src/collab/session.ts; this store calls into it and
 * brokers the host-relay IPC.
 */

import { create } from 'zustand'
import { useToastStore } from '@/stores/toastStore'
import { useSetStore } from '@/stores/setStore'
import { useUiStore } from '@/stores/uiStore'
import { colorForClientId, type CollabPeer } from '@/collab/sharedTypes'
import {
  startHostSession,
  startGuestSession,
  leaveActiveSession,
  setLocalEditing
} from '@/collab/session'
import { getCloudRelayUrl, buildConnectionUrl, randomSecret } from '@/collab/relayConfig'

export type CollabStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'
export type CollabRole = 'host' | 'guest' | null
export type CollabPanel = 'none' | 'invite' | 'join'

/** Host-side connection details shown in the invite panel. */
export interface InviteInfo {
  /** Pasteable code (base64url JSON) a guest enters to join. */
  code: string
  /** Human-readable address for reference / manual entry (LAN host:port or relay URL). */
  host: string
  port: number
  secret: string
  setName: string
  /** True for a cross-network (cloud relay) session; false for same-Wi-Fi LAN. */
  remote: boolean
}

/** v2 invite payload: a relay base URL + room + secret (covers LAN and cloud). */
interface JoinV2 {
  v: 2
  url: string
  room: string
  s: string
  n: string
}
/** Legacy v1 payload (LAN host:port). Kept for back-compatibility. */
interface JoinV1 {
  h: string
  p: number
  s: string
  n: string
}

interface NormalisedJoin {
  url: string
  room: string
  secret: string
  name: string
}

interface CollabState {
  status: CollabStatus
  role: CollabRole
  peers: CollabPeer[]
  invite: InviteInfo | null
  panel: CollabPanel
  /** Ephemeral display identity (no account). Persisted to localStorage. */
  selfName: string

  setStatus: (s: CollabStatus) => void
  setPeers: (p: CollabPeer[]) => void
  setSelfName: (name: string) => void
  openPanel: (p: CollabPanel) => void
  closePanel: () => void
  /** Host a same-Wi-Fi (LAN) session for the current set (caller must be Pro-gated). */
  host: () => Promise<void>
  /** Host a cross-network session via the configured cloud relay (Pro-gated). */
  hostRemote: () => Promise<void>
  /** Join a session from a pasted invite code (LAN or remote — transparent). */
  join: (code: string) => Promise<void>
  leave: () => Promise<void>
}

const NAME_KEY = 'setsense-collab-name'

function initialName(): string {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(NAME_KEY)
    if (saved) return saved
  }
  return `DJ ${Math.floor(10 + Math.random() * 89)}`
}

function colorForName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return colorForClientId(h)
}

function encodePayload(p: JoinV2): string {
  const b64 = btoa(JSON.stringify(p))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodePayload(code: string): NormalisedJoin | null {
  try {
    const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/')
    const p = JSON.parse(atob(b64)) as Partial<JoinV2 & JoinV1>
    if (p.v === 2 && typeof p.url === 'string' && typeof p.room === 'string' && typeof p.s === 'string') {
      return { url: p.url, room: p.room, secret: p.s, name: p.n ?? '' }
    }
    // Legacy LAN payload.
    if (typeof p.h === 'string' && typeof p.p === 'number' && typeof p.s === 'string') {
      return { url: `ws://${p.h}:${p.p}`, room: '', secret: p.s, name: p.n ?? '' }
    }
    return null
  } catch {
    return null
  }
}

export const useCollabStore = create<CollabState>((set, get) => ({
  status: 'idle',
  role: null,
  peers: [],
  invite: null,
  panel: 'none',
  selfName: initialName(),

  setStatus: (status) => set({ status }),
  setPeers: (peers) => set({ peers }),
  setSelfName: (name) => {
    const trimmed = name.trim().slice(0, 24) || 'DJ'
    if (typeof window !== 'undefined') window.localStorage.setItem(NAME_KEY, trimmed)
    set({ selfName: trimmed })
  },
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: 'none' }),

  host: async () => {
    const setObj = useSetStore.getState().currentSet
    if (!setObj) {
      useToastStore.getState().push({ kind: 'info', message: 'Open or start a set first' })
      return
    }
    if (typeof window === 'undefined' || typeof window.setsense?.collabHostStart !== 'function') {
      useToastStore.getState().error('Live collaboration needs the desktop app.')
      return
    }
    try {
      const info = await window.setsense.collabHostStart()
      const room = setObj.id // LAN relay ignores room; carried for the v2 shape
      const name = get().selfName
      const color = colorForName(name)
      startHostSession({
        url: buildConnectionUrl(`ws://127.0.0.1:${info.port}`, room, info.secret),
        name,
        color,
        set: setObj
      })
      const code = encodePayload({ v: 2, url: `ws://${info.host}:${info.port}`, room, s: info.secret, n: setObj.name })
      set({
        role: 'host',
        status: 'connecting',
        invite: {
          code,
          host: `${info.host}:${info.port}`,
          port: info.port,
          secret: info.secret,
          setName: setObj.name,
          remote: false
        },
        panel: 'invite'
      })
    } catch (err) {
      console.error('[collab] host start failed', err)
      useToastStore.getState().error('Could not start the session.')
    }
  },

  hostRemote: async () => {
    const setObj = useSetStore.getState().currentSet
    if (!setObj) {
      useToastStore.getState().push({ kind: 'info', message: 'Open or start a set first' })
      return
    }
    const relay = getCloudRelayUrl()
    if (!relay) {
      useToastStore.getState().error('No remote relay is configured for this build.')
      return
    }
    const room = crypto.randomUUID()
    const secret = randomSecret()
    const name = get().selfName
    const color = colorForName(name)
    startHostSession({ url: buildConnectionUrl(relay, room, secret), name, color, set: setObj })
    const code = encodePayload({ v: 2, url: relay, room, s: secret, n: setObj.name })
    set({
      role: 'host',
      status: 'connecting',
      invite: { code, host: relay, port: 0, secret, setName: setObj.name, remote: true },
      panel: 'invite'
    })
  },

  join: async (code) => {
    const payload = decodePayload(code)
    if (!payload) {
      useToastStore.getState().error('That invite code looks invalid.')
      return
    }
    const name = get().selfName
    const color = colorForName(name)
    startGuestSession({
      url: buildConnectionUrl(payload.url, payload.room, payload.secret),
      name,
      color
    })
    useUiStore.getState().setMode('Build')
    set({ role: 'guest', status: 'connecting', panel: 'none', invite: null })
  },

  leave: async () => {
    const role = get().role
    leaveActiveSession()
    setLocalEditing(null)
    if (role === 'host' && typeof window.setsense?.collabHostStop === 'function') {
      try {
        await window.setsense.collabHostStop()
      } catch {
        /* relay already gone */
      }
    }
    set({ status: 'idle', role: null, peers: [], invite: null, panel: 'none' })
    useToastStore.getState().push({
      kind: 'success',
      message: 'Session ended — your copy of the set is saved.'
    })
  }
}))

/** True when a live session is running (hosting or joined). */
export function useIsCollabActive(): boolean {
  return useCollabStore((s) => s.role !== null)
}
