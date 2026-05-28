import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', this.props.label ?? 'panel', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div className="ss-h3" style={{ color: 'var(--semantic-danger)' }}>
            Something went wrong
          </div>
          <div className="ss-body-sm" style={{ opacity: 0.6 }}>
            {this.props.label ? `The ${this.props.label} panel ran into an error.` : 'A panel ran into an error.'} Reload the app to recover.
          </div>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
