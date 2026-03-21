"use client";

import { Loader2 } from "lucide-react";

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = "Loading..." }: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-6">
          <Loader2 className="w-16 h-16 text-[var(--color-brand)] animate-spin mx-auto" />
          <div className="absolute inset-0 w-16 h-16 border-2 border-[var(--color-brand)]/20 rounded-full animate-pulse mx-auto"></div>
        </div>
        <p className="text-[var(--color-text-secondary)] font-medium text-lg">{message}</p>
      </div>
    </div>
  );
}
