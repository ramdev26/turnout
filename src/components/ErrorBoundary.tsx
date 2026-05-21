import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const showErrorDetails = import.meta.env.DEV;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-neutral-900">Something went wrong</h1>
          <p className="mt-2 max-w-md text-neutral-600">
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Page
            </button>
            {showErrorDetails ? (
              <pre className="mt-8 max-w-2xl overflow-auto rounded-lg bg-neutral-900 p-4 text-left text-xs text-neutral-400">
                {this.state.error?.message}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
