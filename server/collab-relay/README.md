# SetSense Collab Relay (cloud v2)

A tiny, stateless WebSocket relay that lets DJs run a live **Back-to-Back** set
session across **different networks** (not just the same Wi-Fi). It's the
cloud-hosted sibling of the in-app LAN relay
(`electron/services/collab/relayServer.ts`).

## What it does (and doesn't)

- Clients connect with `?room=<id>&secret=<token>`.
- Every binary frame from one client is rebroadcast to **all other clients in
  the same room**, unparsed. That's it.
- **Stateless**: it stores no set data, no Y.Doc, no accounts. All CRDT/sync/
  presence logic lives in the desktop app. The relay only moves bytes.
- **Room secret**: the first client into a room fixes its secret; later joiners
  must match (the secret travels inside the invite code). Rooms are deleted when
  empty. This stops random room-id guessing — it is **not** an auth system.

Because it's a relay (clients dial **out** to it), there's no NAT/STUN/TURN
problem — it works across any networks.

## Run locally

```bash
cd server/collab-relay
npm install
PORT=8787 npm start
# health: curl http://localhost:8787/healthz  -> ok
```

## Deploy

TLS (`wss://`) is required by the app in production. Let your platform terminate
TLS at the edge and forward to the container's plain `ws` on `$PORT`.

### Fly.io
```bash
cd server/collab-relay
fly launch --no-deploy        # pick an app name; keep the included fly.toml
fly deploy
# → wss://<your-app>.fly.dev
```

### Render / Railway / Docker anywhere
- Build the Dockerfile, expose `$PORT`, deploy. The platform gives you an
  `https://…` host; clients use the `wss://…` equivalent.

## Point the app at it

Set the relay URL at **app build time** and rebuild the desktop app:

```bash
VITE_COLLAB_RELAY_URL="wss://your-app.fly.dev" npm run build
```

When `VITE_COLLAB_RELAY_URL` is set, the Build-mode **Collaborate** menu gains a
**"Host remotely"** option. Unset → the app stays LAN-only. Guests don't need
any config: a remote invite code already carries the relay URL.

## Env

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8787` | Listen port. |
| `MAX_CLIENTS_PER_ROOM` | `12` | Hard cap per session. |

## Scaling note

This single-process relay keeps each room's sockets in memory, so all peers of a
given session must land on the **same instance**. For one small box that's fine
(a session is 2–5 people). If you ever run multiple instances behind a load
balancer, enable sticky sessions by `room`, or add a shared pub/sub (e.g. Redis)
fan-out between instances.
