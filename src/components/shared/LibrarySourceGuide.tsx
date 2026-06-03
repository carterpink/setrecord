import { AppWindow, Download, FolderOpen } from 'lucide-react'
import { APP_NAME } from '@/utils/constants'

interface Step {
  icon: typeof AppWindow
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: AppWindow,
    title: 'Open Rekordbox',
    body: 'Launch the app on this Mac if it isn’t already running.'
  },
  {
    icon: Download,
    title: 'File › Export Collection in xml format',
    body: 'In the menu bar. Save the file anywhere — Desktop is fine.'
  },
  {
    icon: FolderOpen,
    title: 'Choose the file below',
    body: `${APP_NAME} reads the export read‑only — Rekordbox stays untouched.`
  }
]

/**
 * 3-step walkthrough for the manual Rekordbox XML export path. Pure
 * presentational — no store wiring. Shown when auto-detect can’t find a
 * Rekordbox install, when master.db read fails, or from Settings for users
 * who want to refresh the steps.
 */
export function LibrarySourceGuide(): React.JSX.Element {
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
        Takes about 30 seconds.
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
        {STEPS.map((step, idx) => (
          <li
            key={step.title}
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
