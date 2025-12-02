"use client";

export default function VendorDashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Skeleton Nav */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="h-12 w-80 bg-zinc-800/50 rounded-full animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 pt-24">
        {/* Header Skeleton */}
        <div className="h-10 w-64 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="h-5 w-48 bg-zinc-800/50 rounded animate-pulse mb-8" />

        {/* Coming Soon Card Skeleton */}
        <div className="p-6 border border-zinc-700/50 rounded-xl bg-zinc-900/60">
          <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse mx-auto mb-4" />
          <div className="h-4 w-64 bg-zinc-800/50 rounded animate-pulse mx-auto" />
        </div>

        {/* User Info Skeleton */}
        <div className="mt-8 p-6 border border-zinc-700/50 rounded-xl bg-zinc-900/60">
          <div className="h-6 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-48 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-4 w-56 bg-zinc-800/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
