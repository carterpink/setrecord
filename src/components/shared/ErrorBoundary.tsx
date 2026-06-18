import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import i18n from '@/i18n'
import { reportRendererError } from '@/utils/reportError'

/** Translate a `shared` namespace key. ErrorBoundary must stay a plain class
 * (error boundaries can't use hooks), so it reads the global i18n instance
 * directly rather than via the react-i18next HOC. The fallback only renders on
 * a crash, so it doesn't need to re-render reactively on a language switch. */
function tr(key: string, opts?: Record<string, unknown>): string {
  return i18n.t(key, { ns: 'shared', ...opts })
}

type Variant = 'panel' | 'chrome' | 'section'

interface Props {
  children: ReactNode
  /** Human-readable name of the wrapped region, shown in the fallback copy. */
  label?: string
  /**
   * Visual treatment of the fallback:
   * - 'panel'   (default) full-height centered card for main content regions.
   * - 'section' same card, sized to fill a sub-region (e.g. a single Recall
   *             section) while the surrounding nav/chrome stays interactive.
   * - 'chrome'  compact inline strip for persistent chrome (TopBar / BottomDock)
   *             so a crash there degrades gracefully instead of breaking layout.
   */
  variant?: Variant
  /**
   * When any value in this array changes between renders, the boundary clears
   * its error and re-renders its children. Pass the navigation identity of the
   * wrapped region (e.g. the active Recall section, or the app mode) so that
   * navigating away from a broken view auto-recovers it.
   */
  resetKeys?: unknown[]
}

interface State {
  error: Error | null
  retryCount: number
}

/** After this many failed manual retries we stop offering "Try again". */
const MAX_RETRIES = 2

function resetKeysChanged(a: unknown[] | undefined, b: unknown[] | undefined): boolean {
  if (a === b) return false
  if (!a || !b || a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return true
  }
  return false
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retryCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportRendererError(error, {
      label: this.props.label,
      componentStack: info.componentStack
    })
  }

  componentDidUpdate(prevProps: Props): void {
    // Navigating to a different view (resetKeys changed) auto-clears the error
    // so a crashed sub-view never latches the surface into a dead-end.
    if (this.state.error && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset()
    }
  }

  /** Clear the error and the retry counter (used on navigation reset). */
  reset = (): void => {
    this.setState({ error: null, retryCount: 0 })
  }

  /** Re-render the children, counting the attempt so we can give up eventually. */
  retry = (): void => {
    this.setState((s) => ({ error: null, retryCount: s.retryCount + 1 }))
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    const { label, variant = 'panel' } = this.props
    const exhausted = this.state.retryCount >= MAX_RETRIES

    if (variant === 'chrome') {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '6px 12px',
            width: '100%'
          }}
        >
          <span className="ss-body-sm" style={{ opacity: 0.7 }}>
            {label
              ? tr('errorBoundary.chromeLabelled', { label })
              : tr('errorBoundary.chromeGeneric')}
          </span>
          {exhausted ? (
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              {tr('errorBoundary.reload')}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={this.retry}>
              {tr('errorBoundary.retry')}
            </button>
          )}
        </div>
      )
    }

    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 8,
          padding: 24,
          textAlign: 'center'
        }}
      >
        <div className="ss-h3" style={{ color: 'var(--semantic-danger)' }}>
          {tr('errorBoundary.title')}
        </div>
        <div className="ss-body-sm" style={{ opacity: 0.6, maxWidth: 360 }}>
          {label ? tr('errorBoundary.bodyLabelled', { label }) : tr('errorBoundary.bodyGeneric')}{' '}
          {exhausted ? tr('errorBoundary.exhaustedHint') : tr('errorBoundary.recoverHint')}
        </div>
        {exhausted ? (
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => window.location.reload()}
          >
            {tr('errorBoundary.reload')}
          </button>
        ) : (
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={this.retry}>
            {tr('errorBoundary.tryAgain')}
          </button>
        )}
      </div>
    )
  }
}
