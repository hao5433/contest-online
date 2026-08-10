import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort guard against a blank white screen. Without this, any
 * uncaught render error (a bad API response shape, a null field, ...)
 * unmounts the whole React tree silently - the page just goes blank.
 * This at least surfaces the error and offers a way back.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error in UI tree:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-neutral-900">Đã có lỗi xảy ra</h1>
          <p className="max-w-md text-sm text-neutral-500">
            Trang này gặp lỗi không mong muốn. Vui lòng thử tải lại trang; nếu vẫn còn lỗi, hãy báo cho quản trị viên.
          </p>
          <pre className="max-w-lg overflow-auto rounded-md bg-neutral-100 p-3 text-left text-xs text-neutral-600">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
