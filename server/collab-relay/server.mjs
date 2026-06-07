/**
 * SetSense cloud collaboration relay (v2).
 *
 * A standalone, room-multiplexing WebSocket broadcaster — the cloud-hosted
 * sibling of the in-app LAN relay (electron/services/collab/relayServer.ts). It
 * lets DJs on different networks build a set together: clients connect with
 * `?room=<id>&secret=<token>`, and every binary frame is rebroadcast to all
 * OTHER clients in the same room, unparsed. All CRDT/sync logic stays in the
 * app; this server never sees a Y.Doc and stores nothing.
 *
 * Security model (no accounts): the first client into a room fixes the room's
 * secret; later joiners must present the same secret (it travels in the invite
 * code). Rooms are deleted when empty. This is a relay, not an auth server —
 * front it with your platform's TLS (wss) and, ideally, rate limiting.
 *
 * Env: PORT (default 8787), MAX_CLIENTS_PER_ROOM (default 12).
 * Run: `node server.mjs`  ·  Deploy: see README.md (Fly.io / Render).
 */

import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = Number(process.env.PORT) || 8787
const MAX_CLIENTS_PER_ROOM = Number(process.env.MAX_CLIENTS_PER_ROOM) || 12
const HEARTBEAT_MS = 30_000

/** roomId -> { secret, clients:Set<WebSocket> } */
const rooms = new Map()

const http = createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(426)
  res.end('Upgrade Required')
})

// 1 MiB cap per frame — a shared set's CRDT updates are tiny; this just bounds abuse.
const wss = new WebSocketServer({ server: http, maxPayload: 1 << 20 })

wss.on('connection', (ws, req) => {
  let roomId = null
  let secret = null
  try {
    const u = new URL(req.url ?? '', 'ws://localhost')
    roomId = u.searchParams.get('room')
    secret = u.searchParams.get('secret')
  } catch {
    /* malformed */
  }
  if (!roomId || !secret) return ws.close(1008, 'missing room/secret')

  let room = rooms.get(roomId)
  if (!room) {
    room = { secret, clients: new Set() }
    rooms.set(roomId, room)
  } else if (room.secret !== secret) {
    return ws.close(1008, 'bad secret')
  }
  if (room.clients.size >= MAX_CLIENTS_PER_ROOM) return ws.close(1013, 'room full')

  room.clients.add(ws)
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('message', (data) => {
    for (const c of room.clients) {
      if (c !== ws && c.readyState === WebSocket.OPEN) c.send(data, { binary: true })
    }
  })

  const cleanup = () => {
    room.clients.delete(ws)
    if (room.clients.size === 0) rooms.delete(roomId)
  }
  ws.on('close', cleanup)
  ws.on('error', cleanup)
})

// Drop dead sockets so empty rooms (and their secrets) don't linger.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    try {
      ws.ping()
    } catch {
      /* terminating */
    }
  }
}, HEARTBEAT_MS)
wss.on('close', () => clearInterval(heartbeat))

http.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[setsense-collab-relay] listening on :${PORT}`)
})
