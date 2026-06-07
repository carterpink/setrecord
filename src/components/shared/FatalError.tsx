import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/utils/constants'

/** Shown when a packaged production renderer boots without the main-process IPC
 *  bridge. We fail closed here rather than fall back to the design-preview Pro
 *  state, so a broken build can never silently hand out Pro entitlements. */
export function FatalError(): React.JSX.Element {
  const { t } = useTranslation('shared')
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 10,
        padding: 24,
        textAlign: 'center'
      }}
    >
      <div className="ss-h3" style={{ color: 'var(--semantic-danger)' }}>
        {t('fatalError.title', { app: APP_NAME })}
      </div>
      <div className="ss-body-sm" style={{ opacity: 0.6, maxWidth: 420 }}>
        {t('fatalError.body', { app: APP_NAME })}
      </div>
    </div>
  )
}
