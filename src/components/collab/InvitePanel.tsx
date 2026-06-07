/**
 * Host invite panel — the share surface for a live session. Shows a QR + a
 * pasteable invite code, the LAN address for manual entry, who's connected, and
 * the honest "joining is free" nudge that powers the viral loop.
 */

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check, X, LogOut } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { useCollabStore } from '@/stores/collabStore'
import { useToastStore } from '@/stores/toastStore'

export function InvitePanel(): React.JSX.Element | null {
  const invite = useCollabStore((s) => s.invite)
  const peers = useCollabStore((s) => s.peers)
  const status = useCollabStore((s) => s.status)
  const closePanel = useCollabStore((s) => s.closePanel)
  const leave = useCollabStore((s) => s.leave)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!invite) return
    let cancelled = false
    void QRCode.toDataURL(invite.code, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setQr(url)
    })
    return () => {
      cancelled = true
    }
  }, [invite])

  if (!invite) return null

  async function copy(): Promise<void> {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      useToastStore.getState().error('Could not copy — select and copy manually.')
    }
  }

  return (
    <div className="combos-overlay" role="dialog" aria-label="Invite a partner" style={overlay}>
      <div className="glass-3" style={card}>
        <div style={header}>
          <div>
            <div className="ss-h3">Build together — live</div>
            <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
              {status === 'connected' ? 'Session live' : 'Starting session…'} ·{' '}
              {peers.length === 0 ? 'waiting for your partner' : `${peers.length} connected`}
            </div>
          </div>
          <button className="smart-filter-dismiss" onClick={closePanel} aria-label="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {qr && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
            <img
              src={qr}
              alt="Scan to join this session"
              width={180}
              height={180}
              style={{ borderRadius: 10, background: '#fff', padding: 6 }}
            />
          </div>
        )}

        <div className="ss-label" style={labelStyle}>
          Invite code
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input readOnly value={invite.code} style={codeInput} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <div className="ss-caption" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
          {invite.remote ? (
            <>Works on any network — just share the code.</>
          ) : (
            <>
              Same Wi-Fi · <code>{invite.host}</code>
            </>
          )}
        </div>

        <div
          className="ss-caption"
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(200,255,0,0.08)',
            border: '1px solid rgba(200,255,0,0.20)',
            color: 'var(--text-secondary)'
          }}
        >
          Your partner doesn’t need Pro — joining is free. Everyone keeps their own copy of the
          finished set.
        </div>

        {peers.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="ss-label" style={labelStyle}>
              In the session
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {peers.map((p) => (
                <span key={p.clientId} style={chip(p.color)}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Button variant="ghost" icon={LogOut} onClick={() => void leave()}>
            End session
          </Button>
          <Button variant="primary" onClick={closePanel}>
            Done
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
const card: React.CSSProperties = {
  width: 'min(420px, 92vw)',
  padding: 20,
  borderRadius: 16
}
const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 8
}
const labelStyle: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4
}
const codeInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 11
}
function chip(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${color}`,
    color: 'var(--text-secondary)',
    fontSize: 12
  }
}
