/**
 * Build-mode header control for live "Back-to-Back" collaboration.
 *
 * Idle: a single compact icon button → popover with Host (Pro-gated) and Join
 * (free — the viral on-ramp). Active: a live presence pill + Leave. Kept to one
 * 36px control so it never crowds the timeline header.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Radio, UserPlus, Users, LogOut, Globe } from 'lucide-react'
import clsx from 'clsx'
import { useCollabStore } from '@/stores/collabStore'
import { useCanUse } from '@/stores/licenseStore'
import { useUiStore } from '@/stores/uiStore'
import { getCloudRelayUrl } from '@/collab/relayConfig'
import { PeerAvatars } from './PeerAvatars'

export function CollaborateButton(): React.JSX.Element {
  const role = useCollabStore((s) => s.role)
  const status = useCollabStore((s) => s.status)
  const host = useCollabStore((s) => s.host)
  const hostRemote = useCollabStore((s) => s.hostRemote)
  const leave = useCollabStore((s) => s.leave)
  const openPanel = useCollabStore((s) => s.openPanel)
  const canHost = useCanUse('hostCollab')
  const showUpgrade = useUiStore((s) => s.showUpgrade)
  const cloudRelay = getCloudRelayUrl()

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onPointer(e: PointerEvent): void {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer, { capture: true })
    return () => window.removeEventListener('pointerdown', onPointer, { capture: true })
  }, [menuOpen])

  function toggleMenu(): void {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setMenuOpen((v) => !v)
  }

  if (role) {
    const statusLabel =
      status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => openPanel(role === 'host' ? 'invite' : 'none')}
          title={role === 'host' ? 'Show invite code' : 'Live session'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid rgba(200,255,0,0.35)',
            background: 'rgba(200,255,0,0.10)',
            color: 'var(--text-primary)',
            font: 'inherit',
            cursor: 'pointer'
          }}
        >
          <Radio
            size={12}
            strokeWidth={2}
            color={status === 'connected' ? '#c8ff00' : 'var(--text-tertiary)'}
            aria-hidden="true"
          />
          <span className="ss-caption">{statusLabel}</span>
          <PeerAvatars />
        </button>
        <button
          type="button"
          className="icon-btn sm"
          onClick={() => void leave()}
          title="Leave session"
          aria-label="Leave session"
        >
          <LogOut size={14} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        className={clsx('icon-btn', menuOpen && 'active')}
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Collaborate"
        title="Collaborate — build this set together, live"
      >
        <Users size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>

      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="tl-overflow-menu glass-3"
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
              minWidth: 200
            }}
          >
            <button
              type="button"
              className="tl-overflow-btn"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                if (canHost) void host()
                else showUpgrade('hostCollab')
              }}
            >
              <Users size={13} strokeWidth={1.7} aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left' }}>
                {cloudRelay ? 'Host on this Wi-Fi' : 'Host a live session'}
              </span>
              {!canHost && <span style={proBadge}>PRO</span>}
            </button>
            {cloudRelay && (
              <button
                type="button"
                className="tl-overflow-btn"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  if (canHost) void hostRemote()
                  else showUpgrade('hostCollab')
                }}
              >
                <Globe size={13} strokeWidth={1.7} aria-hidden="true" />
                <span style={{ flex: 1, textAlign: 'left' }}>Host remotely (any network)</span>
                {!canHost && <span style={proBadge}>PRO</span>}
              </button>
            )}
            <button
              type="button"
              className="tl-overflow-btn"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                openPanel('join')
              }}
            >
              <UserPlus size={13} strokeWidth={1.7} aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left' }}>Join with a code</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

const proBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#c8ff00'
}
