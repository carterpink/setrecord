/**
 * Stacked, colour-coded initials for everyone in the live session (peers only —
 * "you" are implied). The magnetic "someone else is here" presence cue.
 */

import { useCollabStore } from '@/stores/collabStore'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

export function PeerAvatars(): React.JSX.Element | null {
  const peers = useCollabStore((s) => s.peers)
  if (peers.length === 0) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-label={`${peers.length} connected`}>
      {peers.slice(0, 4).map((p, i) => (
        <span
          key={p.clientId}
          title={p.name}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            marginLeft: i === 0 ? 2 : -6,
            borderRadius: 999,
            background: p.color,
            color: '#0a0a0a',
            fontSize: 9,
            fontWeight: 700,
            border: '1.5px solid var(--bg-base, #111)'
          }}
        >
          {initials(p.name)}
        </span>
      ))}
    </span>
  )
}
