// src/components/ErrorBoundary.tsx

import { type ReactNode, Component } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            minHeight: '100vh',
            padding: 'var(--space-6)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>⚠️</div>
          <h1 className="text-heading" style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            Something went wrong
          </h1>
          <p className="text-body" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px' }}>
            The app encountered an error. This might be a temporary issue.
          </p>
          {this.state.error && (
            <div
              className="card"
              style={{
                marginBottom: 'var(--space-6)',
                maxWidth: '500px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <pre
                className="text-caption"
                style={{
                  color: 'var(--color-danger)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                }}
              >
                {this.state.error.message}
              </pre>
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="btn btn-pill btn-primary"
            style={{ padding: 'var(--space-3) var(--space-8)' }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
