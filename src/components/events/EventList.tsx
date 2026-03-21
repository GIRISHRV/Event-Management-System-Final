"use client";

import { Building2 } from "lucide-react";
import { type EventRow } from "@/schemas/event.schema";
import { EventCard } from "@/components/events/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface EventListProps {
  events: EventRow[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  showFavorite?: boolean;
  onShare?: (event: EventRow, e: React.MouseEvent) => void;
  onToggleFavorite?: (event: EventRow, e: React.MouseEvent) => void;
  favorites?: Set<string>;
  onEdit?: (event: EventRow) => void;
  onDelete?: (eventId: string) => void;
  eventTrends?: Record<string, "increasing" | "decreasing" | "stable">;
}

// Hoisted outside the component so it is the same object reference on every
// render. The old `favorites = new Set()` default parameter created a brand-new
// Set on every render, causing EventCard to see a changed prop, re-render, and
// reset its isImageLoading state -- producing the image blink.
const EMPTY_FAVORITES = new Set<string>();

export function EventList({
  events,
  isLoading = false,
  emptyTitle = "No events mapped",
  emptyDescription = "There are no events to display matching your current view or filters.",
  showFavorite = false,
  onShare,
  onToggleFavorite,
  favorites = EMPTY_FAVORITES,
  onEdit,
  onDelete,
  eventTrends,
}: EventListProps) {

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full rounded-[var(--radius-lg)] shadow-sm" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] py-20 mt-4 shadow-sm">
        <EmptyState
          icon={Building2}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          showFavorite={showFavorite}
          isFavorite={favorites.has(event.id!)}
          onShare={onShare}
          onToggleFavorite={onToggleFavorite}
          onEdit={onEdit}
          onDelete={onDelete}
          trend={eventTrends?.[event.id!]}
          className="shadow-sm hover:shadow-xl transition-shadow duration-300"
        />
      ))}
    </div>
  );
}