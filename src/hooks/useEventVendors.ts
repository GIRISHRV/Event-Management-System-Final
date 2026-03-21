"use client";

import useSWR from "swr";
import { eventsService } from "@/services/events.service";

/**
 * Hook to fetch the formal roster of hired vendors for an event.
 */
export function useEventVendors(eventId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    eventId ? ["event-vendors", eventId] : null,
    async () => {
      if (!eventId) return null;
      const response = await eventsService.getEventVendors(eventId);
      if (!response.success) throw new Error(response.error?.message);
      return response.data;
    },
    { revalidateOnFocus: false }
  );

  return {
    hiredVendors: data || [],
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}
