"use client";

import { Calendar } from "lucide-react";

export default function CustomerDashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Skeleton Nav */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="h-12 w-80 bg-zinc-800/50 rounded-full animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 pt-24">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8 bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
          <div>
            <div className="h-10 w-48 bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-5 w-64 bg-zinc-800/50 rounded animate-pulse" />
          </div>
          <div className="h-12 w-36 bg-zinc-800 rounded-lg animate-pulse" />
        </div>

        {/* Tab Skeleton */}
        <div className="flex space-x-1 mb-8 bg-zinc-800/60 rounded-xl p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-10 bg-zinc-700/50 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Event Cards Skeleton */}
        <div className="bg-zinc-950/90 rounded-xl border border-zinc-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800"
                style={{ aspectRatio: "3/4" }}
              >
                <div className="h-48 bg-zinc-800 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-6 w-3/4 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-zinc-800/50 rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-700" />
                    <div className="h-4 w-24 bg-zinc-800/50 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
