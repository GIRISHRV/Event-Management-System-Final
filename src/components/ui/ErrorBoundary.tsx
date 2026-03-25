"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

// ─── Class-based Error Boundary ──────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Name for logging purposes */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// ─── Inline Error Boundary (for sections within a page) ──────────────────────

export function InlineErrorBoundary({
  children,
  name,
}: {
  children: React.ReactNode;
  name?: string;
}) {
  return (
    <ErrorBoundary
      name={name}
      fallback={
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-muted)] p-4 text-center">
          <p className="text-sm text-[var(--color-danger)]">
            Failed to load {name ?? "this section"}
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ─── Reusable Error Fallback ─────────────────────────────────────────────────

interface ErrorFallbackProps {
  error?: Error | null;
  message?: string;
  onRetry?: () => void;
  actionLabel?: string;
  fullScreen?: boolean;
}

export function ErrorFallback({
  error,
  message,
  onRetry,
  actionLabel = "Try Again",
  fullScreen = false,
}: ErrorFallbackProps) {
  const displayMessage = message ?? error?.message ?? "Something went wrong";

  const content = (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="mb-4 rounded-full bg-[var(--color-danger-muted)] p-4">
        <AlertTriangle className="w-8 h-8 text-[var(--color-danger)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {displayMessage}
      </h3>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4 max-w-sm">
        An unexpected error occurred. Please try again.
      </p>
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-background)]">
        {content}
      </div>
    );
  }

  return content;
}
