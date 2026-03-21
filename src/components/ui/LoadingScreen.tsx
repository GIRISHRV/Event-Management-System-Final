"use client";

import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  /** Message to display below the spinner */
  message?: string;
  /** When false, the component renders nothing */
  isLoading?: boolean;
  /** Full-screen overlay (fixed) vs inline block */
  fullScreen?: boolean;
  className?: string;
}

export function LoadingScreen({
  message = "Loading…",
  isLoading = true,
  fullScreen = true,
  className,
}: LoadingScreenProps) {
  if (!isLoading) return null;

  if (fullScreen) {
    return (
      <div
        className={cn(
          "fixed inset-0 flex flex-col items-center justify-center bg-[var(--color-background)]",
          className
        )}
        style={{ zIndex: "var(--z-fixed)" }}
      >
        <Loader2 className="w-8 h-8 text-[var(--color-brand)] animate-spin" />
        {message && (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16",
        className
      )}
    >
      <Loader2 className="w-8 h-8 text-[var(--color-brand)] animate-spin" />
      {message && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </p>
      )}
    </div>
  );
}
