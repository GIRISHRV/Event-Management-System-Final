"use client";

import { memo } from "react";

interface SkeletonProps {
  className?: string;
}

export const Skeleton = memo(function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-800/60 rounded ${className}`}
      aria-hidden="true"
    />
  );
});

export const EventCardSkeleton = memo(function EventCardSkeleton() {
  return (
    <div
      className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Image skeleton */}
      <Skeleton className="absolute inset-0" />

      {/* Date badge skeleton */}
      <div className="absolute top-4 right-4">
        <Skeleton className="w-14 h-14 rounded-lg" />
      </div>

      {/* Content skeleton */}
      <div className="absolute inset-x-0 bottom-0 p-6 space-y-3">
        <Skeleton className="w-3/4 h-7 rounded-md" />
        <Skeleton className="w-1/2 h-5 rounded-md" />
        <Skeleton className="w-1/3 h-4 rounded-md" />
      </div>
    </div>
  );
});

export const StatsCardSkeleton = memo(function StatsCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="w-20 h-4 rounded" />
          <Skeleton className="w-12 h-8 rounded" />
        </div>
        <Skeleton className="w-12 h-12 rounded-lg" />
      </div>
    </div>
  );
});

export const RecommendationCardSkeleton = memo(function RecommendationCardSkeleton() {
  return (
    <div className="bg-zinc-900/80 rounded-xl border border-zinc-700/50 overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="h-28 w-full" />
      {/* Content skeleton */}
      <div className="p-4 space-y-2">
        <Skeleton className="w-3/4 h-5 rounded" />
        <div className="flex gap-3">
          <Skeleton className="w-16 h-4 rounded" />
          <Skeleton className="w-16 h-4 rounded" />
        </div>
      </div>
    </div>
  );
});

export const RecentlyViewedSkeleton = memo(function RecentlyViewedSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-hidden pb-2">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-64 bg-zinc-900/80 rounded-xl border border-zinc-700/50 p-3"
        >
          <div className="flex gap-3">
            <Skeleton className="shrink-0 w-16 h-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-full h-4 rounded" />
              <Skeleton className="w-1/2 h-3 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export const EventListSkeleton = memo(function EventListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(count)].map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
});
