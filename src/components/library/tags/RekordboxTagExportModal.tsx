import { createPortal } from 'react-dom'
import { useState } from 'react'
import { X, FileDown, Database, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { RekordboxTagWriteResult } from '@/types'

interface Props {
  onClose: () => void
}

type Phase = 'choose' | 'confirm-native' | 'running' | 'done'

const optionCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: 12,
  borderRadius: 10,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-1, rgba(255,255,255,0.03))',
  cursor: 'pointer',
  textAlign: 'left'
}

interface DoneState {
  ok: boolean
  title: string
  detail: string
  backupPath?: string
}

/**
 * "Send tags to Rekordbox". Two clear paths:
 *  - Rekordbox XML (recommended): tags land in the Comments column, master.db
 *    untouched — zero risk.
 *  - Write directly (advanced): native, filterable MyTags written into master.db,
 *    with an automatic backup taken first and Rekordbox required to be closed.
 */
export function RekordboxTagExportModal({ onClose }: Props): React.ReactPortal {
  const [phase, setPhase] = useState<Phase>('choose')
  const [done, setDone] = useState<DoneState | null>(null)

  async function runXml(): Promise<void> {
    setPhase('running')
    const res = await window.setsense.tagsExportXml()
    if (res.error === 'cancelled') {
      setPhase('choose')
      return
    }
    setDone(
      res.success
        ? {
            ok: true,
            title: 'Tags exported',
            detail: `Wrote ${res.trackCount ?? 0} tracks to an XML file. In Rekordbox, use File → Import Collection (your library isn't overwritten) — tags appear in the Comments column.`
          }
        : { ok: false, title: 'Export failed', detail: res.error ?? 'Something went wrong.' }
    )
    setPhase('done')
  }

  async function runNative(): Promise<void> {
    setPhase('running')
    const res: RekordboxTagWriteResult = await window.setsense.tagsWriteMyTags()
    setDone(
      res.success
        ? {
            ok: true,
            title: 'Tags written to Rekordbox',
            detail: `Created ${res.tagsCreated ?? 0} MyTags and tagged ${res.associations ?? 0} tracks. Open Rekordbox and filter by MyTag to see them.`,
            backupPath: res.backupPath
          }
        : {
            ok: false,
            title: 'Could not write tags',
            detail: res.error ?? 'Something went wrong.',
            backupPath: res.backupPath
          }
    )
    setPhase('done')
  }

  return createPortal(
    <div
      className="combos-overlay"
      role="dialog"
      aria-label="Send tags to Rekordbox"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose()
      }}
    >
      <div className="combos-popover glass-3" style={{ width: 440, maxWidth: '90vw' }}>
        <div className="combos-header">
          <div className="ss-body-sm" style={{ fontWeight: 600 }}>
            Send tags to Rekordbox
          </div>
          {phase !== 'running' && (
            <button className="smart-filter-dismiss" onClick={onClose} aria-label="Close">
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        {phase === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
            <button type="button" onClick={() => void runXml()} style={optionCardStyle}>
              <FileDown size={18} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
              <div style={{ textAlign: 'left' }}>
                <div className="ss-body-sm" style={{ fontWeight: 600 }}>
                  Rekordbox XML <span style={{ color: 'var(--accent)' }}>· Recommended</span>
                </div>
                <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                  Safest. Tags land in the Comments column. Your library is never modified.
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPhase('confirm-native')}
              style={optionCardStyle}
            >
              <Database size={18} strokeWidth={1.6} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ textAlign: 'left' }}>
                <div className="ss-body-sm" style={{ fontWeight: 600 }}>
                  Write directly to Rekordbox{' '}
                  <span style={{ color: 'var(--text-tertiary)' }}>· Advanced</span>
                </div>
                <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                  Real, filterable MyTags. Takes a backup first; Rekordbox must be closed.
                </div>
              </div>
            </button>
          </div>
        )}

        {phase === 'confirm-native' && (
          <div style={{ paddingTop: 6 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 10,
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--semantic-warning) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--semantic-warning) 30%, transparent)',
                marginBottom: 12
              }}
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.7}
                style={{ color: 'var(--semantic-warning)', flexShrink: 0 }}
              />
              <div
                className="ss-caption"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
              >
                This writes directly into your Rekordbox library.{' '}
                <strong>Close Rekordbox first.</strong> SetSense saves a timestamped backup of your
                database before writing, and rolls back if anything goes wrong.
              </div>
            </div>
            <ul
              className="ss-caption"
              style={{ color: 'var(--text-tertiary)', margin: '0 0 14px 16px', lineHeight: 1.6 }}
            >
              <li>Creates a “SetSense” MyTag group with your tags</li>
              <li>Tags only tracks that came from your Rekordbox library</li>
              <li>Won’t duplicate tags a track already has</li>
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('choose')}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runNative()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ShieldCheck size={13} strokeWidth={1.7} />
                Back up &amp; write tags
              </button>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div
            className="ss-body-sm"
            style={{ padding: '18px 4px', color: 'var(--text-secondary)' }}
          >
            Working… this won’t take long.
          </div>
        )}

        {phase === 'done' && done && (
          <div style={{ paddingTop: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
              {done.ok ? (
                <CheckCircle2
                  size={18}
                  style={{ color: 'var(--semantic-success, #22C55E)', flexShrink: 0 }}
                />
              ) : (
                <AlertTriangle
                  size={18}
                  style={{ color: 'var(--semantic-warning)', flexShrink: 0 }}
                />
              )}
              <div>
                <div className="ss-body-sm" style={{ fontWeight: 600 }}>
                  {done.title}
                </div>
                <div
                  className="ss-caption"
                  style={{ color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}
                >
                  {done.detail}
                </div>
                {done.backupPath && (
                  <div
                    className="ss-caption"
                    style={{ color: 'var(--text-tertiary)', marginTop: 6, wordBreak: 'break-all' }}
                  >
                    Backup: {done.backupPath}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
