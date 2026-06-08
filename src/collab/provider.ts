/**
 * CollabProvider — binds a Y.Doc + awareness to the host-hub WebSocket relay.
 *
 * Transport model: the host's Electron main process runs a dumb broadcast relay
 * (electron/services/collab/relayServer.ts). Every binary frame a peer sends is
 * rebroadcast to all OTHER peers. The relay never parses the Yjs payload, so the
 * sync is pure CRDT — peers converge regardless of join order or drops.
 *
 * Frames are `[type, ...payload]`:
 *   MSG_SYNC      Yjs update bytes (state-as-update or incremental update)
 *   MSG_QUERY     "send me your full state" (sent on connect / reconnect)
 *   MSG_AWARENESS y-protocols/awareness update bytes (ephemeral presence)
 *
 * This file is transport-only and deliberately knows nothing about SetRecord
 * stores — the bridge (session.ts) wires it to setStore.
 */

import * as Y from 'yjs'
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates
} from 'y-protocols/awareness'
import { MSG_SYNC, MSG_QUERY, MSG_AWARENESS } from './sharedTypes'

export type CollabStatus = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed'

function frame(type: number, payload?: Uint8Array): Uint8Array {
  const body = payload ?? new Uint8Array(0)
  const out = new Uint8Array(body.length + 1)
  out[0] = type
  out.set(body, 1)
  return out
}

export class CollabProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness
  onStatus?: (status: CollabStatus) => void

  private ws: WebSocket | null = null
  private readonly url: string
  private shouldReconnect = true
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  /** After this many consecutive failures we treat the host as gone and end. */
  private readonly maxReconnect = 8

  constructor(url: string, doc: Y.Doc) {
    this.url = url
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)
    this.connect()
  }

  /** Local doc change (origin !== this) → broadcast. Remote-applied updates carry
   *  origin === this and are skipped so they don't echo back through the relay. */
  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return
    this.send(frame(MSG_SYNC, update))
  }

  private handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ): void => {
    if (origin === this) return
    const changed = [...changes.added, ...changes.updated, ...changes.removed]
    this.send(frame(MSG_AWARENESS, encodeAwarenessUpdate(this.awareness, changed)))
  }

  private connect(): void {
    this.onStatus?.('connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    ws.binaryType = 'arraybuffer'
    this.ws = ws

    ws.onopen = (): void => {
      this.reconnectAttempts = 0
      this.onStatus?.('connected')
      // Pull peers' state, push ours, and announce presence.
      this.send(frame(MSG_QUERY))
      this.send(frame(MSG_SYNC, Y.encodeStateAsUpdate(this.doc)))
      this.broadcastFullAwareness()
    }
    ws.onmessage = (ev: MessageEvent): void => {
      if (ev.data instanceof ArrayBuffer) this.onMessage(new Uint8Array(ev.data))
    }
    ws.onclose = (): void => {
      this.ws = null
      if (this.shouldReconnect) this.scheduleReconnect()
      else this.onStatus?.('closed')
    }
    ws.onerror = (): void => {
      this.onStatus?.('error')
    }
  }

  private onMessage(data: Uint8Array): void {
    if (data.length < 1) return
    const type = data[0]
    const payload = data.subarray(1)
    if (type === MSG_SYNC) {
      Y.applyUpdate(this.doc, payload, this)
    } else if (type === MSG_QUERY) {
      // A peer (re)joined and asked for state — answer with the full doc + presence.
      this.send(frame(MSG_SYNC, Y.encodeStateAsUpdate(this.doc)))
      this.broadcastFullAwareness()
    } else if (type === MSG_AWARENESS) {
      applyAwarenessUpdate(this.awareness, payload, this)
    }
  }

  private broadcastFullAwareness(): void {
    const clients = Array.from(this.awareness.getStates().keys())
    this.send(frame(MSG_AWARENESS, encodeAwarenessUpdate(this.awareness, clients)))
  }

  private send(bytes: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(bytes)
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return
    this.reconnectAttempts += 1
    if (this.reconnectAttempts > this.maxReconnect) {
      // The relay (host) is gone — stop trying and signal a terminal close.
      this.shouldReconnect = false
      this.onStatus?.('closed')
      return
    }
    this.onStatus?.('reconnecting')
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), 1200)
  }

  destroy(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.doc.off('update', this.handleDocUpdate)
    this.awareness.off('update', this.handleAwarenessUpdate)
    // Tell peers we're gone before the socket closes.
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local')
    this.awareness.destroy()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* already closing */
      }
      this.ws = null
    }
    this.onStatus?.('closed')
  }
}
