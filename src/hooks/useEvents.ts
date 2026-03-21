"use client";

import useSWR from "swr";
import { eventsService } from "@/services/events.service";
import type { PaginationParams } from "@/schemas/common.schema";

interface UseEventsOptions extends PaginationParams {
  userId?: string;
  visibility?: "public" | "private" | "whitelist";
  status?: "upcoming" | "ongoing" | "completed" | "cancelled";
}

// Stable fallback -- prevents returning a new [] on every render when data is
// undefined, which would change the reference seen by consumers and cause
// unnecessary re-renders / image blinks.
const EMPTY_EVENTS: never[] = [];

export function useEvents(options: UseEventsOptions = { page: 1, limit: 10 }) {
  // JSON.stringify makes the SWR key stable across renders.
  // Without this, every render passes a new object literal -> SWR sees a new
  // key -> sets isLoading=true -> EventList swaps to skeletons -> cards unmount
  // -> isImageLoading resets to true -> blink.
  const { data, error, isLoading, mutate } = useSWR(
    ["events", JSON.stringify(options)],
    async () => {
      const response = options.userId
        ? await eventsService.getMyEvents(options.userId, { page: options.page, limit: options.limit })
        : await eventsService.getPublicEvents({ page: options.page, limit: options.limit });

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch events");
      }

      return response.data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    events: data?.items ?? EMPTY_EVENTS,
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}

export function useEvent(eventId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    eventId ? ["event", eventId] : null,
    async () => {
      if (!eventId) return null;
      const response = await eventsService.getEventById(eventId);

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to fetch event");
      }

      return response.data;
    },
    {
      revalidateOnFocus: false,
    }
  );

  return {
    event: data || null,
    isLoading,
    error: error as Error | undefined,
    mutate,
  };
}

export function useMyEvents(userId: string | undefined, params: PaginationParams = { page: 1, limit: 10 }) {
  return useEvents(userId ? { ...params, userId } : undefined);
}

export function usePublicEvents(params: PaginationParams = { page: 1, limit: 9 }) {
  return useEvents({ ...params, visibility: "public" });
}