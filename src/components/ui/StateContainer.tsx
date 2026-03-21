"use client";

import { cn } from "@/lib/cn";
import { LoadingScreen } from "./LoadingScreen";
import { EmptyState } from "./EmptyState";
import { type LucideIcon } from "lucide-react";

/**
 * StateContainer — handles loading, empty, and error states for data-driven views.
 * Renders children only when data is available (not loading, not empty, no error).
 */
interface StateContainerProps {
  isLoading: boolean;
  isEmpty?: boolean;
  error?: string | null;
  /** Content to show when data is loaded */
  children: React.ReactNode;
  /** Loading message */
  loadingMessage?: string;
  /** Empty state config */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: string;
  onEmptyAction?: () => void;
  className?: string;
}

export function StateContainer({
  isLoading,
  isEmpty = false,
  error,
  children,
  loadingMessage = "Loading…",
  emptyTitle = "No items found",
  emptyDescription,
  emptyIcon,
  emptyAction,
  onEmptyAction,
  className,
}: StateContainerProps) {
  if (isLoading) {
    return (
      <LoadingScreen
        fullScreen={false}
        message={loadingMessage}
        isLoading
      />
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger-muted)] p-6 text-center",
          className
        )}
      >
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyAction}
        onAction={onEmptyAction}
        className={className}
      />
    );
  }

  return <div className={className}>{children}</div>;
}
