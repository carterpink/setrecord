/** Shown when a packaged production renderer boots without the main-process IPC
 *  bridge. We fail closed here rather than fall back to the design-preview Pro
 *  state, so a broken build can never silently hand out Pro entitlements. */
export function FatalError(): React.JSX.Element {
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
        SetSense failed to start
      </div>
      <div className="ss-body-sm" style={{ opacity: 0.6, maxWidth: 420 }}>
        The application core didn&rsquo;t load. This usually means the install is damaged. Please
        quit and reinstall SetSense, or reach out to support if the problem persists.
      </div>
    </div>
  )
}
