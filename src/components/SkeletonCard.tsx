import { Loader2 } from "lucide-react";

export function SkeletonCard() {
  return (
    <div className="relative bg-zinc-900 rounded-2xl overflow-hidden shadow-xl border border-zinc-800" style={{ aspectRatio: '3/4' }}>
      <div className="absolute inset-0 animate-pulse bg-zinc-800">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
        </div>
      </div>
      
      {/* Content Skeleton */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 space-y-3">
        {/* Date Badge Skeleton */}
        <div className="absolute top-6 right-6 w-14 h-14 bg-zinc-700/50 rounded-lg animate-pulse" />
        
        {/* Title Skeleton */}
        <div className="w-3/4 h-8 bg-zinc-700/50 rounded-md animate-pulse" />
        
        {/* Location Skeleton */}
        <div className="w-1/2 h-5 bg-zinc-700/50 rounded-md animate-pulse" />
      </div>
    </div>
  );
}
