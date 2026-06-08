/**
 * Central sink for renderer-side React render errors caught by ErrorBoundary.
 *
 * NFR-403: every per-panel ErrorBoundary routes its caught errors through this
 * single function, so error handling has exactly one seam in the renderer.
 * Today it logs to the console (matching prior behaviour).
 *
 * NFR-802 (renderer crash reporting): swap the body of this function to forward
 * the error over a `window.setrecord.reportError(...)` IPC channel into the
 * main-process Sentry pipeline (electron/services/crashReporter.ts), gated on
 * the user's `crashReportingEnabled` setting. No ErrorBoundary call site needs
 * to change when that lands — only this function.
 */
export interface RendererErrorContext {
  /** Human-readable panel/surface name, e.g. "Library", "Timeline". */
  label?: string
  /** React component stack from ErrorInfo, when available. */
  componentStack?: string | null
}

export function reportRendererError(error: Error, context: RendererErrorContext = {}): void {
  const { label = 'panel', componentStack } = context
  console.error(`[ErrorBoundary] ${label}`, error, componentStack ?? '')
}
