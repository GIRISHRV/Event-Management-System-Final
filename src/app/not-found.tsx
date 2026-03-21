"use client";

import Link from "next/link";
import { Home, ArrowLeft, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import Squares from "@/components/ui/Squares";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--color-background)] relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Squares
          speed={0.3}
          squareSize={40}
          direction="diagonal"
          borderColor="rgba(37, 99, 235, 0.1)"
          hoverFillColor="rgba(37, 99, 235, 0.05)"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* 404 Number */}
        <div className="mb-6">
          <h1 className="text-[120px] md:text-[150px] font-bold text-transparent bg-clip-text bg-gradient-to-b from-[var(--color-brand)] to-[var(--color-brand)]/20 leading-none select-none">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold text-[var(--color-text-primary)]">
            Page Not Found
          </h2>
          <p className="text-[var(--color-text-secondary)] text-base max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium rounded-md transition-all duration-200 border border-[var(--color-border)] hover:border-[var(--color-border-hover)] w-full sm:w-auto justify-center"
          >
            <ArrowLeft size={18} />
            Go Back
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-medium rounded-md transition-all duration-200 w-full sm:w-auto justify-center"
          >
            <Home size={18} />
            Back to Home
          </Link>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
          <p className="text-[var(--color-text-tertiary)] text-sm mb-3">Or try these popular pages:</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signin"
              className="text-[var(--color-brand)] hover:opacity-80 transition-opacity text-sm font-medium"
            >
              Sign In
            </Link>
            <span className="text-[var(--color-text-muted)]">&bull;</span>
            <Link
              href="/signup"
              className="text-[var(--color-brand)] hover:opacity-80 transition-opacity text-sm font-medium"
            >
              Create Account
            </Link>
            <span className="text-[var(--color-text-muted)]">&bull;</span>
            <Link
              href="/customer-dashboard"
              className="text-[var(--color-brand)] hover:opacity-80 transition-opacity text-sm font-medium flex items-center gap-1"
            >
              <Calendar size={14} />
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}