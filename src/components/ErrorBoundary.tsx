import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * React Error Boundary Component
 * Catches rendering errors and displays a fallback UI
 *
 * Usage:
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] React rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback p-4 bg-red-50 border border-red-200 rounded">
          <div className="error-message text-center">
            <p className="text-red-800 font-semibold">
              ⚠️ Unable to render this section
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details mt-2 text-sm text-red-600">
                <summary className="cursor-pointer font-mono">Details</summary>
                <pre className="mt-2 bg-red-100 p-2 rounded overflow-auto text-xs">
                  {this.state.error?.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
