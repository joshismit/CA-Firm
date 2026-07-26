// src/providers/ErrorBoundary.tsx
// Class component is required here - React has no hook-based equivalent for catching render errors.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { env } from '@/config/env'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (env.isDev) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, info)
    }
  }

  retry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.retry)

    return <ErrorFallback error={error} onRetry={this.retry} />
  }
}

/** Exported so app/router.tsx's per-route errorElement can reuse the same visual fallback -
 * React Router's data router catches render errors at the route level before they ever reach
 * this component's componentDidCatch, so this class alone does not cover route-rendered pages. */
export function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-[var(--color-danger-bg)] flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-[var(--color-danger)]" />
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--color-text-heading)]">Something went wrong</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            An unexpected error occurred. You can try again or reload the page.
          </p>
        </div>

        {env.isDev && (
          <pre className="w-full max-h-48 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left text-[11px] font-mono text-[var(--color-danger)]">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="h-9 px-4 inline-flex items-center rounded-[var(--radius-md)] text-[13px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="h-9 px-4 inline-flex items-center rounded-[var(--radius-md)] text-[13px] font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
