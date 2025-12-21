import { EventCardSkeleton } from "@/components/ui/Skeleton";

export default function EventsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header Skeleton */}
      <div className="bg-gradient-to-r from-green-900 to-green-800 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="h-4 w-24 bg-green-700/50 rounded mb-4 animate-pulse" />
          <div className="h-12 w-80 bg-green-700/50 rounded mb-2 animate-pulse" />
          <div className="h-6 w-96 bg-green-700/50 rounded animate-pulse" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Filter Skeleton */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 h-11 bg-zinc-800 rounded-xl animate-pulse" />
            <div className="h-11 w-11 bg-zinc-800 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Results Count Skeleton */}
        <div className="h-5 w-40 bg-zinc-800 rounded mb-6 animate-pulse" />

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
