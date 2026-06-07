import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
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
  const { t } = useTranslation('library')
  const [phase, setPhase] = useState<Phase>('choose')
  const [done, setDone] = useState<DoneState | null>(null)
  // When Settings → Library defaults to XML-only, the direct DB-write path is
  // hidden — a deliberate safety guard around the live Rekordbox database.
  const [allowNative, setAllowNative] = useState(false)

  useEffect(() => {
    if (typeof window.setsense === 'undefined') return
    window.setsense
      .getSettings()
      .then((s) => setAllowNative((s.defaultTagExportRoute ?? 'xml') === 'native'))
      .catch(() => {})
  }, [])

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
            title: t('tagExport.xmlDoneTitle'),
            detail: t('tagExport.xmlDoneDetail', { count: res.trackCount ?? 0 })
          }
        : {
            ok: false,
            title: t('tagExport.xmlFailTitle'),
            detail: res.error ?? t('tagExport.somethingWrong')
          }
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
            title: t('tagExport.nativeDoneTitle'),
            detail: t('tagExport.nativeDoneDetail', {
              tags: res.tagsCreated ?? 0,
              tracks: res.associations ?? 0
            }),
            backupPath: res.backupPath
          }
        : {
            ok: false,
            title: t('tagExport.nativeFailTitle'),
            detail: res.error ?? t('tagExport.somethingWrong'),
            backupPath: res.backupPath
          }
    )
    setPhase('done')
  }

  return createPortal(
    <div
      className="combos-overlay"
      role="dialog"
      aria-label={t('tagExport.dialogAria')}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose()
      }}
    >
      <div className="combos-popover glass-3" style={{ width: 440, maxWidth: '90vw' }}>
        <div className="combos-header">
          <div className="ss-body-sm" style={{ fontWeight: 600 }}>
            {t('tagExport.title')}
          </div>
          {phase !== 'running' && (
            <button
              className="smart-filter-dismiss"
              onClick={onClose}
              aria-label={t('tagExport.close')}
            >
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
                  {t('tagExport.xmlTitle')}{' '}
                  <span style={{ color: 'var(--accent)' }}>· {t('tagExport.recommended')}</span>
                </div>
                <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {t('tagExport.xmlDetail')}
                </div>
              </div>
            </button>
            {allowNative && (
              <button
                type="button"
                onClick={() => setPhase('confirm-native')}
                style={optionCardStyle}
              >
                <Database size={18} strokeWidth={1.6} style={{ color: 'var(--text-secondary)' }} />
                <div style={{ textAlign: 'left' }}>
                  <div className="ss-body-sm" style={{ fontWeight: 600 }}>
                    {t('tagExport.directTitle')}{' '}
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      · {t('tagExport.advanced')}
                    </span>
                  </div>
                  <div className="ss-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {t('tagExport.directDetail')}
                  </div>
                </div>
              </button>
            )}
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
                <Trans t={t} i18nKey="tagExport.warning" components={[<strong key="0" />]} />
              </div>
            </div>
            <ul
              className="ss-caption"
              style={{ color: 'var(--text-tertiary)', margin: '0 0 14px 16px', lineHeight: 1.6 }}
            >
              <li>{t('tagExport.bullet1')}</li>
              <li>{t('tagExport.bullet2')}</li>
              <li>{t('tagExport.bullet3')}</li>
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('choose')}>
                {t('tagExport.back')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void runNative()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ShieldCheck size={13} strokeWidth={1.7} />
                {t('tagExport.backupAndWrite')}
              </button>
            </div>
          </div>
        )}

        {phase === 'running' && (
          <div
            className="ss-body-sm"
            style={{ padding: '18px 4px', color: 'var(--text-secondary)' }}
          >
            {t('tagExport.working')}
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
                    {t('tagExport.backup', { path: done.backupPath })}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t('tagExport.done')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
