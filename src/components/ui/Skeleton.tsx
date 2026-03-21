import { cn } from "@/lib/cn";

// ─── Base Skeleton ───────────────────────────────────────────────────────────

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "block" | "circle" | "text";
}

function Skeleton({ className, variant = "block", ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--color-surface)]",
        variant === "circle" && "rounded-full",
        variant === "text" && "h-4 rounded-[var(--radius-sm)]",
        variant === "block" && "rounded-[var(--radius-md)]",
        className
      )}
      {...props}
    />
  );
}

// ─── Prebuilt Skeleton Patterns ──────────────────────────────────────────────

function EventCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      <Skeleton className="w-full aspect-[2/3]" />
      <div className="p-4 space-y-2">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2 h-3" />
      </div>
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton variant="text" className="w-1/3 h-3" />
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export {
  Skeleton,
  EventCardSkeleton,
  ListItemSkeleton,
  PageSkeleton,
  EventCardSkeleton as RecommendationCardSkeleton,
};
