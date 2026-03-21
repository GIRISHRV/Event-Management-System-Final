"use client";

import { Calendar, MapPin, Clock } from "lucide-react";

export default function EventLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Skeleton Nav */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="h-12 w-80 bg-[var(--color-surface)]/50 rounded-full animate-pulse" />
      </div>

      {/* Hero Skeleton */}
      <div className="relative h-[50vh] bg-[var(--color-surface)] animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-6xl mx-auto">
          <div className="h-12 w-3/4 bg-[var(--color-surface)] rounded animate-pulse mb-4" />
          <div className="flex gap-4">
            <div className="h-6 w-32 bg-[var(--color-surface)]/50 rounded animate-pulse" />
            <div className="h-6 w-40 bg-[var(--color-surface)]/50 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[Calendar, Clock, MapPin].map((Icon, i) => (
            <div
              key={i}
              className="bg-[var(--color-surface)]/50 rounded-md p-6 border border-[var(--color-border)]/50"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-brand)]/10 rounded-md">
                  <Icon className="w-6 h-6 text-[var(--color-brand)]/50" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-24 bg-[var(--color-surface)] rounded animate-pulse" />
                  <div className="h-4 w-32 bg-[var(--color-surface)]/50 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Description Skeleton */}
        <div className="bg-[var(--color-surface)]/50 rounded-md p-6 border border-[var(--color-border)]/50 mb-8">
          <div className="h-6 w-32 bg-[var(--color-surface)] rounded animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-[var(--color-surface)]/50 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-[var(--color-surface)]/50 rounded animate-pulse" />
            <div className="h-4 w-4/6 bg-[var(--color-surface)]/50 rounded animate-pulse" />
          </div>
        </div>

        {/* Gallery Skeleton */}
        <div className="bg-[var(--color-surface)]/50 rounded-md p-6 border border-[var(--color-border)]/50">
          <div className="h-6 w-24 bg-[var(--color-surface)] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square bg-[var(--color-surface)] rounded-md animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
