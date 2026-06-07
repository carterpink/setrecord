/**
 * Join dialog — a guest pastes an invite code and a display name, then drops
 * straight into the shared set. No account, no Pro required.
 */

import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useCollabStore } from '@/stores/collabStore'

export function JoinDialog(): React.JSX.Element {
  const selfName = useCollabStore((s) => s.selfName)
  const setSelfName = useCollabStore((s) => s.setSelfName)
  const join = useCollabStore((s) => s.join)
  const closePanel = useCollabStore((s) => s.closePanel)
  const [name, setName] = useState(selfName)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleJoin(): Promise<void> {
    if (!code.trim()) return
    setBusy(true)
    setSelfName(name)
    await join(code)
    setBusy(false)
  }

  return (
    <div className="combos-overlay" role="dialog" aria-label="Join a session" style={overlay}>
      <div className="glass-3" style={card}>
        <div style={header}>
          <div className="ss-h3">Join a back-to-back</div>
          <button className="smart-filter-dismiss" onClick={closePanel} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="ss-label" style={labelStyle}>
          Your name
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="DJ name"
          style={input}
        />

        <div className="ss-label" style={{ ...labelStyle, marginTop: 12 }}>
          Invite code
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste the code your partner shared"
          rows={3}
          style={{ ...input, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}
        />

        <div className="ss-caption" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
          You and your partner must be on the same Wi-Fi.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="ghost" onClick={closePanel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={UserPlus}
            disabled={busy || !code.trim()}
            onClick={() => void handleJoin()}
          >
            {busy ? 'Joining…' : 'Join session'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9998
}
const card: React.CSSProperties = { width: 'min(420px, 92vw)', padding: 20, borderRadius: 16 }
const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12
}
const labelStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4
}
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-primary)',
  font: 'inherit'
}
