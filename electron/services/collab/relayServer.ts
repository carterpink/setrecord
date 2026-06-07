/**
 * Host-hub WebSocket relay for live "Back-to-Back" collaboration.
 *
 * The host's Electron main process runs this LAN relay; the host renderer and
 * every guest renderer connect to it over the local network. It is a DUMB binary
 * broadcaster: every frame from one peer is rebroadcast to all OTHER peers,
 * unparsed. All CRDT/sync logic lives in the renderer (src/collab) — the relay
 * never sees a Y.Doc. No cloud, no accounts: when the host leaves, the relay
 * stops and the session ends.
 *
 * Access is gated by a per-session secret passed as a `?secret=` query param.
 */

import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'

export interface RelayHandle {
  /** Ephemeral port the relay bound to. */
  port: number
  /** Shared secret a peer must present to join. */
  secret: string
  /** Best-guess LAN IPv4 for guests to connect to (falls back to loopback). */
  host: string
}

let wss: WebSocketServer | null = null
let currentSecret = ''

/** First non-internal IPv4 address, for the guest-facing connection URL. */
function lanIp(): string {
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) return ni.address
    }
  }
  return '127.0.0.1'
}

/** Start (or restart) the relay. Binds 0.0.0.0 so LAN peers can reach it. */
export async function startRelay(): Promise<RelayHandle> {
  await stopRelay()
  const secret = randomBytes(6).toString('hex')
  currentSecret = secret

  const server = new WebSocketServer({ host: '0.0.0.0', port: 0 })
  wss = server

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0

  server.on('connection', (ws, req) => {
    let secretOk = false
    try {
      const url = new URL(req.url ?? '', 'ws://localhost')
      secretOk = url.searchParams.get('secret') === currentSecret
    } catch {
      secretOk = false
    }
    if (!secretOk) {
      ws.close()
      return
    }
    ws.on('message', (data) => {
      // Pure broadcast to everyone else; never inspect the payload.
      for (const client of server.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: true })
        }
      }
    })
  })

  return { port, secret, host: lanIp() }
}

export async function stopRelay(): Promise<void> {
  if (!wss) return
  const server = wss
  wss = null
  currentSecret = ''
  for (const c of server.clients) {
    try {
      c.terminate()
    } catch {
      /* already gone */
    }
  }
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
