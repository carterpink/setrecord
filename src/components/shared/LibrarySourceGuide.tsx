import { AppWindow, Download, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/utils/constants'

const STEP_ICONS = [AppWindow, Download, FolderOpen] as const

/**
 * 3-step walkthrough for the manual Rekordbox XML export path. Pure
 * presentational — no store wiring. Shown when auto-detect can’t find a
 * Rekordbox install, when master.db read fails, or from Settings for users
 * who want to refresh the steps.
 */
export function LibrarySourceGuide(): React.JSX.Element {
  const { t } = useTranslation('shared')
  const steps = [
    {
      icon: STEP_ICONS[0],
      title: t('librarySourceGuide.step1.title'),
      body: t('librarySourceGuide.step1.body')
    },
    {
      icon: STEP_ICONS[1],
      title: t('librarySourceGuide.step2.title'),
      body: t('librarySourceGuide.step2.body')
    },
    {
      icon: STEP_ICONS[2],
      title: t('librarySourceGuide.step3.title'),
      body: t('librarySourceGuide.step3.body', { app: APP_NAME })
    }
  ]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '8px 0'
      }}
    >
      <div className="ss-body-sm" style={{ opacity: 0.7 }}>
        {t('librarySourceGuide.duration')}
      </div>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {steps.map((step, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: 999,
                background: 'var(--accent-dim-12)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ss-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <step.icon size={15} strokeWidth={1.6} aria-hidden="true" />
                <span>{step.title}</span>
              </div>
              <div className="ss-caption" style={{ opacity: 0.65, marginTop: 4 }}>
                {step.body}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
