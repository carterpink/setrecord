/**
 * Cloud relay configuration. When `VITE_COLLAB_RELAY_URL` is set at build time,
 * the app can host/join sessions across networks via the standalone relay in
 * `server/collab-relay`. Unset → LAN-only.
 */

/** The configured cloud relay base URL (e.g. wss://collab.setrecord.app), or null. */
export function getCloudRelayUrl(): string | null {
  const raw = import.meta.env.VITE_COLLAB_RELAY_URL
  if (!raw || typeof raw !== 'string') return null
  return raw.replace(/\/+$/, '')
}

/** Build a relay connection URL with the room + secret query the relays expect. */
export function buildConnectionUrl(base: string, room: string, secret: string): string {
  const b = base.replace(/\/+$/, '')
  return `${b}/?room=${encodeURIComponent(room)}&secret=${encodeURIComponent(secret)}`
}

/** A random hex token used as a room secret (no accounts; travels in the invite). */
export function randomSecret(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
