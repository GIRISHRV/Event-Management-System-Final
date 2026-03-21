"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home, LucideIcon } from "lucide-react";
import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  backLink?: string;
  backLabel?: string;
  backIcon?: LucideIcon;
}

export function ErrorPage({
  error,
  reset,
  title = "Something went wrong",
  backLink = "/",
  backLabel = "Go Home",
  backIcon: BackIcon = Home,
}: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Error:", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-red-600/20 border border-red-600/30 rounded-md flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
          <p className="text-[var(--color-text-secondary)] leading-relaxed">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold rounded-md transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <Link
            href={backLink}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-white font-semibold rounded-md transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <BackIcon className="w-5 h-5" />
            {backLabel}
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 text-xs text-[var(--color-text-muted)] font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
