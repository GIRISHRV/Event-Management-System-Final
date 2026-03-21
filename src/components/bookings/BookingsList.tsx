"use client";

import { useBookings } from "@/hooks/useBookings";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingStatusBadge } from "@/components/ui/StatusBadge";
import { Users } from "lucide-react";
import Image from "next/image";

interface BookingsListProps {
  eventId: string;
}

export function BookingsList({ eventId }: BookingsListProps) {
  const { attendees, isAttendeesLoading, attendeesError } = useBookings(eventId);

  if (isAttendeesLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="w-20 h-6 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (attendeesError) {
    return (
      <div className="p-4 rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-muted)] text-[var(--color-danger)] text-sm">
        Failed to load attendees.
      </div>
    );
  }

  if (!attendees || attendees.length === 0) {
    return (
      <EmptyState
        title="No RSVPs yet"
        description="Be the first to request to join this event."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-[var(--color-text-secondary)]" />
        <h3 className="text-[var(--color-text-primary)] font-medium">
          Attendees ({attendees.length})
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {attendees.map((attendee) => (
          <div 
            key={attendee.id} 
            className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[var(--color-background)] border border-[var(--color-border)] flex-shrink-0">
              {attendee.profiles?.avatar_url ? (
                <Image
                  src={attendee.profiles.avatar_url}
                  alt={attendee.profiles.name || 'Attendee'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] text-xs font-bold uppercase">
                  {attendee.profiles?.name?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {attendee.profiles?.name || 'Anonymous User'}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {new Date(attendee.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <BookingStatusBadge 
                status={attendee.status} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
